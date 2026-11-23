-- Ideas y feedback: sugerencias, feedback de clientes y cosas nuevas para sumar. Las puede cargar, ver, comentar y votar CUALQUIER usuario con sesión
-- (no depende de la sección Devs); ordenarlas (estado, descartar, "Enviar a Devs") solo admin, dev y editor (can_write_ops).
-- ESTADO: YA APLICADO en el proyecto real (khuavhbraikzreyhptog) el 2026-11-23 (probado antes en una transacción que se deshizo, con usuarios reales).
--
-- ideas:       una fila por idea. status: nueva | evaluacion | enviada | descartada. "Hecha" no se guarda: se calcula cuando la tarea de dev vinculada llega a Done.
--              dev_task_id: la tarea que se creó en Devs al "Enviar a Devs" (si esa tarea se borra queda en null).
-- idea_votes:  un voto 👍 por persona y por idea.
-- idea_images: capturas/imágenes de la idea. El archivo va al bucket privado 'attachments' (carpeta ideas/…); acá solo los datos.
-- Comentarios: se reutiliza la tabla comments (entity_type 'idea'): lectura abierta y cada uno edita/borra solo los suyos.
--
-- Permisos (RLS):
--   · Cualquiera lee todo y carga ideas (a su nombre, siempre en estado 'nueva'), vota y sube imágenes a su nombre.
--   · El autor puede editar o borrar SU idea mientras siga en 'nueva'.
--   · Cambiar el estado, vincular la tarea y descartar: can_write_ops (admin, dev, editor). Borrar cualquiera: can_delete_ops (admin, dev).

begin;

create table if not exists public.ideas (
  id text primary key,
  title text not null check (char_length(title) between 3 and 120),
  description text check (description is null or char_length(description) <= 4000),
  type text not null default 'funcion' check (type in ('funcion', 'mejora', 'feedback', 'problema')),
  requested_by text check (requested_by is null or char_length(requested_by) <= 120),   -- "pedido por": alguien del equipo, un cliente, etc.
  status text not null default 'nueva' check (status in ('nueva', 'evaluacion', 'enviada', 'descartada')),
  author_id uuid not null references auth.users(id),
  author_email text not null,
  dev_task_id text references public.dev_tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ideas_status_created on public.ideas (status, created_at desc);

create table if not exists public.idea_votes (
  idea_id text not null references public.ideas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

create table if not exists public.idea_images (
  id text primary key,
  idea_id text not null references public.ideas(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idea_images_idea on public.idea_images (idea_id);

alter table public.ideas enable row level security;
alter table public.idea_votes enable row level security;
alter table public.idea_images enable row level security;

drop policy if exists "Ideas: leer" on public.ideas;
drop policy if exists "Ideas: cargar a nombre propio" on public.ideas;
drop policy if exists "Ideas: el autor edita la suya mientras es nueva" on public.ideas;
drop policy if exists "Ideas: ordenar (admin, dev, editor)" on public.ideas;
drop policy if exists "Ideas: borrar la propia si es nueva, o admin/dev" on public.ideas;
create policy "Ideas: leer" on public.ideas for select to authenticated using (true);
create policy "Ideas: cargar a nombre propio" on public.ideas for insert to authenticated
  with check (author_id = auth.uid() and lower(author_email) = lower(auth.jwt() ->> 'email') and status = 'nueva' and dev_task_id is null);
create policy "Ideas: el autor edita la suya mientras es nueva" on public.ideas for update to authenticated
  using (author_id = auth.uid() and status = 'nueva')
  with check (author_id = auth.uid() and status = 'nueva' and dev_task_id is null);
create policy "Ideas: ordenar (admin, dev, editor)" on public.ideas for update to authenticated
  using (public.can_write_ops()) with check (public.can_write_ops());
create policy "Ideas: borrar la propia si es nueva, o admin/dev" on public.ideas for delete to authenticated
  using ((author_id = auth.uid() and status = 'nueva') or public.can_delete_ops());

drop policy if exists "Votos: leer" on public.idea_votes;
drop policy if exists "Votos: votar a nombre propio" on public.idea_votes;
drop policy if exists "Votos: quitar el propio" on public.idea_votes;
create policy "Votos: leer" on public.idea_votes for select to authenticated using (true);
create policy "Votos: votar a nombre propio" on public.idea_votes for insert to authenticated with check (user_id = auth.uid());
create policy "Votos: quitar el propio" on public.idea_votes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Imágenes de ideas: leer" on public.idea_images;
drop policy if exists "Imágenes de ideas: subir a nombre propio" on public.idea_images;
drop policy if exists "Imágenes de ideas: borrar la propia o admin/dev" on public.idea_images;
create policy "Imágenes de ideas: leer" on public.idea_images for select to authenticated using (true);
create policy "Imágenes de ideas: subir a nombre propio" on public.idea_images for insert to authenticated with check (uploaded_by_id = auth.uid());
create policy "Imágenes de ideas: borrar la propia o admin/dev" on public.idea_images for delete to authenticated
  using (uploaded_by_id = auth.uid() or public.can_delete_ops());

-- updated_at automático al cambiar una idea
create or replace function public.ideas_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists ideas_touch on public.ideas;
create trigger ideas_touch before update on public.ideas for each row execute function public.ideas_touch();

-- Comentarios: permitir el tipo 'idea' y borrar los comentarios de una idea cuando se borra la idea
alter table public.comments drop constraint if exists comments_entity_type_check;
alter table public.comments add constraint comments_entity_type_check
  check (entity_type in ('ticket', 'dev_task', 'task', 'onboarding', 'idea'));

create or replace function public.ideas_delete_comments() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.comments where entity_type = 'idea' and entity_id = old.id;
  return old;
end $$;
revoke all on function public.ideas_delete_comments() from public, anon, authenticated;
drop trigger if exists ideas_delete_comments on public.ideas;
create trigger ideas_delete_comments after delete on public.ideas for each row execute function public.ideas_delete_comments();

commit;
