// Cliente mínimo de Google (OAuth + Calendar). Sin librerías: solo fetch. Nada de esto toca la red en los tests (se inyecta fetchImpl).
// Permiso que se pide: crear y editar eventos ("calendar.events") + el mail de la cuenta ("openid email") para mostrar qué cuenta quedó conectada.
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://www.googleapis.com/calendar/v3";
export const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"];

// Error de Google con lo que importa para decidir qué hacer: status HTTP y, en el OAuth, el código (invalid_grant = la persona revocó el permiso).
export class GoogleError extends Error {
  constructor(status, code, message) { super(message || code || `HTTP ${status}`); this.name = "GoogleError"; this.status = status; this.code = code || ""; }
  // invalid_grant: la persona sacó el permiso (o el token venció): hay que volver a conectar.
  get revoked() { return this.code === "invalid_grant"; }
}

export function makeGoogle({ clientId, clientSecret, redirectUri, fetchImpl = globalThis.fetch, timeoutMs = 15_000 } = {}) {
  const configured = !!(clientId && clientSecret && redirectUri);
  const form = (obj) => new URLSearchParams(obj).toString();
  const signal = () => AbortSignal.timeout(timeoutMs);

  async function readJson(res) { try { return await res.json(); } catch { return null; } }
  async function tokenCall(body) {
    const res = await fetchImpl(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form({ client_id: clientId, client_secret: clientSecret, ...body }), signal: signal() });
    const data = await readJson(res);
    if (!res.ok) throw new GoogleError(res.status, data && data.error, data && (data.error_description || data.error));
    return data || {};
  }

  // El id_token viene directo de Google por HTTPS en esta misma respuesta: alcanza con leer el mail, no hace falta validarlo.
  const emailFromIdToken = (idToken) => {
    try { return String(JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString("utf8")).email || ""); } catch { return ""; }
  };

  return {
    configured,
    authUrl(state, loginHint = "") {
      const q = { client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: SCOPES.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true", state };
      if (loginHint) q.login_hint = loginHint;
      return `${AUTH_URL}?${form(q)}`;
    },
    // code → { refreshToken, accessToken, googleEmail, scope }
    async exchangeCode(code) {
      const d = await tokenCall({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
      return { refreshToken: d.refresh_token || "", accessToken: d.access_token || "", googleEmail: emailFromIdToken(d.id_token), scope: String(d.scope || "") };
    },
    async accessToken(refreshToken) {
      const d = await tokenCall({ refresh_token: refreshToken, grant_type: "refresh_token" });
      if (!d.access_token) throw new GoogleError(500, "no_access_token", "Google no devolvió un token de acceso.");
      return d.access_token;
    },
    async revoke(token) {
      try { await fetchImpl(REVOKE_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form({ token }), signal: signal() }); } catch { /* mejor esfuerzo */ }
    },

    // Eventos del calendario principal. `event` ya viene armado (ver calendarEvents.js).
    async insertEvent(accessToken, event) { return calendarCall("POST", "/calendars/primary/events", accessToken, event); },
    async updateEvent(accessToken, eventId, event) { return calendarCall("PUT", `/calendars/primary/events/${encodeURIComponent(eventId)}`, accessToken, event); },
    async deleteEvent(accessToken, eventId) {
      try { await calendarCall("DELETE", `/calendars/primary/events/${encodeURIComponent(eventId)}`, accessToken); } catch (e) { if (!(e instanceof GoogleError) || (e.status !== 404 && e.status !== 410)) throw e; } // ya no existe: perfecto
    },
  };

  async function calendarCall(method, path, accessToken, body) {
    const res = await fetchImpl(API + path, { method, headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: signal() });
    if (res.status === 204) return {};
    const data = await readJson(res);
    if (!res.ok) throw new GoogleError(res.status, data && data.error && (data.error.status || data.error.code), data && data.error && data.error.message);
    return data || {};
  }
}
