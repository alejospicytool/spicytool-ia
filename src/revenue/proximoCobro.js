// Próximo cobro de cada suscripción (lógica pura, sin React ni Supabase). La fecha viene de Stripe y la guarda revenue-sync en
// rev_subscriptions.current_period_end (cuándo vence el período actual = cuándo se cobra la próxima vez; en prueba, cuando termina la prueba).
// OJO: es la fecha de RENOVACIÓN, no garantiza que el cobro salga (puede fallar). El monto es una estimación: no incluye impuestos ni ajustes.
import { baDateISO } from "../timeTracking.js";

export const LIVE_STATUSES = ["active", "past_due", "trialing"];
const round2 = (n) => Math.round(n * 100) / 100;
const MS_DAY = 86400000;
const isoDays = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / MS_DAY);
export const fmtDia = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
export const fmtDiaCorto = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");

// Cuánto se va a cobrar en la próxima factura (en la moneda de la suscripción): suma de ítems menos el descuento si todavía vale ese día.
export function chargeAmount(sub, at = new Date()) {
  let total = 0;
  for (const it of (sub && sub.items) || []) total += ((Number(it.unitAmount) || 0) * (Number(it.quantity) || 1)) / 100;
  const d = sub && sub.discount;
  if (d && (!d.endsAt || new Date(d.endsAt) > at)) {
    if (d.percentOff) total *= 1 - d.percentOff / 100;
    if (d.amountOff) total = Math.max(0, total - d.amountOff / 100);
  }
  return round2(total);
}

// Qué le pasa a esta suscripción en su próxima fecha. null si no corresponde (cancelada, impaga o sin fecha guardada).
// kind: "cobro" (se renueva), "prueba" (termina la prueba y empieza a cobrar), "cancela" (se cancela al final, no se renueva), "atrasado" (tiene un pago atrasado).
// vencida: la fecha ya pasó y todavía no se actualizó (dato viejo: hay que confirmarlo en Stripe).
export function nextCharge(sub, now = new Date()) {
  if (!sub || !LIVE_STATUSES.includes(sub.status) || !sub.current_period_end) return null;
  const date = new Date(sub.current_period_end);
  if (Number.isNaN(date.getTime())) return null;
  const iso = baDateISO(date), today = baDateISO(now);
  const days = isoDays(today, iso);
  const kind = sub.cancel_at_period_end ? "cancela" : sub.status === "past_due" ? "atrasado" : sub.status === "trialing" ? "prueba" : "cobro";
  return { date, iso, days, kind, vencida: days < 0, amount: chargeAmount(sub, date), currency: String(sub.currency || "usd").toLowerCase() };
}

const when = (days) => (days === 0 ? "hoy" : days === 1 ? "mañana" : days > 1 ? `en ${days} días` : `hace ${-days} día${days === -1 ? "" : "s"}`);
const cur = (c, n) => `${String(c).toUpperCase()} ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
// Texto corto para mostrar en la ficha y en la lista de clientes: { text, tone: "ok" | "warn" | "bad" | "muted" }.
export function chargeText(nc) {
  if (!nc) return null;
  const f = fmtDia(nc.iso);
  if (nc.vencida) return { text: `Fecha vencida (${f}): a confirmar en Stripe`, tone: "warn" };
  if (nc.kind === "cancela") return { text: `Se cancela el ${f} (${when(nc.days)}): no se renueva`, tone: "bad" };
  if (nc.kind === "atrasado") return { text: `Pago atrasado · próximo ciclo el ${f} (${when(nc.days)}) · ${cur(nc.currency, nc.amount)}`, tone: "warn" };
  if (nc.kind === "prueba") return { text: `Termina la prueba el ${f} (${when(nc.days)}) · después ${cur(nc.currency, nc.amount)}`, tone: "ok" };
  return { text: `Próximo cobro: ${f} (${when(nc.days)}) · ${cur(nc.currency, nc.amount)}`, tone: "ok" };
}

// De un cliente (varias suscripciones posibles) cuál es la próxima fecha que importa: la más cercana entre las vivas con fecha.
export function nextChargeOfCustomer(subs, now = new Date()) {
  const list = (subs || []).map((s) => nextCharge(s, now)).filter(Boolean).sort((a, b) => a.date - b.date);
  return list[0] || null;
}

// Lista de cobros que vienen en los próximos `days` días (más los de fecha vencida, que hay que confirmar), ordenada por fecha.
// Los totales suman solo USD (hoy todo es USD); lo que esté en otra moneda se cuenta aparte para no mezclar.
export function upcomingCharges(subs, customers, { now = new Date(), days = 30 } = {}) {
  const byKey = new Map((customers || []).map((c) => [c.key, c]));
  const rows = [];
  for (const s of subs || []) {
    const nc = nextCharge(s, now);
    if (!nc || (!nc.vencida && nc.days > days)) continue;
    rows.push({ ...nc, sub: s, customer: byKey.get(s.customer_key) || null });
  }
  rows.sort((a, b) => a.date - b.date || String((a.customer && a.customer.name) || "").localeCompare(String((b.customer && b.customer.name) || ""), "es"));
  const t = { expected: 0, expectedCount: 0, cancel: 0, cancelCount: 0, late: 0, lateCount: 0, vencidas: 0, otherCurrency: 0 };
  for (const r of rows) {
    if (r.vencida) { t.vencidas++; continue; }
    if (r.currency !== "usd") { t.otherCurrency++; continue; }
    if (r.kind === "cancela") { t.cancel += r.amount; t.cancelCount++; }
    else if (r.kind === "atrasado") { t.late += r.amount; t.lateCount++; }
    else { t.expected += r.amount; t.expectedCount++; }
  }
  for (const k of ["expected", "cancel", "late"]) t[k] = round2(t[k]);
  return { rows, totals: t };
}

// Agrupa por día para mostrar "Mañana · 27/11 · USD 580". Los de fecha vencida van en un grupo aparte al principio.
export function groupByDay(rows) {
  const groups = [];
  for (const r of rows) {
    const key = r.vencida ? "vencida" : r.iso;
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, iso: r.iso, days: r.days, vencida: r.vencida, rows: [], total: 0 }; groups.push(g); }
    g.rows.push(r);
    if (r.currency === "usd" && r.kind !== "cancela" && r.kind !== "atrasado" && !r.vencida) g.total = round2(g.total + r.amount);
  }
  return groups.sort((a, b) => Number(b.vencida) - Number(a.vencida) || (a.iso < b.iso ? -1 : 1));
}
export const dayLabel = (g) => (g.vencida ? "Fecha vencida: a confirmar" : `${g.days === 0 ? "Hoy" : g.days === 1 ? "Mañana" : ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][new Date(g.iso + "T12:00:00Z").getUTCDay()]} ${fmtDiaCorto(g.iso)}`);
