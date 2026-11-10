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
