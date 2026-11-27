// Cobros manuales por período en Métricas: un cliente pagó N meses por adelantado (por ejemplo un año o un semestre, con descuento, fuera de la
// suscripción) y se carga a mano para que su MRR no desaparezca. MRR = monto pagado ÷ meses cubiertos, y el cobro VENCE solo al terminar el período.
// Todo puro (sin React ni Supabase) para poder probarlo. La parte que guarda está en la Edge Function revenue-sync (ruta "manual").
import { baDateISO } from "../timeTracking.js";

const round2 = (n) => Math.round(n * 100) / 100;
const MS_DAY = 86400000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const COBRO_MESES_MAX = 36;
export const COBRO_ATAJOS = [[1, "1 mes"], [3, "3 meses"], [6, "6 meses (semestral)"], [12, "12 meses (anual)"]];
const LIVE = ["active", "past_due"];

// "2026-11-27" + 12 meses → "2027-11-27". Si el día no existe en el mes de destino queda el último (31/08 + 6 meses = 28/02). Igual que el servidor.
export function addMonthsISO(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}
const isoDays = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / MS_DAY);
export const fmtDia = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");

// ¿Esta suscripción es un cobro por período cargado a mano? (manual, con fecha de vencimiento de la cobertura)
export const isCobro = (sub) => !!sub && sub.source === "manual" && !!sub.current_period_end;
// Hasta qué día cubre (el día de vencimiento YA no cuenta), como fecha de Buenos Aires.
export const coverageEnd = (sub) => (isCobro(sub) ? baDateISO(new Date(sub.current_period_end)) : null);
export const monthsOfCobro = (sub) => { const it = sub && sub.items && sub.items[0]; return it ? Math.max(1, Number(it.intervalCount) || 1) * (it.interval === "year" ? 12 : 1) : 1; };

// Qué se va a guardar, para mostrarlo ANTES de confirmar. { ok:false, error } si algo no cierra.
export function previewCobro({ amount, months, paidAt }, now = new Date()) {
  const today = baDateISO(now);
  const a = Number(String(amount ?? "").replace(",", "."));
  if (!(a > 0)) return { ok: false, error: "Cargá el monto que pagó el cliente (lo que realmente cobraste, con descuentos)." };
  const m = Number(months);
  if (!Number.isInteger(m) || m < 1 || m > COBRO_MESES_MAX) return { ok: false, error: `Los meses tienen que ser un número entero entre 1 y ${COBRO_MESES_MAX}.` };
  const day = paidAt || today;
  if (!DAY_RE.test(day) || Number.isNaN(Date.parse(day + "T00:00:00Z"))) return { ok: false, error: "La fecha de pago no es válida." };
  if (day > today) return { ok: false, error: "La fecha de pago no puede ser futura." };
  const end = addMonthsISO(day, m);
  if (end <= today) return { ok: false, error: `Ese cobro ya venció el ${fmtDia(end)}: no suma al MRR de hoy. Si es de un período pasado no hace falta cargarlo.` };
  return { ok: true, mrr: round2(a / m), end, months: m, amount: a, paidAt: day };
}

// El cobro manual VIVO de cada cliente (active/past_due y todavía no vencido): clave de cliente → suscripción. Si hay más de uno, el que vence más tarde.
export function liveCobros(subs, now = new Date()) {
  const out = {};
  for (const s of subs || []) {
    if (!isCobro(s) || !LIVE.includes(s.status) || new Date(s.current_period_end) <= now) continue;
    const cur = out[s.customer_key];
    if (!cur || new Date(s.current_period_end) > new Date(cur.current_period_end)) out[s.customer_key] = s;
  }
  return out;
}

// Texto corto para la lista de clientes: { text, tone } o null si no es un cobro manual por período.
export function cobroText(sub, now = new Date()) {
  if (!isCobro(sub)) return null;
  const end = coverageEnd(sub), today = baDateISO(now), days = isoDays(today, end), m = monthsOfCobro(sub);
  const cover = `Cobro manual de ${m} ${m === 1 ? "mes" : "meses"}`;
  if (!LIVE.includes(sub.status)) return null;
  if (days <= 0) return { text: `${cover}: venció el ${fmtDia(end)}`, tone: "warn" };
  if (days <= 30) return { text: `${cover}: cubre hasta el ${fmtDia(end)} (en ${days} ${days === 1 ? "día" : "días"}) · hay que renovarlo`, tone: "warn" };
  return { text: `${cover}: cubre hasta el ${fmtDia(end)}`, tone: "ok" };
}

// Avisos: cobros manuales que ya vencieron pero el MRR del cliente todavía no bajó (falta "Aplicar y recalcular" o el chequeo nocturno),
// y los que vencen en los próximos 30 días (hay que renovarlos).
export function cobroAlerts({ subs = [], customers = [], now = new Date() } = {}) {
  const mrrOf = new Map(customers.map((c) => [c.key, Number(c.mrr) || 0]));
  const nameOf = new Map(customers.map((c) => [c.key, c.name || c.email || c.key]));
  const expired = [], soon = [];
  for (const s of subs) {
    if (!isCobro(s) || !LIVE.includes(s.status)) continue;
    const end = new Date(s.current_period_end);
    if (end <= now) { if ((mrrOf.get(s.customer_key) || 0) > 0) expired.push(s); }
    else if (end - now <= 30 * MS_DAY) soon.push(s);
  }
  const list = (arr) => [...new Set(arr.map((s) => nameOf.get(s.customer_key) || s.customer_key))].slice(0, 4).join(", ") + (arr.length > 4 ? "…" : "");
  const alerts = [];
  if (expired.length) alerts.push({ level: "warn", code: "cobro_vencido", tab: "planes", text: `${expired.length === 1 ? "Un cobro manual ya venció" : expired.length + " cobros manuales ya vencieron"} (${list(expired)}) y el MRR todavía lo cuenta. Entrá a Planes y apretá “Aplicar y recalcular”, o renová el cobro desde Clientes.` });
  if (soon.length) alerts.push({ level: "info", code: "cobro_por_vencer", tab: "clientes", text: `${soon.length === 1 ? "Un cobro manual vence" : soon.length + " cobros manuales vencen"} en los próximos 30 días (${list(soon)}). Si el cliente renueva, cargá el cobro nuevo desde Clientes.` });
  return alerts;
}
