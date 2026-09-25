-- Reestructura de Tickets + tareas de desarrollo de producto (Devs).
-- YA APLICADO en el proyecto real (khuavhbraikzreyhptog) vía Supabase MCP el 2026-09-25.
-- Este archivo queda solo como referencia/documentación del esquema (igual criterio
-- que supabase_tickets.sql / supabase_tasks.sql / supabase_onboarding.sql).
--
-- Cambios sobre supabase_tickets.sql:
-- - Nuevos estados de ticket (10, ver TICKET_STATUSES en src/App.jsx) reemplazando
--   los 7 anteriores. El único ticket real que existía (categoría "Error bloqueante",
--   estado "🚨 Urgente") se migró a categoría "Bloqueante", estado "Inicio".
-- - Categorías renombradas: "Error bloqueante" → "Bloqueante", "Error funcional" → "Funcional"
--   (las otras tres quedan igual).
-- - `first_response_at`/`resolved_at` dejan de escribirse desde el frontend: las fechas
--   de cierre ahora salen de `ticket_status_history`, no de "última edición". Las columnas
--   quedan en la tabla sin uso (mismo criterio que `client_id` en tickets: no se hacen
--   migraciones destructivas sobre columnas existentes).

-- Puntaje de esfuerzo (Fibonacci). Nace null; obligatorio en el frontend al pasar a
-- cualquier estado "En curso" (En Curso, En DEV, Revision).
alter table public.tickets add column if not exists fibonacci_score int
  check (fibonacci_score in (1,2,3,5,8,13,21));

-- Historial de cambios de estado, con fecha y usuario — reemplaza el stamping manual
-- de first_response_at/resolved_at como fuente de verdad para cycle time / tiempo de
-- resolución. Mismo patrón que onboarding_stage_history.
create table public.ticket_status_history (
  id text primary key,
  ticket_id text not null references public.tickets(id) on delete cascade,
  status text not null,
  changed_by text,              -- email del usuario que hizo el cambio
  changed_at timestamptz not null default now()
);
alter table public.ticket_status_history enable row level security;
create policy "Todos los auth pueden leer y crear historial" on public.ticket_status_history
  for all to authenticated using (true) with check (true);

-- Tareas de desarrollo de producto (sección Devs) — no existían en ningún sistema
-- antes de esto, se crean desde cero acá. Mismo criterio de RLS abierta que tickets.
create table public.dev_tasks (
  id text primary key,
  title text not null,
  description text,
  stage text not null default 'Backlog',   -- Backlog | Por Hacer | In Progress | Testing | Done
  assigned_to text,                         -- nombre para mostrar de un usuario de user_roles (mismo criterio que tickets.assigned_to)
  fibonacci_score int check (fibonacci_score in (1,2,3,5,8,13,21)),
  created_at timestamptz not null default now()
);
create table public.dev_task_status_history (
  id text primary key,
  dev_task_id text not null references public.dev_tasks(id) on delete cascade,
  stage text not null,
  changed_by text,
  changed_at timestamptz not null default now()
);
alter table public.dev_tasks enable row level security;
alter table public.dev_task_status_history enable row level security;
create policy "Todos los auth pueden gestionar dev_tasks" on public.dev_tasks
  for all to authenticated using (true) with check (true);
create policy "Todos los auth pueden leer y crear historial dev_tasks" on public.dev_task_status_history
  for all to authenticated using (true) with check (true);

-- Nuevo rol 'dev' (además de admin/reader). No es superset de admin: es un rol aparte
-- que habilita edición del campo fibonacci_score (ver trigger más abajo).
alter table public.user_roles drop constraint user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role = any (array['admin','reader','dev']));

-- Solo dev o admin pueden tocar fibonacci_score, a nivel base de datos (no solo en la
-- UI). Se permite también admin, no solo dev, para poder corregir datos si hace falta.
create or replace function public.check_fibonacci_edit_permission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.fibonacci_score is distinct from old.fibonacci_score then
    if get_my_role() not in ('dev','admin') then
      raise exception 'solo usuarios dev o admin pueden editar el puntaje fibonacci';
    end if;
  end if;
  return new;
end;
$$;

create trigger tickets_fibonacci_permission
  before update on public.tickets
  for each row execute function public.check_fibonacci_edit_permission();

create trigger dev_tasks_fibonacci_permission
  before update on public.dev_tasks
  for each row execute function public.check_fibonacci_edit_permission();

-- Migración del único ticket real que existía al momento de este cambio.
update public.tickets
  set status = 'Inicio', category = 'Bloqueante'
  where status = '🚨 Urgente';
update public.tickets set category = 'Bloqueante' where category = 'Error bloqueante';
update public.tickets set category = 'Funcional' where category = 'Error funcional';
