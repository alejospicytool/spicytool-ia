-- Métricas de revenue (reemplazo de ChartMogul). Migración "revenue_metrics_tables".
-- Se aplica en Supabase (SQL editor o MCP). Solo estructura: los DATOS salen de Stripe (webhook +
-- chequeo nocturno), de la carga manual y del histórico de ChartMogul (no va a git, ver scripts/revenue-import.py).
--
-- Acceso: SOLO admins pueden leer. Las escrituras las hace la Edge Function `revenue-sync` con la
-- service_role (que se saltea RLS); el único permiso de escritura para admins desde el front es
-- clasificar planes (rev_plans.category / counts_in_mrr).
-- Las tablas viejas revenue_customers / revenue_customer_mrr (vacías, sin uso) NO se tocan.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.get_my_role() = 'admin'
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Planes / precios de Stripe (y planes manuales). Los nuevos entran sin clasificar y NO suman al MRR.
create table public.rev_plans (
  price_id text primary key,
  name text,
  category text not null default 'sin_clasificar'
    check (category in ('sin_clasificar','saas','pass_through','servicio','test')),
  counts_in_mrr boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table public.rev_customers (
  key text primary key,                       -- 'stripe:cus_xxx' o 'manual:<uuid>'
  name text,
  email text,
  source text not null check (source in ('stripe','manual')),
  company_id text,
  country text,
  mrr numeric(14,2) not null default 0,
  ever_paid boolean not null default false,
  first_paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rev_subscriptions (
  id text primary key,                        -- 'stripe:sub_xxx' o 'manual:<uuid>'
  customer_key text not null references public.rev_customers(key) on delete cascade,
  source text not null check (source in ('stripe','manual')),
  status text not null,
  currency text not null default 'usd',
  items jsonb not null default '[]',          -- [{priceId, productName, unitAmount, quantity, interval, intervalCount}]
  discount jsonb,                             -- {percentOff, amountOff, endsAt}
  canceled_at timestamptz,
  updated_at timestamptz not null default now()
);
create index rev_subscriptions_customer_idx on public.rev_subscriptions (customer_key);

create table public.rev_mrr_events (
  id bigint generated always as identity primary key,
  customer_key text not null references public.rev_customers(key) on delete cascade,
  date timestamptz not null default now(),
  type text not null check (type in ('new','expansion','contraction','churn','reactivation','baseline')),
  mrr_before numeric(14,2) not null,
  mrr_after numeric(14,2) not null,
  delta numeric(14,2) not null,
  baseline boolean not null default false,    -- true solo en la carga inicial: no cuenta como "new"
  cause text
);
create index rev_mrr_events_customer_idx on public.rev_mrr_events (customer_key, date desc);
create index rev_mrr_events_date_idx on public.rev_mrr_events (date, type);

create table public.rev_fx_rates (
  currency text primary key,                  -- 'ars', 'eur'... (minúscula)
  rate numeric not null check (rate > 0),     -- a USD
  updated_at timestamptz not null default now()
);

-- Webhooks ya recibidos (Stripe puede mandar el mismo evento más de una vez)
create table public.rev_stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  result jsonb
);

-- Auditoría de la carga manual: quién cambió qué y cuándo
create table public.rev_manual_audit (
  id bigint generated always as identity primary key,
  subscription_id text not null,
  before jsonb,
  after jsonb,
  user_id uuid references auth.users(id) on delete set null,
  at timestamptz not null default now()
);

-- Histórico mensual exportado de ChartMogul (agregado, sin clientes). `data` = fila original completa.
create table public.rev_history_monthly (
  month text primary key check (month ~ '^\d{4}-\d{2}$'),
  data jsonb not null,
  source text not null default 'chartmogul'
);

-- Registro de cada corrida del chequeo (nocturno o manual): alimenta los avisos de la sección Métricas
create table public.rev_sync_runs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null check (kind in ('reconcile','baseline','recompute')),
  fixes int not null default 0,          -- clientes cuyo MRR se corrigió
  stale int not null default 0,          -- suscripciones que se habían perdido por webhook
  unclassified int not null default 0,   -- planes sin clasificar
  errors jsonb not null default '[]'     -- [{customerKey, error}]
);
create index rev_sync_runs_at_idx on public.rev_sync_runs (at desc);

create or replace function public.rev_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
create trigger rev_plans_touch before update on public.rev_plans for each row execute function public.rev_touch();

-- Tipo de movimiento. Igual que classify() del módulo de referencia.
create or replace function public.rev_classify(p_before numeric, p_after numeric, p_ever_paid boolean)
returns text language sql immutable as $$
  select case
    when p_before = 0 and p_after > 0 then case when p_ever_paid then 'reactivation' else 'new' end
    when p_before > 0 and p_after = 0 then 'churn'
    when p_after > p_before then 'expansion'
    when p_after < p_before then 'contraction'
    else null end
$$;

-- Aplica el MRR ya calculado de un cliente y registra el movimiento, de forma atómica.
-- Un bloqueo por cliente evita que dos webhooks simultáneos dupliquen movimientos.
-- Cambios del mismo cliente dentro de 1 hora se consolidan en un solo movimiento (ej. cambio de plan).
-- baseline = true solo en la carga inicial. Devuelve null si no cambió nada.
create or replace function public.rev_apply_mrr(
  p_key text, p_after numeric, p_cause text default 'sync', p_baseline boolean default false,
  p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.rev_customers%rowtype;
  v_before numeric; v_after numeric := round(p_after, 2);
  rec public.rev_mrr_events%rowtype; v_type text; v_ever boolean;
begin
  perform pg_advisory_xact_lock(hashtext('rev:' || p_key));
  select * into c from public.rev_customers where key = p_key for update;
  if not found then raise exception 'cliente_inexistente: %', p_key; end if;
  v_before := c.mrr; v_ever := c.ever_paid;
  if v_before = v_after then return null; end if;

  if not p_baseline then
    select * into rec from public.rev_mrr_events
      where customer_key = p_key and not baseline and date >= p_now - interval '1 hour'
      order by date desc, id desc limit 1;
  end if;

  if rec.id is not null then
    -- ¿había pagado alguna vez ANTES del movimiento reciente?
    v_type := public.rev_classify(rec.mrr_before, v_after, rec.type <> 'new');
    if v_type is null then
      delete from public.rev_mrr_events where id = rec.id;   -- se anuló: volvió al MRR original
      if rec.type = 'new' then v_ever := false; end if;
    else
      update public.rev_mrr_events
        set type = v_type, mrr_after = v_after, delta = round(v_after - rec.mrr_before, 2), cause = p_cause
        where id = rec.id;
    end if;
  else
    insert into public.rev_mrr_events (customer_key, date, type, mrr_before, mrr_after, delta, baseline, cause)
    values (p_key, p_now,
            case when p_baseline then 'baseline' else public.rev_classify(v_before, v_after, v_ever) end,
            v_before, v_after, round(v_after - v_before, 2), p_baseline, p_cause);
  end if;

  update public.rev_customers set
    mrr = v_after, updated_at = p_now,
    ever_paid = case when v_after > 0 then true else v_ever end,
    first_paid_at = case when v_after > 0 and not v_ever then p_now
                         when not v_ever then null else first_paid_at end
  where key = p_key;
  return jsonb_build_object('customerKey', p_key, 'before', v_before, 'after', v_after);
end $$;
revoke all on function public.rev_apply_mrr(text, numeric, text, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.rev_apply_mrr(text, numeric, text, boolean, timestamptz) to service_role;

-- RLS: lectura solo admins; el resto lo escribe la service_role
alter table public.rev_plans           enable row level security;
alter table public.rev_customers       enable row level security;
alter table public.rev_subscriptions   enable row level security;
alter table public.rev_mrr_events      enable row level security;
alter table public.rev_fx_rates        enable row level security;
alter table public.rev_stripe_events   enable row level security;
alter table public.rev_manual_audit    enable row level security;
alter table public.rev_history_monthly enable row level security;
alter table public.rev_sync_runs       enable row level security;

create policy "Revenue: admins leen planes"    on public.rev_plans           for select to authenticated using (public.is_admin());
create policy "Revenue: admins clasifican planes" on public.rev_plans        for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Revenue: admins leen clientes"  on public.rev_customers       for select to authenticated using (public.is_admin());
create policy "Revenue: admins leen suscripciones" on public.rev_subscriptions for select to authenticated using (public.is_admin());
create policy "Revenue: admins leen movimientos" on public.rev_mrr_events    for select to authenticated using (public.is_admin());
create policy "Revenue: admins leen tipos de cambio" on public.rev_fx_rates  for select to authenticated using (public.is_admin());
create policy "Revenue: admins leen auditoría" on public.rev_manual_audit    for select to authenticated using (public.is_admin());
create policy "Revenue: admins leen histórico" on public.rev_history_monthly for select to authenticated using (public.is_admin());
create policy "Revenue: admins leen corridas" on public.rev_sync_runs for select to authenticated using (public.is_admin());
-- rev_stripe_events: sin políticas (solo la service_role)

revoke all on public.rev_plans, public.rev_customers, public.rev_subscriptions, public.rev_mrr_events,
  public.rev_fx_rates, public.rev_stripe_events, public.rev_manual_audit, public.rev_history_monthly, public.rev_sync_runs from anon;
revoke insert, delete on public.rev_plans from authenticated;
