import { describe, it, expect, vi } from "vitest";
import { makeWebhookClient, UncertainOutcome } from "./webhooks.js";

// SIEMPRE un fetch falso: estos tests nunca tocan la red (el webhook real cobra).
const reply = (status, body) => vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => { if (body === undefined) throw new Error("sin json"); return body; } }));
const client = (fetchImpl, extra = {}) => makeWebhookClient({ token: "TOKEN_SECRETO", fetchImpl, ...extra });

describe("cliente de los webhooks de back office", () => {
  it("asignar plan: manda el JSON y el token en la cabecera x-webhook-token, a la dirección de producción", async () => {
    const f = reply(201, { message: "Subscription assigned and charged", plan: "SpicyPro" });
    const r = await client(f).assign({ email: "a@b.test", plan: "SpicyPro", stripePriceId: "price_X1", idempotencyKey: "k-12345678" });
    expect(r).toEqual({ ok: true, status: 201, body: { message: "Subscription assigned and charged", plan: "SpicyPro" } });
    const [url, opts] = f.mock.calls[0];
    expect(url).toBe("https://api.spicytool.net/api/webhooks/backoffice/subscription");
    expect(opts.method).toBe("POST");
    expect(opts.headers).toEqual({ "Content-Type": "application/json", "x-webhook-token": "TOKEN_SECRETO" });
    expect(JSON.parse(opts.body)).toEqual({ email: "a@b.test", plan: "SpicyPro", stripePriceId: "price_X1", idempotencyKey: "k-12345678" });
  });
  it("link de tarjeta: va a payment-method-url con solo el email", async () => {
    const f = reply(200, { userEmail: "a@b.test", paymentMethodUpdateUrl: "https://billing.stripe.com/p/session/x" });
    await client(f, { baseUrl: "https://otra.test/" }).cardLink({ email: "a@b.test" });
    expect(f.mock.calls[0][0]).toBe("https://otra.test/api/webhooks/backoffice/payment-method-url");
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ email: "a@b.test" });
  });
  it("error 402 con code: devuelve código, mensaje, decline_code y el link para cambiar la tarjeta", async () => {
    const r = await client(reply(402, { code: "PAGO_RECHAZADO", message: "Your card was declined.", decline_code: "insufficient_funds", paymentMethodUpdateUrl: "https://billing.stripe.com/p/session/y" })).assign({});
    expect(r).toEqual({ ok: false, status: 402, code: "PAGO_RECHAZADO", message: "Your card was declined.", extra: { decline_code: "insufficient_funds", paymentMethodUpdateUrl: "https://billing.stripe.com/p/session/y" } });
  });
  it("401 y 403 sin code se traducen a UNAUTHORIZED y FORBIDDEN", async () => {
    expect((await client(reply(401, {})).assign({})).code).toBe("UNAUTHORIZED");
    expect((await client(reply(403, {})).assign({})).code).toBe("FORBIDDEN");
  });
  it("respuesta de error sin JSON: ERROR con el status", async () => {
    const r = await client(reply(500, undefined)).assign({});
    expect(r).toMatchObject({ ok: false, status: 500, code: "ERROR", message: "HTTP 500" });
  });
  it("sin token configurado: no llama a nada y responde 503", async () => {
    const f = reply(201, {});
    const r = await makeWebhookClient({ token: "", fetchImpl: f }).assign({});
    expect(r).toMatchObject({ ok: false, status: 503, code: "WEBHOOK_NO_CONFIGURADO" });
    expect(f).not.toHaveBeenCalled();
  });
  it("si se corta la conexión o se agota el tiempo: resultado INCIERTO (puede haberse cobrado)", async () => {
    await expect(client(vi.fn(async () => { throw new TypeError("fetch failed"); })).assign({})).rejects.toBeInstanceOf(UncertainOutcome);
    const timeout = vi.fn(async () => { const e = new Error("t"); e.name = "TimeoutError"; throw e; });
    await expect(client(timeout).assign({})).rejects.toThrow(/tiempo de espera/);
  });
  it("el mensaje de error nunca incluye el token", async () => {
    const e = await client(vi.fn(async () => { throw new TypeError("fetch failed"); })).assign({}).catch((x) => x);
    expect(String(e.message) + JSON.stringify(e)).not.toContain("TOKEN_SECRETO");
  });
});

describe("cupones en el webhook", () => {
  const base = { email: "a@b.test", plan: "SpicyStart", stripePriceId: "price_X1", idempotencyKey: "k-12345678" };
  it("con el campo configurado, el cupón viaja en ese campo", async () => {
    const f = reply(201, { message: "ok" });
    const c = client(f, { couponField: "couponId" });
    expect(c.couponsEnabled).toBe(true);
    await c.assign({ ...base, couponId: "START-10-3M" });
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ ...base, couponId: "START-10-3M" });
  });
  it("el nombre del campo es el que defina Spicytool", async () => {
    const f = reply(201, {});
    await client(f, { couponField: "promotionCodeId" }).assign({ ...base, couponId: "promo_1" });
    expect(JSON.parse(f.mock.calls[0][1].body).promotionCodeId).toBe("promo_1");
  });
  it("SIN campo configurado: un pedido con cupón NO llama al webhook (si el campo se ignorara, se cobraría el precio completo)", async () => {
    const f = reply(201, {});
    const c = client(f);
    expect(c.couponsEnabled).toBe(false);
    const r = await c.assign({ ...base, couponId: "START-10-3M" });
    expect(r).toMatchObject({ ok: false, status: 501, code: "CUPON_NO_SOPORTADO" });
    expect(f).not.toHaveBeenCalled();
  });
  it("un nombre de campo inválido cuenta como no configurado", () => {
    for (const bad of ["", "1abc", "co upon", "a-b", "x".repeat(60), "a;b"]) expect(client(reply(200, {}), { couponField: bad }).couponsEnabled).toBe(false);
  });
  it("sin cupón no cambia nada aunque el campo esté configurado", async () => {
    const f = reply(201, {});
    await client(f, { couponField: "couponId" }).assign(base);
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual(base);
  });
});
