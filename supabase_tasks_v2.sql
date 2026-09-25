-- Tareas (Operaciones): mismo modelo de asignados/comentarios/adjuntos que
-- Tickets y Devs. YA APLICADO en el proyecto real (khuavhbraikzreyhptog) vía
-- Supabase MCP el 2026-09-25. Este archivo queda solo como referencia.
--
-- Se amplía el CHECK de entity_type en las tablas genéricas ya existentes
-- (entity_assignees, comments, attachments — ver supabase_devs_v2.sql) para
-- sumar 'task'. No hizo falta migrar datos: al momento de este cambio la
-- tabla `tasks` no tenía filas, y `task_comments` (el comentario viejo,
-- específico de Tareas) tampoco tenía datos. `task_comments` y
-- `tasks.assigned_to` quedan sin uso desde el frontend, sin borrarse
-- (mismo criterio no-destructivo del resto del repo).

alter table public.entity_assignees drop constraint entity_assignees_entity_type_check;
alter table public.entity_assignees add constraint entity_assignees_entity_type_check
  check (entity_type = any (array['ticket','dev_task','task']));

alter table public.comments drop constraint comments_entity_type_check;
alter table public.comments add constraint comments_entity_type_check
  check (entity_type = any (array['ticket','dev_task','task']));

alter table public.attachments drop constraint attachments_entity_type_check;
alter table public.attachments add constraint attachments_entity_type_check
  check (entity_type = any (array['ticket','dev_task','task']));
