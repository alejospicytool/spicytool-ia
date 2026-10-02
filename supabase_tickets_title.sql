-- Tickets: separar "título" de "cliente". Hasta ahora client_name se usaba
-- como título del ticket (el formulario lo llamaba "Cliente / Empresa" pero
-- la gente cargaba el resumen del problema ahí). YA APLICADO en el proyecto
-- real (khuavhbraikzreyhptog) vía Supabase MCP el 2026-10-02. Solo referencia.
--
-- title       = título del ticket (obligatorio)
-- client_name = cliente/empresa real (ahora opcional)
-- Los valores viejos de client_name eran títulos: se copiaron a title y
-- client_name quedó en null para los tickets existentes.

alter table public.tickets add column title text;
update public.tickets set title = client_name;
alter table public.tickets alter column title set not null;
alter table public.tickets alter column client_name drop not null;
update public.tickets set client_name = null;
