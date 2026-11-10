// Suscripciones manuales (clientes que pagan por fuera de Stripe). Usan el mismo motor.
const { ObjectId } = require('mongodb');
const { recomputeCustomer } = require('./engine');

// data = { customerKey?, customerName, email, companyId, planPriceId, amount (USD o moneda), currency,
//          interval: 'month'|'year', status: 'active'|'canceled', userId }
async function saveManualSubscription(db, data, subId) {
  const customerKey = data.customerKey || `manual:${new ObjectId()}`;
  await db.collection('rev_customers').updateOne(
    { _id: customerKey },
    { $set: { name: data.customerName, email: data.email, companyId: data.companyId || null, source: 'manual' },
      $setOnInsert: { mrr: 0, everPaid: false } },
    { upsert: true });

  const _id = subId || `manual:${new ObjectId()}`;
  const prev = await db.collection('rev_subscriptions').findOne({ _id });
  const doc = {
    _id, customerKey, source: 'manual', status: data.status || 'active', currency: data.currency || 'usd',
    items: [{ priceId: data.planPriceId, unitAmount: Math.round(data.amount * 100), quantity: 1,
              interval: data.interval || 'month', intervalCount: 1 }],
    discount: null, updatedAt: new Date(),
  };
  await db.collection('rev_subscriptions').replaceOne({ _id }, doc, { upsert: true });

  // Auditoría: quién cambió qué y cuándo (la versión anterior no se pierde)
  await db.collection('rev_manual_audit').insertOne({ subscriptionId: _id, before: prev, after: doc, userId: data.userId, at: new Date() });

  return recomputeCustomer(db, customerKey, { cause: prev ? 'manual_edicion' : 'manual_alta' });
}

module.exports = { saveManualSubscription };
