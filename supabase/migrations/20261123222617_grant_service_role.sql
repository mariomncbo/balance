-- Balance — permisos del rol de servicio.
-- En este proyecto las tablas nuevas no reciben permisos automáticos (ajuste de la Data API),
-- así que se conceden de forma explícita. Solo service_role (las Edge Functions) los recibe;
-- anon y authenticated siguen sin acceso a las tablas cifradas.
-- (La migración 20261123222144_service_role_grants quedó vacía por un fallo al escribirla.)

grant select, insert, update, delete on
  public.profiles,
  public.user_keys,
  public.accounts,
  public.transactions,
  public.recurring,
  public.goals,
  public.monthly_reports,
  public.user_settings,
  public.shortcut_tokens,
  public.login_attempts
to service_role;
