// Cliente de los webhooks de back office de Spicytool (doc "Back office webhooks: subscriptions", Jonathan, 2026-11-05).
// El token (x-webhook-token) vive SOLO acá, en el servidor: nunca se manda al navegador, ni se guarda, ni se escribe en logs.
// OJO: el webhook de suscripción COBRA la tarjeta del cliente al instante. Los tests usan siempre un fetch falso, nunca la red.

// El pedido salió pero no sabemos qué pasó (corte de red, tiempo agotado): puede que se haya cobrado.
export class UncertainOutcome extends Error {
  constructor(reason) { super("No se pudo confirmar el resultado: " + reason); this.name = "UncertainOutcome"; this.reason = reason; }
}

export function makeWebhookClient({ token, baseUrl = "https://api.spicytool.net", fetchImpl = globalThis.fetch, timeoutMs = 45_000 } = {}) {
  const base = String(baseUrl).replace(/\/+$/, "") + "/api/webhooks/backoffice";

  async function post(name, body) {
    if (!token) return { ok: false, status: 503, code: "WEBHOOK_NO_CONFIGURADO", message: "Falta el token del webhook en el servidor.", extra: {} };
    let res;
    try {
      res = await fetchImpl(`${base}/${name}`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-webhook-token": token }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throw new UncertainOutcome(e && e.name === "TimeoutError" ? "se agotó el tiempo de espera" : "falló la conexión");
    }
    let data = null;
    try { data = await res.json(); } catch { /* sin cuerpo JSON */ }
    if (res.ok) return { ok: true, status: res.status, body: data || {} };
    const code = (data && data.code) || (res.status === 401 ? "UNAUTHORIZED" : res.status === 403 ? "FORBIDDEN" : "ERROR");
    const extra = {};
    if (data && data.decline_code) extra.decline_code = data.decline_code;
    if (data && data.paymentMethodUpdateUrl) extra.paymentMethodUpdateUrl = data.paymentMethodUpdateUrl;
    return { ok: false, status: res.status, code, message: (data && data.message) || `HTTP ${res.status}`, extra };
  }

  return {
    // POST …/subscription → 201. COBRA.
    assign: ({ email, plan, stripePriceId, idempotencyKey }) => post("subscription", { email, plan, stripePriceId, idempotencyKey }),
    // POST …/payment-method-url → 200. No cobra.
    cardLink: ({ email }) => post("payment-method-url", { email }),
  };
}
