-- Subtareas (checklist) de tickets, tareas de dev y tareas de operaciones. YA APLICADO en el
-- proyecto real (khuavhbraikzreyhptog) vía Supabase MCP el 2026-10-12. Solo referencia.
-- Mismo modelo genérico (entity_type, entity_id) que asignados/comentarios/adjuntos, y misma
-- política abierta: cualquier usuario autenticado puede crear, tildar, editar y borrar.
-- Al borrar un ticket/tarea el front también borra sus subtareas (no hay FK, igual que comentarios).

create table public.subtasks (
  id text primary key,
  entity_type text not null check (entity_type in ('ticket','dev_task','task')),
  entity_id text not null,
  title text not null check (length(trim(title)) > 0 and length(title) <= 300),
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index subtasks_entity on public.subtasks (entity_type, entity_id);

alter table public.subtasks enable row level security;
create policy "Todos los auth gestionan subtareas" on public.subtasks
  for all to authenticated using (true) with check (true);
