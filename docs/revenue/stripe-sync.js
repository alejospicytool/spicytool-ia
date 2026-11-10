// Normaliza suscripciones de Stripe y las guarda en rev_subscriptions.
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_API_KEY); // clave restringida de solo lectura

const EXPAND = ['items.data.price.product', 'discounts', 'customer'];

function normalize(sub) {
  const disc = (sub.discounts || []).find(d => typeof d === 'object' && d.coupon) || sub.discount;
  const coupon = disc && disc.coupon;
  return {
    _id: `stripe:${sub.id}`,
    customerKey: `stripe:${typeof sub.customer === 'string' ? sub.customer : sub.customer.id}`,
    source: 'stripe',
    status: sub.status,
    currency: sub.currency,
    items: sub.items.data.map(it => ({
      priceId: it.price.id,
      productName: it.price.product && it.price.product.name,
      unitAmount: it.price.unit_amount,
      quantity: it.quantity || 1,
      interval: it.price.recurring.interval,
      intervalCount: it.price.recurring.interval_count,
    })),
    discount: coupon ? {
      percentOff: coupon.percent_off, amountOff: coupon.amount_off,
      endsAt: disc.end ? new Date(disc.end * 1000) : null,
    } : null,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    updatedAt: new Date(),
  };
}

async function upsertCustomer(db, customer) {
  if (!customer || typeof customer === 'string') return;
  await db.collection('rev_customers').updateOne(
    { _id: `stripe:${customer.id}` },
    { $set: { name: customer.name, email: customer.email, source: 'stripe', country: customer.address && customer.address.country },
      $setOnInsert: { mrr: 0, everPaid: false } },
    { upsert: true });
}

// Planes nuevos entran sin clasificar y NO cuentan en el MRR hasta que alguien los clasifique
async function registerPlans(db, sub) {
  for (const it of sub.items.data) {
    await db.collection('rev_plans').updateOne(
      { priceId: it.price.id },
      { $setOnInsert: { priceId: it.price.id, name: it.price.product && it.price.product.name,
                        category: 'sin_clasificar', countsInMrr: false, createdAt: new Date() } },
      { upsert: true });
  }
}

async function saveStripeSubscription(db, subId) {
  const sub = await stripe.subscriptions.retrieve(subId, { expand: EXPAND });
  await upsertCustomer(db, sub.customer);
  await registerPlans(db, sub);
  const doc = normalize(sub);
  await db.collection('rev_subscriptions').replaceOne({ _id: doc._id }, doc, { upsert: true });
  return doc.customerKey;
}

module.exports = { stripe, saveStripeSubscription, normalize, upsertCustomer, registerPlans, EXPAND };
