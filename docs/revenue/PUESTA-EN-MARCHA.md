# Métricas de revenue: cómo quedó adaptado a este repo

Los archivos `mrr.js`, `engine.js`, `stripe-sync.js`, `webhook.js`, `reconcile.js`, `manual.js` y `test-mrr.js` de esta carpeta son el **código de referencia original** (Express + MongoDB) y no se usan. La versión real vive en:

| Pieza | Dónde |
|---|---|
| Tablas `rev_*`, permisos (solo admin) y función atómica `rev_apply_mrr` | `supabase_revenue.sql` (tests: `supabase_tests/revenue_test.sql`) |
| Webhook de Stripe, chequeo nocturno, carga manual | `supabase/functions/revenue-sync/index.ts` (tests: `revenue-sync.test.js`) |
| Cron nocturno (pg_cron) | `supabase_revenue_cron.sql` |
| Cálculo de métricas del panel | `src/revenue/revenueMetrics.js` |
| Sección "Métricas" (solo admins) | `src/revenue/RevenueApp.jsx` |
| Carga del histórico de ChartMogul | `scripts/revenue-import.py` |

El histórico (`chartmogul_historico_mensual.json`) tiene ingresos reales y el repo es público: está en `.gitignore`, no se sube.

## Puesta en marcha (en este orden)

1. **Base:** pegar `supabase_revenue.sql` en Supabase → SQL editor. Después pegar `supabase_tests/revenue_test.sql`: tiene que terminar con `revenue_test: OK` (corre dentro de una transacción con ROLLBACK, no deja datos).
2. **Histórico:** `python3 scripts/revenue-import.py` y pegar `_import/revenue-history.sql` en el SQL editor.
3. **Stripe:** crear una clave **restringida de solo lectura** (Customers, Subscriptions, Prices, Products, Coupons). No usar la `sk_live` completa del Worker.
4. **Función:** Supabase → Edge Functions → crear `revenue-sync` pegando `index.ts`. **Desactivar "Enforce JWT Verification"** (Stripe y el cron no mandan JWT; la seguridad la dan la firma, el secret del cron y el chequeo de admin). Secrets: `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `REVENUE_CRON_SECRET`.
5. **Webhook:** Stripe → Developers → Webhooks → endpoint `https://khuavhbraikzreyhptog.supabase.co/functions/v1/revenue-sync/stripe` con `customer.subscription.created`, `.updated` y `.deleted`. Su signing secret va en `STRIPE_WEBHOOK_SECRET`.
6. **Backoffice → Métricas → Resumen → "Puesta en marcha":**
   1. *Traer de Stripe* (trae todo sin calcular MRR).
   2. *Planes*: clasificar cada plan (SaaS suma al MRR; pass-through, servicio y test no) y cargar tipos de cambio si hay cobros que no son en USD.
   3. *Hacer carga inicial*: registra el MRR de hoy como punto de partida. Se rehúsa si quedan planes sin clasificar y solo se puede hacer una vez.
7. **Cron nocturno:** correr `supabase_revenue_cron.sql` (con el mismo `REVENUE_CRON_SECRET` en el Vault).
8. **Comparar** el MRR con ChartMogul antes de apagarlo (se esperan diferencias: ChartMogul sumaba planes que no son SaaS).

Hasta la carga inicial, ni el webhook, ni el chequeo nocturno, ni la carga manual registran movimientos: guardan los datos y listo.

## Diferencias con el código de referencia

- **Orden de puesta en marcha.** La referencia hace la carga inicial *antes* de clasificar los planes; como los planes nuevos valen 0, al clasificar después toda la base habría salido como "nuevos". Acá: traer → clasificar → carga inicial.
- **Atomicidad.** Los movimientos se registran en una función SQL con un bloqueo por cliente: dos webhooks simultáneos del mismo cliente no duplican movimientos.
- **Descuentos de monto fijo (`amount_off`).** Son por factura: se llevan a mensual con el intervalo de cobro (una suscripción anual con USD 120 de descuento resta USD 10/mes). La referencia restaba el monto entero.
- **Cupones.** Soporta las dos formas de la API de Stripe (`discount.coupon` y `discount.source.coupon`) y resuelve cupones que vienen solo como id.
- **Errores por cliente.** Si a un cliente le falta el tipo de cambio, el chequeo sigue con el resto y deja el error registrado (se ve en Métricas), en vez de frenar todo.
- **Bajas perdidas.** Si Stripe ya no tiene una suscripción (404), se da por cancelada en vez de romper el chequeo.
- **Precios medidos o escalonados** (sin monto fijo) suman 0 y no inventan un número.
- **Registro de corridas** (`rev_sync_runs`) para mostrar avisos: planes sin clasificar, clientes con error, bajas perdidas, y "el chequeo nocturno no corrió".
- **Firma del webhook** verificada con WebCrypto (sin SDK de Stripe) y con tolerancia de 5 minutos.

## Limitaciones conocidas (igual que la referencia)

- Un solo cupón por suscripción; cupones por ítem o varios a la vez no se contemplan.
- Los `trialing` no suman hasta pasar a `active`; `past_due` sí suma (no hay churn automático por pago vencido).
- La carga manual maneja un precio por suscripción.
- Una sola cuenta de Stripe.
- El histórico de ChartMogul incluye planes que no son SaaS, así que no es estrictamente comparable con el sistema nuevo.
