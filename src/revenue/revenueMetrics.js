// Cálculo de las métricas de revenue a partir de lo que guarda la base (rev_customers, rev_mrr_events,
// rev_history_monthly, rev_sync_runs). Funciones puras: sin red ni React, con tests.
// Los meses son de Buenos Aires (igual que el resto del backoffice).
import { baDateISO } from "../timeTracking.js";

export const MOV_TYPES = ["new", "expansion", "contraction", "churn", "reactivation"];
export const MOV_LABEL = { new: "Nuevos", expansion: "Expansión", contraction: "Contracción", churn: "Churn", reactivation: "Reactivación" };
const round2 = (n) => Math.round(n * 100) / 100;
const num = (x) => Number(x) || 0;

export const monthKeyOf = (date) => baDateISO(new Date(date)).slice(0, 7);
export const monthStart = (m) => new Date(`${m}-01T00:00:00-03:00`);
export function nextMonth(m) { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; }
export function prevMonth(m) { const [y, mo] = m.split("-").map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`; }
export function monthsBetween(from, to) { const out = []; for (let m = from; m <= to; m = nextMonth(m)) out.push(m); return out; }

// MRR actual, clientes que pagan y ARPA
export function summarize(customers) {
  const paying = customers.filter((c) => num(c.mrr) > 0);
  const mrr = round2(paying.reduce((s, c) => s + num(c.mrr), 0));
  return { mrr, arr: round2(mrr * 12), customers: paying.length, arpa: paying.length ? round2(mrr / paying.length) : 0 };
}

// Fecha de la carga inicial (primer movimiento "baseline"). Antes de eso el motor no tiene historia propia.
export function baselineDate(events) {
  const b = events.filter((e) => e.baseline).map((e) => new Date(e.date).getTime());
  return b.length ? new Date(Math.min(...b)) : null;
}

// Fin de la carga inicial (el último movimiento "baseline": cada cliente se registra con su propia hora)
export function baselineEnd(events) {
  const b = events.filter((e) => e.baseline).map((e) => new Date(e.date).getTime());
  return b.length ? new Date(Math.max(...b)) : null;
}

// MRR y clientes que pagaban en un instante T: el MRR de hoy menos los movimientos posteriores a T
export function mrrAt(customers, events, T) {
  const after = new Map();
  for (const e of events) if (new Date(e.date) > T) after.set(e.customer_key, (after.get(e.customer_key) || 0) + num(e.delta));
  let mrr = 0, n = 0;
  for (const c of customers) {
    const v = round2(num(c.mrr) - (after.get(c.key) || 0));
    if (v > 0) { mrr += v; n++; }
  }
  return { mrr: round2(mrr), customers: n };
}

// Movimientos de un mes (sin la carga inicial): cantidad y USD por tipo, más el neto
export function movementsFor(events, month) {
  const from = monthStart(month), to = monthStart(nextMonth(month));
  const out = Object.fromEntries(MOV_TYPES.map((t) => [t, { count: 0, mrr: 0 }]));
  for (const e of events) {
    if (e.baseline || !out[e.type]) continue;
    const d = new Date(e.date);
    if (d >= from && d < to) { out[e.type].count++; out[e.type].mrr = round2(out[e.type].mrr + num(e.delta)); }
  }
  out.net = round2(MOV_TYPES.reduce((s, t) => s + out[t].mrr, 0));
  return out;
}

// Churn de clientes del mes = bajas del mes / clientes que pagaban al inicio del mes (null si no hay base para comparar)
export function churnRate(customers, events, month) {
  const base = baselineDate(events);
  const start = monthStart(month);
  if (!base || start < base) return null;
  const startCustomers = mrrAt(customers, events, start).customers;
  if (!startCustomers) return null;
  return { rate: movementsFor(events, month).churn.count / startCustomers, startCustomers };
}

// Serie propia del sistema nuevo: MRR y clientes al cierre de cada mes desde la carga inicial (el mes en curso, a hoy)
export function liveSeries(customers, events, now = new Date()) {
  const base = baselineDate(events);
  if (!base) return [];
  const cur = monthKeyOf(now);
  return monthsBetween(monthKeyOf(base), cur).map((m) => {
    const end = m === cur ? now : new Date(monthStart(nextMonth(m)).getTime() - 1);
    const r = mrrAt(customers, events, end);
    return { month: m, mrr: r.mrr, customers: r.customers, source: "nuevo", partial: m === cur };
  });
}

// Histórico de ChartMogul (cerrado) + serie nueva. En el mes de la carga inicial y siguientes manda el sistema nuevo.
// OJO: el histórico incluye planes que no son SaaS, así que no es estrictamente comparable con lo nuevo.
export function combinedSeries(history, live) {
  const firstLive = live.length ? live[0].month : "9999-99";
  const old = history
    .filter((h) => h.month < firstLive && h.data && h.data.parcial !== "si")
    .map((h) => ({ month: h.month, mrr: num(h.data.mrr_usd), customers: num(h.data.clientes_pagos), source: "chartmogul", partial: false }))
    .sort((a, b) => (a.month < b.month ? -1 : 1));
  return [...old, ...live];
}

// Diferencia entre el MRR del sistema nuevo y el último mes cerrado de ChartMogul (solo informativa)
export function compareWithHistory(history, current) {
  const closed = history.filter((h) => h.data && h.data.parcial !== "si").sort((a, b) => (a.month < b.month ? 1 : -1))[0];
  if (!closed) return null;
  const mrr = num(closed.data.mrr_usd);
  return { month: closed.month, chartmogulMrr: mrr, diff: round2(current - mrr) };
}

// Avisos para mostrar arriba en Métricas
export function healthAlerts({ plans = [], runs = [], events = [], now = new Date() }) {
  const alerts = [];
  if (!events.some((e) => e.baseline)) alerts.push({ level: "info", code: "sin_baseline", text: "Todavía no se hizo la carga inicial de Stripe: las métricas nuevas arrancan cuando se corra." });
  const unclassified = plans.filter((p) => p.category === "sin_clasificar").length;
  if (unclassified) alerts.push({ level: "warn", code: "sin_clasificar", text: `Hay ${unclassified} ${unclassified === 1 ? "plan sin clasificar" : "planes sin clasificar"}: no suman al MRR hasta que los clasifiques.`, tab: "planes" });
  const last = [...runs].sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  if (events.some((e) => e.baseline)) {
    if (!last) alerts.push({ level: "warn", code: "sin_corridas", text: "El chequeo nocturno todavía no corrió." });
    else if (now - new Date(last.at) > 36 * 3600 * 1000) alerts.push({ level: "error", code: "chequeo_viejo", text: "El chequeo nocturno no corre hace más de un día y medio. Revisá el cron en Supabase." });
  }
  if (last) {
    const errs = Array.isArray(last.errors) ? last.errors.length : 0;
    if (errs) alerts.push({ level: "error", code: "errores", text: `La última corrida tuvo ${errs} ${errs === 1 ? "cliente con error" : "clientes con error"} (por ejemplo, falta cargar un tipo de cambio).`, tab: "planes" });
    if (num(last.stale)) alerts.push({ level: "warn", code: "perdidas", text: `El chequeo corrigió ${last.stale} ${last.stale === 1 ? "suscripción" : "suscripciones"} que no habían llegado por webhook. Si pasa seguido, revisá el webhook en Stripe.` });
  }
  return alerts;
}


// ══ Tablero tipo "Revenue Dashboard" ═══════════════════════════════════════════════════════════════════
// Una fila por mes con todo lo que usan las pantallas: MRR, clientes, movimientos (en USD positivos), ARPA,
// churn %, retención neta (NRR). Histórico de ChartMogul (cerrado) + sistema nuevo desde la carga inicial.

export function monthlyRows({ history = [], customers = [], events = [], now = new Date() }) {
  const live = liveSeries(customers, events, now);
  const firstLive = live.length ? live[0].month : "9999-99";
  const rows = [];
  for (const h of [...history].sort((a, b) => (a.month < b.month ? -1 : 1))) {
    if (h.month >= firstLive || !h.data || h.data.parcial === "si") continue;
    const d = h.data;
    rows.push({ month: h.month, source: "chartmogul", partial: false, mrr: num(d.mrr_usd), customers: num(d.clientes_pagos),
      newBiz: num(d.new_mrr), expansion: num(d.expansion_mrr), contraction: Math.abs(num(d.contraction_mrr)), churn: Math.abs(num(d.churn_mrr)),
      reactivation: num(d.reactivation_mrr), newClients: num(d.new_clientes), churnClients: num(d.churn_clientes) });
  }
  for (const l of live) {
    const m = movementsFor(events, l.month);
    rows.push({ month: l.month, source: "nuevo", partial: l.partial, mrr: l.mrr, customers: l.customers,
      newBiz: m.new.mrr, expansion: m.expansion.mrr, contraction: Math.abs(m.contraction.mrr), churn: Math.abs(m.churn.mrr),
      reactivation: m.reactivation.mrr, newClients: m.new.count, churnClients: m.churn.count });
  }
  const end = baselineEnd(events);
  rows.forEach((r, i) => {
    let start = null;
    if (i > 0) start = r.source === "nuevo" && rows[i - 1].source !== "nuevo" && end ? mrrAt(customers, events, end) : { mrr: rows[i - 1].mrr, customers: rows[i - 1].customers };
    else if (r.source === "nuevo" && end) start = mrrAt(customers, events, end);
    r.startMrr = start ? start.mrr : null;
    r.startCustomers = start ? start.customers : null;
    r.net = round2(r.newBiz + r.expansion + r.reactivation - r.contraction - r.churn);
    r.arpa = r.customers ? round2(r.mrr / r.customers) : 0;
    r.churnPct = r.startCustomers ? round2((r.churnClients / r.startCustomers) * 100) : null;
    // Retención neta: (MRR de inicio + expansión neta de contracciones − churn) / MRR de inicio. Igual que el prototipo.
    r.nrr = r.startMrr ? round2(((r.startMrr + r.expansion - r.contraction - r.churn) / r.startMrr) * 100) : null;
  });
  return rows;
}

export const PERIODS = [["year", "Este año"], ["last12", "Últ. 12 meses"], ["last6", "Últ. 6 meses"], ["last4", "Últ. 4 meses"], ["month", "Este mes"], ["all", "Todo"]];
export function periodRows(rows, preset, now = new Date()) {
  const cur = monthKeyOf(now);
  const upto = rows.filter((r) => r.month <= cur);
  const last = (n) => upto.slice(-n);
  if (preset === "year") return upto.filter((r) => r.month.slice(0, 4) === cur.slice(0, 4));
  if (preset === "last12") return last(12);
  if (preset === "last6") return last(6);
  if (preset === "last4") return last(4);
  if (preset === "month") return last(1);
  return upto;
}

const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
export function periodKpis(rows) {
  if (!rows.length) return null;
  const first = rows[0], last = rows[rows.length - 1];
  const churnPcts = rows.filter((r) => r.churnPct != null), nrrs = rows.filter((r) => r.nrr != null);
  const by = (list, f, pick) => list.reduce((m, r) => (pick(f(r), f(m)) ? r : m), list[0]);
  return {
    last, first,
    churnTotal: round2(rows.reduce((s, r) => s + r.churn, 0)), newTotal: round2(rows.reduce((s, r) => s + r.newBiz, 0)),
    growthPct: first.mrr > 0 ? Math.round(((last.mrr - first.mrr) / first.mrr) * 100) : null,
    bestNew: by(rows, (r) => r.newBiz, (a, b) => a > b),
    churnMax: churnPcts.length ? by(churnPcts, (r) => r.churnPct, (a, b) => a > b) : null,
    churnMin: churnPcts.length ? by(churnPcts, (r) => r.churnPct, (a, b) => a < b) : null,
    churnAvg: churnPcts.length ? round2(avg(churnPcts.map((r) => r.churnPct))) : null,
    nrrBest: nrrs.length ? by(nrrs, (r) => r.nrr, (a, b) => a > b) : null,
    nrrAvg: nrrs.length ? round2(avg(nrrs.map((r) => r.nrr))) : null,
  };
}

// MRR de cada cliente al cierre de cada mes (desde la carga inicial; antes no hay datos por cliente)
export function customerMonthly(customers, events, months, now = new Date()) {
  const cur = monthKeyOf(now);
  const out = Object.fromEntries(customers.map((c) => [c.key, {}]));
  for (const m of months) {
    const T = m === cur ? now : new Date(monthStart(nextMonth(m)).getTime() - 1);
    const after = new Map();
    for (const e of events) if (new Date(e.date) > T) after.set(e.customer_key, (after.get(e.customer_key) || 0) + num(e.delta));
    for (const c of customers) { const v = round2(num(c.mrr) - (after.get(c.key) || 0)); if (v > 0) out[c.key][m] = v; }
  }
  return out;
}

export const SEGMENTS = [["inmobiliaria", "🏠 Inmobiliarias"], ["otro", "◎ Otros"]];
export function segmentSummary(customers) {
  const out = { inmobiliaria: { mrr: 0, customers: 0 }, otro: { mrr: 0, customers: 0 }, sin: { mrr: 0, customers: 0 } };
  for (const c of customers) {
    if (num(c.mrr) <= 0) continue;
    const b = out[c.segment] || out.sin;
    b.mrr = round2(b.mrr + num(c.mrr)); b.customers++;
  }
  return out;
}
export const matchSegment = (c, seg) => seg === "todos" || (seg === "sin" ? !c.segment : c.segment === seg);

// ── Proyección (mismo cálculo que el prototipo) ──────────────────────────────────────────────────────────
export function projectionMonths(now = new Date(), n = 4) {
  const out = []; let m = monthKeyOf(now);
  for (let i = 0; i < n; i++) { m = nextMonth(m); out.push(m); }
  return out;
}
// Supuestos iniciales = promedio de los últimos 6 meses reales
export function projectionDefaults(rows) {
  const r6 = rows.slice(-6);
  if (!r6.length) return { churnPct: 0, newBiz: 0, expansion: 0 };
  const churnRatios = r6.filter((r) => r.startMrr).map((r) => r.churn / r.startMrr);
  return {
    churnPct: Math.round((avg(churnRatios) || 0) * 1000) / 10,
    newBiz: Math.round(avg(r6.map((r) => r.newBiz))),
    expansion: Math.round(avg(r6.map((r) => r.expansion))),
  };
}
// proj = { churnPct[], newBiz[], expansion[], extra: [{ name, base, mrr[] }] }; baseTotal = MRR de hoy
export function computeProjection(baseTotal, proj, keys) {
  const manualBase = proj.extra.reduce((s, c) => s + (c.base || 0), 0);
  let auto = baseTotal - manualBase, prevManual = manualBase, prevTotal = baseTotal;
  const rows = keys.map((k, i) => {
    const churn = (auto * (proj.churnPct[i] || 0)) / 100;
    const nb = proj.newBiz[i] || 0, ex = proj.expansion[i] || 0;
    const autoNew = auto - churn + nb + ex;
    const manual = proj.extra.reduce((s, c) => s + (c.mrr[i] || 0), 0);
    const total = autoNew + manual;
    const row = { key: k, start: prevTotal, nb, ex, churn, dManual: manual - prevManual, manual, total };
    auto = autoNew; prevManual = manual; prevTotal = total;
    return row;
  });
  return { baseTotal, manualBase, rows };
}

// ── Pagos fallidos ────────────────────────────────────────────────────────────────────────────────────
const daysBetween = (a, b) => Math.max(0, Math.floor((new Date(b) - new Date(a)) / 864e5));
export function failuresSummary({ failures = [], customers = [], involuntaryKeys = new Set(), events = [], now = new Date() }) {
  const byKey = new Map(customers.map((c) => [c.key, c]));
  const open = failures.filter((f) => f.status === "open")
    .map((f) => ({ ...f, customer: byKey.get(f.customer_key) || null, daysOpen: daysBetween(f.first_failed_at, now) }))
    .sort((a, b) => (a.first_failed_at < b.first_failed_at ? -1 : 1));
  const atRisk = new Map();
  for (const f of open) { const c = f.customer; if (c && num(c.mrr) > 0) atRisk.set(c.key, num(c.mrr)); }
  const month = monthKeyOf(now);
  const inMonth = (iso) => iso && monthKeyOf(iso) === month;
  const recovered = failures.filter((f) => f.status === "recovered" && inMonth(f.resolved_at));
  const lost = failures.filter((f) => (f.status === "uncollectible" || f.status === "void") && inMonth(f.resolved_at));
  const closed = recovered.length + lost.length;
  const churn = movementsFor(events, month).churn;
  const invol = events.filter((e) => !e.baseline && e.type === "churn" && involuntaryKeys.has(e.customer_key) && monthKeyOf(e.date) === month);
  return {
    open, openCount: open.length,
    openAmount: round2(open.reduce((s, f) => s + num(f.amount_due), 0)),
    mrrAtRisk: round2([...atRisk.values()].reduce((s, v) => s + v, 0)), customersAtRisk: atRisk.size,
    recoveredCount: recovered.length, recoveredAmount: round2(recovered.reduce((s, f) => s + num(f.amount_due), 0)),
    recoveryRate: closed ? round2((recovered.length / closed) * 100) : null,
    involuntary: { count: invol.length, mrr: round2(Math.abs(invol.reduce((s, e) => s + num(e.delta), 0))), of: churn.count },
  };
}
