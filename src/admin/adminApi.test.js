import { describe, it, expect, beforeEach } from "vitest";
import { resetMock, listUsers, getCompanyBundle, getPipelineStages, getCredits, listAudit, updateCompany, updateUserContact, setCompanyStatus, assignPlan, getPaymentMethodUrl, listPrices, WebhookError, deleteWorkflow, getUser, listCompanies, listCompanyUsers, getMyPermissions, createSupportLink, listSupportLog, SupportError } from "./adminApi.js";
import { MOCK } from "./adminMock.js";

const ACTOR = "admin@ejemplo.test";
beforeEach(() => resetMock());

describe("datos de ejemplo", () => {
  it("cada usuario apunta a una company que existe y cada company tiene saldo de créditos", () => {
    const ids = new Set(MOCK.companies.map((c) => c._id));
    // quien tiene company apunta a una que existe; también hay usuarios sin company (en la base real son la mayoría)
    expect(MOCK.users.filter((u) => u.companies.length).every((u) => ids.has(u.companies[0]))).toBe(true);
    expect(MOCK.users.some((u) => u.companies.length === 0)).toBe(true);
    expect(MOCK.companies.every((c) => MOCK.credit_balances.some((b) => b.company_id === c._id))).toBe(true);
  });
  it("hay companies activas y pausadas, y los dos proveedores de WhatsApp", () => {
    expect(new Set(MOCK.companies.map((c) => c.status))).toEqual(new Set(["active", "paused"]));
    expect(MOCK.users.some((u) => u.kapso)).toBe(true);
    expect(MOCK.users.some((u) => u.gupshup)).toBe(true);
  });
  it("los ids son únicos", () => {
    const all = ["users", "companies", "contacts", "campaigns", "landings", "companyconversions", "whatsappconversions", "workflows", "pipelines", "pipelinestages", "whatsapptemplates", "webforms", "contactlists"].flatMap((k) => MOCK[k].map((x) => x._id));
    expect(new Set(all).size).toBe(all.length);
  });
  it("no hay emails reales: todo termina en .test", () => {
    const emails = [...MOCK.users.map((u) => u.email), ...MOCK.companies.map((c) => c.userEmail), ...MOCK.contacts.map((c) => c.email)];
    expect(emails.every((e) => e.endsWith(".test"))).toBe(true);
  });
});

describe("listUsers", () => {
  it("pagina, ordena de más nuevo a más viejo y trae el nombre de la company", async () => {
    const r = await listUsers({ page: 1, pageSize: 5 });
    expect(r.items).toHaveLength(5);
    expect(r.total).toBe(MOCK.users.length);
    expect(r.items[0]._id > r.items[1]._id).toBe(true);
    expect(r.items[0].companyName).toBeTruthy();
  });
  it("busca por apellido sin acentos exactos pero respetando letras", async () => {
    const r = await listUsers({ search: "rossi" });
    expect(r.items.map((u) => u.surname)).toEqual(["Rossi"]);
  });
  it("sin resultados da una página vacía", async () => {
    const r = await listUsers({ search: "zzzzzz" });
    expect(r).toMatchObject({ items: [], total: 0, pages: 1 });
  });
});

describe("listUsers: filtros", () => {
  const all = async (opts) => (await listUsers({ pageSize: 100, ...opts })).items;
  it("cada company tiene un owner, y es un usuario de esa misma company", () => {
    for (const c of MOCK.companies) {
      const owners = MOCK.users.filter((u) => u.email === c.userEmail);
      expect(owners).toHaveLength(1);
      expect(owners[0].companies[0]).toBe(c._id);
    }
  });
  it("solo owners: uno por company", async () => {
    const r = await all({ owners: true });
    expect(r).toHaveLength(MOCK.companies.length);
    expect(r.every((u) => u.isOwner)).toBe(true);
    expect((await all({})).filter((u) => u.isOwner)).toHaveLength(MOCK.companies.length);
  });
  it("company activa: excluye usuarios de companies pausadas", async () => {
    const paused = new Set(MOCK.companies.filter((c) => c.status === "paused").map((c) => c._id));
    const r = await all({ activeOnly: true });
    // los usuarios sin company no cuentan como "company activa"
    expect(r.length).toBe(MOCK.users.filter((u) => u.companies[0] && !paused.has(u.companies[0])).length);
    expect(r.every((u) => u.companyStatus === "active")).toBe(true);
  });
  it("los usuarios sin company aparecen en la lista, sin nombre de company ni owner, y no entran en el filtro de company activa", async () => {
    const sin = (await all({})).filter((u) => u.companies.length === 0);
    expect(sin.length).toBeGreaterThan(0);
    expect(sin.every((u) => u.companyName === "—" && u.companyStatus === null && u.isOwner === false)).toBe(true);
    expect((await all({ activeOnly: true })).some((u) => u.companies.length === 0)).toBe(false);
    expect((await all({ owners: true })).some((u) => u.companies.length === 0)).toBe(false);
  });
  it("owners + activa + búsqueda se combinan, y el total sale del filtro", async () => {
    const r = await listUsers({ owners: true, activeOnly: true, pageSize: 2 });
    expect(r.total).toBe(MOCK.companies.filter((c) => c.status === "active").length);
    expect(r.items).toHaveLength(2);
    const s = await all({ owners: true, search: "rossi" });
    expect(s.map((u) => u.surname)).toEqual(["Rossi"]);
    expect(await all({ owners: true, search: "Gómez" })).toHaveLength(0); // Martín Gómez no es owner
  });
  it("pausar una company la saca del filtro de activas", async () => {
    const co = MOCK.companies[0];
    const antes = (await all({ activeOnly: true })).length;
    await setCompanyStatus(co._id, "paused", ACTOR);
    expect((await all({ activeOnly: true })).length).toBe(antes - MOCK.users.filter((u) => u.companies[0] === co._id).length);
  });
});

describe("listCompanies / listCompanyUsers", () => {
  it("separa activas y pausadas, con los totales de cada lista", async () => {
    const a = await listCompanies({ status: "active", pageSize: 50 }), p = await listCompanies({ status: "paused", pageSize: 50 });
    const nPaused = MOCK.companies.filter((c) => c.status === "paused").length;
    expect(p.items).toHaveLength(nPaused);
    expect(a.items).toHaveLength(MOCK.companies.length - nPaused);
    expect(a.counts).toEqual({ active: a.items.length, paused: nPaused });
    expect(a.items.every((c) => c.status !== "paused")).toBe(true);
    expect(p.items.every((c) => c.status === "paused")).toBe(true);
    const ids = [...a.items, ...p.items].map((c) => c._id);
    expect(new Set(ids).size).toBe(MOCK.companies.length); // ninguna en las dos listas ni en ninguna
  });
  it("ordena por nombre y cuenta usuarios", async () => {
    const a = await listCompanies({ status: "active", pageSize: 50 });
    const names = a.items.map((c) => c.name);
    expect(names).toEqual([...names].sort((x, y) => x.localeCompare(y, "es", { sensitivity: "base" })));
    for (const c of a.items) expect(c.userCount).toBe(MOCK.users.filter((u) => u.companies[0] === c._id).length);
  });
  it("busca por nombre o por email del owner, y los totales siguen la búsqueda", async () => {
    const r = await listCompanies({ search: "demo", pageSize: 50 });
    expect(r.items.map((c) => c.name)).toEqual(["Propiedades Demo Sur"]);
    expect(r.counts).toEqual({ active: 1, paused: 0 });
    const byOwner = await listCompanies({ search: "valentina.silva", status: "paused" });
    expect(byOwner.items.map((c) => c.name)).toEqual(["Estudio Ficticio & Asociados"]);
    expect((await listCompanies({ search: "zzz" })).items).toEqual([]);
  });
  it("pagina", async () => {
    const r = await listCompanies({ status: "active", pageSize: 3 });
    expect(r).toMatchObject({ total: 4, pages: 2, page: 1 });
    expect(r.items).toHaveLength(3);
  });
  it("pausar una company la pasa de lista", async () => {
    const co = MOCK.companies.find((c) => c.status === "active");
    await setCompanyStatus(co._id, "paused", ACTOR);
    expect((await listCompanies({ status: "paused", pageSize: 50 })).items.some((c) => c._id === co._id)).toBe(true);
    expect((await listCompanies({ status: "active", pageSize: 50 })).items.some((c) => c._id === co._id)).toBe(false);
  });
  it("usuarios de la company: el owner primero, y error si no existe", async () => {
    const co = MOCK.companies[3];
    const u = await listCompanyUsers(co._id);
    expect(u).toHaveLength(MOCK.users.filter((x) => x.companies[0] === co._id).length);
    expect(u[0].isOwner).toBe(true);
    expect(u.slice(1).every((x) => !x.isOwner)).toBe(true);
    await expect(listCompanyUsers("nope")).rejects.toThrow(/No se encontró/);
  });
});

describe("webhooks de back office (simulados)", () => {
  const user = (name) => MOCK.users.find((x) => x.name === name);
  const START = "price_1MockStartStd0001", PROMO = "price_1MockStartPromo01", PRO = "price_1MockProStd000001";
  const subOf = async (name) => (await getUser(user(name)._id)).subscription;
  const err = async (p) => { try { await p; } catch (e) { return e; } throw new Error("tenía que fallar"); };

  it("solo ofrece precios activos y mensuales", async () => {
    const r = await listPrices();
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((p) => p.active && p.interval === "month")).toBe(true);
    expect(r.some((p) => p.id === "price_1MockProOld0000001" || p.id === "price_1MockProAnnual0001")).toBe(false);
  });
  it("asignar plan con tarjeta ok: cambia plan, suscripción y precio, y audita", async () => {
    const lucia = user("Lucía");
    const r = await assignPlan(lucia._id, { plan: "SpicyStart", stripePriceId: PROMO, idempotencyKey: "k1" }, ACTOR);
    expect(r).toMatchObject({ userEmail: lucia.email, plan: "SpicyStart", previousPlan: "SpicyPro", stripePriceId: PROMO, oldSubscriptionCancelled: true, billingFailures: [] });
    expect(r.stripeSubscriptionId).toMatch(/^sub_/);
    expect(await subOf("Lucía")).toEqual({ subscriptionType: "SpicyStart", subscriptionId: r.stripeSubscriptionId });
    expect((await getUser(lucia._id)).stripe).toMatchObject({ subscriptionId: r.stripeSubscriptionId, priceId: PROMO });
    const [a] = await listAudit();
    expect(a).toMatchObject({ actor: ACTOR, action: "plan_assign", targetId: lucia._id });
    expect(a.detail).toMatchObject({ plan: "SpicyStart", previousPlan: "SpicyPro", stripePriceId: PROMO });
  });
  it("mismo plan con otro precio cobra el nuevo; con el mismo precio es YA_SUSCRIPTO", async () => {
    const id = user("Lucía")._id;
    await assignPlan(id, { plan: "SpicyStart", stripePriceId: PROMO }, ACTOR);
    await assignPlan(id, { plan: "SpicyStart", stripePriceId: START }, ACTOR);
    expect((await getUser(user("Lucía")._id)).stripe.priceId).toBe(START);
    const e = await err(assignPlan(id, { plan: "SpicyStart", stripePriceId: START }, ACTOR));
    expect(e).toBeInstanceOf(WebhookError);
    expect([e.status, e.code]).toEqual([409, "YA_SUSCRIPTO"]);
  });
  it("tarjeta rechazada: 402, link para cambiarla, no cambia nada y queda auditado el intento", async () => {
    const before = await subOf("Sofía");
    const e = await err(assignPlan(user("Sofía")._id, { plan: "SpicyPro", stripePriceId: PRO }, ACTOR));
    expect([e.status, e.code]).toEqual([402, "PAGO_RECHAZADO"]);
    expect(e.extra.decline_code).toBe("insufficient_funds");
    expect(e.extra.paymentMethodUpdateUrl).toMatch(/^https:\/\/billing\.stripe\.com\//);
    expect(await subOf("Sofía")).toEqual(before);
    const [a] = await listAudit();
    expect(a).toMatchObject({ action: "plan_assign_failed" });
    expect(a.detail.code).toBe("PAGO_RECHAZADO");
  });
  it("sin tarjeta guardada: 402 SIN_MEDIO_DE_PAGO con el link, y no se cobra", async () => {
    const before = await subOf("Valentina");
    const e = await err(assignPlan(user("Valentina")._id, { plan: "SpicyOne", stripePriceId: "price_1MockOneStd00001" }, ACTOR));
    expect([e.status, e.code]).toEqual([402, "SIN_MEDIO_DE_PAGO"]);
    expect(e.extra.paymentMethodUpdateUrl).toBeTruthy();
    expect(await subOf("Valentina")).toEqual(before);
  });
  it("validaciones del webhook: plan, precio requerido, precio inválido (archivado, anual o inexistente)", async () => {
    const id = user("Lucía")._id, before = await subOf("Lucía");
    const code = async (body) => (await err(assignPlan(id, body, ACTOR))).code;
    expect(await code({ plan: "Freemium", stripePriceId: START })).toBe("PLAN_INVALIDO");
    expect(await code({ plan: "tier3", stripePriceId: START })).toBe("PLAN_INVALIDO");
    expect(await code({ plan: "SpicyStart" })).toBe("PRECIO_REQUERIDO");
    expect(await code({ plan: "SpicyStart", stripePriceId: "price_1MockProOld0000001" })).toBe("PRECIO_INVALIDO");
    expect(await code({ plan: "SpicyStart", stripePriceId: "price_1MockProAnnual0001" })).toBe("PRECIO_INVALIDO");
    expect(await code({ plan: "SpicyStart", stripePriceId: "price_noexiste" })).toBe("PRECIO_INVALIDO");
    expect(await subOf("Lucía")).toEqual(before);
    expect((await listAudit()).every((a) => a.action === "plan_assign_failed")).toBe(true);
  });
  it("usuario inexistente: 404", async () => {
    const e = await err(assignPlan("nope", { plan: "SpicyStart", stripePriceId: START }, ACTOR));
    expect([e.status, e.code]).toEqual([404, "USUARIO_NO_ENCONTRADO"]);
  });
  it("idempotencia: repetir la misma clave devuelve el primer resultado y no cobra dos veces", async () => {
    const id = user("Lucía")._id;
    const a = await assignPlan(id, { plan: "SpicyStart", stripePriceId: START, idempotencyKey: "ticket-1" }, ACTOR);
    const b = await assignPlan(id, { plan: "SpicyStart", stripePriceId: START, idempotencyKey: "ticket-1" }, ACTOR);
    expect(b).toEqual(a);
    expect((await listAudit()).filter((x) => x.action === "plan_assign")).toHaveLength(1);
  });
  it("sin clave, repetir la misma operación es YA_SUSCRIPTO (tampoco cobra dos veces)", async () => {
    const id = user("Lucía")._id;
    await assignPlan(id, { plan: "SpicyStart", stripePriceId: START }, ACTOR);
    expect((await err(assignPlan(id, { plan: "SpicyStart", stripePriceId: START }, ACTOR))).code).toBe("YA_SUSCRIPTO");
  });
  it("un cobro fallido no se guarda como resultado: reintentar con la misma clave vuelve a intentar", async () => {
    const id = user("Sofía")._id;
    for (let i = 0; i < 2; i++) expect((await err(assignPlan(id, { plan: "SpicyPro", stripePriceId: PRO, idempotencyKey: "k-fail" }, ACTOR))).code).toBe("PAGO_RECHAZADO");
    expect((await listAudit()).filter((x) => x.action === "plan_assign_failed")).toHaveLength(2);
  });
  it("link de tarjeta: devuelve cliente y link único, no toca la suscripción y audita", async () => {
    const lucia = user("Lucía"), before = await subOf("Lucía");
    const a = await getPaymentMethodUrl(lucia._id, ACTOR), b = await getPaymentMethodUrl(lucia._id, ACTOR);
    expect(a).toMatchObject({ userEmail: lucia.email, stripeCustomerId: lucia.stripe.customerId });
    expect(a.paymentMethodUpdateUrl).toMatch(/^https:\/\/billing\.stripe\.com\/p\/session\//);
    expect(b.paymentMethodUpdateUrl).not.toBe(a.paymentMethodUpdateUrl);
    expect(await subOf("Lucía")).toEqual(before);
    expect((await listAudit()).filter((x) => x.action === "card_link_created")).toHaveLength(2);
    expect(JSON.stringify(await listAudit())).not.toContain("billing.stripe.com");
  });
  it("link de tarjeta: usuario inexistente es 404 y sin actor no se genera", async () => {
    expect((await err(getPaymentMethodUrl("nope", ACTOR))).status).toBe(404);
    await expect(getPaymentMethodUrl(user("Lucía")._id, "")).rejects.toThrow(/quién/);
  });
  it("hay usuarios para probar cada caso: con tarjeta, rechazada, sin tarjeta, freemium y free trial", () => {
    expect(new Set(MOCK.users.map((u) => u.stripe.paymentMethod))).toEqual(new Set(["ok", "declined", "none"]));
    expect(new Set(MOCK.users.map((u) => u.subscription.subscriptionType))).toEqual(new Set(["SpicyPro", "SpicyStart", "Freemium", "SpicyProMax", "FreeTrial"]));
    expect(MOCK.users.some((u) => "tier" in u.subscription)).toBe(false);
  });
});

describe("soporte: entrar como usuario (simulado)", () => {
  const DENIED = "sin.permiso@ejemplo.test";
  const REASON = "ticket 4821: el cliente no ve sus contactos";
  const lucia = () => MOCK.users.find((x) => x.name === "Lucía");
  const err = async (p) => { try { await p; } catch (e) { return e; } throw new Error("tenía que fallar"); };

  it("permisos: tienen todos menos el actor sin permiso, sin distinguir mayúsculas", async () => {
    expect(await getMyPermissions(ACTOR)).toEqual({ support: true });
    expect(await getMyPermissions(DENIED)).toEqual({ support: false });
    expect(await getMyPermissions("  SIN.PERMISO@Ejemplo.test ")).toEqual({ support: false });
    await expect(getMyPermissions("")).rejects.toThrow(/quién/);
  });
  it("un usuario sin company no puede entrar como usuario: SIN_COMPANY, sin link y sin auditar un link generado", async () => {
    const sinCompany = MOCK.users.find((x) => x.companies.length === 0);
    const e = await err(createSupportLink(sinCompany._id, REASON, ACTOR));
    expect(e).toBeInstanceOf(SupportError);
    expect(e).toMatchObject({ status: 422, code: "SIN_COMPANY" });
    expect((await listAudit()).filter((a) => a.action === "support_link_created")).toHaveLength(0);
  });
  it("genera el link, que vence a los 15 min, y audita quién, a quién, a qué company y por qué", async () => {
    const now = new Date("2026-11-11T10:00:00Z");
    const r = await createSupportLink(lucia()._id, "  ticket 4821:  el cliente no ve sus contactos ", ACTOR, now);
    expect(r.url).toMatch(/^https:\/\/app\.example\.test\/support-session\?token=/);
    expect(r.expiresAt).toBe("2026-11-11T10:15:00.000Z");
    const [a] = await listAudit();
    expect(a).toMatchObject({ actor: ACTOR, action: "support_link_created", targetType: "user", targetId: lucia()._id, companyId: lucia().companies[0] });
    expect(a.detail).toMatchObject({ targetEmail: lucia().email, companyName: "Inmobiliaria Ejemplo Norte", reason: REASON });
  });
  it("el link NUNCA queda en la auditoría ni en el registro de soporte", async () => {
    const r = await createSupportLink(lucia()._id, REASON, ACTOR);
    const token = r.url.split("token=")[1];
    expect(JSON.stringify(await listAudit())).not.toContain(token);
    expect(JSON.stringify(await listSupportLog())).not.toContain(token);
    expect(JSON.stringify(await listAudit())).not.toContain("support-session");
  });
  it("cada pedido da un link distinto", async () => {
    const a = await createSupportLink(lucia()._id, REASON, ACTOR), b = await createSupportLink(lucia()._id, REASON, ACTOR);
    expect(a.url).not.toBe(b.url);
  });
  it("sin permiso: 403, no hay link y el intento queda registrado", async () => {
    const e = await err(createSupportLink(lucia()._id, REASON, DENIED));
    expect(e).toBeInstanceOf(SupportError);
    expect([e.status, e.code]).toEqual([403, "SIN_PERMISO_SOPORTE"]);
    const [a] = await listAudit();
    expect(a).toMatchObject({ actor: DENIED, action: "support_link_denied", targetId: lucia()._id });
    expect(a.detail.reason).toBe(REASON);
  });
  it("sin permiso responde 403 aunque el usuario no exista (no revela qué usuarios hay)", async () => {
    expect((await err(createSupportLink("nope", REASON, DENIED))).code).toBe("SIN_PERMISO_SOPORTE");
  });
  it("usuario inexistente: 404", async () => {
    const e = await err(createSupportLink("nope", REASON, ACTOR));
    expect([e.status, e.code]).toEqual([404, "USUARIO_NO_ENCONTRADO"]);
  });
  it("motivo inválido: 422, sin link y sin registrar una sesión", async () => {
    for (const bad of ["", "corto", "aaaaaaaaaaaa", undefined]) {
      const e = await err(createSupportLink(lucia()._id, bad, ACTOR));
      expect([e.status, e.code]).toEqual([422, "MOTIVO_INVALIDO"]);
    }
    expect(await listAudit()).toHaveLength(0);
  });
  it("sin actor no se genera nada", async () => {
    await expect(createSupportLink(lucia()._id, REASON, "")).rejects.toThrow(/quién/);
    expect(await listAudit()).toHaveLength(0);
  });
  it("también se puede entrar a un usuario de una company pausada", async () => {
    const paused = MOCK.users.find((u) => MOCK.companies.find((c) => c._id === u.companies[0]).status === "paused");
    expect((await createSupportLink(paused._id, REASON, ACTOR)).url).toBeTruthy();
  });
  it("el registro de soporte tiene solo sesiones e intentos, más nuevo primero", async () => {
    await setCompanyStatus(MOCK.companies[0]._id, "paused", ACTOR); // otra acción: no debe aparecer
    await createSupportLink(lucia()._id, "ticket 1: primer caso de prueba", ACTOR);
    await err(createSupportLink(lucia()._id, "ticket 2: segundo caso de prueba", DENIED));
    await createSupportLink(MOCK.users[3]._id, "ticket 3: tercer caso de prueba", ACTOR);
    const r = await listSupportLog();
    expect(r.total).toBe(3);
    expect(r.items.map((a) => a.action)).toEqual(["support_link_created", "support_link_denied", "support_link_created"]);
    expect(r.items[0].detail.reason).toMatch(/tercer/);
  });
  it("el registro se busca por admin, usuario, email, company o motivo, y pagina", async () => {
    for (let i = 0; i < 12; i++) await createSupportLink(lucia()._id, `ticket ${100 + i}: caso de prueba número ${i}`, ACTOR);
    await err(createSupportLink(MOCK.users[3]._id, "ticket 999: revisar facturación", DENIED));
    expect((await listSupportLog({ pageSize: 10 })).pages).toBe(2);
    expect((await listSupportLog({ search: "facturación" })).total).toBe(1);
    expect((await listSupportLog({ search: DENIED })).total).toBe(1);
    expect((await listSupportLog({ search: lucia().email })).total).toBe(12);
    expect((await listSupportLog({ search: "Inmobiliaria Ejemplo Norte" })).total).toBe(12);
    expect((await listSupportLog({ search: "zzzz" })).total).toBe(0);
  });
  it("listAudit puede filtrar por acciones", async () => {
    await setCompanyStatus(MOCK.companies[0]._id, "paused", ACTOR);
    await createSupportLink(lucia()._id, REASON, ACTOR);
    expect((await listAudit({ actions: ["company_pause"] })).map((a) => a.action)).toEqual(["company_pause"]);
    expect(await listAudit()).toHaveLength(2);
  });
});

describe("detalle de la company", () => {
  it("trae los usuarios de la company (users.companies = companyId)", async () => {
    const co = MOCK.companies[3];
    const b = await getCompanyBundle(co._id);
    expect(b.users.length).toBe(MOCK.users.filter((u) => u.companies.includes(co._id)).length);
    expect(b.users.length).toBeGreaterThan(1);
  });
  it("solo trae datos de esa company", async () => {
    const co = MOCK.companies[0];
    const b = await getCompanyBundle(co._id);
    for (const k of ["contacts", "campaigns", "landings", "conversions", "whatsappConversions", "pipelines", "templates", "webforms", "contactLists", "workflows"]) {
      expect(b[k].length).toBeGreaterThan(0);
      expect(b[k].every((x) => x.companyId === co._id)).toBe(true);
    }
  });
  it("una company inexistente da error claro", async () => {
    await expect(getCompanyBundle("nope")).rejects.toThrow(/No se encontró/);
  });
  it("los stages vienen ordenados por posición", async () => {
    const p = MOCK.pipelines[0];
    const st = await getPipelineStages(p._id);
    expect(st.map((s) => s.position)).toEqual([1, 2, 3, 4]);
    expect(st.every((s) => s.pipelineId === p._id)).toBe(true);
  });
  it("créditos: saldo y transacciones, las más recientes primero", async () => {
    const c = await getCredits(MOCK.companies[0]._id);
    expect(c.balance).toMatchObject({ monthly_credits: expect.any(Number), total_credits: expect.any(Number), available_credits: expect.any(Number) });
    expect(c.transactions.length).toBeGreaterThan(1);
    expect(c.transactions[0].created_at >= c.transactions[1].created_at).toBe(true);
    expect(await getCredits("nope")).toEqual({ balance: null, transactions: [] });
  });
});

describe("acciones: cambian los datos y dejan auditoría", () => {
  it("editar company", async () => {
    const co = MOCK.companies[0];
    await updateCompany(co._id, { name: "Nuevo nombre", phoneNumber: co.phoneNumber, credits: 999 }, ACTOR);
    const b = await getCompanyBundle(co._id);
    expect(b.company).toMatchObject({ name: "Nuevo nombre", credits: 999 });
    const [a] = await listAudit();
    expect(a).toMatchObject({ actor: ACTOR, action: "company_edit", targetType: "company", targetId: co._id, companyId: co._id });
    expect(a.detail.changes.map((c) => c.key).sort()).toEqual(["credits", "name"]);
  });
  it("editar company con créditos vacío NO toca los créditos (no escribe un 0)", async () => {
    const co = MOCK.companies[0];
    const antes = co.credits;
    await updateCompany(co._id, { name: "Otro nombre", phoneNumber: co.phoneNumber, credits: null }, ACTOR);
    const b = await getCompanyBundle(co._id);
    expect(b.company.credits).toBe(antes);
    const [a] = await listAudit();
    expect(a.detail.changes.map((c) => c.key)).toEqual(["name"]);
  });
  it("editar company con datos inválidos no cambia nada ni audita", async () => {
    const co = MOCK.companies[0];
    await expect(updateCompany(co._id, { name: "", phoneNumber: "", credits: 1 }, ACTOR)).rejects.toThrow(/nombre/);
    await expect(updateCompany(co._id, { name: "x", phoneNumber: "", credits: -5 }, ACTOR)).rejects.toThrow(/créditos/i);
    expect((await getCompanyBundle(co._id)).company.name).toBe(co.name);
    expect(await listAudit()).toHaveLength(0);
  });
  it("editar ficha de contacto, con email repetido rechazado", async () => {
    const [u1, u2] = MOCK.users;
    await updateUserContact(u1._id, { name: "Otro", surname: "Nombre", email: "otro.nombre@ejemplo.test", phoneNumber: "" }, ACTOR);
    expect(await getUser(u1._id)).toMatchObject({ name: "Otro", email: "otro.nombre@ejemplo.test" });
    await expect(updateUserContact(u1._id, { name: "A", surname: "B", email: u2.email.toUpperCase(), phoneNumber: "" }, ACTOR)).rejects.toThrow(/ya existe/i);
  });
  it("pausar y activar", async () => {
    const co = MOCK.companies[0];
    await setCompanyStatus(co._id, "paused", ACTOR);
    expect((await getCompanyBundle(co._id)).company.status).toBe("paused");
    await setCompanyStatus(co._id, "active", ACTOR);
    expect((await getCompanyBundle(co._id)).company.status).toBe("active");
    const acts = (await listAudit()).map((a) => a.action);
    expect(acts).toEqual(["company_activate", "company_pause"]);
    await expect(setCompanyStatus(co._id, "borrada", ACTOR)).rejects.toThrow(/inválido/);
  });
  it("eliminar workflow", async () => {
    const w = MOCK.workflows[0];
    await deleteWorkflow(w._id, ACTOR);
    const b = await getCompanyBundle(w.companyId);
    expect(b.workflows.some((x) => x._id === w._id)).toBe(false);
    expect((await listAudit({ companyId: w.companyId }))[0]).toMatchObject({ action: "workflow_delete", targetId: w._id });
    await expect(deleteWorkflow(w._id, ACTOR)).rejects.toThrow(/No se encontró/);
  });
  it("sin actor no se puede modificar nada", async () => {
    const co = MOCK.companies[0];
    await expect(setCompanyStatus(co._id, "paused", "")).rejects.toThrow(/quién/);
    await expect(assignPlan(MOCK.users[0]._id, { plan: "SpicyStart", stripePriceId: "price_1MockStartStd0001" }, undefined)).rejects.toThrow(/quién/);
    await expect(deleteWorkflow(MOCK.workflows[0]._id, "")).rejects.toThrow(/quién/);
    expect((await getCompanyBundle(co._id)).company.status).toBe(co.status);
    expect((await getUser(MOCK.users[0]._id)).subscription).toEqual(MOCK.users[0].subscription);
    expect((await getCompanyBundle(MOCK.workflows[0].companyId)).workflows.some((w) => w._id === MOCK.workflows[0]._id)).toBe(true);
    expect(await listAudit()).toHaveLength(0);
  });
  it("la auditoría se puede filtrar por company", async () => {
    await setCompanyStatus(MOCK.companies[0]._id, "paused", ACTOR);
    await setCompanyStatus(MOCK.companies[1]._id, "paused", ACTOR);
    expect(await listAudit({ companyId: MOCK.companies[1]._id })).toHaveLength(1);
    expect(await listAudit()).toHaveLength(2);
  });
  it("resetMock vuelve al estado inicial", async () => {
    await setCompanyStatus(MOCK.companies[0]._id, "paused", ACTOR);
    resetMock();
    expect((await getCompanyBundle(MOCK.companies[0]._id)).company.status).toBe(MOCK.companies[0].status);
    expect(await listAudit()).toHaveLength(0);
  });
});
