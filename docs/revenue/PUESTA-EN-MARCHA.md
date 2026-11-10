# Métricas de revenue: cómo quedó adaptado a este repo

Los archivos `mrr.js`, `engine.js`, `stripe-sync.js`, `webhook.js`, `reconcile.js`, `manual.js` y `test-mrr.js` de esta carpeta son el **código de referencia original** (Express + MongoDB) y no se usan. La versión real vive en:

| Pieza | Dónde |
|---|---|
| Tablas `rev_*`, permisos (solo admin) y función atómica `rev_apply_mrr` | `supabase_revenue.sql` (tests: `supabase_tests/revenue_test.sql`) |
| Segmento por cliente y pagos fallidos | `supabase_revenue_v2.sql` (tests: `supabase_tests/revenue_v2_test.sql`) |
| Webhook de Stripe, chequeo nocturno, carga manual | `supabase/functions/revenue-sync/index.ts` (tests: `revenue-sync.test.js`) |
| Cron nocturno (pg_cron) | `supabase_revenue_cron.sql` |
| Cálculo de métricas del panel (MRR, churn %, retención, proyección, pagos fallidos) | `src/revenue/revenueMetrics.js` |
| Sección "Métricas" (solo admins): Overview, MRR & ARR, Churn, Retención, Pagos fallidos, Clientes, Proyección, Planes | `src/revenue/RevenueApp.jsx`, `RevenuePages.jsx`, `revenueUi.jsx` |
| Carga del histórico de ChartMogul | `scripts/revenue-import.py` |

El histórico (`chartmogul_historico_mensual.json`) tiene ingresos reales y el repo es público: está en `.gitignore`, no se sube.

## Puesta en marcha (en este orden)

1. **Base:** pegar `supabase_revenue.sql` en Supabase → SQL editor y después `supabase_revenue_v2.sql` (segmento y pagos fallidos). Después pegar `supabase_tests/revenue_test.sql` y `supabase_tests/revenue_v2_test.sql`: tienen que terminar sin errores (corren dentro de una transacción con ROLLBACK, no dejan datos). Si el v2 no está aplicado, Métricas funciona igual y avisa que faltan el segmento y los pagos fallidos.
2. **Histórico:** `python3 scripts/revenue-import.py` y pegar `_import/revenue-history.sql` en el SQL editor.
3. **Stripe:** crear una clave **restringida de solo lectura** (Customers, Subscriptions, Prices, Products, Coupons, **Invoices** y **PaymentIntents**; las dos últimas son para los pagos fallidos). No usar la `sk_live` completa del Worker.
4. **Función:** Supabase → Edge Functions → crear `revenue-sync` pegando `index.ts`. **Desactivar "Enforce JWT Verification"** (Stripe y el cron no mandan JWT; la seguridad la dan la firma, el secret del cron y el chequeo de admin). Secrets: `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `REVENUE_CRON_SECRET`.
5. **Webhook:** Stripe → Developers → Webhooks → endpoint `https://khuavhbraikzreyhptog.supabase.co/functions/v1/revenue-sync/stripe` con `customer.subscription.created`, `.updated` y `.deleted` y, para los pagos fallidos, `invoice.payment_failed`, `invoice.paid`, `invoice.voided` y `invoice.marked_uncollectible`. Su signing secret va en `STRIPE_WEBHOOK_SECRET`.
6. **Backoffice → Métricas → Resumen → "Puesta en marcha":**
   1. *Traer de Stripe* (trae todo sin calcular MRR).
   2. *Planes*: clasificar cada plan (SaaS suma al MRR; pass-through, servicio y test no) y cargar tipos de cambio si hay cobros que no son en USD.
   3. *Hacer carga inicial*: registra el MRR de hoy como punto de partida. Se rehúsa si quedan planes sin clasificar y solo se puede hacer una vez.
7. **Cron nocturno:** correr `supabase_revenue_cron.sql` (con el mismo `REVENUE_CRON_SECRET` en el Vault).
8. **Comparar** el MRR con ChartMogul antes de apagarlo (se esperan diferencias: ChartMogul sumaba planes que no son SaaS).

Hasta la carga inicial, ni el webhook, ni el chequeo nocturno, ni la carga manual registran movimientos: guardan los datos y listo.

## Pantallas (basadas en el "SpicyTool · Revenue Dashboard" que ya existía)

Se respetó su estética (tarjetas KPI con franja de color, números en tipografía monoespaciada, barras, tablas, filtros en píldoras) con la paleta clara del backoffice, y sus funciones: filtros de período y segmento, Overview, MRR & ARR con ARPA, Churn %, Retención (NRR con su misma fórmula), Clientes con MRR por mes y alta/edición/baja de clientes por fuera, y Proyección con supuestos editables y clientes "por fuera".

- **Pagos fallidos (nuevo):** MRR en riesgo, facturas abiertas, intentos, motivo del rechazo, próximo reintento, link a la factura en Stripe, recuperados del mes, tasa de recuperación y churn involuntario (bajas por falta de pago, separadas del resto).
- **Segmento:** se elige a mano por cliente (Inmobiliaria / Otro / sin segmento). Los clientes nuevos de Stripe entran sin segmento.
- **Historia:** hasta el último mes cerrado antes de la carga inicial sale del export de ChartMogul; después, del sistema nuevo. El export no tiene datos por cliente, así que el MRR por mes de cada cliente solo existe desde la carga inicial.
- **Diferencia con el prototipo:** el "Net" mensual incluye contracción y reactivación (el del prototipo las omitía en la tabla MRR). "Registrar baja manual" ya no es un registro suelto: se usa Clientes → Dar de baja, que queda como churn real y auditado.

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
