-- Tablas del módulo de Tareas (sección Operaciones).
-- YA APLICADO en el proyecto real (khuavhbraikzreyhptog) vía Supabase MCP el 2026-09-18.
-- Este archivo queda solo como referencia/documentación del esquema.
--
-- Módulo separado del de Tickets — no comparte tabla ni esquema con `tickets`.
-- Mismo criterio de RLS que Tickets: cualquier usuario autenticado (admin o
-- reader) puede crear/editar/mover tareas y comentarios.

create table if not exists public.tasks (
  id text primary key,
  title text not null,
  start_date date not null,
  end_date date not null,
  assigned_to text,
  priority text not null default 'Media',   -- 'Alta' | 'Media' | 'Baja'
  stage text not null default 'Sin Empezar', -- 'Sin Empezar' | 'Urgentes' | 'Stand By' | 'En Curso' | 'Escalado' | 'Finalizado' | 'Archivado'
  description text,
  created_at timestamptz not null default now(),
  constraint tasks_date_range check (end_date >= start_date)
);

-- Hilo de comentarios de cada tarea — tabla relacionada, no un campo simple.
create table if not exists public.task_comments (
  id text primary key,
  task_id text not null references public.tasks(id) on delete cascade,
  author text not null,   -- email del usuario logueado que comenta
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;

create policy "Todos los auth pueden gestionar tareas" on public.tasks
  for all to authenticated using (true) with check (true);

create policy "Todos los auth pueden gestionar comentarios de tareas" on public.task_comments
  for all to authenticated using (true) with check (true);
