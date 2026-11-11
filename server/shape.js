// Convierte documentos de Mongo en lo que consume el backoffice. LISTA PERMITIDA: lo que no se nombra acá no sale nunca
// (passwordHash, tokens de Brizy/Tokko/Tiendanube/Tera/EasyBroker, appToken de WhatsApp, etc.). Función pura: se prueba en shape.test.js.
import { isPaused } from "../src/admin/adminLogic.js";

const str = (v) => (v == null ? null : String(v));
const dateOf = (id) => (id && /^[0-9a-f]{24}$/i.test(String(id)) ? new Date(parseInt(String(id).slice(0, 8), 16) * 1000).toISOString() : null);
const iso = (v) => { if (v == null) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };

// Campos que se le piden a Mongo (projection). Es la misma lista que usan los shape*: pedir de más no está permitido.
export const USER_PROJECTION = {
  email: 1, name: 1, surname: 1, phoneNumber: 1, companies: 1, creationDate: 1, activeWhatsAppProvider: 1,
  "kapso.kapsoAppId": 1, "gupshup.whatsAppAppId": 1, "subscription.subscriptionType": 1, "subscription.subscriptionId": 1,
  "stripe.customerId": 1, "stripe.subscriptionId": 1,
};
export const COMPANY_PROJECTION = {
  name: 1, status: 1, userEmail: 1, phoneNumber: 1, credits: 1, currency: 1, vertical: 1, teamSize: 1, creationDate: 1, accountId: 1,
  activeWhatsAppConversations: 1, isConfigured: 1, onboardingEnded: 1, trackId: 1, lastUnpaidBill: 1,
};

export function shapeUser(d) {
  return {
    _id: str(d._id), email: d.email || "", name: d.name || "", surname: d.surname || "", phoneNumber: d.phoneNumber || "",
    creationDate: d.creationDate || dateOf(d._id),
    companies: Array.isArray(d.companies) ? d.companies.map(String) : [],
    activeWhatsAppProvider: d.activeWhatsAppProvider || null,
    kapso: { kapsoAppId: (d.kapso && d.kapso.kapsoAppId) || null },
    gupshup: { whatsAppAppId: (d.gupshup && d.gupshup.whatsAppAppId) || null },
    subscription: { subscriptionType: (d.subscription && d.subscription.subscriptionType) || null, subscriptionId: (d.subscription && d.subscription.subscriptionId) || null },
    stripe: { customerId: (d.stripe && d.stripe.customerId) || null, subscriptionId: (d.stripe && d.stripe.subscriptionId) || null },
  };
}

// Estado: solo "paused" cuenta como pausada; cualquier otro valor (incluidos "", "undefined" o faltante) es activa.
export function shapeCompany(d) {
  return {
    _id: str(d._id), name: d.name || "", status: isPaused(d) ? "paused" : "active", statusRaw: d.status == null ? null : String(d.status),
    userEmail: d.userEmail || "", phoneNumber: d.phoneNumber || "", credits: typeof d.credits === "number" ? d.credits : null, currency: d.currency || null,
    vertical: d.vertical || null, teamSize: d.teamSize || null, creationDate: d.creationDate || dateOf(d._id), accountId: d.accountId || null,
    activeWhatsAppConversations: Array.isArray(d.activeWhatsAppConversations) ? d.activeWhatsAppConversations.length : 0,
    isConfigured: !!d.isConfigured, onboardingEnded: !!d.onboardingEnded, trackId: d.trackId || null, lastUnpaidBill: d.lastUnpaidBill || null,
  };
}

// ── Colecciones hijas de una company: solo los campos que muestra cada pestaña ───────────────────────
export const CHILD = {
  campaigns: { projection: { campaignName: 1, campaignId: 1, campaignStatus: 1, budgetPerDay: 1, investedPerDay: 1, accountId: 1 },
    shape: (d) => ({ _id: str(d._id), campaignName: d.campaignName || "", campaignId: d.campaignId || "", campaignStatus: d.campaignStatus && d.campaignStatus.status ? "ENABLED" : "PAUSED", budgetPerDay: d.budgetPerDay ?? null, investedPerDay: d.investedPerDay ?? null, accountId: d.accountId || "" }) },
  landings: { projection: { companyName: 1, businessDescription: 1, landingStatus: 1, createdWithIA: 1 },
    shape: (d) => ({ _id: str(d._id), name: d.companyName || "", description: String(d.businessDescription || "").slice(0, 140), status: (d.landingStatus && d.landingStatus.status) || "", createdWithIA: !!d.createdWithIA }) },
  companyconversions: { projection: { conversionName: 1, condition: 1, conversionCategory: 1 },
    shape: (d) => ({ _id: str(d._id), conversionName: d.conversionName || "", condition: d.condition || "", conversionCategory: d.conversionCategory || "" }) },
  whatsappconversions: { projection: { date: 1, behavior: 1, checked: 1, source: 1, trackId: 1 },
    shape: (d) => ({ _id: str(d._id), date: d.date || null, behavior: d.behavior || "", checked: !!d.checked, source: d.source || "", trackId: d.trackId || "" }) },
  pipelines: { projection: { name: 1, description: 1 }, shape: (d) => ({ _id: str(d._id), name: d.name || "", description: d.description || "" }) },
  pipelinestages: { projection: { name: 1, description: 1, position: 1, pipelineId: 1 },
    shape: (d) => ({ _id: str(d._id), pipelineId: d.pipelineId || "", name: d.name || "", description: d.description || "", position: Number(d.position) || 0 }) },
  // El nombre exacto de estos campos no se pudo comprobar con una muestra; lo que falte se muestra como "—".
  whatsapptemplates: { projection: { name: 1, category: 1, header: 1, message: 1, variables: 1, status: 1 },
    shape: (d) => ({ _id: str(d._id), name: d.name || "", category: d.category || "", header: d.header || "", message: d.message || "", variables: Array.isArray(d.variables) ? d.variables.map(String) : [], gupshup: { status: d.status || null } }) },
  webforms: { projection: { name: 1, description: 1, created: 1 }, shape: (d) => ({ _id: str(d._id), name: d.name || "", description: d.description || "", created: iso(d.created) }) },
  contactlists: { projection: { name: 1, description: 1 }, shape: (d) => ({ _id: str(d._id), name: d.name || "", description: d.description || "" }) },
  workflows: { projection: { name: 1, description: 1, triggerProperty: 1, triggerValue: 1, status: 1 },
    shape: (d) => ({ _id: str(d._id), name: d.name || "", description: d.description || "", triggerProperty: d.triggerProperty ?? null, triggerValue: d.triggerValue ?? null, active: !!d.status }) },
};

// Webforms y listas no tienen "position" en Mongo: se numeran en el orden en que se crearon.
export const numbered = (rows) => rows.map((r, i) => ({ ...r, position: i + 1 }));

// Sesiones de soporte (colección supportsessions): solo quién, a quién, motivo y tiempos. NUNCA codeHash.
export const SUPPORT_PROJECTION = { actorEmail: 1, targetEmail: 1, reason: 1, createdAt: 1, expiresAt: 1, exchangeCount: 1, companyId: 1, targetUserId: 1 };
export function shapeSupportSession(d, companyName) {
  return {
    id: str(d._id), at: iso(d.createdAt), actor: d.actorEmail || "", action: "support_link_created", targetType: "user", targetId: str(d.targetUserId),
    targetLabel: d.targetEmail || "", companyId: str(d.companyId),
    detail: { targetEmail: d.targetEmail || "", companyName: companyName || null, reason: d.reason || "", expiresAt: iso(d.expiresAt), exchangeCount: d.exchangeCount ?? 0 },
  };
}
