-- Balance — límite diario de usos de la IA por usuario y tarea ('scan' = escaneo de tickets, 'chat', 'parse').
-- Solo cuenta usos: no guarda ni preguntas, ni respuestas, ni imágenes. Solo la usa la Edge Function `api`
-- con el rol de servicio; las apps no tienen acceso.

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('scan', 'chat', 'parse')),
  day date not null,
  uses integer not null default 0 check (uses >= 0),
  primary key (user_id, kind, day)
);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
grant select, insert, update, delete on public.ai_usage to service_role;

-- Reserva un uso. Devuelve los usos que quedan hoy, o -1 si ya se alcanzó el límite. Atómico.
create or replace function public.ai_consume(p_user_id uuid, p_kind text, p_day date, p_limit integer)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_uses integer;
begin
  insert into public.ai_usage as u (user_id, kind, day, uses)
  values (p_user_id, p_kind, p_day, 1)
  on conflict (user_id, kind, day) do update set uses = u.uses + 1
    where u.uses < p_limit
  returning u.uses into v_uses;
  if v_uses is null then
    return -1;
  end if;
  return p_limit - v_uses;
end;
$$;

-- Devuelve un uso reservado (la IA falló y no se gastó el cupo del usuario).
create or replace function public.ai_refund(p_user_id uuid, p_kind text, p_day date)
returns void
language sql
set search_path = ''
as $$
  update public.ai_usage set uses = greatest(0, uses - 1)
  where user_id = p_user_id and kind = p_kind and day = p_day;
$$;

revoke execute on function public.ai_consume(uuid, text, date, integer) from public, anon, authenticated;
revoke execute on function public.ai_refund(uuid, text, date) from public, anon, authenticated;
grant execute on function public.ai_consume(uuid, text, date, integer) to service_role;
grant execute on function public.ai_refund(uuid, text, date) to service_role;
