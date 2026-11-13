-- Permisos por usuario para Métricas y Admin Spicy (se asignan desde Configuración → Usuarios y permisos).
-- ESTADO: YA APLICADO en el proyecto real (khuavhbraikzreyhptog) vía Supabase MCP el 2026-11-13. Este archivo queda como referencia.
--
-- Modelo (usa la tabla allowed_sections que ya existe; no hay tablas nuevas):
--   · 'Métricas'                → puede LEER las tablas rev_* (MRR, churn, retención, pagos fallidos, clientes). Solo lectura:
--                                  las escrituras (clasificar planes, tipos de cambio, segmentos, sync) siguen siendo solo de admins.
--   · 'Admin Spicy'             → puede LEER usuarios, companies y la auditoría. El servidor (server/auth.js) lo exige además.
--   · 'Admin Spicy: acciones'   → además puede ejecutar acciones (pausar/activar, editar, asignar plan = COBRA tarjetas reales).
--                                  Exige también 'Admin Spicy'. Solo puede registrar auditoría a su propio nombre.
-- Los admins siguen viendo y haciendo todo. Todo es ADITIVO salvo las dos políticas de admin_audit, que se reemplazan.

begin;

-- Mismo patrón que has_crm_access(): admin, o tiene la sección en allowed_sections.
create or replace function public.has_section(p_section text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.get_my_role() = 'admin'
    or exists (select 1 from public.allowed_sections a where a.user_id = auth.uid() and a.section = p_section)
  )
$$;
revoke all on function public.has_section(text) from public, anon;
grant execute on function public.has_section(text) to authenticated;

-- Métricas: lectura de las tablas que usa el panel (las políticas de admin existentes no se tocan).
create policy "Revenue: lectura con sección Métricas" on public.rev_plans            for select to authenticated using (public.has_section('Métricas'));
create policy "Revenue: lectura con sección Métricas" on public.rev_customers        for select to authenticated using (public.has_section('Métricas'));
create policy "Revenue: lectura con sección Métricas" on public.rev_subscriptions    for select to authenticated using (public.has_section('Métricas'));
create policy "Revenue: lectura con sección Métricas" on public.rev_mrr_events       for select to authenticated using (public.has_section('Métricas'));
create policy "Revenue: lectura con sección Métricas" on public.rev_fx_rates         for select to authenticated using (public.has_section('Métricas'));
create policy "Revenue: lectura con sección Métricas" on public.rev_manual_audit     for select to authenticated using (public.has_section('Métricas'));
create policy "Revenue: lectura con sección Métricas" on public.rev_history_monthly  for select to authenticated using (public.has_section('Métricas'));
create policy "Revenue: lectura con sección Métricas" on public.rev_sync_runs        for select to authenticated using (public.has_section('Métricas'));
create policy "Revenue: lectura con sección Métricas" on public.rev_payment_failures for select to authenticated using (public.has_section('Métricas'));

-- Auditoría de Admin Spicy: la lee quien tiene la sección; la escribe quien tiene acciones, siempre a su propio nombre.
drop policy if exists "Admins leen la auditoria" on public.admin_audit;
create policy "Auditoría: lectura con sección Admin Spicy" on public.admin_audit
  for select to authenticated using (public.has_section('Admin Spicy'));

drop policy if exists "Admins registran sus acciones" on public.admin_audit;
create policy "Auditoría: registra quien tiene acciones" on public.admin_audit
  for insert to authenticated
  with check (public.has_section('Admin Spicy: acciones') and lower(actor) = lower(auth.jwt() ->> 'email'));

commit;
