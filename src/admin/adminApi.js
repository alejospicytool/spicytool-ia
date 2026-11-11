// Capa de datos de "Admin Spicy". HOY lee y escribe sobre los datos de ejemplo (adminMock.js) en memoria: al recargar
// la página vuelve todo al estado inicial. Las funciones tienen la forma de los endpoints que va a tener el backend
// (ver PLAN.md), así que al conectar Mongo / Postgres solo se reemplaza este archivo; las pantallas no cambian.
import { MOCK } from "./adminMock.js";
import { matchesSearch, matchesFilters, isOwner, isPaused, matchesCompanySearch, sortCompaniesByName, sortUsersRecent, paginate, companyIdOf, userFullName, planOf, isPaidPlan, PAID_PLANS, validateCompanyEdit, validateContactEdit, validateSupportReason, buildSupportRequest, SUPPORT_ACTIONS, diffFields, buildAuditEntry, sortByPosition } from "./adminLogic.js";

let db = structuredClone(MOCK);
let audit = [];
let auditSeq = 0;

// Solo para tests: vuelve al estado inicial.
export function resetMock() { db = structuredClone(MOCK); audit = []; auditSeq = 0; sessionSeq = 0; subSeq = 0; linkSeq = 0; idempotent.clear(); }

const copy = (x) => structuredClone(x);
const byId = (coll, id) => db[coll].find((x) => x._id === id);
const fail = (msg) => { throw new Error(msg); };
// Se exige antes de tocar nada: así una acción sin responsable no cambia datos ni queda a medio registrar.
const needActor = (actor) => { if (!actor) fail("La auditoría necesita saber quién hizo la acción."); };

function log(actor, action, { targetType, targetId, targetLabel, companyId, detail }) {
  const entry = buildAuditEntry({ id: ++auditSeq, actor, action, targetType, targetId, targetLabel, companyId, detail });
  audit.unshift(entry);
  return entry;
}

// ── Lectura ─────────────────────────────────────────────────────────────────────────────────────
// GET /admin/users?search=&owners=&activeOnly=&page=&pageSize=   (filtrado y paginado del lado del servidor)
export async function listUsers({ search = "", page = 1, pageSize = 8, owners = false, activeOnly = false } = {}) {
  const rows = db.users.map((u) => ({ u, co: byId("companies", companyIdOf(u)) }))
    .filter(({ u, co }) => matchesSearch(u, search) && matchesFilters(u, co, { owners, activeOnly }));
  const p = paginate(sortUsersRecent(rows.map((r) => r.u)), page, pageSize);
  return {
    ...p,
    items: p.items.map((u) => {
      const co = byId("companies", companyIdOf(u));
      return { ...copy(u), companyName: co ? co.name : "—", companyStatus: co ? co.status : null, isOwner: isOwner(u, co) };
    }),
  };
}

// GET /admin/companies?status=active|paused&search=&page=&pageSize=
// "counts" son los totales de cada lista con la búsqueda aplicada, para mostrarlos en las pestañas.
export async function listCompanies({ status = "active", search = "", page = 1, pageSize = 8 } = {}) {
  const found = db.companies.filter((c) => matchesCompanySearch(c, search));
  const counts = { active: found.filter((c) => !isPaused(c)).length, paused: found.filter(isPaused).length };
  const list = sortCompaniesByName(found.filter((c) => (status === "paused" ? isPaused(c) : !isPaused(c))));
  const p = paginate(list, page, pageSize);
  return { ...p, counts, items: p.items.map((c) => ({ ...copy(c), userCount: db.users.filter((u) => (u.companies || []).includes(c._id)).length })) };
}

// GET /admin/companies/:id/users   (el owner primero)
export async function listCompanyUsers(companyId) {
  const co = byId("companies", companyId) || fail("No se encontró la company.");
  const users = db.users.filter((u) => (u.companies || []).includes(companyId)).map((u) => ({ ...copy(u), isOwner: isOwner(u, co) }));
  return users.sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || userFullName(a).localeCompare(userFullName(b), "es", { sensitivity: "base" }));
}

export async function getUser(userId) {
  const u = byId("users", userId);
  return u ? copy(u) : null;
}

// Todo lo de una company: sus datos y sus colecciones hijas.
// GET /admin/companies/:id
export async function getCompanyBundle(companyId) {
  const company = byId("companies", companyId);
  if (!company) fail("No se encontró la company.");
  const own = (coll) => copy(db[coll].filter((x) => x.companyId === companyId));
  return {
    company: copy(company),
    users: copy(db.users.filter((u) => (u.companies || []).includes(companyId))),
    contacts: [...own("contacts")].reverse(),
    campaigns: own("campaigns"),
    landings: own("landings"),
    conversions: own("companyconversions"),
    whatsappConversions: own("whatsappconversions"),
    pipelines: own("pipelines"),
    templates: own("whatsapptemplates"),
    webforms: sortByPosition(own("webforms")),
    contactLists: sortByPosition(own("contactlists")),
    workflows: own("workflows"),
  };
}

// GET /admin/pipelines/:id/stages
export async function getPipelineStages(pipelineId) {
  return copy(sortByPosition(db.pipelinestages.filter((s) => s.pipelineId === pipelineId)));
}

// GET /admin/companies/:id/credits   (Postgres de billing: credit_balances + credit_transactions)
export async function getCredits(companyId) {
  const balance = db.credit_balances.find((b) => b.company_id === companyId) || null;
  const transactions = db.credit_transactions.filter((t) => t.company_id === companyId).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return copy({ balance, transactions });
}

// GET /admin/audit
export async function listAudit({ companyId = null, limit = 50, actions = null } = {}) {
  return copy(audit.filter((a) => (!companyId || a.companyId === companyId) && (!actions || actions.includes(a.action))).slice(0, limit));
}

// ── Escritura (cada una deja una entrada en la auditoría) ─────────────────────────────────────────
// PATCH /admin/companies/:id
export async function updateCompany(companyId, fields, actor) {
  needActor(actor);
  const co = byId("companies", companyId) || fail("No se encontró la company.");
  const v = validateCompanyEdit(fields);
  if (!v.ok) fail(Object.values(v.errors)[0]);
  const changes = diffFields(co, v.value, ["name", "phoneNumber", "credits"]);
  Object.assign(co, v.value);
  log(actor, "company_edit", { targetType: "company", targetId: companyId, targetLabel: co.name, companyId, detail: { changes } });
  return copy(co);
}

// PATCH /admin/users/:id   (ficha de contacto)
export async function updateUserContact(userId, fields, actor) {
  needActor(actor);
  const u = byId("users", userId) || fail("No se encontró el usuario.");
  const v = validateContactEdit(fields);
  if (!v.ok) fail(Object.values(v.errors)[0]);
  if (db.users.some((x) => x._id !== userId && x.email.toLowerCase() === v.value.email.toLowerCase())) fail("Ya existe otro usuario con ese email.");
  const changes = diffFields(u, v.value, ["name", "surname", "email", "phoneNumber"]);
  Object.assign(u, v.value);
  log(actor, "contact_edit", { targetType: "user", targetId: userId, targetLabel: userFullName(u), companyId: companyIdOf(u), detail: { changes } });
  return copy(u);
}

// PATCH /admin/companies/:id/status
export async function setCompanyStatus(companyId, status, actor) {
  needActor(actor);
  if (status !== "paused" && status !== "active") fail("Estado inválido: " + status);
  const co = byId("companies", companyId) || fail("No se encontró la company.");
  const from = co.status;
  co.status = status;
  log(actor, status === "paused" ? "company_pause" : "company_activate", { targetType: "company", targetId: companyId, targetLabel: co.name, companyId, detail: { from, to: status } });
  return copy(co);
}

// ── Webhooks de back office (doc "Back office webhooks: subscriptions") ─────────────────────────────
// Hoy se SIMULAN. En producción los llama una función de backend que guarda el token (x-webhook-token); el front nunca lo ve.
// Los errores llevan el mismo status y "code" que el webhook real, para que la pantalla los explique igual.
export class WebhookError extends Error {
  constructor(status, code, message, extra = {}) { super(message); this.name = "WebhookError"; this.status = status; this.code = code; this.extra = extra; }
}
const wh = (status, code, message, extra) => { throw new WebhookError(status, code, message, extra); };
let sessionSeq = 0, subSeq = 0;
const idempotent = new Map(); // clave → primera respuesta (el webhook real no cobra dos veces con la misma clave)
const cardUrl = () => `https://billing.stripe.com/p/session/mock_${++sessionSeq}`;

// Precios que se pueden usar: activos y mensuales (el webhook rechaza el resto con PRECIO_INVALIDO).
export async function listPrices() {
  return copy(db.stripe_prices.filter((p) => p.active && p.interval === "month"));
}

// POST /webhooks/backoffice/subscription   → 201. COBRA la tarjeta al instante; si el cobro falla no cambia nada.
export async function assignPlan(userId, { plan, stripePriceId, idempotencyKey } = {}, actor) {
  needActor(actor);
  const u = byId("users", userId) || wh(404, "USUARIO_NO_ENCONTRADO", "No Spicytool account with that email");
  const target = { targetType: "user", targetId: userId, targetLabel: userFullName(u), companyId: companyIdOf(u) };
  const failed = (status, code, message, extra) => {
    log(actor, "plan_assign_failed", { ...target, detail: { plan, stripePriceId, code } });
    wh(status, code, message, extra);
  };
  if (idempotencyKey && idempotent.has(idempotencyKey)) return copy(idempotent.get(idempotencyKey));
  if (!isPaidPlan(plan)) failed(400, "PLAN_INVALIDO", "Plan must be one of " + PAID_PLANS.join(", "));
  if (!stripePriceId) failed(400, "PRECIO_REQUERIDO", "stripePriceId is required");
  const price = db.stripe_prices.find((p) => p.id === stripePriceId);
  if (!price || !price.active || price.interval !== "month") failed(400, "PRECIO_INVALIDO", "The price does not exist, is archived or is not recurring");
  if (u.stripe?.deleted) failed(409, "CLIENTE_STRIPE_BORRADO", "The customer was deleted in Stripe");
  if (u.stripe?.priceId === stripePriceId && isPaidPlan(planOf(u))) failed(409, "YA_SUSCRIPTO", "The customer already has an active subscription to that price");
  const pm = u.stripe?.paymentMethod;
  if (pm === "none") failed(402, "SIN_MEDIO_DE_PAGO", "The customer has no card in Stripe", { paymentMethodUpdateUrl: cardUrl() });
  if (pm === "declined") failed(402, "PAGO_RECHAZADO", "Your card was declined.", { decline_code: "insufficient_funds", paymentMethodUpdateUrl: cardUrl() });
  // Cobro aprobado: recién ahora cambia el plan
  const previousPlan = planOf(u);
  const newSubId = `sub_1MockNew${++subSeq}`;
  u.subscription = { ...u.subscription, subscriptionType: plan, subscriptionId: newSubId };
  u.stripe = { ...u.stripe, subscriptionId: newSubId, priceId: stripePriceId };
  const result = { message: "Subscription assigned and charged", userEmail: u.email, plan, previousPlan, stripePriceId, stripeSubscriptionId: newSubId, oldSubscriptionCancelled: true, billingFailures: [] };
  if (idempotencyKey) idempotent.set(idempotencyKey, result);
  log(actor, "plan_assign", { ...target, detail: { plan, previousPlan, stripePriceId, stripeSubscriptionId: result.stripeSubscriptionId, idempotencyKey: idempotencyKey || null } });
  return copy(result);
}

// POST /webhooks/backoffice/payment-method-url   → 200. No cobra ni cambia la suscripción; el link es de un solo uso.
export async function getPaymentMethodUrl(userId, actor) {
  needActor(actor);
  const u = byId("users", userId) || wh(404, "USUARIO_NO_ENCONTRADO", "No Spicytool account with that email");
  const url = cardUrl();
  log(actor, "card_link_created", { targetType: "user", targetId: userId, targetLabel: userFullName(u), companyId: companyIdOf(u), detail: {} });
  return { userEmail: u.email, stripeCustomerId: u.stripe?.customerId || null, paymentMethodUpdateUrl: url };
}

// DELETE /admin/workflows/:id
export async function deleteWorkflow(workflowId, actor) {
  needActor(actor);
  const i = db.workflows.findIndex((w) => w._id === workflowId);
  if (i < 0) fail("No se encontró el workflow.");
  const [w] = db.workflows.splice(i, 1);
  log(actor, "workflow_delete", { targetType: "workflow", targetId: workflowId, targetLabel: w.name, companyId: w.companyId, detail: { name: w.name } });
  return { ok: true };
}

// ── Soporte: entrar como usuario ────────────────────────────────────────────────────────────────────
// Hoy se SIMULA. En producción: una función de backend (1) comprueba que quien llama sea admin CON permiso de soporte
// (tabla support_access), (2) hace el login contra la API de Spicytool con una cuenta de servicio guardada como secret
// (el front no maneja contraseñas), (3) pide POST admin/support-sessions/link y (4) guarda la auditoría, sin el link.
// La respuesta real de la API no está documentada: acá se supone { url, expiresAt }.
export class SupportError extends WebhookError {}
const sup = (status, code, message) => { throw new SupportError(status, code, message); };
// En el mock tienen permiso todos menos estos. En producción es al revés: solo los habilitados explícitamente.
const SUPPORT_DENIED = ["sin.permiso@ejemplo.test"];
let linkSeq = 0;
const SUPPORT_LINK_MINUTES = 15; // supuesto

// GET /admin/me/permissions
export async function getMyPermissions(actor) {
  needActor(actor);
  return { support: !SUPPORT_DENIED.includes(String(actor).trim().toLowerCase()) };
}

// POST /admin/support-sessions/link
export async function createSupportLink(userId, reason, actor, now = new Date()) {
  needActor(actor);
  const u = byId("users", userId);
  const co = u && byId("companies", companyIdOf(u));
  const target = u ? { targetType: "user", targetId: userId, targetLabel: userFullName(u), companyId: companyIdOf(u) } : { targetType: "user", targetId: userId, targetLabel: userId, companyId: null };
  if (!(await getMyPermissions(actor)).support) {
    log(actor, "support_link_denied", { ...target, detail: { targetEmail: u ? u.email : null, reason: validateSupportReason(reason).value } });
    sup(403, "SIN_PERMISO_SOPORTE", "Support access is not enabled for this admin");
  }
  if (!u) sup(404, "USUARIO_NO_ENCONTRADO", "User not found");
  if (!co) sup(422, "SIN_COMPANY", "The user has no company");
  const v = validateSupportReason(reason);
  if (!v.ok) sup(422, "MOTIVO_INVALIDO", v.error);
  const req = buildSupportRequest(u, v.value);
  const result = { url: `https://app.example.test/support-session?token=mock_${++linkSeq}`, expiresAt: new Date(new Date(now).getTime() + SUPPORT_LINK_MINUTES * 60000).toISOString() };
  // La auditoría guarda quién, a quién, a qué company y el motivo. NUNCA el link.
  log(actor, "support_link_created", { ...target, detail: { targetEmail: req.targetEmail, companyName: co ? co.name : null, reason: req.reason, expiresAt: result.expiresAt } });
  return result;
}

// GET /admin/support-sessions   (el registro; sin links)
export async function listSupportLog({ search = "", page = 1, pageSize = 10 } = {}) {
  const q = String(search || "").trim().toLowerCase();
  const rows = (await listAudit({ actions: SUPPORT_ACTIONS, limit: 1000 })).filter((a) => !q || [a.actor, a.targetLabel, a.detail?.targetEmail, a.detail?.companyName, a.detail?.reason].some((v) => v && String(v).toLowerCase().includes(q)));
  return paginate(rows, page, pageSize);
}
