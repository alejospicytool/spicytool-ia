-- Ficha 360 del cliente: vínculos confirmados por una persona entre una cuenta de Spicytool (company_id) y datos que viven en otros lados.
-- ESTADO: YA APLICADO en el proyecto real (khuavhbraikzreyhptog) el 2026-11-23 (probado antes en una transacción que se deshizo, con usuarios reales).
--
-- kind:
--   rev_customer  → ref = rev_customers.key (el cliente de Métricas/Stripe, p. ej. "stripe:cus_…")
--   crm_deal      → ref = crm_deals.id (el deal del CRM de donde vino)
--   ticket_client → ref = el texto de tickets.client_name tal cual está escrito (los tickets se cargan a mano, sin id de cliente)
-- unique (kind, ref): un cliente de Métricas, un deal o un nombre de ticket pertenece a UNA sola cuenta.
-- Las sugerencias (mismo email, nombre parecido) las calcula la app; acá solo queda lo que alguien confirmó.
-- Permisos: leer = cualquier usuario con sesión; vincular y desvincular = admin, dev y editor (can_write_ops). No hay política de update.

begin;

create table if not exists public.client_links (
  id text primary key,
  company_id text not null,
  kind text not null check (kind in ('rev_customer', 'crm_deal', 'ticket_client')),
  ref text not null check (char_length(ref) between 1 and 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kind, ref)
);
create index if not exists client_links_company on public.client_links (company_id);

alter table public.client_links enable row level security;

drop policy if exists "Vínculos: leer" on public.client_links;
drop policy if exists "Vínculos: crear a nombre propio (admin, dev, editor)" on public.client_links;
drop policy if exists "Vínculos: quitar (admin, dev, editor)" on public.client_links;
create policy "Vínculos: leer" on public.client_links for select to authenticated using (true);
create policy "Vínculos: crear a nombre propio (admin, dev, editor)" on public.client_links for insert to authenticated
  with check (public.can_write_ops() and created_by = auth.uid());
create policy "Vínculos: quitar (admin, dev, editor)" on public.client_links for delete to authenticated using (public.can_write_ops());

commit;
