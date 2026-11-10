// Motor de movimientos: recalcula el MRR de un cliente y registra el cambio.
// Colecciones:
//   rev_plans         { priceId, name, category, countsInMrr }
//   rev_subscriptions { _id, customerKey, source, status, currency, items, discount, updatedAt }
//   rev_customers     { _id: customerKey, name, email, source, companyId, mrr, everPaid, firstPaidAt }
//   rev_mrr_events    { customerKey, date, type, mrrBefore, mrrAfter, delta, baseline, cause }
//   rev_fx_rates      { currency, rate }  (a USD)

const { subscriptionMrr } = require('./mrr');

const MERGE_WINDOW_MS = 60 * 60 * 1000; // cambios dentro de 1 hora = un solo movimiento

async function loadContext(db) {
  const plans = new Map((await db.collection('rev_plans').find().toArray()).map(p => [p.priceId, p]));
  const fx = new Map((await db.collection('rev_fx_rates').find().toArray()).map(r => [r.currency, r.rate]));
  return { plans, fx };
}

function classify(before, after, everPaid) {
  if (before === 0 && after > 0) return everPaid ? 'reactivation' : 'new';
  if (before > 0 && after === 0) return 'churn';
  if (after > before) return 'expansion';
  if (after < before) return 'contraction';
  return null;
}

// baseline: true solo en la carga inicial, para que no cuente como "new" toda la base
async function recomputeCustomer(db, customerKey, { cause = 'sync', baseline = false, ctx } = {}) {
  ctx = ctx || (await loadContext(db));
  const subs = await db.collection('rev_subscriptions').find({ customerKey }).toArray();
  const after = Math.round(subs.reduce((s, x) => s + subscriptionMrr(x, ctx.plans, ctx.fx), 0) * 100) / 100;

  const customers = db.collection('rev_customers');
  const cust = (await customers.findOne({ _id: customerKey })) || { mrr: 0, everPaid: false };
  const before = cust.mrr || 0;
  if (before === after) return null;

  const now = new Date();
  const events = db.collection('rev_mrr_events');

  // Consolidar con un movimiento reciente del mismo cliente (ej. cambio de plan = baja + alta)
  const recent = await events.findOne(
    { customerKey, baseline: { $ne: true }, date: { $gte: new Date(now - MERGE_WINDOW_MS) } },
    { sort: { date: -1 } });

  if (recent && !baseline) {
    // ¿Había pagado alguna vez ANTES del movimiento reciente?
    const everPaidBefore = recent.type !== 'new';
    const type = classify(recent.mrrBefore, after, everPaidBefore);
    if (!type) {
      await events.deleteOne({ _id: recent._id }); // se anuló: volvió al MRR original
      if (recent.type === 'new') {
        await customers.updateOne({ _id: customerKey }, { $set: { everPaid: false, firstPaidAt: null } });
        cust.everPaid = false;
      }
    } else {
      await events.updateOne({ _id: recent._id },
        { $set: { type, mrrAfter: after, delta: Math.round((after - recent.mrrBefore) * 100) / 100, cause } });
    }
  } else {
    await events.insertOne({
      customerKey, date: now, type: baseline ? 'baseline' : classify(before, after, cust.everPaid),
      mrrBefore: before, mrrAfter: after, delta: Math.round((after - before) * 100) / 100, baseline, cause,
    });
  }

  const set = { mrr: after, updatedAt: now };
  if (after > 0 && !cust.everPaid) Object.assign(set, { everPaid: true, firstPaidAt: now });
  await customers.updateOne({ _id: customerKey }, { $set: set }, { upsert: true });
  return { customerKey, before, after };
}

module.exports = { recomputeCustomer, loadContext, classify };
