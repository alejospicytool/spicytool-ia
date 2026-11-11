// Lógica pura de la sección "Admin Spicy" (Usuarios + Company + Créditos): búsqueda, paginación, planes,
// validaciones y armado del registro de auditoría. No toca red ni estado: se prueba en adminLogic.test.js.

// ── Planes y suscripciones ──────────────────────────────────────────────────────────────────────
// Los "tier" ya no existen: lo que importa es la suscripción. Los planes pagos se asignan SOLO con el webhook de back office
// (cobra la tarjeta al instante); Freemium y free trial no se asignan desde acá. Fuente: doc "Back office webhooks: subscriptions".
export const PAID_PLANS = ["SpicyOne", "SpicyStart", "SpicyPro", "SpicyProMax"];

// Nombre del plan del usuario. Ojo: el campo real de Mongo hay que confirmarlo; está acá, en un solo lugar.
export const planOf = (user) => (user && user.subscription && user.subscription.plan) || null;
export const planLabel = (plan) => plan || "Sin plan";
export const isPaidPlan = (plan) => PAID_PLANS.includes(plan);

const PRICE_RE = /^(price|prod)_[A-Za-z0-9]+$/;

// Formulario de "Asignar plan": mismas reglas que el webhook, para no llegar a cobrar con datos malos.
export function validatePlanAssignment({ email, plan, stripePriceId }) {
  const errors = {};
  const e = String(email ?? "").trim(), p = String(plan ?? "").trim(), price = String(stripePriceId ?? "").trim();
  if (!EMAIL_RE.test(e)) errors.email = "El email del cliente no es válido.";
  if (!PAID_PLANS.includes(p)) errors.plan = "Elegí uno de los planes pagos (Freemium y free trial no se asignan desde acá).";
  if (!price) errors.stripePriceId = "Falta el precio de Stripe.";
  else if (!PRICE_RE.test(price)) errors.stripePriceId = "El precio de Stripe empieza con price_ (o prod_) y no lleva espacios.";
  return { ok: Object.keys(errors).length === 0, errors, value: { email: e, plan: p, stripePriceId: price } };
}

// Clave para que Stripe no cobre dos veces si se reintenta la misma operación.
export function newIdempotencyKey(now = Date.now(), random = Math.random) {
  const rnd = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Array.from({ length: 4 }, () => Math.floor(random() * 0xffff).toString(16).padStart(4, "0")).join("");
  return `bo-${now.toString(36)}-${rnd}`;
}

export const formatPrice = (amountCents, currency = "usd") => `${String(currency).toUpperCase()} ${(Number(amountCents) / 100).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// Errores del webhook: título para el admin y qué hacer (según la tabla del doc).
export const WEBHOOK_ERRORS = {
  EMAIL_INVALIDO: { title: "El email no es válido", action: "Corregí el email del cliente." },
  USUARIO_NO_ENCONTRADO: { title: "No hay una cuenta con ese email", action: "Revisá el email con el que el cliente entra a la app." },
  PLAN_INVALIDO: { title: "Ese plan no es uno de los pagos", action: "Usá SpicyOne, SpicyStart, SpicyPro o SpicyProMax." },
  PRECIO_REQUERIDO: { title: "Falta el precio", action: "Elegí el precio de Stripe." },
  PRECIO_INVALIDO: { title: "El precio no sirve", action: "No existe en Stripe, está archivado o no es mensual. Copiá el id de nuevo desde Stripe." },
  YA_SUSCRIPTO: { title: "El cliente ya tiene ese precio", action: "No hay nada que hacer: ya está en ese plan. Para cambiar el precio, elegí otro." },
  CLIENTE_STRIPE_BORRADO: { title: "El cliente fue borrado de Stripe", action: "Hace falta un desarrollador." },
  SIN_MEDIO_DE_PAGO: { title: "El cliente no tiene tarjeta guardada", action: "No se cobró nada. Mandale el link para cargar la tarjeta y volvé a intentar." },
  PAGO_RECHAZADO: { title: "La tarjeta fue rechazada", action: "No se cobró ni se cambió nada. Mandale el link para actualizar la tarjeta y, cuando lo haga, volvé a intentar." },
  STRIPE_PORTAL_FALLIDO: { title: "Stripe no pudo generar el link", action: "Probá de nuevo en un minuto; si sigue, avisá a un desarrollador." },
  ERROR: { title: "Error inesperado", action: "Avisá a un desarrollador: el detalle queda en Discord y en los logs del servidor." },
  UNAUTHORIZED: { title: "Falta el token del webhook", action: "Revisá la configuración del servidor." },
  FORBIDDEN: { title: "El token del webhook es incorrecto o venció", action: "Pedile uno nuevo a Jonathan y actualizalo en el servidor." },
};
export const explainWebhookError = (code) => WEBHOOK_ERRORS[code] || WEBHOOK_ERRORS.ERROR;

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

// Pausada, sin distinguir mayúsculas. Retool usaba dos criterios distintos (!= "paused" y regex ^paused$ con "i"), así que un
// "Paused" podía aparecer en las dos listas o en ninguna; acá hay una sola definición y todo lo demás es "activa".
export const isPaused = (company) => String((company && company.status) || "").trim().toLowerCase() === "paused";

// Filtros de la lista: solo owners y/o solo usuarios de una company activa (cualquiera que no esté pausada).
export function matchesFilters(user, company, { owners = false, activeOnly = false } = {}) {
  if (owners && !isOwner(user, company)) return false;
  if (activeOnly && (!company || isPaused(company))) return false;
  return true;
}

// Companies: búsqueda literal por nombre o email del owner, y orden por nombre.
export function matchesCompanySearch(company, q) {
  const text = String(q || "").trim();
  if (!text) return true;
  const re = new RegExp(escapeRegExp(text), "i");
  return [company.name, company.userEmail].some((v) => v != null && re.test(String(v)));
}
export const sortCompaniesByName = (companies) => [...companies].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es", { sensitivity: "base" }));

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
  plan_assign: "Asignó un plan (cobró)",
  plan_assign_failed: "Intentó asignar un plan (no se cobró)",
  card_link_created: "Generó un link para cambiar la tarjeta",
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
