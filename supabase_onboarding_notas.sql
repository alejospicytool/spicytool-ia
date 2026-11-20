-- Onboarding: notas de seguimiento por cliente (reuniones, llamadas, pendientes).
-- ESTADO: PENDIENTE DE APLICAR.
--
-- Reutiliza la tabla `comments` (la misma de Tickets y Tareas: autor, fecha, editar/borrar solo las propias).
-- Solo hace falta permitir el tipo 'onboarding' y limpiar las notas cuando se borra un onboarding.
-- No cambia permisos: leer = cualquier usuario con sesión; escribir/editar/borrar = solo el autor de cada nota.

begin;

alter table public.comments drop constraint if exists comments_entity_type_check;
alter table public.comments add constraint comments_entity_type_check
  check (entity_type in ('ticket', 'dev_task', 'task', 'onboarding'));

-- Al borrar un onboarding se borran también sus notas (la tabla comments no tiene clave foránea al ser genérica).
create or replace function public.onboarding_delete_notes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.comments where entity_type = 'onboarding' and entity_id = old.id;
  return old;
end $$;
revoke all on function public.onboarding_delete_notes() from public, anon;

drop trigger if exists onboarding_delete_notes on public.onboarding;
create trigger onboarding_delete_notes after delete on public.onboarding
  for each row execute function public.onboarding_delete_notes();

commit;
