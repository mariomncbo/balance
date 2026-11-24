-- Atajo de iPhone: datos para la Edge Function `shortcut` (pública, se autentica con la clave del Atajo).
--
-- shortcut_tokens ya guarda solo el hash SHA-256 de la clave. Se añade:
--   token_hint          últimos 4 caracteres de la clave, para reconocerla en la app ("bal_••••3f9a")
--   account_id          cuenta por defecto donde apuntar los pagos (opcional)
--   window_start/count  límite de peticiones por hora
--   last_fingerprint    HMAC del último pago (nunca el pago en claro) para no apuntarlo dos veces
-- Ninguna de estas columnas contiene datos financieros del usuario en claro.

alter table public.shortcut_tokens
  add column token_hint text,
  add column account_id uuid references public.accounts (id) on delete set null,
  add column window_start timestamptz not null default now(),
  add column window_count integer not null default 0 check (window_count >= 0),
  add column last_fingerprint text,
  add column last_fingerprint_at timestamptz;

create index shortcut_tokens_account_id_idx on public.shortcut_tokens (account_id);

-- Valida la clave y aplica, en una sola operación atómica, el límite por hora y la deduplicación.
-- Devuelve out_status: 'ok' | 'invalid' | 'limited' | 'duplicate'.
create or replace function public.shortcut_consume(p_token_hash text, p_fingerprint text, p_limit integer default 30)
returns table (out_status text, out_user_id uuid, out_account_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.shortcut_tokens%rowtype;
begin
  select * into r from public.shortcut_tokens t where t.token_hash = p_token_hash for update;
  if not found then
    return query select 'invalid'::text, null::uuid, null::uuid;
    return;
  end if;

  if r.window_start < now() - interval '1 hour' then
    r.window_start := now();
    r.window_count := 0;
  end if;

  if r.window_count >= p_limit then
    return query select 'limited'::text, r.user_id, r.account_id;
    return;
  end if;

  if p_fingerprint is not null and r.last_fingerprint = p_fingerprint
     and r.last_fingerprint_at > now() - interval '2 minutes' then
    return query select 'duplicate'::text, r.user_id, r.account_id;
    return;
  end if;

  update public.shortcut_tokens t
     set window_start = r.window_start,
         window_count = r.window_count + 1,
         last_used_at = now(),
         last_fingerprint = p_fingerprint,
         last_fingerprint_at = now()
   where t.user_id = r.user_id;

  return query select 'ok'::text, r.user_id, r.account_id;
end;
$$;

revoke execute on function public.shortcut_consume(text, text, integer) from public, anon, authenticated;
grant execute on function public.shortcut_consume(text, text, integer) to service_role;
