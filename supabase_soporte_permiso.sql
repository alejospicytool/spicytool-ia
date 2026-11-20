-- Permiso "Admin Spicy: soporte": quién puede usar "Entrar como usuario" (abre la cuenta de un cliente).
-- ESTADO: YA APLICADO en el proyecto real (khuavhbraikzreyhptog) el 2026-11-20.
-- No hace falta ningún cambio de tablas: es una fila más en allowed_sections (se asigna desde Configuración → Usuarios y permisos,
-- columna "Admin Spicy · soporte"). Los admins pueden siempre; los demás necesitan 'Admin Spicy', 'Admin Spicy: acciones' y esta.
-- La auditoría ya deja escribir a quien tiene 'Admin Spicy: acciones' (supabase_permisos_metricas_admin.sql), así que no se toca.
-- Se le dio a Ticiana (marketing@spicytool.net) y a Lucas (escobedolucas123@gmail.com).
insert into public.allowed_sections (user_id, section)
select r.user_id, 'Admin Spicy: soporte'
from public.user_roles r
where r.email in ('marketing@spicytool.net', 'escobedolucas123@gmail.com')
  and exists (select 1 from public.allowed_sections a where a.user_id = r.user_id and a.section = 'Admin Spicy: acciones')
on conflict do nothing;
