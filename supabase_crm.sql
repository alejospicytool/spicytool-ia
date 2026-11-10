-- CRM comercial. YA APLICADO en el proyecto real (khuavhbraikzreyhptog) vía Supabase MCP el
-- 2026-11-10 (migración crm_comercial_tables). Solo referencia. Los DATOS no están en git:
-- se importan con `python3 scripts/crm-import.py` desde _import/crm-datos.json (ver ese script).
--
-- Cada deal / tarea es una fila con el objeto JSON original completo en `data` (se respetan todos
-- los campos: hist, trail, calif, promo*, cal*, etc.). `version` detecta ediciones simultáneas: el
-- front actualiza con "where id = ? and version = <la que leyó>" y suma 1.
-- Acceso: admins o quienes tengan la sección "CRM" en allowed_sections (validado en la base).

create or replace function public.has_crm_access() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.get_my_role() = 'admin'
    or exists (select 1 from public.allowed_sections a where a.user_id = auth.uid() and a.section = 'CRM')
  )
$$;
revoke all on function public.has_crm_access() from public, anon;
grant execute on function public.has_crm_access() to authenticated;

create table public.crm_config (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create table public.crm_deals (
  id text primary key,
  data jsonb not null check (data ->> 'id' = id),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create table public.crm_tasks (
  id text primary key,
  data jsonb not null check (data ->> 'id' = id),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create or replace function public.crm_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
create trigger crm_config_touch before update on public.crm_config for each row execute function public.crm_touch();
create trigger crm_deals_touch  before update on public.crm_deals  for each row execute function public.crm_touch();
create trigger crm_tasks_touch  before update on public.crm_tasks  for each row execute function public.crm_touch();

alter table public.crm_config enable row level security;
alter table public.crm_deals  enable row level security;
alter table public.crm_tasks  enable row level security;
create policy "CRM: acceso a config" on public.crm_config for all to authenticated using (public.has_crm_access()) with check (public.has_crm_access());
create policy "CRM: acceso a deals"  on public.crm_deals  for all to authenticated using (public.has_crm_access()) with check (public.has_crm_access());
create policy "CRM: acceso a tareas" on public.crm_tasks  for all to authenticated using (public.has_crm_access()) with check (public.has_crm_access());
revoke all on public.crm_config, public.crm_deals, public.crm_tasks from anon;
