// Cálculo de MRR de una suscripción normalizada (Stripe o manual).
// Todo en USD. Devuelve el MRR que aporta la suscripción hoy.

const COUNTED_STATUSES = ['active', 'past_due']; // sin auto-churn por pago vencido

function monthsOf(interval, intervalCount = 1) {
  return { day: 1 / 30, week: 12 / 52, month: 1, year: 12 }[interval] * intervalCount;
}

// sub = { status, currency, items: [{ priceId, unitAmount, quantity, interval, intervalCount }], discount }
// plans = Map(priceId -> { countsInMrr })
// fx = Map(currency -> tasa a USD)
function subscriptionMrr(sub, plans, fx) {
  if (!COUNTED_STATUSES.includes(sub.status)) return 0;

  let mrr = 0;
  for (const it of sub.items) {
    const plan = plans.get(it.priceId);
    if (!plan || !plan.countsInMrr) continue; // sin clasificar o no SaaS: no suma
    mrr += (it.unitAmount * it.quantity) / 100 / monthsOf(it.interval, it.intervalCount);
  }

  // Descuento a nivel suscripción (cupones de Stripe o descuento manual)
  const d = sub.discount;
  if (d && (!d.endsAt || new Date(d.endsAt) > new Date())) {
    if (d.percentOff) mrr *= 1 - d.percentOff / 100;
    if (d.amountOff) mrr = Math.max(0, mrr - d.amountOff / 100);
  }

  const cur = (sub.currency || 'usd').toLowerCase();
  if (cur !== 'usd') {
    const rate = fx.get(cur);
    if (!rate) throw new Error(`Falta tipo de cambio para ${cur}`);
    mrr *= rate;
  }
  return Math.round(mrr * 100) / 100;
}

module.exports = { subscriptionMrr, COUNTED_STATUSES };
