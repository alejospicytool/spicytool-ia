-- Preferencias del menú lateral de cada usuario: orden de las secciones y cuáles quedaron plegadas.
-- ESTADO: PENDIENTE de aplicar en el proyecto real (khuavhbraikzreyhptog). Cuando se aplique, anotarlo acá.
--
-- Una fila por usuario, y cada usuario solo puede leer y tocar la SUYA. Esto solo cambia cómo se ve el menú:
-- qué secciones puede ver cada uno lo siguen decidiendo los permisos (allowed_sections), no esta tabla.
-- Mientras la tabla no exista, la app guarda lo mismo en el navegador de cada persona (funciona igual, pero no viaja entre dispositivos).

create table if not exists public.user_menu_prefs (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  section_order      text[] not null default '{}',
  collapsed_sections text[] not null default '{}',
  updated_at         timestamptz not null default now(),
  constraint user_menu_prefs_size check (cardinality(section_order) <= 40 and cardinality(collapsed_sections) <= 40)
);

alter table public.user_menu_prefs enable row level security;

create policy "Menú: cada usuario lee el suyo"       on public.user_menu_prefs for select to authenticated using (user_id = auth.uid());
create policy "Menú: cada usuario crea el suyo"      on public.user_menu_prefs for insert to authenticated with check (user_id = auth.uid());
create policy "Menú: cada usuario actualiza el suyo" on public.user_menu_prefs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Menú: cada usuario borra el suyo"     on public.user_menu_prefs for delete to authenticated using (user_id = auth.uid());

revoke all on public.user_menu_prefs from anon;
