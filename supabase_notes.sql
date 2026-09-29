-- Sección "Notas": notas simples de equipo (accesos, URLs, procedimientos).
-- No guarda contraseñas — el frontend detecta contenido que parece una
-- contraseña/token/API key y avisa antes de guardar (ver looksLikeSecret en
-- src/App.jsx). YA APLICADO en el proyecto real (khuavhbraikzreyhptog) vía
-- Supabase MCP el 2026-09-29. Este archivo queda solo como referencia.

create table public.notes (
  id text primary key,
  title text not null,
  content text,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notes enable row level security;

-- Cualquier usuario del back office puede ver y crear notas.
create policy "Todos los auth leen notas" on public.notes
  for select to authenticated using (true);
create policy "Crear notas propias" on public.notes
  for insert to authenticated with check (author_id = auth.uid());

-- Editar y borrar: solo el autor o un admin.
create policy "Editar notas propias o si es admin" on public.notes
  for update to authenticated
  using (author_id = auth.uid() or get_my_role() = 'admin')
  with check (author_id = auth.uid() or get_my_role() = 'admin');
create policy "Borrar notas propias o si es admin" on public.notes
  for delete to authenticated
  using (author_id = auth.uid() or get_my_role() = 'admin');
