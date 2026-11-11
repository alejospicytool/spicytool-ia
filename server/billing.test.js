import { describe, it, expect, vi } from "vitest";
import { makeBilling } from "./billing.js";
import { UncertainOutcome } from "./webhooks.js";

// Todo falso: ni Mongo, ni Supabase, ni Spicytool, ni Stripe. Estos tests NUNCA cobran.
const UID = "6650000000000000000000a1";
const ADMIN = { id: "u-admin", email: "nico@spicytool.test" };
const TOKEN = "jwt-del-admin";
const PRICE = "price_1UTMSrJdCZldzCmGg8bgtWwm";
const KEY = "ticket-4821-abc";

const setup = ({ user = { _id: UID, email: "Cliente@Ejemplo.test", name: "Ana", surname: "Paz", companies: ["6650000000000000000000c1"] }, assign, cardLink, auditFails = null, allowedEmails = [], maxPerMinute, now } = {}) => {
  const records = [];
  const audit = { record: vi.fn(async (token, e) => { if (auditFails && auditFails(e)) throw new Error("audit down"); records.push({ token, ...e }); }) };
  const webhook = { assign: vi.fn(assign || (async () => ({ ok: true, status: 201, body: { message: "ok", userEmail: "Cliente@Ejemplo.test", plan: "SpicyPro", previousPlan: "Freemium", stripePriceId: PRICE, stripeSubscriptionId: "sub_1", oldSubscriptionCancelled: true, billingFailures: [] } }))), cardLink: vi.fn(cardLink || (async () => ({ ok: true, status: 200, body: { userEmail: "x", stripeCustomerId: "cus_1", paymentMethodUpdateUrl: "https://billing.stripe.com/p/session/a" } }))) };
  const log = vi.fn();
  const billing = makeBilling({ getUser: async (id) => (id === UID ? user : null), webhook, audit, allowedEmails, log, ...(maxPerMinute ? { maxPerMinute } : {}), ...(now ? { now } : {}) });
  return { billing, webhook, audit, records, log };
};
const input = { plan: "SpicyPro", stripePriceId: PRICE, idempotencyKey: KEY };

describe("asignar plan (cobra)", () => {
  it("camino feliz: registra 'iniciado', cobra con el email de Mongo, registra el resultado y devuelve 201", async () => {
    const { billing, webhook, records } = setup();
    const r = await billing.assignPlan(ADMIN, TOKEN, UID, input);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ plan: "SpicyPro", previousPlan: "Freemium", stripeSubscriptionId: "sub_1", auditWarning: false });
    expect(webhook.assign).toHaveBeenCalledWith({ email: "Cliente@Ejemplo.test", plan: "SpicyPro", stripePriceId: PRICE, idempotencyKey: KEY });
    expect(records.map((x) => x.action)).toEqual(["plan_assign_started", "plan_assign"]);
    expect(records[0]).toMatchObject({ token: TOKEN, actor: ADMIN.email, targetType: "user", targetId: UID, companyId: "6650000000000000000000c1", detail: { plan: "SpicyPro", stripePriceId: PRICE, idempotencyKey: KEY } });
  });
  it("el 'iniciado' se guarda ANTES de llamar al webhook", async () => {
    const order = [];
    const s = setup({ assign: async () => { order.push("cobro"); return { ok: true, status: 201, body: {} }; } });
    s.audit.record.mockImplementation(async (t, e) => { order.push(e.action); });
    await s.billing.assignPlan(ADMIN, TOKEN, UID, input);
    expect(order).toEqual(["plan_assign_started", "cobro", "plan_assign"]);
  });
  it("SIN auditoría previa NO se cobra: 503 y el webhook ni se llama", async () => {
    const { billing, webhook } = setup({ auditFails: () => true });
    const r = await billing.assignPlan(ADMIN, TOKEN, UID, input);
    expect(r).toMatchObject({ status: 503, body: { code: "AUDITORIA_NO_DISPONIBLE" } });
    expect(webhook.assign).not.toHaveBeenCalled();
  });
  it("si el cobro salió bien pero la auditoría final falla: devuelve 201 con auditWarning y lo deja en el log", async () => {
    const { billing, log } = setup({ auditFails: (e) => e.action === "plan_assign" });
    const r = await billing.assignPlan(ADMIN, TOKEN, UID, input);
    expect(r.status).toBe(201);
    expect(r.body.auditWarning).toBe(true);
    expect(log.mock.calls.flat().join(" ")).toContain("plan_assign");
  });
  it("tarjeta rechazada: no se cobró, devuelve code/decline_code/link y audita el fallo SIN guardar el link", async () => {
    const { billing, records } = setup({ assign: async () => ({ ok: false, status: 402, code: "PAGO_RECHAZADO", message: "Your card was declined.", extra: { decline_code: "insufficient_funds", paymentMethodUpdateUrl: "https://billing.stripe.com/p/session/SECRETO" } }) });
    const r = await billing.assignPlan(ADMIN, TOKEN, UID, input);
    expect(r).toMatchObject({ status: 402, body: { code: "PAGO_RECHAZADO", decline_code: "insufficient_funds", paymentMethodUpdateUrl: "https://billing.stripe.com/p/session/SECRETO" } });
    const failed = records.find((x) => x.action === "plan_assign_failed");
    expect(failed.detail).toMatchObject({ code: "PAGO_RECHAZADO", decline_code: "insufficient_funds" });
    expect(JSON.stringify(records)).not.toContain("SECRETO");
  });
  it("resultado incierto (red/tiempo): 504, no dice que falló, audita 'unknown' y avisa que se mire Stripe", async () => {
    const { billing, records } = setup({ assign: async () => { throw new UncertainOutcome("falló la conexión"); } });
    const r = await billing.assignPlan(ADMIN, TOKEN, UID, input);
    expect(r).toMatchObject({ status: 504, body: { code: "RESULTADO_INCIERTO" } });
    expect(r.body.message).toMatch(/Stripe/);
    expect(records.map((x) => x.action)).toEqual(["plan_assign_started", "plan_assign_unknown"]);
  });
  it("un error inesperado del webhook se propaga (el servidor responde 500 genérico)", async () => {
    const { billing } = setup({ assign: async () => { throw new Error("bug"); } });
    await expect(billing.assignPlan(ADMIN, TOKEN, UID, input)).rejects.toThrow("bug");
  });
  it("validaciones previas: plan inválido (Freemium, tier, vacío), precio faltante o con mal formato. No audita ni llama al webhook", async () => {
    const { billing, webhook, audit } = setup();
    for (const plan of ["Freemium", "FreeTrial", "tier3", "", undefined]) expect((await billing.assignPlan(ADMIN, TOKEN, UID, { ...input, plan })).body.code).toBe("PLAN_INVALIDO");
    expect((await billing.assignPlan(ADMIN, TOKEN, UID, { ...input, stripePriceId: "" })).body.code).toBe("PRECIO_REQUERIDO");
    expect((await billing.assignPlan(ADMIN, TOKEN, UID, { ...input, stripePriceId: "no es un precio" })).body.code).toBe("PRECIO_INVALIDO");
    expect((await billing.assignPlan(ADMIN, TOKEN, UID, { ...input, idempotencyKey: "corta" })).body.code).toBe("CLAVE_INVALIDA");
    expect(webhook.assign).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
  it("sin clave de idempotencia, el servidor genera una (y es la que se manda y se audita)", async () => {
    const { billing, webhook, records } = setup();
    await billing.assignPlan(ADMIN, TOKEN, UID, { plan: "SpicyPro", stripePriceId: PRICE });
    const key = webhook.assign.mock.calls[0][0].idempotencyKey;
    expect(key).toMatch(/^bo-srv-/);
    expect(records[0].detail.idempotencyKey).toBe(key);
  });
  it("usuario inexistente: 404 sin tocar nada", async () => {
    const { billing, webhook, audit } = setup();
    expect((await billing.assignPlan(ADMIN, TOKEN, "6650000000000000000000ff", input)).status).toBe(404);
    expect(webhook.assign).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
  it("el email que se cobra es el de Mongo: aunque el navegador mande otro campo 'email', se ignora", async () => {
    const { billing, webhook } = setup();
    await billing.assignPlan(ADMIN, TOKEN, UID, { ...input, email: "otro@cliente.test", userId: "x" });
    expect(webhook.assign.mock.calls[0][0].email).toBe("Cliente@Ejemplo.test");
  });
});

describe("lista de emails habilitados y tope de intentos", () => {
  it("con lista: solo se puede tocar a los que están (sin distinguir mayúsculas); a los demás 403 sin auditar ni cobrar", async () => {
    const ok = setup({ allowedEmails: ["cliente@ejemplo.TEST"] });
    expect((await ok.billing.assignPlan(ADMIN, TOKEN, UID, input)).status).toBe(201);
    const no = setup({ allowedEmails: ["solo.este@ejemplo.test"] });
    const r = await no.billing.assignPlan(ADMIN, TOKEN, UID, input);
    expect(r).toMatchObject({ status: 403, body: { code: "FUERA_DE_LA_LISTA" } });
    expect(no.webhook.assign).not.toHaveBeenCalled();
    expect(no.audit.record).not.toHaveBeenCalled();
    expect((await no.billing.paymentMethodUrl(ADMIN, TOKEN, UID)).status).toBe(403);
    expect(no.webhook.cardLink).not.toHaveBeenCalled();
  });
  it("sin lista: cualquier cliente", async () => {
    expect((await setup().billing.assignPlan(ADMIN, TOKEN, UID, input)).status).toBe(201);
  });
  it("tope por admin por minuto: el siguiente intento da 429 sin cobrar; pasado el minuto vuelve a andar", async () => {
    let t = 1_000_000;
    const { billing, webhook } = setup({ maxPerMinute: 2, now: () => t });
    expect((await billing.assignPlan(ADMIN, TOKEN, UID, input)).status).toBe(201);
    expect((await billing.assignPlan(ADMIN, TOKEN, UID, input)).status).toBe(201);
    const r = await billing.assignPlan(ADMIN, TOKEN, UID, input);
    expect(r).toMatchObject({ status: 429, body: { code: "DEMASIADOS_INTENTOS" } });
    expect(webhook.assign).toHaveBeenCalledTimes(2);
    t += 61_000;
    expect((await billing.assignPlan(ADMIN, TOKEN, UID, input)).status).toBe(201);
  });
});

describe("link de tarjeta (no cobra)", () => {
  it("devuelve el link y audita sin guardarlo", async () => {
    const { billing, records } = setup();
    const r = await billing.paymentMethodUrl(ADMIN, TOKEN, UID);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ userEmail: "x", stripeCustomerId: "cus_1", paymentMethodUpdateUrl: "https://billing.stripe.com/p/session/a" });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ action: "card_link_created", actor: ADMIN.email, targetId: UID, detail: {} });
    expect(JSON.stringify(records)).not.toContain("billing.stripe.com");
  });
  it("sin auditoría no se entrega el link", async () => {
    const { billing } = setup({ auditFails: () => true });
    const r = await billing.paymentMethodUrl(ADMIN, TOKEN, UID);
    expect(r).toMatchObject({ status: 503, body: { code: "AUDITORIA_NO_DISPONIBLE" } });
    expect(JSON.stringify(r)).not.toContain("billing.stripe.com");
  });
  it("si Stripe falla o no responde: error sin auditar un link que no existió", async () => {
    const a = setup({ cardLink: async () => ({ ok: false, status: 502, code: "STRIPE_PORTAL_FALLIDO", message: "x", extra: {} }) });
    expect(await a.billing.paymentMethodUrl(ADMIN, TOKEN, UID)).toMatchObject({ status: 502, body: { code: "STRIPE_PORTAL_FALLIDO" } });
    const b = setup({ cardLink: async () => { throw new UncertainOutcome("falló la conexión"); } });
    expect((await b.billing.paymentMethodUrl(ADMIN, TOKEN, UID)).status).toBe(502);
    expect(a.audit.record).not.toHaveBeenCalled();
    expect(b.audit.record).not.toHaveBeenCalled();
  });
});
