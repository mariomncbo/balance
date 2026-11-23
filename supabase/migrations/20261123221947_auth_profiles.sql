-- Balance — perfiles al registrarse y límite de intentos de login.

-- Esquema privado: no se expone en la API de datos.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ───────────────────────── Perfil automático al registrarse ─────────────────────────
-- La app llama a signUp con options.data = { name, username }. Esos metadatos solo
-- se usan para rellenar el perfil, nunca para autorizar nada.
-- Si el nombre de usuario no es válido o ya existe, el registro falla entero.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(new.raw_user_meta_data ->> 'name', ''));
  v_username text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
begin
  if v_username !~ '^[a-z0-9._]{3,30}$' then
    raise exception 'username_invalid' using errcode = '22023';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'name_invalid' using errcode = '22023';
  end if;
  insert into public.profiles (id, name, username, email)
  values (new.id, v_name, v_username, lower(new.email));
  return new;
exception
  when unique_violation then
    raise exception 'username_taken' using errcode = '23505';
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Si el usuario cambia de correo en Auth, se refleja en el perfil.
create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;

revoke execute on function private.handle_user_email_change() from public, anon, authenticated;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- ───────────────────────── Límite de intentos de login ─────────────────────────
-- Clave: el nombre de usuario (en minúsculas). Solo la usa la Edge Function `auth`
-- con el rol de servicio; las apps no tienen acceso.

create table public.login_attempts (
  username text primary key,
  failures smallint not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz
);

alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;

-- Registra un fallo y devuelve hasta cuándo queda bloqueado (null si no lo está).
-- 5 fallos en 15 minutos → 15 minutos de bloqueo.
create or replace function public.register_login_failure(p_username text)
returns timestamptz
language plpgsql
set search_path = ''
as $$
declare
  v_failures smallint;
  v_locked timestamptz;
begin
  insert into public.login_attempts as la (username, failures, window_start)
  values (p_username, 1, now())
  on conflict (username) do update
    set failures = case when la.window_start < now() - interval '15 minutes' then 1 else la.failures + 1 end,
        window_start = case when la.window_start < now() - interval '15 minutes' then now() else la.window_start end
  returning la.failures into v_failures;

  if v_failures >= 5 then
    update public.login_attempts
      set locked_until = now() + interval '15 minutes', failures = 0, window_start = now()
      where username = p_username
      returning locked_until into v_locked;
  end if;
  return v_locked;
end;
$$;

revoke execute on function public.register_login_failure(text) from public, anon, authenticated;
grant execute on function public.register_login_failure(text) to service_role;
