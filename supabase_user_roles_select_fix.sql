-- Fix: la política original de user_roles ("Solo admins gestionan roles",
-- ALL) bloqueaba también el SELECT para no-admins, dejando allUsers vacío
-- para cualquier reader o dev — rompía el selector de "Responsable" en
-- Tickets/Devs/Tareas (el picker no tenía a quién mostrar). YA APLICADO en
-- el proyecto real (khuavhbraikzreyhptog) vía Supabase MCP el 2026-09-30.
-- Este archivo queda solo como referencia.
--
-- Modelo de permisos vigente: el único privilegio exclusivo de admin es
-- gestionar secciones/roles (panel de Usuarios — user_roles, allowed_sections).
-- Todo lo demás (editar tickets/tareas de dev/tareas de operaciones, asignar
-- responsable, comentar, adjuntar archivos, editar el puntaje Fibonacci) es
-- igual para admin/dev/reader.

drop policy "Solo admins gestionan roles" on public.user_roles;

create policy "Todos los auth leen usuarios" on public.user_roles
  for select to authenticated using (true);

create policy "Solo admins escriben roles" on public.user_roles
  for insert to authenticated with check (get_my_role() = 'admin');

create policy "Solo admins actualizan roles" on public.user_roles
  for update to authenticated using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

create policy "Solo admins borran roles" on public.user_roles
  for delete to authenticated using (get_my_role() = 'admin');
