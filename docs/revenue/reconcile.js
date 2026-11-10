// Chequeo nocturno de respaldo y carga inicial.
//   Carga inicial (una sola vez):  await reconcile(db, { baseline: true })
//   Todas las noches:              await reconcile(db)
const { stripe, normalize, upsertCustomer, registerPlans, EXPAND } = require('./stripe-sync');
const { recomputeCustomer, loadContext } = require('./engine');

async function reconcile(db, { baseline = false } = {}) {
  const subsCol = db.collection('rev_subscriptions');
  const seen = new Set();

  for (const status of ['active', 'past_due', 'trialing']) {
    for await (const sub of stripe.subscriptions.list({ status, limit: 100, expand: EXPAND.map(e => `data.${e}`) })) {
      await upsertCustomer(db, sub.customer);
      await registerPlans(db, sub);
      const doc = normalize(sub);
      seen.add(doc._id);
      await subsCol.replaceOne({ _id: doc._id }, doc, { upsert: true });
    }
  }

  // Suscripciones que teníamos vivas y ya no aparecen: se perdió el webhook de baja
  const stale = await subsCol.find({ source: 'stripe', status: { $in: ['active', 'past_due', 'trialing'] }, _id: { $nin: [...seen] } }).toArray();
  for (const s of stale) {
    const sub = await stripe.subscriptions.retrieve(s._id.replace('stripe:', ''), { expand: EXPAND });
    await subsCol.replaceOne({ _id: s._id }, normalize(sub));
  }

  // Recalcular todos los clientes (Stripe y manuales)
  const ctx = await loadContext(db);
  const keys = await subsCol.distinct('customerKey');
  const fixes = [];
  for (const key of keys) {
    const r = await recomputeCustomer(db, key, { cause: baseline ? 'carga_inicial' : 'reconciliacion', baseline, ctx });
    if (r) fixes.push(r);
  }

  const unclassified = await db.collection('rev_plans').countDocuments({ category: 'sin_clasificar' });
  return { fixes, staleCount: stale.length, unclassified };
}

module.exports = { reconcile };
