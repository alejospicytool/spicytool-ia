-- Chequeo nocturno de revenue. REFERENCIA: se corre UNA VEZ en el SQL editor de Supabase, después de aplicar
-- supabase_revenue.sql y de subir la función `revenue-sync`. pg_cron trabaja en UTC: 06:00 UTC = 03:00 Argentina.
--
-- 1) Guardar el secret en el Vault (el MISMO valor que el secret REVENUE_CRON_SECRET de la Edge Function).
--    Reemplazar <TEXTO-LARGO-AL-AZAR> a mano al correrlo; NO commitear el valor real.
--      select vault.create_secret('<TEXTO-LARGO-AL-AZAR>', 'revenue_cron_secret');
--
-- 2) Programar la corrida diaria:
select cron.schedule(
  'revenue-reconcile-nightly',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://khuavhbraikzreyhptog.supabase.co/functions/v1/revenue-sync/reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-revenue-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'revenue_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
-- Ver que quedó:      select jobid, jobname, schedule, active from cron.job where jobname = 'revenue-reconcile-nightly';
-- Quitarlo:           select cron.unschedule('revenue-reconcile-nightly');
-- Resultado de cada corrida: tabla rev_sync_runs (se muestra en Métricas).
