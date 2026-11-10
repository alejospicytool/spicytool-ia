-- Métricas de revenue, parte 2: segmento por cliente y pagos fallidos. Migración "revenue_segment_and_failed_payments".
-- Se aplica DESPUÉS de supabase_revenue.sql. Solo agrega estructura; no toca datos.
--
-- segment: 'inmobiliaria' | 'otro' | null (sin segmento). Lo elige un admin a mano desde la pantalla Clientes.
-- Es lo ÚNICO que un admin puede escribir en rev_customers desde el front (el MRR lo escribe solo rev_apply_mrr).

alter table public.rev_customers add column segment text check (segment in ('inmobiliaria','otro'));

-- Por qué se canceló una suscripción de Stripe (cancellation_details.reason). 'payment_failed' = churn involuntario.
alter table public.rev_subscriptions add column cancel_reason text;

-- Una fila por factura con pago fallido. La carga la hace la Edge Function (webhook invoice.* y chequeo nocturno).
create table public.rev_payment_failures (
  invoice_id text primary key,
  customer_key text not null references public.rev_customers(key) on delete cascade,
  subscription_id text,                         -- 'stripe:sub_xxx'
  amount_due numeric(14,2) not null default 0,  -- en la moneda de la factura
  currency text not null default 'usd',
  attempt_count int not null default 1,
  next_attempt_at timestamptz,                  -- próximo reintento automático de Stripe (null si no hay más)
  failure_code text,                            -- ej. card_declined, insufficient_funds
  failure_message text,
  hosted_invoice_url text,
  status text not null default 'open' check (status in ('open','recovered','void','uncollectible')),
  first_failed_at timestamptz not null default now(),
  last_failed_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);
create index rev_payment_failures_status_idx on public.rev_payment_failures (status, last_failed_at desc);
create index rev_payment_failures_customer_idx on public.rev_payment_failures (customer_key);

alter table public.rev_payment_failures enable row level security;
create policy "Revenue: admins leen pagos fallidos" on public.rev_payment_failures for select to authenticated using (public.is_admin());
revoke all on public.rev_payment_failures from anon;

-- Segmento: un admin puede cambiar SOLO esa columna de rev_customers
revoke update on public.rev_customers from authenticated;
grant update (segment) on public.rev_customers to authenticated;
create policy "Revenue: admins asignan segmento" on public.rev_customers for update to authenticated using (public.is_admin()) with check (public.is_admin());
