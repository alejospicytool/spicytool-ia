// Lógica pura de la Ficha 360 del cliente (sin React ni Supabase), para poder probarla con vitest.
// El eje es la cuenta de Spicytool (company_id). Lo que no se une solo (pagos de Métricas, deals del CRM, tickets escritos a mano) se SUGIERE por email,
// teléfono o nombre parecido, y una persona lo confirma: lo confirmado se guarda en client_links (ver supabase_cliente_links.sql).

export const LINK_KINDS = { rev_customer: "Pagos (Métricas)", crm_deal: "Deal del CRM", ticket_client: "Tickets" };

const fold = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// Palabras que no sirven para reconocer a una empresa ("Inmobiliaria", "Propiedades", "SRL"…).
const STOP = new Set(["inmobiliaria", "inmobiliarias", "inmobiliario", "propiedades", "propiedad", "grupo", "estudio", "srl", "sas", "sa", "de", "del", "la", "el", "los", "las", "y", "e", "the", "inmuebles", "bienes", "raices", "real", "estate", "constructora", "construcciones", "negocios", "servicios", "consultora", "mat", "ci", "cia"]);
export const nameTokens = (s) => [...new Set(fold(s).replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w.length >= 3 && !STOP.has(w)))];
// 0 a 1: qué parte de las palabras (las del nombre más corto) comparten. Sin palabras útiles no hay coincidencia.
export function nameScore(a, b) {
  const A = nameTokens(a), B = nameTokens(b);
  if (!A.length || !B.length) return 0;
  const shared = A.filter((w) => B.includes(w)).length;
  return shared / Math.min(A.length, B.length);
}
export const NAME_MATCH_MIN = 0.67;
const lastDigits = (p) => { const d = String(p ?? "").replace(/\D/g, ""); return d.length >= 8 ? d.slice(-8) : ""; };
const normEmail = (e) => String(e ?? "").trim().toLowerCase();

// Quiénes son los clientes de Métricas que podrían ser de esta cuenta: mismo email (fuerte) o nombre parecido. No se sugiere a quien ya está vinculado a alguna cuenta.
export function suggestRevCustomers(company, customers, links, emails = []) {
  const mails = new Set([company && company.contact_email, ...emails].map(normEmail).filter(Boolean));
  const taken = new Set((links || []).filter((l) => l.kind === "rev_customer").map((l) => l.ref));
  const out = [];
  for (const c of customers || []) {
    if (taken.has(c.key)) continue;
    if (c.email && mails.has(normEmail(c.email))) out.push({ item: c, reason: "Mismo email", strong: true });
    else if (company && nameScore(company.company_name, c.name) >= NAME_MATCH_MIN) out.push({ item: c, reason: "Nombre parecido", strong: false });
  }
  return out.sort((a, b) => Number(b.strong) - Number(a.strong) || Number(b.item.mrr || 0) - Number(a.item.mrr || 0)).slice(0, 6);
}

// Deals del CRM: por nombre de empresa, nombre del contacto o teléfono. Quedan afuera los que ya están vinculados.
export function suggestDeals(company, deals, links, phones = []) {
  const taken = new Set((links || []).filter((l) => l.kind === "crm_deal").map((l) => l.ref));
  const tel = new Set([company && company.contact_phone, ...phones].map(lastDigits).filter(Boolean));
  const out = [];
  for (const d of deals || []) {
    if (taken.has(d.id)) continue;
    const x = d.data || {};
    if (tel.size && tel.has(lastDigits(x.telefono))) out.push({ item: d, reason: "Mismo teléfono", strong: true });
    else if (company && (nameScore(company.company_name, x.empresa) >= NAME_MATCH_MIN || (company.contact_name && nameScore(company.contact_name, x.contacto) >= NAME_MATCH_MIN))) out.push({ item: d, reason: "Nombre parecido", strong: false });
  }
  return out.sort((a, b) => Number(b.strong) - Number(a.strong)).slice(0, 6);
}

// Nombres de cliente escritos en los tickets que se parecen a esta cuenta. `tickets` = todos los tickets; se agrupan por el texto exacto.
export function suggestTicketClients(company, tickets, links) {
  const taken = new Set((links || []).filter((l) => l.kind === "ticket_client").map((l) => l.ref));
  const count = new Map();
  for (const t of tickets || []) { const n = String(t.client_name || "").trim(); if (n) count.set(n, (count.get(n) || 0) + 1); }
  const out = [];
  for (const [name, n] of count) {
    if (taken.has(name)) continue;
    const s = company ? nameScore(company.company_name, name) : 0;
    if (s >= NAME_MATCH_MIN) out.push({ item: { name, count: n }, reason: s >= 1 ? "Mismo nombre" : "Nombre parecido", strong: s >= 1 });
  }
  return out.sort((a, b) => Number(b.strong) - Number(a.strong) || b.item.count - a.item.count).slice(0, 6);
}

// Pagos que se unen SOLOS: el cliente de Métricas cuya clave es "stripe:<id>" es el mismo cliente de Stripe que guarda Spicytool en el usuario
// (users.stripe.customerId). Se toman los usuarios de la cuenta (sin colaboradores, que pertenecen a otra). Devuelve [{ customer, via }] con via = email del usuario.
export const stripeKeyOf = (customerId) => (customerId ? "stripe:" + String(customerId).trim() : "");
export function autoRevCustomers(users, companyId, customers) {
  const byKey = new Map();
  for (const u of users || []) {
    if (!companyId || !Array.isArray(u.companies) || !u.companies.includes(companyId)) continue;
    const k = stripeKeyOf(u.stripe && u.stripe.customerId);
    if (k && !byKey.has(k)) byKey.set(k, u.email || "");
  }
  return (customers || []).filter((c) => byKey.has(c.key)).map((c) => ({ customer: c, via: byKey.get(c.key) }));
}

// De qué cuenta de Spicytool es un cliente de Métricas (clave "stripe:cus_…" o "manual:…"): primero por el cliente de Stripe de sus usuarios (exacto),
// y si no, por el vínculo confirmado a mano (client_links). `stripeLinks` = [{ customerId, companyId, companyName }]; `manualLinks` = filas de client_links.
// Devuelve { companyId, companyName, via: "auto" | "manual" } o null.
export function companyOfRevCustomer(key, stripeLinks, manualLinks) {
  const k = String(key || "");
  const auto = k.startsWith("stripe:") ? (stripeLinks || []).find((x) => stripeKeyOf(x.customerId) === k) : null;
  if (auto) return { companyId: auto.companyId, companyName: auto.companyName || "", via: "auto" };
  const man = (manualLinks || []).find((l) => (l.kind === undefined || l.kind === "rev_customer") && l.ref === k);
  return man ? { companyId: man.company_id, companyName: "", via: "manual" } : null;
}
// Cuántos de esos clientes tienen cuenta de Spicytool: { auto, manual, sin }.
export function revCustomersSummary(keys, stripeLinks, manualLinks) {
  const out = { auto: 0, manual: 0, sin: 0 };
  for (const k of keys || []) { const c = companyOfRevCustomer(k, stripeLinks, manualLinks); if (!c) out.sin++; else out[c.via]++; }
  return out;
}

export const refsOf = (links, companyId, kind) => (links || []).filter((l) => l.company_id === companyId && l.kind === kind).map((l) => l.ref);
export const linkOf = (links, companyId, kind, ref) => (links || []).find((l) => l.company_id === companyId && l.kind === kind && l.ref === ref) || null;

// Deals de la cuenta: los vinculados a mano + los del onboarding vinculado a esa cuenta (esos son exactos, vienen de "Ganado").
export function dealIdsOfCompany(links, onboarding, companyId) {
  const manual = refsOf(links, companyId, "crm_deal");
  const viaOnb = (onboarding || []).filter((o) => o.spicy_company_id === companyId && o.deal_id).map((o) => o.deal_id);
  return [...new Set([...manual, ...viaOnb])];
}

// Tickets de la cuenta: los que tienen escrito un nombre vinculado a ella.
export function ticketsOfCompany(tickets, links, companyId) {
  const names = new Set(refsOf(links, companyId, "ticket_client"));
  return (tickets || []).filter((t) => names.has(String(t.client_name || "").trim())).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
export const TICKETS_CLOSED = ["Testeando (Prod)", "Solucionado", "Archivado"];
export const ticketsOpen = (list) => (list || []).filter((t) => !TICKETS_CLOSED.includes(t.status));

// Pagos: MRR total de los clientes de Métricas vinculados y estado de sus suscripciones.
export const SUB_STATUS = { active: { label: "Activa", tone: "green" }, trialing: { label: "En prueba", tone: "amber" }, past_due: { label: "Pago atrasado", tone: "red" }, unpaid: { label: "Impaga", tone: "red" }, canceled: { label: "Cancelada", tone: "muted" }, incomplete: { label: "Incompleta", tone: "amber" }, incomplete_expired: { label: "Vencida", tone: "muted" }, paused: { label: "Pausada", tone: "amber" } };
export const subStatusInfo = (s) => SUB_STATUS[s] || { label: s || "—", tone: "muted" };
export const totalMrr = (customers) => (customers || []).reduce((s, c) => s + (Number(c.mrr) || 0), 0);
// Descripción corta de lo que paga una suscripción: "USD 400 / mes".
export function subLine(sub) {
  const it = Array.isArray(sub && sub.items) ? sub.items[0] : null;
  if (!it || it.unitAmount == null) return "—";
  const amount = (Number(it.unitAmount) * (Number(it.quantity) || 1)) / 100;
  const every = Number(it.intervalCount) > 1 ? `cada ${it.intervalCount} ${it.interval === "year" ? "años" : "meses"}` : it.interval === "year" ? "/ año" : "/ mes";
  return `${String(sub.currency || "").toUpperCase()} ${amount.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ${every}`.trim();
}

// Nombre de la etapa de un deal según la configuración del CRM (data.stages).
export const stageName = (stages, id) => ((stages || []).find((s) => s.id === id) || {}).name || id || "—";

// ── Selector de cliente (al crear o editar un ticket) ───────────────────────────────────────────────────────────────────
// Clientes de la cartera de Seguimiento que coinciden con lo escrito (empresa, dueño o email), sin los dados de baja. Sin texto: los primeros por nombre.
export function clientOptions(followup, query, limit = 8) {
  const q = fold(query).trim();
  const rows = (followup || []).filter((r) => !r.baja_en);
  const byName = (a, b) => String(a.company_name || "").localeCompare(String(b.company_name || ""), "es", { sensitivity: "base" });
  if (!q) return [...rows].sort(byName).slice(0, limit);
  const hit = (r) => [r.company_name, r.contact_name, r.contact_email].some((v) => fold(v).includes(q));
  const starts = (r) => fold(r.company_name).startsWith(q);
  return rows.filter(hit).sort((a, b) => Number(starts(b)) - Number(starts(a)) || byName(a, b)).slice(0, limit);
}

// Al elegir un cliente para un ticket, el nombre del ticket queda igual al de la cuenta y se asegura el vínculo nombre → cuenta.
// "ok": ya estaba vinculado a esa cuenta · "create": falta crearlo · "conflict": ese nombre ya está vinculado a OTRA cuenta (no se pisa).
export function linkStatus(links, companyId, name) {
  const l = (links || []).find((x) => x.kind === "ticket_client" && x.ref === name);
  if (!l) return "create";
  return l.company_id === companyId ? "ok" : "conflict";
}
// La cuenta a la que está vinculado el nombre de cliente de un ticket (para mostrarlo ya vinculado al editar).
export const companyOfTicketName = (links, name) => ((links || []).find((x) => x.kind === "ticket_client" && x.ref === String(name || "").trim()) || {}).company_id || null;
