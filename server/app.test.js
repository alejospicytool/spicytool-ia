import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { createApp } from "./app.js";

const ID = "6650000000000000000000a1";
const queries = {
  health: vi.fn(async () => ({ ok: true, mode: "real" })),
  listUsers: vi.fn(async (a) => ({ items: [], total: 0, page: 1, pages: 1, pageSize: a.pageSize, echo: a })),
  getUser: vi.fn(async (id) => (id === ID ? { _id: id } : null)),
  listCompanies: vi.fn(async (a) => ({ items: [], echo: a })),
  getCompanyBundle: vi.fn(async (id) => (id === ID ? { company: { _id: id } } : null)),
  listCompanyUsers: vi.fn(async () => []),
  getPipelineStages: vi.fn(async () => []),
  listSupportSessions: vi.fn(async (a) => ({ items: [], echo: a })),
};
const authenticate = vi.fn(async (h) => (h === "Bearer admin" ? { id: "u1", email: "nico@spicytool.test" } : null));
const billing = {
  assignPlan: vi.fn(async () => ({ status: 201, body: { message: "ok" } })),
  paymentMethodUrl: vi.fn(async () => ({ status: 200, body: { paymentMethodUpdateUrl: "https://billing.stripe.com/p/session/a" } })),
};
const companies = { setStatus: vi.fn(async () => ({ status: 200, body: { _id: "x", status: "paused" } })) };
const audit = { list: vi.fn(async (token, a) => [{ id: "1", echo: { token, ...a } }]) };
const prices = [{ id: "price_1", plan: "SpicyPro", amount: 40000 }];

let server, base;
beforeAll(async () => {
  const app = createApp({ queries, authenticate, billing, companies, audit, prices, log: () => {} });
  await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise((r) => server.close(r)));

const call = (path, { method = "GET", token = "admin", body } = {}) => fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });

describe("API del backoffice (solo lectura)", () => {
  it("sin token o con token que no es de admin: 401 y no consulta nada", async () => {
    queries.listUsers.mockClear();
    for (const token of [null, "otro"]) {
      const r = await call("/api/admin/users", { token });
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: "No autorizado" });
    }
    expect(queries.listUsers).not.toHaveBeenCalled();
  });
  it("health responde ok con un admin", async () => {
    expect(await (await call("/api/admin/health")).json()).toEqual({ ok: true, mode: "real" });
  });
  it("lista de usuarios: pasa los filtros y limita el tamaño de página", async () => {
    const r = await (await call("/api/admin/users?search=ana&page=2&pageSize=999&owners=1&activeOnly=true")).json();
    expect(r.echo).toEqual({ search: "ana", page: 2, pageSize: 50, owners: true, activeOnly: true });
    const d = await (await call("/api/admin/users?page=abc&pageSize=-5")).json();
    expect(d.echo).toMatchObject({ page: 1, pageSize: 1, owners: false, activeOnly: false });
  });
  it("el texto de búsqueda se corta a 100 caracteres", async () => {
    const r = await (await call("/api/admin/users?search=" + "a".repeat(500))).json();
    expect(r.echo.search).toHaveLength(100);
  });
  it("companies: solo 'paused' o 'active'", async () => {
    expect((await (await call("/api/admin/companies?status=paused")).json()).echo.status).toBe("paused");
    expect((await (await call("/api/admin/companies?status=cualquier-cosa")).json()).echo.status).toBe("active");
  });
  it("ids: inválido = 400, inexistente = 404, existente = 200", async () => {
    expect((await call("/api/admin/users/no-es-un-id")).status).toBe(400);
    expect((await call("/api/admin/users/" + "b".repeat(24))).status).toBe(404);
    expect((await call("/api/admin/users/" + ID)).status).toBe(200);
    expect((await call("/api/admin/companies/" + ID)).status).toBe(200);
    expect((await call("/api/admin/companies/xyz")).status).toBe(400);
    expect((await call("/api/admin/pipelines/xyz/stages")).status).toBe(400);
  });
  it("es casi todo lectura: POST, PATCH, PUT y DELETE sobre cualquier otra ruta no existen (con admin y sin admin)", async () => {
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      expect((await call("/api/admin/users/" + ID, { method })).status).toBe(404);
      expect((await call("/api/admin/users", { method, token: null })).status).toBe(401);
    }
  });
  it("un error interno devuelve 500 sin detalles", async () => {
    queries.listSupportSessions.mockRejectedValueOnce(new Error("mongodb://usuario:CLAVE@host falló"));
    const r = await call("/api/admin/support-sessions");
    expect(r.status).toBe(500);
    const body = await r.text();
    expect(body).not.toContain("CLAVE");
    expect(JSON.parse(body)).toEqual({ error: "Error del servidor" });
  });
  it("precios estándar y auditoría", async () => {
    expect(await (await call("/api/admin/prices")).json()).toEqual(prices);
    const a = await (await call("/api/admin/audit?companyId=" + ID + "&limit=9999")).json();
    expect(a[0].echo).toEqual({ token: "admin", companyId: ID, limit: 200 }); // se lee con el token del propio admin
    expect((await call("/api/admin/audit?companyId=zzz")).status).toBe(400);
  });
  it("cambiar plan: solo POST con admin; pasa el admin, su token, el id del usuario y el cuerpo; devuelve el status del cobro", async () => {
    const body = { plan: "SpicyPro", stripePriceId: "price_1", idempotencyKey: "k-12345678" };
    const r = await call(`/api/admin/users/${ID}/subscription`, { method: "POST", body });
    expect(r.status).toBe(201);
    expect(billing.assignPlan).toHaveBeenCalledWith({ id: "u1", email: "nico@spicytool.test" }, "admin", ID, body);
    expect((await call(`/api/admin/users/${ID}/subscription`, { method: "GET" })).status).toBe(404);
    expect((await call(`/api/admin/users/${ID}/subscription`, { method: "POST", token: null, body })).status).toBe(401);
    expect((await call(`/api/admin/users/${ID}/subscription`, { method: "POST", token: "otro", body })).status).toBe(401);
    expect((await call("/api/admin/users/xyz/subscription", { method: "POST", body })).status).toBe(400);
  });
  it("un cuerpo que no es JSON válido da 400 y no llega al cobro", async () => {
    billing.assignPlan.mockClear();
    const r = await call(`/api/admin/users/${ID}/subscription`, { method: "POST", body: "{esto no es json" });
    expect(r.status).toBe(400);
    expect(billing.assignPlan).not.toHaveBeenCalled();
  });
  it("un error del cobro con status 402 se devuelve tal cual (code, mensaje y link)", async () => {
    billing.assignPlan.mockResolvedValueOnce({ status: 402, body: { code: "PAGO_RECHAZADO", message: "Your card was declined.", paymentMethodUpdateUrl: "https://billing.stripe.com/p/session/y" } });
    const r = await call(`/api/admin/users/${ID}/subscription`, { method: "POST", body: {} });
    expect(r.status).toBe(402);
    expect(await r.json()).toMatchObject({ code: "PAGO_RECHAZADO" });
  });
  it("link de tarjeta: POST con admin", async () => {
    const r = await call(`/api/admin/users/${ID}/payment-method-url`, { method: "POST", body: {} });
    expect(r.status).toBe(200);
    expect(billing.paymentMethodUrl).toHaveBeenCalledWith({ id: "u1", email: "nico@spicytool.test" }, "admin", ID);
  });
  it("pausar/activar: solo POST con admin; pasa admin, token, id y el estado pedido", async () => {
    const r = await call(`/api/admin/companies/${ID}/status`, { method: "POST", body: { status: "paused" } });
    expect(r.status).toBe(200);
    expect(companies.setStatus).toHaveBeenCalledWith({ id: "u1", email: "nico@spicytool.test" }, "admin", ID, "paused");
    expect((await call(`/api/admin/companies/${ID}/status`, { method: "POST", token: null, body: { status: "paused" } })).status).toBe(401);
    expect((await call(`/api/admin/companies/${ID}/status`, { method: "GET" })).status).toBe(404);
    expect((await call(`/api/admin/companies/${ID}/status`, { method: "PATCH", body: { status: "paused" } })).status).toBe(404);
    expect((await call("/api/admin/companies/xyz/status", { method: "POST", body: { status: "paused" } })).status).toBe(400);
  });
  it("pausar con un error del servicio devuelve ese status y código", async () => {
    companies.setStatus.mockResolvedValueOnce({ status: 409, body: { code: "YA_ESTA", message: "La company ya está pausada." } });
    const r = await call(`/api/admin/companies/${ID}/status`, { method: "POST", body: { status: "paused" } });
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ code: "YA_ESTA" });
  });
  it("las respuestas no se guardan en caché", async () => {
    expect((await call("/api/admin/health")).headers.get("cache-control")).toBe("no-store");
  });
});
