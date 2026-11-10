# Módulo de revenue (reemplazo de ChartMogul)

Se actualiza solo con webhooks de Stripe, tiene un chequeo nocturno de respaldo y permite carga manual para los clientes que pagan por fuera de Stripe.

## Archivos
- `mrr.js`: calcula el MRR de una suscripción.
  - Lleva todo a mensual: anual ÷ 12.
  - Aplica descuentos y convierte a USD.
  - Solo suma los planes con `countsInMrr: true`.
- `engine.js`: recalcula el MRR de un cliente y registra el movimiento (new, expansion, contraction, churn, reactivation). Si hay dos cambios del mismo cliente dentro de 1 hora, los consolida en un solo movimiento.
- `stripe-sync.js`: lee una suscripción de Stripe y la normaliza. Los planes nuevos entran como `sin_clasificar` y no suman al MRR hasta que se clasifiquen.
- `webhook.js`: endpoint que recibe los eventos de Stripe.
  - Verifica la firma de cada evento.
  - Ignora los eventos duplicados.
  - Vuelve a leer la suscripción desde Stripe en vez de confiar en el orden en que llegan los eventos.
- `reconcile.js`: carga inicial y chequeo nocturno. Corrige lo que no haya llegado por webhook.
- `manual.js`: alta y edición de suscripciones manuales, con auditoría de cambios.

## Variables de entorno
```
STRIPE_API_KEY=rk_live_...        # clave restringida, solo lectura (Customers, Subscriptions, Prices, Products, Invoices)
STRIPE_WEBHOOK_SECRET=whsec_...   # la da Stripe al crear el endpoint
```

## Puesta en marcha
1. `npm i stripe mongodb`
2. Montar el webhook **antes** de `express.json()`, porque la verificación de la firma necesita el body crudo:
   ```js
   const { stripeWebhook } = require('./revenue/webhook');
   app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook(db));
   app.use(express.json());
   ```
3. En Stripe: Developers → Webhooks → Add endpoint, con la URL `https://<backoffice>/api/stripe/webhook`. Seleccionar estos eventos:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

   Copiar el signing secret a `STRIPE_WEBHOOK_SECRET`.
4. Crear los índices:
   ```js
   db.rev_plans.createIndex({ priceId: 1 }, { unique: true })
   db.rev_subscriptions.createIndex({ customerKey: 1 })
   db.rev_mrr_events.createIndex({ customerKey: 1, date: -1 })
   db.rev_mrr_events.createIndex({ date: 1, type: 1 })
   ```
5. **Carga inicial, una sola vez:** `await reconcile(db, { baseline: true })`.
   - Registra el MRR actual de cada cliente como `baseline`, para que no cuente como "new" toda la base.
   - Da de alta todos los planes como `sin_clasificar`.
6. **Clasificar los planes** en `rev_plans`, con `category` y `countsInMrr`:
   - `saas` → `countsInMrr: true`
   - `pass_through` (créditos Google Ads) → `false`
   - `servicio` (honorarios, landing, web) → a definir
   - `test` (planes de 1 dólar) → `false`

   Después correr `reconcile(db)` de nuevo para que se recalcule el MRR.
7. **Chequeo nocturno:** programar `reconcile(db)` todos los días, a las 3 AM por ejemplo, con node-cron, un timer de Azure Functions o un cron de Vercel. Devuelve las correcciones que hizo y la cantidad de planes sin clasificar. Si alguno de los dos no es cero, conviene que mande un aviso.
8. **Tipo de cambio:** si algún cobro no es en USD, cargar la tasa en `rev_fx_rates` con la forma `{ currency: 'ars', rate: 0.0009 }`. Sin esa tasa, el cálculo da error en vez de inventar un número.

## Métricas para el panel (a partir de `rev_mrr_events` y `rev_customers`)
- **MRR actual:** suma de `rev_customers.mrr`.
- **Clientes:** cantidad de clientes con `mrr > 0`. **ARPA** = MRR / clientes.
- **Movimientos del mes:** agrupar `rev_mrr_events` por `type`, sin contar los que tienen `baseline: true`.
- **Churn de clientes del mes:** eventos `churn` del mes / clientes al inicio del mes.
- **Historia previa:** importar `chartmogul_historico_mensual.json`, marcado como "histórico ChartMogul" (incluye los planes que no son SaaS).

## Pendiente o limitaciones conocidas
- **Descuentos:** se toma un solo cupón a nivel suscripción. Si usan cupones por ítem o varios cupones a la vez, hay que ampliarlo.
- **Trials:** las suscripciones en `trialing` no suman al MRR hasta que pasan a `active`.
- **Carga manual:** maneja un precio por suscripción. Para cambiar el precio se edita la suscripción y el motor registra la expansión o contracción.
