// Endpoint de webhook de Stripe. Montar ANTES de express.json():
//   app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook(db));
const { stripe, saveStripeSubscription } = require('./stripe-sync');
const { recomputeCustomer } = require('./engine');

const HANDLED = ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'];

function stripeWebhook(db) {
  return async (req, res) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).send(`Firma inválida: ${err.message}`);
    }
    if (!HANDLED.includes(event.type)) return res.json({ ignored: true });

    // Idempotencia: Stripe puede mandar el mismo evento más de una vez
    const log = db.collection('rev_stripe_events');
    try { await log.insertOne({ _id: event.id, type: event.type, receivedAt: new Date() }); }
    catch (e) { if (e.code === 11000) return res.json({ duplicate: true }); throw e; }

    try {
      // Se relee la suscripción desde Stripe: los eventos pueden llegar desordenados
      const customerKey = await saveStripeSubscription(db, event.data.object.id);
      const result = await recomputeCustomer(db, customerKey, { cause: event.type });
      await log.updateOne({ _id: event.id }, { $set: { processedAt: new Date(), result } });
      res.json({ ok: true });
    } catch (err) {
      await log.deleteOne({ _id: event.id }); // para que el reintento de Stripe lo vuelva a procesar
      console.error('Error procesando webhook', event.id, err);
      res.status(500).send('Error');
    }
  };
}

module.exports = { stripeWebhook };
