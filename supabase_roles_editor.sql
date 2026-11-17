-- Rol "editor" y reglas de escritura/lectura por rol y por sección.
-- ESTADO: YA APLICADO en el proyecto real (khuavhbraikzreyhptog) vía Supabase MCP el 2026-11-17 (probado antes en una transacción que se deshizo). Este archivo queda como referencia.
--
-- ROLES
--   admin   todo.
--   dev     tickets, tareas, tareas de devs, onboarding y sus comentarios/adjuntos/asignados: crear, editar y BORRAR (como hasta ahora).
--   editor  lo mismo pero SIN borrar.
--   reader  solo lectura en esas tablas.
-- LECTURA DE FINANZAS (antes la podía leer cualquier usuario con sesión, aunque no viera el menú):
--   transactions / accounts / categories → solo admin o quien tenga la sección 'Finanzas' o 'Referidos' (Referidos las usa para las comisiones).
--   referrers / referred_clients / referred_client_payments → solo admin o 'Referidos'.
--   revenue_customers / revenue_customer_mrr (tablas viejas, ya no se usan) → solo admin o 'Métricas'.
-- La escritura de Finanzas, Referidos, Métricas, roles y permisos ya era solo de admins: no se toca.
-- Lucas (escobedolucas123@gmail.com) y marketing@spicytool.net pasan de reader a editor para seguir trabajando igual que hasta hoy.

begin;

-- 1) El rol nuevo
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check check (role = any (array['admin','dev','editor','reader']));
update public.user_roles set role = 'editor' where role = 'reader' and lower(email) in ('escobedolucas123@gmail.com', 'marketing@spicytool.net');

-- 2) Quién puede escribir y quién borrar en las tablas de trabajo
create or replace function public.can_write_ops() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.get_my_role() in ('admin', 'dev', 'editor')
$$;
create or replace function public.can_delete_ops() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.get_my_role() in ('admin', 'dev')
$$;
revoke all on function public.can_write_ops(), public.can_delete_ops() from public, anon;
grant execute on function public.can_write_ops(), public.can_delete_ops() to authenticated;

-- 3) Tablas de trabajo: leer todos los usuarios con sesión; crear y editar admin/dev/editor; borrar admin/dev
do $$
declare t text; old text;
begin
  for t, old in select * from (values
    ('attachments',              'Todos los auth gestionan adjuntos'),
    ('clients',                  'Todos los auth pueden gestionar clientes'),
    ('dev_task_status_history',  'Todos los auth pueden leer y crear historial dev_tasks'),
    ('dev_tasks',                'Todos los auth pueden gestionar dev_tasks'),
    ('entity_assignees',         'Todos los auth gestionan asignados'),
    ('onboarding',               'Todos los auth pueden gestionar onboarding'),
    ('onboarding_stage_history', 'Todos los auth pueden gestionar historial de onboarding'),
    ('subtasks',                 'Todos los auth gestionan subtareas'),
    ('task_comments',            'Todos los auth pueden gestionar comentarios de tareas'),
    ('tasks',                    'Todos los auth pueden gestionar tareas'),
    ('ticket_status_history',    'Todos los auth pueden leer y crear historial'),
    ('tickets',                  'Todos los auth pueden gestionar tickets')
  ) as v(t, old)
  loop
    execute format('drop policy if exists %I on public.%I', old, t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', 'Trabajo: leer', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_write_ops())', 'Trabajo: crear (admin, dev, editor)', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_write_ops()) with check (public.can_write_ops())', 'Trabajo: editar (admin, dev, editor)', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_delete_ops())', 'Trabajo: borrar (admin, dev)', t);
  end loop;
end $$;

-- 4) Lectura de Finanzas y Referidos: solo con la sección (o admin)
drop policy if exists "Todos los auth pueden leer transacciones" on public.transactions;
drop policy if exists "Todos los auth pueden leer cuentas" on public.accounts;
drop policy if exists "Todos los auth pueden leer categorías" on public.categories;
create policy "Finanzas: leer con sección Finanzas o Referidos" on public.transactions for select to authenticated using (public.has_section('Finanzas') or public.has_section('Referidos'));
create policy "Finanzas: leer con sección Finanzas o Referidos" on public.accounts     for select to authenticated using (public.has_section('Finanzas') or public.has_section('Referidos'));
create policy "Finanzas: leer con sección Finanzas o Referidos" on public.categories   for select to authenticated using (public.has_section('Finanzas') or public.has_section('Referidos'));

drop policy if exists "Todos los auth pueden leer referidores" on public.referrers;
drop policy if exists "Todos los auth pueden leer clientes referidos" on public.referred_clients;
drop policy if exists "Todos los auth pueden leer pagos de clientes referidos" on public.referred_client_payments;
create policy "Referidos: leer con sección Referidos" on public.referrers                for select to authenticated using (public.has_section('Referidos'));
create policy "Referidos: leer con sección Referidos" on public.referred_clients         for select to authenticated using (public.has_section('Referidos'));
create policy "Referidos: leer con sección Referidos" on public.referred_client_payments for select to authenticated using (public.has_section('Referidos'));

drop policy if exists "Todos los auth pueden leer revenue_customers" on public.revenue_customers;
drop policy if exists "Todos los auth pueden leer revenue_customer_mrr" on public.revenue_customer_mrr;
create policy "Métricas viejas: leer con sección Métricas" on public.revenue_customers    for select to authenticated using (public.has_section('Métricas'));
create policy "Métricas viejas: leer con sección Métricas" on public.revenue_customer_mrr for select to authenticated using (public.has_section('Métricas'));

commit;
