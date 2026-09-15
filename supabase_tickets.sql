-- Tablas del sistema de tickets (sección Operaciones).
-- YA APLICADO en el proyecto real (khuavhbraikzreyhptog) vía Supabase MCP el 2026-09-14.
-- Este archivo queda solo como referencia/documentación del esquema.
--
-- A diferencia del resto de las tablas de la app (donde solo 'admin' puede escribir,
-- vía la función get_my_role()), acá cualquier usuario autenticado (admin o reader)
-- puede crear/editar/mover tickets y clientes — decisión tomada explícitamente porque
-- el equipo de operaciones/soporte puede tener rol 'reader'.

create table if not exists public.clients (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id text primary key,
  client_id text references public.clients(id),
  category text not null,             -- 'Error bloqueante' | 'Error funcional' | 'Duda de uso' | 'Mejora' | 'Administrativo'
  priority text not null default 'Media',   -- 'Alta' | 'Media' | 'Baja'
  status text not null default 'Inicio por OPS',
  channel text not null,              -- 'WhatsApp' | 'Email'
  message text,
  assigned_to text,
  resolution_note text,
  created_at timestamptz not null default now(),
  first_response_at timestamptz,
  resolved_at timestamptz
);

alter table public.clients enable row level security;
alter table public.tickets enable row level security;

create policy "Todos los auth pueden gestionar clientes" on public.clients
  for all to authenticated using (true) with check (true);

create policy "Todos los auth pueden gestionar tickets" on public.tickets
  for all to authenticated using (true) with check (true);
