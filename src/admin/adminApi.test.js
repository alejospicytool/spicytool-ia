import { describe, it, expect, beforeEach } from "vitest";
import { resetMock, listUsers, getCompanyBundle, getPipelineStages, getCredits, listAudit, updateCompany, updateUserContact, setCompanyStatus, changePlan, deleteWorkflow, getUser, listCompanies, listCompanyUsers } from "./adminApi.js";
import { MOCK } from "./adminMock.js";

const ACTOR = "admin@ejemplo.test";
beforeEach(() => resetMock());

describe("datos de ejemplo", () => {
  it("cada usuario apunta a una company que existe y cada company tiene saldo de créditos", () => {
    const ids = new Set(MOCK.companies.map((c) => c._id));
    expect(MOCK.users.every((u) => ids.has(u.companies[0]))).toBe(true);
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
    expect(r.length).toBe(MOCK.users.filter((u) => !paused.has(u.companies[0])).length);
    expect(r.every((u) => u.companyStatus === "active")).toBe(true);
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
  it("cambiar plan escribe en el campo correcto y valida", async () => {
    const u = MOCK.users.find((x) => x.subscription.tier === "tier3");
    await changePlan(u._id, "tier4", ACTOR);
    expect((await getUser(u._id)).subscription.tier).toBe("tier4");
    await changePlan(u._id, "freemium", ACTOR);
    const after = await getUser(u._id);
    expect(after.subscription.subscriptionType).toBe("freemium");
    expect(after.subscription.tier).toBe("tier4");
    await expect(changePlan(u._id, "tier9", ACTOR)).rejects.toThrow(/inválido/);
    expect((await listAudit()).filter((a) => a.action === "plan_change")).toHaveLength(2);
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
    await expect(changePlan(MOCK.users[0]._id, "tier4", undefined)).rejects.toThrow(/quién/);
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
