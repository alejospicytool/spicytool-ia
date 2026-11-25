import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { configureAdminApi, probeAdminApi, adminMode, listUsers, listCompanies, getUser, getCredits, getMyPermissions, createSupportLink, assignPlan, setCompanyStatus, getKapsoSetupLink, WebhookError, SupportError } from "./adminApi.js";

// El servidor es lo que decide y valida; acá se comprueba que los pedidos se armen bien y que los errores se traduzcan.
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
let fetchMock;
beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); configureAdminApi(async () => "jwt-123"); });
afterEach(() => vi.unstubAllGlobals());
const lastCall = () => { const [url, init] = fetchMock.mock.calls.at(-1); return { url, init }; };

describe("conexión con el servidor", () => {
  it("probe: 'real' si responde bien y 'down' si no (nunca se inventan datos)", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true, mode: "real" }));
    expect(await probeAdminApi()).toBe("real");
    expect(adminMode()).toBe("real");
    fetchMock.mockResolvedValueOnce(json(200, { ok: true, mode: "otro" }));
    expect(await probeAdminApi()).toBe("down");
    fetchMock.mockRejectedValueOnce(new Error("sin red"));
    expect(await probeAdminApi()).toBe("down");
    configureAdminApi(async () => null);
    expect(await probeAdminApi()).toBe("down");
  });
  it("todo pedido va con el token de la sesión; sin sesión falla antes de pedir nada", async () => {
    fetchMock.mockResolvedValue(json(200, {}));
    await listUsers();
    expect(lastCall().init.headers.Authorization).toBe("Bearer jwt-123");
    fetchMock.mockClear();
    configureAdminApi(async () => null);
    await expect(listUsers()).rejects.toThrow("No hay sesión.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("armado de los pedidos", () => {
  it("las listas mandan los filtros y omiten los vacíos o apagados", async () => {
    fetchMock.mockResolvedValue(json(200, { items: [] }));
    await listUsers({ search: "ana", page: 2, pageSize: 8, owners: true, activeOnly: false, plan: "Freemium" });
    expect(lastCall().url).toBe("/api/admin/users?search=ana&page=2&pageSize=8&owners=true&plan=Freemium");
    await listCompanies({ status: "paused", plan: "" });
    expect(lastCall().url).toBe("/api/admin/companies?status=paused&page=1&pageSize=8");
  });
  it("las escrituras son POST con su cuerpo; la clave de idempotencia y el cupón viajan solo si hay", async () => {
    fetchMock.mockResolvedValue(json(200, {}));
    await setCompanyStatus("c1", "paused");
    expect(lastCall()).toMatchObject({ url: "/api/admin/companies/c1/status", init: { method: "POST", body: JSON.stringify({ status: "paused" }) } });
    await assignPlan("u1", { plan: "SpicyPro", stripePriceId: "price_1", idempotencyKey: "k1" });
    expect(JSON.parse(lastCall().init.body)).toEqual({ plan: "SpicyPro", stripePriceId: "price_1", idempotencyKey: "k1" });
    await assignPlan("u1", { plan: "SpicyPro", stripePriceId: "price_1", idempotencyKey: "k1", couponId: "cup" });
    expect(JSON.parse(lastCall().init.body).couponId).toBe("cup");
    await getKapsoSetupLink("a1");
    expect(lastCall()).toMatchObject({ url: "/api/admin/kapso-apps/a1/setup-link", init: { method: "POST" } });
  });
  it("los ids se codifican en la dirección", async () => {
    fetchMock.mockResolvedValue(json(200, {}));
    await setCompanyStatus("a/b", "active");
    expect(lastCall().url).toBe("/api/admin/companies/a%2Fb/status");
  });
});

describe("errores y permisos", () => {
  it("un error con código llega como WebhookError (status, code y datos extra)", async () => {
    fetchMock.mockResolvedValue(json(402, { code: "PAGO_RECHAZADO", message: "rechazada", decline_code: "insufficient_funds", paymentMethodUpdateUrl: "https://x" }));
    const e = await assignPlan("u1", { plan: "SpicyPro", stripePriceId: "price_1", idempotencyKey: "k" }).catch((x) => x);
    expect(e).toBeInstanceOf(WebhookError);
    expect(e).toMatchObject({ status: 402, code: "PAGO_RECHAZADO", extra: { decline_code: "insufficient_funds", paymentMethodUpdateUrl: "https://x" } });
  });
  it("un error común llega como Error con el mensaje y el status del servidor", async () => {
    fetchMock.mockResolvedValue(json(500, { error: "Error del servidor" }));
    await expect(listUsers()).rejects.toMatchObject({ message: "Error del servidor", status: 500 });
  });
  it("getUser devuelve null si no existe y propaga el resto de los errores", async () => {
    fetchMock.mockResolvedValueOnce(json(404, { error: "No encontrado" }));
    expect(await getUser("x")).toBeNull();
    fetchMock.mockResolvedValueOnce(json(500, { error: "boom" }));
    await expect(getUser("x")).rejects.toThrow("boom");
  });
  it("getMyPermissions refleja lo que dice el servidor", async () => {
    fetchMock.mockResolvedValue(json(200, { email: "a@b.co", level: "read", canAct: false, support: false }));
    expect(await getMyPermissions()).toMatchObject({ canAct: false, support: false, level: "read" });
    fetchMock.mockResolvedValue(json(200, { level: "actions", canAct: true, support: true }));
    expect(await getMyPermissions()).toMatchObject({ canAct: true, support: true });
  });
  it("los créditos todavía no están conectados: se avisa en vez de inventar un saldo", async () => {
    expect(await getCredits("c1")).toEqual({ balance: null, transactions: [], unavailable: true });
  });
});

describe("entrar como usuario", () => {
  it("sin motivo válido ni siquiera se llama al servidor", async () => {
    const e = await createSupportLink("u1", "x", { email: "a@b.co", password: "p" }).catch((x) => x);
    expect(e).toBeInstanceOf(SupportError);
    expect(e.code).toBe("MOTIVO_INVALIDO");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("manda el motivo y las credenciales de quien lo pide solo en ese pedido", async () => {
    fetchMock.mockResolvedValue(json(201, { url: "https://x", expiresAt: "2026-12-01T00:00:00Z" }));
    const r = await createSupportLink("u1", "ticket 4821: no ve sus contactos", { email: "a@b.co", password: "p" });
    expect(r.url).toBe("https://x");
    expect(JSON.parse(lastCall().init.body)).toEqual({ reason: "ticket 4821: no ve sus contactos", spicyEmail: "a@b.co", spicyPassword: "p" });
  });
});
