// Capa de datos de "Admin Spicy". HOY lee y escribe sobre los datos de ejemplo (adminMock.js) en memoria: al recargar
// la página vuelve todo al estado inicial. Las funciones tienen la forma de los endpoints que va a tener el backend
// (ver PLAN.md), así que al conectar Mongo / Postgres solo se reemplaza este archivo; las pantallas no cambian.
import { MOCK } from "./adminMock.js";
import { matchesSearch, matchesFilters, isOwner, isPaused, matchesCompanySearch, sortCompaniesByName, sortUsersRecent, paginate, companyIdOf, userFullName, planPatch, setPath, validateCompanyEdit, validateContactEdit, diffFields, buildAuditEntry, sortByPosition, PLAN_OPTIONS } from "./adminLogic.js";

let db = structuredClone(MOCK);
let audit = [];
let auditSeq = 0;

// Solo para tests: vuelve al estado inicial.
export function resetMock() { db = structuredClone(MOCK); audit = []; auditSeq = 0; }

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
export async function listAudit({ companyId = null, limit = 50 } = {}) {
  return copy(audit.filter((a) => !companyId || a.companyId === companyId).slice(0, limit));
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

// PATCH /admin/users/:id/plan   (un solo endpoint: valida el plan y sabe a qué campo va)
export async function changePlan(userId, planKey, actor) {
  needActor(actor);
  const u = byId("users", userId) || fail("No se encontró el usuario.");
  if (!PLAN_OPTIONS.some((o) => o.key === planKey)) fail("Plan inválido: " + planKey);
  const { field, value } = planPatch(planKey);
  const before = { subscriptionType: u.subscription?.subscriptionType ?? null, tier: u.subscription?.tier ?? null };
  const next = setPath(u, field, value);
  u.subscription = next.subscription;
  log(actor, "plan_change", { targetType: "user", targetId: userId, targetLabel: userFullName(u), companyId: companyIdOf(u), detail: { plan: planKey, field, value, before } });
  return copy(u);
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
