// Capa de datos de "Admin Spicy": habla con el servidor del backoffice (/api/admin), que lee y escribe en Mongo. Cada función tiene la forma de su endpoint.
// Las reglas (permisos, validaciones, auditoría, topes) las hace el SERVIDOR; acá solo se arman los pedidos y se traducen los errores.
// Si el servidor no responde, la sección muestra un aviso: nunca se inventan datos.

import { validateSupportReason } from "./adminLogic.js";

let tokenProvider = null, mode = "down";
export function configureAdminApi(getToken) { tokenProvider = getToken; }
// "real" si el servidor respondió al abrir la sección; "down" si no.
export const adminMode = () => mode;

// Errores con código (los webhooks y el soporte devuelven { code, message }); la pantalla los explica con adminLogic.explain*Error.
export class WebhookError extends Error {
  constructor(status, code, message, extra = {}) { super(message); this.name = "WebhookError"; this.status = status; this.code = code; this.extra = extra; }
}
export class SupportError extends WebhookError {}

async function http(path, params = {}, { method = "GET", body: payload } = {}) {
  const token = tokenProvider ? await tokenProvider() : null;
  if (!token) throw new Error("No hay sesión.");
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== false).map(([k, v]) => [k, String(v)])).toString();
  const headers = { Authorization: `Bearer ${token}` };
  if (payload !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`/api/admin${path}${qs ? "?" + qs : ""}`, { method, headers, body: payload === undefined ? undefined : JSON.stringify(payload) });
  let body = null;
  try { body = await res.json(); } catch { /* sin cuerpo JSON */ }
  if (!res.ok) {
    // Los webhooks devuelven { code, message, decline_code?, paymentMethodUpdateUrl? }; el resto { error }.
    const e = body && body.code ? new WebhookError(res.status, body.code, body.message || body.code, { decline_code: body.decline_code, paymentMethodUpdateUrl: body.paymentMethodUpdateUrl, auditWarning: body.auditWarning })
      : Object.assign(new Error((body && body.error) || `Error ${res.status}`), { status: res.status });
    throw e;
  }
  return body;
}

// Prueba el servidor. Devuelve "real" si responde bien y "down" si no (sin sesión, servidor caído o respuesta rara).
export async function probeAdminApi() {
  mode = "down";
  if (!tokenProvider) return mode;
  try { const r = await http("/health"); if (r && r.ok === true && r.mode === "real") mode = "real"; } catch { /* sin servidor */ }
  return mode;
}

// ── Lectura ─────────────────────────────────────────────────────────────────────────────────────
export const listUsers = ({ search = "", page = 1, pageSize = 8, owners = false, activeOnly = false, plan = "" } = {}) => http("/users", { search, page, pageSize, owners, activeOnly, plan });
export async function getUser(userId) { try { return await http(`/users/${encodeURIComponent(userId)}`); } catch (e) { if (e.status === 404) return null; throw e; } }
export const listCompanies = ({ status = "active", search = "", plan = "", page = 1, pageSize = 8 } = {}) => http("/companies", { status, search, plan, page, pageSize });
export const listCompanyUsers = (companyId) => http(`/companies/${encodeURIComponent(companyId)}/users`);
// Todo lo de una company: sus datos y sus colecciones hijas.
export const getCompanyBundle = (companyId) => http(`/companies/${encodeURIComponent(companyId)}`);
export const getPipelineStages = (pipelineId) => http(`/pipelines/${encodeURIComponent(pipelineId)}/stages`);
// El saldo de créditos de WhatsApp vive en otra base (billing), todavía sin conectar.
export const getCredits = async () => ({ balance: null, transactions: [], unavailable: true });
export const listAudit = ({ companyId = null, limit = 50 } = {}) => http("/audit", { companyId, limit });
// Conexiones de WhatsApp (Kapso) de todas las companies: ?status=pending|connected|all
export const listKapsoApps = ({ status = "pending", search = "", activeOnly = true, page = 1, pageSize = 10 } = {}) => http("/kapso-apps", { status, search, activeOnly: activeOnly ? "1" : "0", page, pageSize });
export const listSupportLog = ({ search = "", page = 1, pageSize = 10 } = {}) => http("/support-sessions", { search, page, pageSize });
export const listCoupons = () => http("/coupons");
// Qué cuenta de Spicytool es de cada cliente de Stripe: [{ customerId, companyId, companyName, userEmail }].
export const listStripeCustomers = () => http("/stripe-customers");
export const listPrices = () => http("/prices");

// Qué puede hacer quien está conectado. canAct / level / support vienen del servidor: la que manda es esa API; esto solo deshabilita botones.
export async function getMyPermissions() {
  const me = await http("/me");
  return { support: !!(me && me.support), disabledReason: "Entrar como usuario necesita el permiso de soporte. Pedíselo a un admin.", canAct: !!(me && me.canAct), level: me && me.level };
}

// ── Escritura (el servidor audita cada una a nombre de quien la hace, que sale de la sesión) ───────────
const post = (path, body = {}) => http(path, {}, { method: "POST", body });
// Escriben solo los campos que cambiaron.
export const updateCompany = (companyId, fields) => post(`/companies/${encodeURIComponent(companyId)}`, fields);
export const updateUserContact = (userId, fields) => post(`/users/${encodeURIComponent(userId)}`, fields);
export const setCompanyStatus = (companyId, status) => post(`/companies/${encodeURIComponent(companyId)}/status`, { status });
// Cambia QUÉ conexión de WhatsApp (Kapso) usa el usuario.
export const setUserKapsoApp = (userId, appId) => post(`/users/${encodeURIComponent(userId)}/kapso-app`, { appId });
// El link para que el cliente termine de conectar su número: se pide de a uno, queda auditado y nunca viaja en las listas.
export const getKapsoSetupLink = (appId) => post(`/kapso-apps/${encodeURIComponent(appId)}/setup-link`);
// COBRA de verdad la tarjeta del cliente. La clave de idempotencia evita cobrar dos veces si se reintenta.
export const assignPlan = (userId, { plan, stripePriceId, idempotencyKey, couponId } = {}) => post(`/users/${encodeURIComponent(userId)}/subscription`, { plan, stripePriceId, idempotencyKey, ...(couponId ? { couponId } : {}) });
export const getPaymentMethodUrl = (userId) => post(`/users/${encodeURIComponent(userId)}/payment-method-url`);
// "Entrar como usuario": el servidor hace el login con la cuenta de Spicytool de quien lo pide ({ email, password }, solo para este pedido: no se guardan)
// y devuelve el link. El email y la company del usuario los toma el servidor de Mongo; acá solo viaja el motivo.
export async function createSupportLink(userId, reason, creds = null) {
  const v = validateSupportReason(reason);
  if (!v.ok) throw new SupportError(422, "MOTIVO_INVALIDO", v.error);
  return post(`/users/${encodeURIComponent(userId)}/support-link`, { reason: v.value, spicyEmail: creds && creds.email, spicyPassword: creds && creds.password });
}
