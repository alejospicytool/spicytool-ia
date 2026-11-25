-- Métricas: fecha del próximo cobro de cada suscripción. YA APLICADO en el proyecto real (khuavhbraikzreyhptog) vía Supabase MCP el 2026-11-25
-- (migración revenue_proximo_cobro). Solo referencia.
--  · current_period_end: cuándo vence el período actual = cuándo Stripe va a cobrar la próxima vez (en suscripciones en prueba, cuando termina la prueba).
--    Lo guarda la Edge Function revenue-sync cada vez que Stripe avisa un cambio (también al renovar) y en cada sincronización completa.
--  · cancel_at_period_end: la suscripción se cancela al final del período (no se va a renovar).
-- Las dos columnas son opcionales: las suscripciones canceladas o las que todavía no se sincronizaron quedan sin fecha.
alter table public.rev_subscriptions add column if not exists current_period_end timestamptz;
alter table public.rev_subscriptions add column if not exists cancel_at_period_end boolean not null default false;
create index if not exists rev_subscriptions_period_end_idx on public.rev_subscriptions (current_period_end) where current_period_end is not null;
