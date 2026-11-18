-- Métricas: los editores (y devs) con la sección 'Métricas' también pueden asignar el segmento de cada cliente.
-- ESTADO: YA APLICADO en el proyecto real (khuavhbraikzreyhptog) el 2026-11-18 (probado antes en una transacción que se deshizo).
-- Solo cambia quién puede actualizar rev_customers.segment. La columna sigue siendo la ÚNICA actualizable desde la app
-- (grant update (segment), ver supabase_revenue_v2.sql): MRR, planes, tipos de cambio y sincronizaciones siguen siendo solo de admins.
-- Un reader sigue sin poder.
drop policy if exists "Revenue: admins asignan segmento" on public.rev_customers;
drop policy if exists "Revenue: asignar segmento (admin o editor con Métricas)" on public.rev_customers;
create policy "Revenue: asignar segmento (admin o editor con Métricas)" on public.rev_customers for update to authenticated
  using (public.is_admin() or (public.get_my_role() in ('editor','dev') and public.has_section('Métricas')))
  with check (public.is_admin() or (public.get_my_role() in ('editor','dev') and public.has_section('Métricas')));
