-- Balance — esquema base.
-- Solo nombre, nombre de usuario y correo van en claro (profiles).
-- El resto de datos del usuario se guarda cifrado (AES-256-GCM) en `payload`.
-- Las tablas cifradas NO son accesibles desde las apps: solo las Edge Functions
-- (con la clave secreta) leen y escriben en ellas, filtrando siempre por user_id.

-- ───────────────────────── Utilidades ─────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ───────────────────────── Perfil (en claro) ─────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  username text not null check (username ~ '^[a-z0-9._]{3,30}$'),
  email text not null check (char_length(email) <= 254),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_username_key on public.profiles (username);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Cada usuario solo puede leer su propio perfil. Altas y cambios: Edge Functions.
create policy "profiles: leer el propio"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- ───────────────────────── Claves por usuario ─────────────────────────
-- Clave de datos (DEK) de cada usuario, cifrada con la clave maestra.

create table public.user_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  wrapped_key text not null,
  key_version smallint not null default 1,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Tablas cifradas ─────────────────────────
-- Todas: id generado por la Edge Function (UUIDv7, ordenado en el tiempo),
-- user_id para filtrar, payload cifrado y fechas técnicas.

create table public.accounts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index accounts_user_id_idx on public.accounts (user_id);

create table public.transactions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete cascade,
  payload text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transactions_user_id_idx on public.transactions (user_id);
create index transactions_account_id_idx on public.transactions (account_id);

-- Fijos: ingresos fijos, gastos fijos y préstamos.
create table public.recurring (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recurring_user_id_idx on public.recurring (user_id);

create table public.goals (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index goals_user_id_idx on public.goals (user_id);

-- Un informe por usuario y mes. `month` es el primer día del mes.
create table public.monthly_reports (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  payload text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

-- Ajustes del usuario que deban sincronizarse entre dispositivos.
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload text not null,
  updated_at timestamptz not null default now()
);

-- Clave personal del Atajo de iPhone: solo se guarda su hash (SHA-256).
create table public.shortcut_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create unique index shortcut_tokens_token_hash_key on public.shortcut_tokens (token_hash);

-- Triggers de updated_at
create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
create trigger recurring_set_updated_at before update on public.recurring
  for each row execute function public.set_updated_at();
create trigger goals_set_updated_at before update on public.goals
  for each row execute function public.set_updated_at();
create trigger monthly_reports_set_updated_at before update on public.monthly_reports
  for each row execute function public.set_updated_at();
create trigger user_settings_set_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ───────────────────────── Acceso ─────────────────────────
-- RLS activado y sin políticas: las apps (anon/authenticated) no pueden leer
-- ni escribir. Además se retiran los privilegios por si se expone la tabla.

alter table public.user_keys enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.recurring enable row level security;
alter table public.goals enable row level security;
alter table public.monthly_reports enable row level security;
alter table public.user_settings enable row level security;
alter table public.shortcut_tokens enable row level security;

revoke all on
  public.user_keys,
  public.accounts,
  public.transactions,
  public.recurring,
  public.goals,
  public.monthly_reports,
  public.user_settings,
  public.shortcut_tokens
from anon, authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
