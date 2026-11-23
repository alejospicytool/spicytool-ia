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
