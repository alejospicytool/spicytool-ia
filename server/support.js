// "Entrar como usuario" (sesión de soporte), igual que en Retool: la persona entra con SU PROPIA cuenta de Spicytool
// (POST login) y con esa sesión se pide el link (POST admin/support-sessions/link). El link abre la cuenta del cliente.
//
// Reglas de seguridad:
//  1. La contraseña de Spicytool llega solo para este pedido: se usa para el login y se descarta. NUNCA se guarda, se escribe en logs,
//     se devuelve ni va a la auditoría. Tampoco el token de sesión que devuelve el login.
//  2. El link es una llave a la cuenta del cliente: se devuelve una sola vez y NUNCA se guarda (ni en auditoría ni en logs).
//  3. El email del cliente y su company salen de Mongo, no del navegador. El motivo es obligatorio.
//  4. Primero se guarda la auditoría "solicitado"; si no se puede guardar, no se pide ningún link.
//  5. Solo admins del backoffice (la tabla de auditoría solo deja escribir a admins) y tope de intentos por minuto
//     (frena también el probar contraseñas de Spicytool a ciegas).
// Los tests usan siempre un fetch falso: nunca se llama al servicio real.
import { validateSupportReason, userFullName, companyIdOf } from "../src/admin/adminLogic.js";

const fail = (status, code, message, extra = {}) => ({ status, body: { code, message, ...extra } });
const EMAIL_RE = /^[^\s@]{1,100}@[^\s@]{1,100}\.[^\s@]{2,30}$/;
const pick = (o, keys) => { for (const k of keys) if (o && typeof o[k] === "string" && o[k]) return o[k]; return null; };
const inner = (b) => (b && typeof b === "object" && b.data && typeof b.data === "object" ? b.data : null);

// El nombre exacto de los campos de la respuesta de Spicytool no está documentado: se aceptan los nombres habituales.
export const tokenOf = (b) => pick(b, ["token", "accessToken", "access_token", "jwt"]) || pick(inner(b), ["token", "accessToken", "access_token", "jwt"]);
export const linkOf = (b) => ({
  url: pick(b, ["url", "link", "sessionUrl"]) || pick(inner(b), ["url", "link", "sessionUrl"]),
  expiresAt: pick(b, ["expiresAt", "expires_at"]) || pick(inner(b), ["expiresAt", "expires_at"]),
});

export function makeSupport({ getUser, audit, apiBase = "https://api.spicytool.net/api", fetchImpl = globalThis.fetch, timeoutMs = 20_000, now = () => Date.now(), maxPerMinute = 5, log = console.error } = {}) {
  const base = String(apiBase).replace(/\/+$/, "");
  const attempts = new Map();
  const tooMany = (email) => {
    const t = now(), recent = (attempts.get(email) || []).filter((x) => t - x < 60_000);
    if (recent.length >= maxPerMinute) { attempts.set(email, recent); return true; }
    attempts.set(email, [...recent, t]);
    return false;
  };
  const saveLater = async (token, entry) => { try { await audit.record(token, entry); return true; } catch (e) { log("AUDITORÍA SIN GUARDAR:", JSON.stringify(entry), e.message); return false; } };

  // Devuelve { res, body } o { netError: true }. El cuerpo se lee como JSON si se puede; nunca se loguea.
  async function post(path, payload, headers = {}) {
    let res;
    try { res = await fetchImpl(`${base}/${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(payload), signal: AbortSignal.timeout(timeoutMs) }); }
    catch { return { netError: true }; }
    let body = null;
    try { body = await res.json(); } catch { /* sin cuerpo JSON */ }
    return { res, body };
  }

  // Solo admins del backoffice (la auditoría exige rol admin).
  const isAllowed = (admin) => !!admin && admin.level === "admin";

  return {
    isAllowed,

    async createLink(admin, token, userId, input = {}) {
      if (!isAllowed(admin)) return fail(403, "SIN_PERMISO_SOPORTE", "Entrar como usuario solo está habilitado para admins.");
      const reason = validateSupportReason(input.reason);
      if (!reason.ok) return fail(422, "MOTIVO_INVALIDO", reason.error);
      const spicyEmail = String(input.spicyEmail ?? "").trim();
      const password = typeof input.spicyPassword === "string" ? input.spicyPassword : "";
      if (!EMAIL_RE.test(spicyEmail) || !password || password.length > 200) return fail(400, "CREDENCIALES_REQUERIDAS", "Escribí el email y la contraseña de tu cuenta de Spicytool.");

      const user = await getUser(userId);
      if (!user) return fail(404, "USUARIO_NO_ENCONTRADO", "No se encontró el usuario.");
      const companyId = companyIdOf(user); // la suya o, si solo colabora, la company en la que colabora
      if (!user.email || !companyId) return fail(422, "SIN_COMPANY", "El usuario no tiene company: no hay cuenta para revisar.");
      if (tooMany(admin.email)) return fail(429, "DEMASIADOS_INTENTOS", "Demasiados intentos en un minuto. Esperá un momento.");

      const target = { targetType: "user", targetId: userId, targetLabel: userFullName(user), companyId };
      const base0 = { actor: admin.email, ...target };
      const detail = { targetEmail: user.email, reason: reason.value, spicyAccount: spicyEmail }; // nunca contraseña, token ni link
      try { await audit.record(token, { ...base0, action: "support_link_requested", detail }); }
      catch (e) { log("Auditoría no disponible:", e.message); return fail(503, "AUDITORIA_NO_DISPONIBLE", "No se pudo guardar el registro de auditoría, por eso no se pidió ningún link."); }
      const failed = async (status, code, message, why) => { const saved = await saveLater(token, { ...base0, action: "support_link_failed", detail: { ...detail, code, why } }); return fail(status, code, message, { auditWarning: !saved }); };

      // 1) Login con la cuenta de Spicytool de la persona.
      const login = await post("login", { email: spicyEmail, password });
      if (login.netError) return failed(502, "SESION_NO_DISPONIBLE", "No se pudo conectar con Spicytool.", "login_red");
      if (!login.res.ok) {
        if ([400, 401, 403, 404].includes(login.res.status)) return failed(401, "SPICY_LOGIN_INVALIDO", "El email o la contraseña de Spicytool no son correctos.", `login_http_${login.res.status}`);
        return failed(502, "SESION_NO_DISPONIBLE", "Spicytool no pudo iniciar la sesión.", `login_http_${login.res.status}`);
      }
      const bearer = tokenOf(login.body);
      if (!bearer) { log("Respuesta del login de Spicytool sin token reconocible (campos: " + Object.keys(login.body || {}).join(",") + ")"); return failed(502, "RESPUESTA_INESPERADA", "Spicytool respondió algo que no esperábamos. Avisá a un desarrollador.", "login_sin_token"); }

      // 2) Pedir el link a nombre de la cuenta de soporte.
      const link = await post("admin/support-sessions/link", { targetUserId: String(user._id ?? userId), targetEmail: user.email, companyId, reason: reason.value }, { Authorization: `Bearer ${bearer}` });
      if (link.netError) return failed(502, "SESION_NO_DISPONIBLE", "No se pudo conectar con Spicytool.", "link_red");
      if (!link.res.ok) {
        const s = link.res.status;
        if (s === 401 || s === 403) return failed(403, "SIN_PERMISO_SOPORTE", "Tu cuenta de Spicytool no tiene permiso de soporte. Pedile a un administrador que te habilite.", `link_http_${s}`);
        if (s === 404) return failed(404, "USUARIO_NO_ENCONTRADO", "Spicytool no encontró al usuario.", "link_http_404");
        return failed(502, "SESION_NO_DISPONIBLE", "Spicytool no pudo generar la sesión.", `link_http_${s}`);
      }
      const { url, expiresAt } = linkOf(link.body);
      let https = false;
      try { https = new URL(url).protocol === "https:"; } catch { /* no es una URL */ }
      if (!https) { log("Respuesta del link de soporte sin URL https reconocible (campos: " + Object.keys(link.body || {}).join(",") + ")"); return failed(502, "RESPUESTA_INESPERADA", "Spicytool respondió algo que no esperábamos. Avisá a un desarrollador.", "link_sin_url"); }

      const saved = await saveLater(token, { ...base0, action: "support_link_created", detail: { ...detail, expiresAt: expiresAt || null } });
      return { status: 201, body: { url, expiresAt: expiresAt || null, auditWarning: !saved } };
    },
  };
}
