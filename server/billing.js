// Cambio de suscripción y link de tarjeta. COBRA dinero real: cada paso está pensado para que un error nunca cobre de más ni deje
// un cobro sin registro.
//  1. El email del cliente sale de Mongo y el admin de la sesión de Supabase; el navegador solo dice "qué usuario, qué plan, qué precio".
//  2. Si hay lista de emails permitidos (WEBHOOK_ALLOWED_EMAILS), solo esos clientes se pueden tocar.
//  3. Tope de intentos por admin por minuto.
//  4. Primero se guarda la auditoría "iniciado"; si no se puede guardar, NO se cobra.
//  5. Si la respuesta del cobro no llega (red, tiempo), no se afirma que falló: se avisa que hay que revisar Stripe, y reintentar con la
//     misma clave de idempotencia no cobra dos veces.
//  6. Ni el token del webhook ni los links de Stripe se guardan en la auditoría.
import { validatePlanAssignment, userFullName } from "../src/admin/adminLogic.js";
import { UncertainOutcome } from "./webhooks.js";

const KEY_RE = /^[A-Za-z0-9_.:-]{8,100}$/;
const fail = (status, code, message, extra = {}) => ({ status, body: { code, message, ...extra } });

export function makeBilling({ getUser, webhook, audit, allowedEmails = [], now = () => Date.now(), maxPerMinute = 10, log = console.error, newKey = () => `bo-srv-${now().toString(36)}-${Math.random().toString(36).slice(2, 10)}` }) {
  const allowed = new Set(allowedEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean));
  const attempts = new Map(); // email del admin → momentos de sus últimos intentos

  const tooMany = (adminEmail) => {
    const t = now(), recent = (attempts.get(adminEmail) || []).filter((x) => t - x < 60_000);
    if (recent.length >= maxPerMinute) { attempts.set(adminEmail, recent); return true; }
    attempts.set(adminEmail, [...recent, t]);
    return false;
  };
  const saveLater = async (token, entry) => { try { await audit.record(token, entry); return true; } catch (e) { log("AUDITORÍA SIN GUARDAR:", JSON.stringify(entry), e.message); return false; } };

  // Comprobaciones comunes. Devuelve { user } o { error }.
  async function prepare(admin, userId) {
    const user = await getUser(userId);
    if (!user) return { error: fail(404, "USUARIO_NO_ENCONTRADO", "No se encontró el usuario.") };
    if (!user.email) return { error: fail(422, "EMAIL_INVALIDO", "El usuario no tiene email.") };
    if (allowed.size > 0 && !allowed.has(user.email.trim().toLowerCase())) return { error: fail(403, "FUERA_DE_LA_LISTA", "Este cliente no está en la lista de emails habilitados para cobrar desde el backoffice.") };
    if (tooMany(admin.email)) return { error: fail(429, "DEMASIADOS_INTENTOS", "Demasiados intentos en un minuto. Esperá un momento.") };
    return { user };
  }
  const targetOf = (user, userId) => ({ targetType: "user", targetId: userId, targetLabel: userFullName(user), companyId: (user.companies && user.companies[0]) || null });

  return {
    async assignPlan(admin, token, userId, input = {}) {
      const { user, error } = await prepare(admin, userId);
      if (error) return error;

      const v = validatePlanAssignment({ email: user.email, plan: input.plan, stripePriceId: input.stripePriceId });
      if (!v.ok) {
        const code = v.errors.plan ? "PLAN_INVALIDO" : !String(input.stripePriceId ?? "").trim() ? "PRECIO_REQUERIDO" : "PRECIO_INVALIDO";
        return fail(400, code, Object.values(v.errors)[0]);
      }
      if (input.idempotencyKey != null && !KEY_RE.test(String(input.idempotencyKey))) return fail(400, "CLAVE_INVALIDA", "La clave de idempotencia no es válida.");
      const idempotencyKey = input.idempotencyKey ? String(input.idempotencyKey) : newKey();

      const base = { actor: admin.email, ...targetOf(user, userId) };
      const detail = { plan: v.value.plan, stripePriceId: v.value.stripePriceId, idempotencyKey };
      // 4. Sin registro previo no se cobra.
      try { await audit.record(token, { ...base, action: "plan_assign_started", detail }); }
      catch (e) { log("Auditoría no disponible:", e.message); return fail(503, "AUDITORIA_NO_DISPONIBLE", "No se pudo guardar el registro de auditoría, por eso no se intentó el cobro."); }

      let r;
      try { r = await webhook.assign({ email: user.email, plan: v.value.plan, stripePriceId: v.value.stripePriceId, idempotencyKey }); }
      catch (e) {
        if (!(e instanceof UncertainOutcome)) throw e;
        const saved = await saveLater(token, { ...base, action: "plan_assign_unknown", detail: { ...detail, reason: e.reason } });
        return fail(504, "RESULTADO_INCIERTO", "No se pudo confirmar si se cobró. Antes de reintentar revisá Stripe y el aviso de Discord. Si reintentás, se usa la misma clave y Stripe no cobra dos veces.", { auditWarning: !saved });
      }

      if (r.ok) {
        const b = r.body;
        const saved = await saveLater(token, { ...base, action: "plan_assign", detail: { plan: b.plan || v.value.plan, previousPlan: b.previousPlan ?? null, stripePriceId: b.stripePriceId || v.value.stripePriceId, stripeSubscriptionId: b.stripeSubscriptionId ?? null, oldSubscriptionCancelled: b.oldSubscriptionCancelled ?? null, billingFailures: b.billingFailures || [], idempotencyKey } });
        return { status: 201, body: { ...b, auditWarning: !saved } };
      }
      const saved = await saveLater(token, { ...base, action: "plan_assign_failed", detail: { ...detail, code: r.code, decline_code: r.extra.decline_code ?? null } });
      return fail(r.status, r.code, r.message, { ...r.extra, auditWarning: !saved });
    },

    async paymentMethodUrl(admin, token, userId) {
      const { user, error } = await prepare(admin, userId);
      if (error) return error;
      let r;
      try { r = await webhook.cardLink({ email: user.email }); }
      catch (e) { if (!(e instanceof UncertainOutcome)) throw e; return fail(502, "ERROR", "No se pudo generar el link. Probá de nuevo."); }
      if (!r.ok) return fail(r.status, r.code, r.message, r.extra);
      // El link no se guarda; sin registro tampoco se entrega.
      try { await audit.record(token, { actor: admin.email, ...targetOf(user, userId), action: "card_link_created", detail: {} }); }
      catch (e) { log("Auditoría no disponible:", e.message); return fail(503, "AUDITORIA_NO_DISPONIBLE", "No se pudo guardar el registro de auditoría, por eso no se entrega el link."); }
      return { status: 200, body: { userEmail: r.body.userEmail || user.email, stripeCustomerId: r.body.stripeCustomerId ?? null, paymentMethodUpdateUrl: r.body.paymentMethodUpdateUrl } };
    },
  };
}
