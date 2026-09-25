-- Devs: multi-asignado, comentarios, adjuntos, vínculo tarea↔ticket.
-- YA APLICADO en el proyecto real (khuavhbraikzreyhptog) vía Supabase MCP el 2026-09-25.
-- Este archivo queda solo como referencia/documentación del esquema (igual criterio
-- que supabase_tickets.sql / supabase_tasks.sql / supabase_onboarding.sql / supabase_tickets_v2.sql).
--
-- Todo genérico por (entity_type, entity_id) con entity_type in ('ticket','dev_task'),
-- para que Tickets y la sección Devs usen exactamente el mismo dato y los mismos
-- componentes de frontend (AssigneesPicker, CommentsThread, AttachmentsList).

-- Asignados (múltiples por entidad). Reemplaza tickets.assigned_to / dev_tasks.assigned_to
-- (texto libre) como fuente de verdad; esas columnas quedan sin uso, no se borran
-- (mismo criterio no-destructivo del resto del repo).
create table public.entity_assignees (
  id text primary key,
  entity_type text not null check (entity_type in ('ticket','dev_task')),
  entity_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, user_id)
);
alter table public.entity_assignees enable row level security;
create policy "Todos los auth gestionan asignados" on public.entity_assignees
  for all to authenticated using (true) with check (true);

-- Comentarios. Lectura y creación abiertas a cualquier autenticado (mismo criterio que
-- el resto de Operaciones); edición/borrado restringidos al autor, enforced por RLS
-- (author_id = auth.uid()), no solo en la UI.
create table public.comments (
  id text primary key,
  entity_type text not null check (entity_type in ('ticket','dev_task')),
  entity_id text not null,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_email text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
alter table public.comments enable row level security;
create policy "Todos los auth leen comentarios" on public.comments
  for select to authenticated using (true);
create policy "Crear comentarios propios" on public.comments
  for insert to authenticated with check (author_id = auth.uid());
create policy "Editar solo comentarios propios" on public.comments
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "Borrar solo comentarios propios" on public.comments
  for delete to authenticated using (author_id = auth.uid());

-- Adjuntos: metadata en esta tabla, el archivo va al bucket privado 'attachments'.
create table public.attachments (
  id text primary key,
  entity_type text not null check (entity_type in ('ticket','dev_task')),
  entity_id text not null,
  file_name text not null,
  storage_path text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by text,
  created_at timestamptz not null default now()
);
alter table public.attachments enable row level security;
create policy "Todos los auth gestionan adjuntos" on public.attachments
  for all to authenticated using (true) with check (true);

-- Bucket privado, mismo patrón que 'invoices' (nunca URL pública permanente — el
-- frontend siempre pide una signed URL al vuelo, ver uploadInvoice/viewInvoice en
-- src/App.jsx). Límite 20MB por archivo; tipos permitidos: imágenes, PDF, video corto,
-- texto plano (logs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments','attachments', false, 20971520,
  array['image/jpeg','image/png','image/gif','image/webp','application/pdf','video/mp4','video/webm','video/quicktime','text/plain']);
create policy "Todos los auth leen adjuntos" on storage.objects
  for select to authenticated using (bucket_id = 'attachments');
create policy "Todos los auth suben adjuntos" on storage.objects
  for insert to authenticated with check (bucket_id = 'attachments');
create policy "Todos los auth borran adjuntos" on storage.objects
  for delete to authenticated using (bucket_id = 'attachments');

-- Vínculo opcional: una tarea de dev puede nacer de un ticket.
alter table public.dev_tasks add column if not exists ticket_id text references public.tickets(id) on delete set null;

-- Migración best-effort de tickets.assigned_to a entity_assignees: al momento de este
-- cambio el único ticket real tenía assigned_to='Ticiana', que no coincide con ningún
-- usuario registrado en user_roles (Alejo, Nico Eliceche, nicolas@spicytool.net) — no
-- hay match, no se crea ninguna fila. dev_tasks no tenía filas.
