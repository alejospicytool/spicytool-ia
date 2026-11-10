import { describe, it, expect } from "vitest";
import { subscriptionMrr, normalizeStripeSub, verifyStripeSignature, handle, monthsOf, saveManualSubscription, reconcile } from "./index.ts";

// ── Base y Stripe en memoria ───────────────────────────────────────────────────────────────────────────
function fakeStore(over = {}) {
  const st = {
    plans: new Map(), fx: new Map(), customers: new Map(), subs: new Map(), events: new Set(), apply: [], audit: [], eventsCount: 0, released: [], finished: [], runs: [],
  };
  const store = {
    st,
    loadPlans: async () => new Map([...st.plans].map(([k, v]) => [k, { countsInMrr: v.countsInMrr }])),
    loadFx: async () => new Map(st.fx),
    knownPlanIds: async () => new Set(st.plans.keys()),
    registerPlan: async (id, name) => { if (!st.plans.has(id)) st.plans.set(id, { name, category: "sin_clasificar", countsInMrr: false }); },
    upsertCustomer: async (c) => { st.customers.set(c.key, { ...(st.customers.get(c.key) || {}), ...Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined)) }); },
    upsertSubscription: async (d) => { st.subs.set(d.id, d); },
    getSubscription: async (id) => st.subs.get(id) || null,
    listSubscriptions: async (key) => [...st.subs.values()].filter((s) => s.customerKey === key),
    liveStripeSubscriptionIds: async () => [...st.subs.values()].filter((s) => s.source === "stripe" && ["active", "past_due", "trialing"].includes(s.status)).map((s) => s.id),
    customerKeys: async () => [...new Set([...st.subs.values()].map((s) => s.customerKey))],
    claimEvent: async (id) => { if (st.events.has(id)) return false; st.events.add(id); return true; },
    finishEvent: async (id, r) => { st.finished.push([id, r]); },
    releaseEvent: async (id) => { st.events.delete(id); st.released.push(id); },
    applyMrr: async (key, after, cause, baseline) => { st.apply.push({ key, after, cause, baseline }); return { customerKey: key, before: 0, after }; },
    countUnclassified: async () => [...st.plans.values()].filter((p) => p.category === "sin_clasificar").length,
    countEvents: async () => st.eventsCount,
    audit: async (a) => { st.audit.push(a); },
    logRun: async (r) => { st.runs.push(r); },
    createManualPlan: async (name, category, counts) => { const id = "manual:plan-" + st.plans.size; st.plans.set(id, { name, category, countsInMrr: counts }); return id; },
    planExists: async (id) => st.plans.has(id),
    ...over,
  };
  return store;
}
const price = (id, cents, interval = "month", extra = {}) => ({ id, unit_amount: cents, recurring: { interval, interval_count: 1 }, product: "prod_" + id, ...extra });
const stripeSub = (id, cust, items, extra = {}) => ({ id, customer: typeof cust === "string" ? { id: cust, name: "Cliente " + cust, email: cust + "@x.com", address: { country: "AR" } } : cust, status: "active", currency: "usd", items: { data: items.map(([p, q]) => ({ price: p, quantity: q || 1 })) }, discounts: [], ...extra });
const fakeStripe = (subs = [], over = {}) => ({
  getSubscription: async (id) => subs.find((s) => s.id === id) || null,
  async *listSubscriptions(status) { for (const s of subs.filter((x) => x.status === status)) yield s; },
  getCoupon: async (id) => ({ id, percent_off: 20 }),
  getProduct: async (id) => ({ name: "Producto " + id }),
  ...over,
});

const SECRET = "whsec_test";
async function sign(payload, secret = SECRET, t = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`)));
  return `t=${t},v1=${Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
const eventReq = async (event, opts = {}) => {
  const body = JSON.stringify(event);
  return new Request("http://x/functions/v1/revenue-sync/stripe", { method: "POST", headers: { "stripe-signature": opts.sig ?? await sign(body) }, body });
};
const evt = (id, type, subId) => ({ id, type, data: { object: { id: subId } } });
const deps = (store, stripe, over = {}) => ({ store, stripe, webhookSecret: SECRET, cronSecret: "cron-secret-1", isAdmin: async () => false, ...over });
const adminReq = (route, body) => new Request("http://x/functions/v1/revenue-sync/" + route, { method: "POST", headers: { authorization: "Bearer h." + btoa(JSON.stringify({ sub: "admin-1" })) + ".s" }, body: JSON.stringify(body || {}) });
const cronReq = (route, body, secret = "cron-secret-1") => new Request("http://x/functions/v1/revenue-sync/" + route, { method: "POST", headers: { "x-revenue-cron-secret": secret }, body: JSON.stringify(body || {}) });

// ── MRR ────────────────────────────────────────────────────────────────────────────────────────────────
describe("subscriptionMrr", () => {
  const plans = new Map([["p1", { countsInMrr: true }], ["ga", { countsInMrr: false }]]);
  const fx = new Map();
  const item = (priceId, unitAmount, interval = "month", intervalCount = 1, quantity = 1) => ({ priceId, unitAmount, quantity, interval, intervalCount });
  const base = { status: "active", currency: "usd", discount: null };

  it("casos del test del módulo de referencia: 270, 100 y 0", () => {
    const sub = { ...base, items: [item("p1", 30000), item("ga", 18000)], discount: { percentOff: 10 } };
    expect(subscriptionMrr(sub, plans, fx)).toBe(270);                                   // solo suma el plan SaaS, con 10% off
    expect(subscriptionMrr({ ...base, items: [item("p1", 120000, "year")] }, plans, fx)).toBe(100); // anual ÷ 12
    expect(subscriptionMrr({ ...sub, status: "canceled" }, plans, fx)).toBe(0);
  });
  it("estados: past_due suma (sin auto-churn), trialing y unpaid no", () => {
    const items = [item("p1", 10000)];
    expect(subscriptionMrr({ ...base, items, status: "past_due" }, plans, fx)).toBe(100);
    expect(subscriptionMrr({ ...base, items, status: "trialing" }, plans, fx)).toBe(0);
    expect(subscriptionMrr({ ...base, items, status: "unpaid" }, plans, fx)).toBe(0);
  });
  it("planes sin clasificar o desconocidos no suman; cantidad e intervalos (trimestral)", () => {
    expect(subscriptionMrr({ ...base, items: [item("nuevo", 99900)] }, plans, fx)).toBe(0);
    expect(subscriptionMrr({ ...base, items: [item("p1", 10000, "month", 1, 3)] }, plans, fx)).toBe(300);
    expect(subscriptionMrr({ ...base, items: [item("p1", 30000, "month", 3)] }, plans, fx)).toBe(100);
    expect(() => monthsOf("decada")).toThrow();
  });
  it("descuentos: porcentaje vencido no cuenta; monto por factura se lleva a mensual (anual ÷ 12)", () => {
    const now = new Date("2026-11-10T00:00:00Z");
    const vencido = { ...base, items: [item("p1", 10000)], discount: { percentOff: 50, endsAt: "2026-10-01T00:00:00Z" } };
    expect(subscriptionMrr(vencido, plans, fx, now)).toBe(100);
    const vigente = { ...vencido, discount: { percentOff: 50, endsAt: "2027-01-01T00:00:00Z" } };
    expect(subscriptionMrr(vigente, plans, fx, now)).toBe(50);
    const anual = { ...base, items: [item("p1", 120000, "year")], discount: { amountOff: 12000 } }; // USD 120 menos por factura anual = USD 10/mes
    expect(subscriptionMrr(anual, plans, fx, now)).toBe(90);
    const mensual = { ...base, items: [item("p1", 10000)], discount: { amountOff: 99999 } };       // nunca negativo
    expect(subscriptionMrr(mensual, plans, fx, now)).toBe(0);
  });
  it("moneda: convierte con la tasa cargada y NO inventa si falta", () => {
    const sub = { ...base, currency: "ARS", items: [item("p1", 1000000)] };
    expect(() => subscriptionMrr(sub, plans, fx)).toThrow("Falta tipo de cambio para ars");
    expect(subscriptionMrr(sub, plans, new Map([["ars", 0.001]]))).toBe(10);
  });
});

// ── Stripe → documento normalizado ─────────────────────────────────────────────────────────────────────
describe("normalizeStripeSub", () => {
  it("normaliza ítems, cliente y estado", () => {
    const d = normalizeStripeSub(stripeSub("sub_1", "cus_1", [[price("price_a", 30000), 2]]));
    expect(d).toMatchObject({ id: "stripe:sub_1", customerKey: "stripe:cus_1", source: "stripe", status: "active", currency: "usd", discount: null });
    expect(d.items).toEqual([{ priceId: "price_a", unitAmount: 30000, quantity: 2, interval: "month", intervalCount: 1 }]);
  });
  it("descuento con la forma clásica (discount.coupon) y con la nueva (discount.source.coupon)", () => {
    const clasico = stripeSub("s", "c", [[price("p", 100)]], { discounts: [{ coupon: { percent_off: 25 }, end: 1798761600 }] });
    expect(normalizeStripeSub(clasico).discount).toEqual({ percentOff: 25, amountOff: null, endsAt: "2027-01-01T00:00:00.000Z" });
    const nuevo = stripeSub("s", "c", [[price("p", 100)]], { discounts: [{ source: { type: "coupon", coupon: { amount_off: 500 } }, end: null }] });
    expect(normalizeStripeSub(nuevo).discount).toEqual({ percentOff: null, amountOff: 500, endsAt: null });
  });
  it("cupón que viene solo como id: se resuelve con el mapa; sin resolver no inventa descuento", () => {
    const s = stripeSub("s", "c", [[price("p", 100)]], { discounts: [{ source: { coupon: "cup_1" } }] });
    expect(normalizeStripeSub(s, new Map([["cup_1", { percent_off: 20 }]])).discount.percentOff).toBe(20);
    expect(normalizeStripeSub(s).discount).toBeNull();
  });
  it("precio medido (sin unit_amount) no rompe: suma 0", () => {
    const d = normalizeStripeSub(stripeSub("s", "c", [[price("p", null)]]));
    expect(d.items[0].unitAmount).toBe(0);
  });
  it("cliente como id (sin expandir)", () => {
    expect(normalizeStripeSub({ ...stripeSub("s", "c", [[price("p", 1)]]), customer: "cus_9" }).customerKey).toBe("stripe:cus_9");
  });
});

// ── Firma ──────────────────────────────────────────────────────────────────────────────────────────────
describe("verifyStripeSignature", () => {
  it("acepta la firma correcta y rechaza secret distinto, cuerpo alterado, vieja o mal formada", async () => {
    const body = '{"a":1}';
    const now = Date.now();
    expect(await verifyStripeSignature(body, await sign(body), SECRET, now)).toBe(true);
    expect(await verifyStripeSignature(body, await sign(body, "otro"), SECRET, now)).toBe(false);
    expect(await verifyStripeSignature('{"a":2}', await sign(body), SECRET, now)).toBe(false);
    expect(await verifyStripeSignature(body, await sign(body, SECRET, Math.floor(now / 1000) - 3600), SECRET, now)).toBe(false);
    expect(await verifyStripeSignature(body, "basura", SECRET, now)).toBe(false);
    expect(await verifyStripeSignature(body, null, SECRET, now)).toBe(false);
  });
});

// ── Webhook ────────────────────────────────────────────────────────────────────────────────────────────
describe("webhook /stripe", () => {
  it("firma inválida → 400 y no toca nada", async () => {
    const store = fakeStore();
    const res = await handle(await eventReq(evt("e1", "customer.subscription.created", "sub_1"), { sig: "t=1,v1=abc" }), deps(store, fakeStripe()));
    expect(res.status).toBe(400);
    expect(store.st.events.size).toBe(0);
  });
  it("eventos que no manejamos se ignoran (sin registrar)", async () => {
    const store = fakeStore();
    const res = await handle(await eventReq(evt("e1", "invoice.paid", "in_1")), deps(store, fakeStripe()));
    expect(await res.json()).toEqual({ ignored: true });
    expect(store.st.events.size).toBe(0);
  });
  it("alta: relee la suscripción, registra cliente y plan SIN CLASIFICAR y el MRR es 0 hasta clasificar", async () => {
    const sub = stripeSub("sub_1", "cus_1", [[price("price_a", 30000)]]);
    const store = fakeStore();
    const res = await handle(await eventReq(evt("e1", "customer.subscription.created", "sub_1")), deps(store, fakeStripe([sub])));
    expect(res.status).toBe(200);
    expect(store.st.customers.get("stripe:cus_1")).toMatchObject({ name: "Cliente cus_1", email: "cus_1@x.com", country: "AR", source: "stripe" });
    expect(store.st.plans.get("price_a")).toMatchObject({ category: "sin_clasificar", countsInMrr: false, name: "Producto prod_price_a" });
    expect(store.st.apply).toEqual([{ key: "stripe:cus_1", after: 0, cause: "customer.subscription.created", baseline: false }]);
    expect(store.st.finished).toHaveLength(1);
    // Clasificado como SaaS, el mismo evento llegaría con MRR real
    store.st.plans.get("price_a").countsInMrr = true;
    await handle(await eventReq(evt("e2", "customer.subscription.updated", "sub_1")), deps(store, fakeStripe([sub])));
    expect(store.st.apply.at(-1).after).toBe(300);
  });
  it("evento duplicado → no se procesa dos veces", async () => {
    const store = fakeStore(), stripe = fakeStripe([stripeSub("sub_1", "cus_1", [[price("pa", 100)]])]);
    await handle(await eventReq(evt("e1", "customer.subscription.created", "sub_1")), deps(store, stripe));
    const res = await handle(await eventReq(evt("e1", "customer.subscription.created", "sub_1")), deps(store, stripe));
    expect(await res.json()).toEqual({ duplicate: true });
    expect(store.st.apply).toHaveLength(1);
  });
  it("si falla el procesamiento: 500 y se libera el evento para que Stripe reintente", async () => {
    const store = fakeStore({ applyMrr: async () => { throw new Error("base caída"); } });
    const stripe = fakeStripe([stripeSub("sub_1", "cus_1", [[price("pa", 100)]])]);
    const res = await handle(await eventReq(evt("e1", "customer.subscription.created", "sub_1")), deps(store, stripe));
    expect(res.status).toBe(500);
    expect(store.st.released).toEqual(["e1"]);
    expect(store.st.events.has("e1")).toBe(false);
  });
  it("baja: si Stripe ya no tiene la suscripción, se marca cancelada y baja el MRR", async () => {
    const store = fakeStore();
    store.st.plans.set("pa", { countsInMrr: true });
    store.st.subs.set("stripe:sub_1", { id: "stripe:sub_1", customerKey: "stripe:cus_1", source: "stripe", status: "active", currency: "usd", items: [{ priceId: "pa", unitAmount: 10000, quantity: 1, interval: "month", intervalCount: 1 }], discount: null });
    const res = await handle(await eventReq(evt("e1", "customer.subscription.deleted", "sub_1")), deps(store, fakeStripe([])));
    expect(res.status).toBe(200);
    expect(store.st.subs.get("stripe:sub_1").status).toBe("canceled");
    expect(store.st.apply.at(-1)).toMatchObject({ key: "stripe:cus_1", after: 0 });
  });
  it("cupón que viene como id se consulta a Stripe una sola vez", async () => {
    let calls = 0;
    const subs = [stripeSub("s1", "c1", [[price("pa", 10000)]], { discounts: [{ source: { coupon: "cup_1" } }] }), stripeSub("s2", "c2", [[price("pa", 10000)]], { discounts: [{ source: { coupon: "cup_1" } }] })];
    const stripe = fakeStripe(subs, { getCoupon: async () => { calls++; return { percent_off: 20 }; } });
    const store = fakeStore(); store.st.plans.set("pa", { countsInMrr: true });
    const r = await handle(cronReq("reconcile"), deps(store, stripe));
    expect(r.status).toBe(200);
    expect(calls).toBe(1);
    expect(store.st.apply.map((a) => a.after)).toEqual([80, 80]);
  });
});

// ── Reconciliación / recálculo ─────────────────────────────────────────────────────────────────────────
describe("reconcile y rutas protegidas", () => {
  it("sin secret ni admin → 403; secret incorrecto → 403; admin → 200", async () => {
    const store = fakeStore(), stripe = fakeStripe();
    expect((await handle(cronReq("reconcile", {}, "incorrecto"), deps(store, stripe))).status).toBe(403);
    expect((await handle(adminReq("reconcile"), deps(store, stripe))).status).toBe(403);
    expect((await handle(adminReq("reconcile"), deps(store, stripe, { isAdmin: async () => true }))).status).toBe(200);
    expect((await handle(cronReq("reconcile"), deps(store, stripe))).status).toBe(200);
  });
  it("sin secret configurado en el servidor, el header vacío NO alcanza", async () => {
    const res = await handle(new Request("http://x/revenue-sync/reconcile", { method: "POST", body: "{}" }), deps(fakeStore(), fakeStripe(), { cronSecret: undefined }));
    expect(res.status).toBe(403);
  });
  it("detecta una baja perdida: la suscripción viva que ya no está en Stripe se da por cancelada", async () => {
    const store = fakeStore();
    store.st.plans.set("pa", { countsInMrr: true });
    store.st.subs.set("stripe:sub_vieja", { id: "stripe:sub_vieja", customerKey: "stripe:cus_v", source: "stripe", status: "active", currency: "usd", items: [{ priceId: "pa", unitAmount: 5000, quantity: 1, interval: "month", intervalCount: 1 }], discount: null });
    const r = await (await handle(cronReq("reconcile"), deps(store, fakeStripe([])))).json();
    expect(r.staleCount).toBe(1);
    expect(store.st.subs.get("stripe:sub_vieja").status).toBe("canceled");
    expect(store.st.apply).toEqual([{ key: "stripe:cus_v", after: 0, cause: "reconciliacion", baseline: false }]);
  });
  it("trae activas, vencidas y en prueba; las de prueba no suman", async () => {
    const subs = [stripeSub("a", "ca", [[price("pa", 10000)]]), stripeSub("b", "cb", [[price("pa", 10000)]], { status: "past_due" }), stripeSub("t", "ct", [[price("pa", 10000)]], { status: "trialing" })];
    const store = fakeStore(); store.st.plans.set("pa", { countsInMrr: true });
    await handle(cronReq("reconcile"), deps(store, fakeStripe(subs)));
    expect(Object.fromEntries(store.st.apply.map((a) => [a.key, a.after]))).toEqual({ "stripe:ca": 100, "stripe:cb": 100, "stripe:ct": 0 });
  });
  it("carga inicial: marca baseline, informa los planes sin clasificar y se bloquea si ya hay movimientos", async () => {
    const store = fakeStore(), stripe = fakeStripe([stripeSub("a", "ca", [[price("pa", 10000)]])]);
    const r = await (await handle(cronReq("reconcile", { baseline: true }), deps(store, stripe))).json();
    expect(store.st.apply[0]).toMatchObject({ baseline: true, cause: "carga_inicial" });
    expect(r.unclassified).toBe(1);
    store.st.eventsCount = 3;
    const again = await handle(cronReq("reconcile", { baseline: true }), deps(store, stripe));
    expect(again.status).toBe(409);
  });
  it("un cliente con error (falta tipo de cambio) no frena al resto y queda informado", async () => {
    const subs = [stripeSub("a", "ca", [[price("pa", 10000)]], { currency: "ars" }), stripeSub("b", "cb", [[price("pa", 10000)]])];
    const store = fakeStore(); store.st.plans.set("pa", { countsInMrr: true });
    const r = await (await handle(cronReq("reconcile"), deps(store, fakeStripe(subs)))).json();
    expect(r.errors).toEqual([{ customerKey: "stripe:ca", error: "Falta tipo de cambio para ars" }]);
    expect(store.st.apply.map((a) => a.key)).toEqual(["stripe:cb"]);
  });
  it("recompute usa lo que ya hay en la base, sin llamar a Stripe", async () => {
    const store = fakeStore(); store.st.plans.set("pa", { countsInMrr: true });
    store.st.subs.set("manual:1", { id: "manual:1", customerKey: "manual:c", source: "manual", status: "active", currency: "usd", items: [{ priceId: "pa", unitAmount: 20000, quantity: 1, interval: "month", intervalCount: 1 }], discount: null });
    const stripe = { ...fakeStripe(), listSubscriptions: () => { throw new Error("no debía llamar a Stripe"); } };
    const res = await handle(cronReq("recompute"), deps(store, stripe));
    expect(res.status).toBe(200);
    expect(store.st.apply).toEqual([{ key: "manual:c", after: 200, cause: "recalculo", baseline: false }]);
  });
  it("cada corrida queda registrada con correcciones, perdidas, sin clasificar y errores", async () => {
    const subs = [stripeSub("a", "ca", [[price("pa", 10000)]], { currency: "ars" })];
    const store = fakeStore(); store.st.plans.set("pa", { countsInMrr: true, category: "saas" });
    await handle(cronReq("reconcile"), deps(store, fakeStripe(subs)));
    await handle(cronReq("recompute"), deps(store, fakeStripe()));
    expect(store.st.runs).toEqual([
      { kind: "reconcile", fixes: 0, stale: 0, unclassified: 0, errors: [{ customerKey: "stripe:ca", error: "Falta tipo de cambio para ars" }] },
      { kind: "recompute", fixes: 0, stale: 0, unclassified: 0, errors: [{ customerKey: "stripe:ca", error: "Falta tipo de cambio para ars" }] },
    ]);
  });
  it("ruta desconocida → 404; método distinto de POST → 405", async () => {
    expect((await handle(cronReq("nada"), deps(fakeStore(), fakeStripe()))).status).toBe(404);
    expect((await handle(new Request("http://x/revenue-sync/stripe", { method: "GET" }), deps(fakeStore(), fakeStripe()))).status).toBe(405);
  });
});

// ── Carga manual ───────────────────────────────────────────────────────────────────────────────────────
describe("carga manual", () => {
  const ctxOf = (store) => ({ store, stripe: fakeStripe(), now: () => new Date("2026-11-10T12:00:00Z"), coupons: new Map(), known: null });
  const ids = () => { let i = 0; return () => "id" + ++i; };
  const manual = (over = {}) => ({ customerName: "Cliente Directo", email: "a@b.com", planPriceId: "pa", amount: 250, interval: "month", ...over });

  it("alta: crea cliente y suscripción manual, deja auditoría y recalcula (misma lógica que Stripe)", async () => {
    const store = fakeStore(); store.st.plans.set("pa", { countsInMrr: true });
    const r = await saveManualSubscription(ctxOf(store), manual(), "user-1", ids());
    expect(r).toMatchObject({ customerKey: "manual:id1", subscriptionId: "manual:id2" });
    expect(store.st.subs.get("manual:id2").items[0]).toMatchObject({ unitAmount: 25000, interval: "month" });
    expect(store.st.audit).toEqual([{ subscriptionId: "manual:id2", before: null, after: store.st.subs.get("manual:id2"), userId: "user-1" }]);
    expect(store.st.apply).toEqual([{ key: "manual:id1", after: 250, cause: "manual_alta", baseline: false }]);
  });
  it("edición: guarda la versión anterior en la auditoría y recalcula (expansión/contracción las clasifica el motor)", async () => {
    const store = fakeStore(); store.st.plans.set("pa", { countsInMrr: true });
    const ctx = ctxOf(store);
    const a = await saveManualSubscription(ctx, manual(), "u", ids());
    await saveManualSubscription(ctx, manual({ customerKey: a.customerKey, subscriptionId: a.subscriptionId, amount: 300 }), "u2", ids());
    expect(store.st.audit[1].before.items[0].unitAmount).toBe(25000);
    expect(store.st.audit[1].after.items[0].unitAmount).toBe(30000);
    expect(store.st.audit[1].userId).toBe("u2");
    expect(store.st.apply.at(-1)).toMatchObject({ after: 300, cause: "manual_edicion" });
  });
  it("cancelar una manual la deja en 0", async () => {
    const store = fakeStore(); store.st.plans.set("pa", { countsInMrr: true });
    const ctx = ctxOf(store);
    const a = await saveManualSubscription(ctx, manual(), "u", ids());
    await saveManualSubscription(ctx, manual({ customerKey: a.customerKey, subscriptionId: a.subscriptionId, status: "canceled" }), "u", ids());
    expect(store.st.apply.at(-1).after).toBe(0);
    expect(store.st.subs.get(a.subscriptionId).canceledAt).toBe("2026-11-10T12:00:00.000Z");
  });
  it("plan nuevo desde la carga manual", async () => {
    const store = fakeStore();
    const r = await saveManualSubscription(ctxOf(store), manual({ planPriceId: undefined, newPlan: { name: "Plan Directo", category: "saas" } }), "u", ids());
    expect(store.st.plans.get("manual:plan-0")).toMatchObject({ name: "Plan Directo", category: "saas", countsInMrr: true });
    expect(store.st.apply.at(-1).after).toBe(250);
    expect(r.subscriptionId).toMatch(/^manual:/);
  });
  it("valida: monto, intervalo, estado, cliente, plan y que no se editen suscripciones de Stripe", async () => {
    const store = fakeStore(); store.st.plans.set("pa", { countsInMrr: true });
    const go = (o) => saveManualSubscription(ctxOf(store), manual(o), "u", ids());
    await expect(go({ amount: -1 })).rejects.toThrow("monto_invalido");
    await expect(go({ amount: NaN })).rejects.toThrow("monto_invalido");
    await expect(go({ interval: "week" })).rejects.toThrow("intervalo_invalido");
    await expect(go({ status: "pausada" })).rejects.toThrow("estado_invalido");
    await expect(go({ customerName: "  " })).rejects.toThrow("cliente_requerido");
    await expect(go({ planPriceId: "no-existe" })).rejects.toThrow("plan_inexistente");
    await expect(go({ subscriptionId: "stripe:sub_1" })).rejects.toThrow("suscripcion_invalida");
    await expect(go({ customerKey: "otra:cosa" })).rejects.toThrow("cliente_invalido");
    expect(store.st.apply).toHaveLength(0);
  });
  it("HTTP: solo un admin logueado puede (el secret del cron no alcanza) y los errores de validación son 400", async () => {
    const store = fakeStore(); store.st.plans.set("pa", { countsInMrr: true });
    expect((await handle(cronReq("manual", manual()), deps(store, fakeStripe()))).status).toBe(403);
    expect((await handle(adminReq("manual", manual()), deps(store, fakeStripe()))).status).toBe(403);
    const ok = await handle(adminReq("manual", manual()), deps(store, fakeStripe(), { isAdmin: async () => true }));
    expect(ok.status).toBe(200);
    expect(store.st.audit[0].userId).toBe("admin-1");
    const bad = await handle(adminReq("manual", manual({ amount: -5 })), deps(store, fakeStripe(), { isAdmin: async () => true }));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "monto_invalido" });
  });
});

describe("reconcile directo", () => {
  it("devuelve cuántos planes quedaron sin clasificar", async () => {
    const store = fakeStore();
    const r = await reconcile({ store, stripe: fakeStripe([stripeSub("a", "ca", [[price("p1", 100)], [price("p2", 100)]])]), now: () => new Date(), coupons: new Map(), known: null });
    expect(r.unclassified).toBe(2);
  });
});
