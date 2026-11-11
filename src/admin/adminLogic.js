// Lógica pura de la sección "Admin Spicy" (Usuarios + Company + Créditos): búsqueda, paginación, planes,
// validaciones y armado del registro de auditoría. No toca red ni estado: se prueba en adminLogic.test.js.

// ── Planes ──────────────────────────────────────────────────────────────────────────────────────
// En Retool el plan se guardaba en dos campos distintos (subscription.subscriptionType y subscription.tier).
// Acá hay un solo selector que sabe a qué campo va cada valor. Confirmar la lista real antes de conectar el backend.
export const PLAN_OPTIONS = [
  { key: "promoLanding", label: "Promo landing", field: "subscription.subscriptionType", value: "promo_landing" },
  { key: "freemium", label: "Freemium", field: "subscription.subscriptionType", value: "freemium" },
  { key: "tier3", label: "Tier 3", field: "subscription.tier", value: "tier3" },
  { key: "tier4", label: "Tier 4", field: "subscription.tier", value: "tier4" },
];

export function planPatch(key) {
  const p = PLAN_OPTIONS.find((o) => o.key === key);
  if (!p) throw new Error("Plan inválido: " + key);
  return { field: p.field, value: p.value };
}

// Plan actual de un usuario: si tiene tier3/tier4 manda el tier; si no, el tipo de suscripción.
export function currentPlanKey(user) {
  const s = (user && user.subscription) || {};
  if (s.tier === "tier3" || s.tier === "tier4") return s.tier;
  const byType = PLAN_OPTIONS.find((o) => o.field === "subscription.subscriptionType" && o.value === s.subscriptionType);
  return byType ? byType.key : null;
}

export const planLabel = (key) => (PLAN_OPTIONS.find((o) => o.key === key) || {}).label || "Sin plan";

// Aplica un cambio con ruta con puntos ("subscription.tier") sobre una copia del objeto.
export function setPath(obj, path, value) {
  const out = { ...obj };
  const parts = path.split(".");
  let cur = out;
  for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] = { ...(cur[parts[i]] || {}) }; cur = cur[parts[i]]; }
  cur[parts[parts.length - 1]] = value;
  return out;
}

// ── Búsqueda y paginación ──────────────────────────────────────────────────────────────────────
export const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Email, teléfono, nombre o apellido, sin distinguir mayúsculas. El texto se toma literal (no como regex).
export function matchesSearch(user, q) {
  const text = String(q || "").trim();
  if (!text) return true;
  const re = new RegExp(escapeRegExp(text), "i");
  return [user.email, user.phoneNumber, user.name, user.surname].some((v) => v != null && re.test(String(v)));
}

// Owner de la company: el usuario cuyo email es el "userEmail" de la company.
export function isOwner(user, company) {
  const a = String((user && user.email) || "").trim().toLowerCase();
  const b = String((company && company.userEmail) || "").trim().toLowerCase();
  return a !== "" && a === b;
}

// Filtros de la lista: solo owners y/o solo usuarios de una company activa ("activa" = cualquiera que no esté pausada).
export function matchesFilters(user, company, { owners = false, activeOnly = false } = {}) {
  if (owners && !isOwner(user, company)) return false;
  if (activeOnly && (!company || company.status === "paused")) return false;
  return true;
}

// Más recientes primero. Los _id de Mongo (ObjectId en hexa) crecen con el tiempo.
export const sortUsersRecent = (users) => [...users].sort((a, b) => (String(a._id) < String(b._id) ? 1 : String(a._id) > String(b._id) ? -1 : 0));

export function paginate(items, page, pageSize) {
  const size = Math.max(1, Math.floor(pageSize) || 1);
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const cur = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { items: items.slice((cur - 1) * size, cur * size), total, page: cur, pages, pageSize: size };
}

// ── Datos del usuario / company ────────────────────────────────────────────────────────────────
export const userFullName = (u) => [u && u.name, u && u.surname].filter(Boolean).join(" ") || (u && u.email) || "—";
export const companyIdOf = (u) => (u && Array.isArray(u.companies) && u.companies[0]) || null;

// Proveedor de WhatsApp: Kapso o Gupshup, según el id que tenga cargado.
export function whatsappProvider(user) {
  const k = user && user.kapso && user.kapso.kapsoAppId;
  if (k) return { provider: "Kapso", appId: k };
  const g = user && user.gupshup && user.gupshup.whatsAppAppId;
  if (g) return { provider: "Gupshup", appId: g };
  return null;
}

export const sortByPosition = (rows) => [...rows].sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));

// ── Validaciones de formularios ────────────────────────────────────────────────────────────────
const PHONE_RE = /^\+?[\d\s()-]{6,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCompanyEdit(f) {
  const errors = {};
  const name = String(f.name ?? "").trim();
  const phoneNumber = String(f.phoneNumber ?? "").trim();
  const rawCredits = typeof f.credits === "string" ? f.credits.trim() : f.credits;
  const credits = Number(rawCredits);
  if (!name) errors.name = "El nombre es obligatorio.";
  if (phoneNumber && !PHONE_RE.test(phoneNumber)) errors.phoneNumber = "El teléfono no es válido.";
  if (rawCredits === "" || rawCredits == null || !Number.isFinite(credits) || credits < 0) errors.credits = "Los créditos deben ser un número igual o mayor a 0.";
  return { ok: Object.keys(errors).length === 0, errors, value: { name, phoneNumber, credits } };
}

export function validateContactEdit(f) {
  const errors = {};
  const name = String(f.name ?? "").trim();
  const surname = String(f.surname ?? "").trim();
  const email = String(f.email ?? "").trim();
  const phoneNumber = String(f.phoneNumber ?? "").trim();
  if (!name) errors.name = "El nombre es obligatorio.";
  if (!EMAIL_RE.test(email)) errors.email = "El email no es válido.";
  if (phoneNumber && !PHONE_RE.test(phoneNumber)) errors.phoneNumber = "El teléfono no es válido.";
  return { ok: Object.keys(errors).length === 0, errors, value: { name, surname, email, phoneNumber } };
}

// ── Auditoría ──────────────────────────────────────────────────────────────────────────────────
export const AUDIT_ACTIONS = {
  company_edit: "Editó la company",
  contact_edit: "Editó la ficha de contacto",
  company_pause: "Pausó la company",
  company_activate: "Activó la company",
  plan_change: "Cambió el plan",
  workflow_delete: "Eliminó un workflow",
};
export const auditLabel = (action) => AUDIT_ACTIONS[action] || action;

// Campos que cambiaron entre dos versiones: [{ key, from, to }]
export function diffFields(before, after, keys) {
  return keys.filter((k) => String(before[k] ?? "") !== String(after[k] ?? "")).map((k) => ({ key: k, from: before[k] ?? null, to: after[k] ?? null }));
}

// Quién, qué, cuándo y sobre qué company o usuario.
export function buildAuditEntry({ id, actor, action, targetType, targetId, targetLabel, companyId = null, detail = null, now = new Date() }) {
  if (!actor) throw new Error("La auditoría necesita saber quién hizo la acción.");
  if (!AUDIT_ACTIONS[action]) throw new Error("Acción de auditoría desconocida: " + action);
  return { id, at: new Date(now).toISOString(), actor, action, targetType, targetId, targetLabel: targetLabel || targetId, companyId, detail };
}
