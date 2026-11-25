// "Enviar al CRM": pasa un usuario Freemium de Admin Spicy al CRM comercial como un deal nuevo, en la etapa del pipeline que se elija,
// para que Comercial lo convierta a plan pago. Usa la misma lógica del CRM (blankDeal/saveDeal), así el deal queda igual que uno cargado a mano.
// La parte de arriba es pura (se prueba en crmSend.test.js); al final están las dos llamadas a Supabase (leer config/deals y crear el deal).
import { createCrm } from "../crm/crmLogic.js";
import * as A from "../crm/crmActions.js";
import { userFullName, planOf } from "./adminLogic.js";

// Solo se envían los Freemium (los free trial y los pagos ya tienen otro camino).
export const canSendToCrm = (user) => planOf(user) === "Freemium";

const last8 = (p) => { const d = String(p ?? "").replace(/\D/g, ""); return d.length >= 8 ? d.slice(-8) : ""; };
const normEmail = (e) => String(e ?? "").trim().toLowerCase();
const normName = (s) => String(s ?? "").trim().toLowerCase();

export const openStages = (config) => ((config && config.stages) || []).filter((s) => s.kind === "open");

// Deals del CRM que ya corresponden a este usuario. "strong" = es el mismo usuario (lo mandamos nosotros antes) o el mismo email/teléfono;
// "weak" = misma empresa por nombre exacto (puede ser otra persona de la misma empresa).
export function findExistingDeals(deals, user, companyName = "") {
  const mail = normEmail(user && user.email), tel = last8(user && user.phoneNumber), co = normName(companyName);
  const out = [];
  for (const d of deals || []) {
    if (user && d.spicyUserId && d.spicyUserId === user._id) out.push({ deal: d, strong: true, reason: "Ya lo enviaste al CRM" });
    else if (mail && normEmail(d.email) === mail) out.push({ deal: d, strong: true, reason: "Mismo email" });
    else if (tel && last8(d.telefono) === tel) out.push({ deal: d, strong: true, reason: "Mismo teléfono" });
    else if (co.length > 3 && normName(d.empresa) === co) out.push({ deal: d, strong: false, reason: "Misma empresa" });
  }
  return out.sort((a, b) => Number(b.strong) - Number(a.strong));
}
// Deal ya enviado desde Admin Spicy para este usuario (para mostrar "En el CRM" en la lista).
export const sentDealOf = (deals, user) => (deals || []).find((d) => user && d.spicyUserId && d.spicyUserId === user._id) || null;

// Valores iniciales del formulario a partir de la config del CRM.
export function defaultSendForm(config, today) {
  const c = config || {};
  const st = openStages(c);
  return { stage: (st[0] || {}).id || "", vendedor: (c.sellers || [])[0] || "", proxima: (c.acciones || [])[0] || "", proximaFecha: today || "", nota: "" };
}

const fmtDay = (iso) => { const p = String(iso || "").split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ""; };

// Arma el deal. Devuelve { deal } o { error }. No toca la base.
export function buildFreemiumDeal(config, user, { companyName = "", form, actor = "", now = new Date() } = {}) {
  if (!config || !Array.isArray(config.stages) || !config.stages.length) return { error: "El CRM todavía no está configurado." };
  const f = form || {};
  const st = openStages(config).find((s) => s.id === f.stage);
  if (!st) return { error: "Elegí una etapa del pipeline (solo etapas abiertas: un freemium todavía no es un cliente)." };
  const crm = createCrm({ config: JSON.parse(JSON.stringify(config)), deals: [], tasks: [] }, { now });
  const name = userFullName(user);
  const co = String(companyName || "").trim();
  const empresa = co && co !== "—" ? co : name;
  const origen = (config.sources || []).find((x) => /freemium/i.test(x)) || "";
  const mail = String(user.email || "").trim();
  const notas = [
    "Usuario Freemium de Spicytool." + (mail ? " Email: " + mail + "." : ""),
    String(f.nota || "").trim(),
  ].filter(Boolean).join("\n");
  const preset = { empresa, contacto: name, telefono: String(user.phoneNumber || "").trim(), email: mail, spicyUserId: user._id, origen };
  const nd = A.blankDeal(crm, st.id, preset);
  const r = A.saveDeal(crm, nd, {
    empresa, contacto: name, telefono: preset.telefono, stage: st.id, vendedor: f.vendedor || nd.vendedor, plan: nd.plan, cierre: nd.cierre, pais: "", tipo: nd.tipo, origen, partner: "",
    proxima: f.proxima || "", proximaFecha: f.proxima ? f.proximaFecha || crm.today : "", proximaTipo: "followup", proximaHora: "09:00", motivo: "", motivoDetalle: "", notas, estado: "",
    mrr: nd.mrr, promoMrr: 0, promoMeses: 0, tags: [], calOn: false, calif: null,
  });
  if (r.error) return { error: r.error };
  A.logH(crm, r.deal, "Enviado desde Admin Spicy (usuario Freemium)" + (actor ? " por " + actor : "") + (f.proxima ? " · primer paso: " + f.proxima + " el " + fmtDay(r.deal.proximaFecha) : ""));
  return { deal: r.deal };
}

// ── Supabase (RLS: solo admins o quienes tienen la sección "CRM") ──
export async function loadCrmContext(sb) {
  const [c, d] = await Promise.all([sb.from("crm_config").select("data").eq("id", 1).maybeSingle(), sb.from("crm_deals").select("id,data")]);
  const error = c.error || d.error;
  if (error) throw new Error(error.message || "No se pudo leer el CRM.");
  return { config: c.data ? c.data.data : null, deals: (d.data || []).map((r) => r.data) };
}
export async function insertDeal(sb, deal) {
  const { error } = await sb.from("crm_deals").insert({ id: deal.id, data: deal });
  if (error) throw new Error(/row-level security|permission/i.test(error.message || "") ? "Tu usuario no tiene acceso al CRM." : error.message || "No se pudo crear el deal.");
}
