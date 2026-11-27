import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { createApp } from "./app.js";
import { makeUserAuthenticator } from "./auth.js";

// Las rutas de Google Calendar las usa cualquier persona con sesión (no hace falta ser admin de Admin Spicy); la vuelta de Google no trae sesión.
const USER = { id: "u-ticiana", email: "ticiana@spicytool.test" };
const authenticateUser = vi.fn(async (h) => (h === "Bearer user" ? USER : null));
const authenticate = vi.fn(async () => null); // ninguno de estos es admin de Admin Spicy
const calendar = {
  status: vi.fn(async (id) => ({ configured: true, connected: true, googleEmail: "x@y.com", echoId: id })),
  startConnect: vi.fn((u) => ({ status: 200, body: { url: "https://accounts.google.com/x?u=" + u.id } })),
  finishConnect: vi.fn(async ({ state }) => (state === "bueno" ? { ok: true } : { error: "state_invalido" })),
  disconnect: vi.fn(async () => ({ ok: true })),
  reconcile: vi.fn(async () => ({ users: 2, created: 1 })),
};

let server, base;
beforeAll(async () => {
  const app = createApp({ queries: {}, authenticate, authenticateUser, calendar, appUrl: "https://app.test/", billing: {}, companies: {}, users: {}, audit: {}, log: () => {} });
  await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise((r) => server.close(r)));
const call = (path, { method = "GET", token = "user" } = {}) => fetch(base + path, { method, redirect: "manual", headers: token ? { Authorization: `Bearer ${token}` } : {} });

describe("rutas de Google Calendar", () => {
  it("sin sesión: 401 y no toca nada", async () => {
    calendar.status.mockClear();
    for (const [p, m] of [["/status", "GET"], ["/connect", "POST"], ["/disconnect", "POST"], ["/sync", "POST"]]) {
      expect((await call("/api/admin/calendar" + p, { method: m, token: null })).status).toBe(401);
      expect((await call("/api/admin/calendar" + p, { method: m, token: "otro" })).status).toBe(401);
    }
    expect(calendar.status).not.toHaveBeenCalled();
    expect(calendar.reconcile).not.toHaveBeenCalled();
  });

  it("una persona con sesión que NO es admin de Admin Spicy puede usarlas, y siempre sobre SU propia conexión", async () => {
    const r = await (await call("/api/admin/calendar/status")).json();
    expect(r).toMatchObject({ connected: true, echoId: "u-ticiana" });
    expect(authenticate).not.toHaveBeenCalled();
    expect((await (await call("/api/admin/calendar/connect", { method: "POST" })).json()).url).toContain("u=u-ticiana");
    await call("/api/admin/calendar/disconnect", { method: "POST" });
    expect(calendar.disconnect).toHaveBeenCalledWith("u-ticiana");
  });

  it("sync concilia y responde sin cachear", async () => {
    const r = await call("/api/admin/calendar/sync", { method: "POST" });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toMatchObject({ ok: true, users: 2 });
  });

  it("la vuelta de Google no pide sesión y redirige al backoffice con el resultado", async () => {
    const ok = await call("/api/admin/calendar/callback?code=C&state=bueno", { token: null });
    expect(ok.status).toBe(302);
    expect(ok.headers.get("location")).toBe("https://app.test/?calendar=ok");
    const mal = await call("/api/admin/calendar/callback?code=C&state=falso", { token: null });
    expect(mal.headers.get("location")).toBe("https://app.test/?calendar=state_invalido");
  });

  it("si el usuario cancela en Google, vuelve con 'denegado'", async () => {
    calendar.finishConnect.mockClear();
    const r = await call("/api/admin/calendar/callback?error=access_denied&state=bueno", { token: null });
    expect(r.headers.get("location")).toBe("https://app.test/?calendar=denegado");
    expect(calendar.finishConnect).not.toHaveBeenCalled(); // no hay nada que guardar
  });

  it("el resto de /api/admin sigue pidiendo admin: calendario no abre nada más", async () => {
    expect((await call("/api/admin/users")).status).toBe(401);
    expect((await call("/api/admin/health")).status).toBe(401);
  });
});

describe("makeUserAuthenticator", () => {
  const ok = (body) => ({ ok: true, json: async () => body });
  it("acepta cualquier token válido de Supabase y lo recuerda un minuto", async () => {
    let t = 0;
    const f = vi.fn(async () => ok({ id: "u1", email: "a@x.com" }));
    const auth = makeUserAuthenticator({ fetchImpl: f, now: () => t });
    expect(await auth("Bearer abc.def")).toEqual({ id: "u1", email: "a@x.com" });
    expect(await auth("Bearer abc.def")).toEqual({ id: "u1", email: "a@x.com" });
    expect(f).toHaveBeenCalledTimes(1);
    t = 61_000;
    await auth("Bearer abc.def");
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("rechaza sin token, con formato raro, token inválido o usuario sin mail", async () => {
    const f = vi.fn(async () => ({ ok: false }));
    const auth = makeUserAuthenticator({ fetchImpl: f });
    expect(await auth(undefined)).toBeNull();
    expect(await auth("abc")).toBeNull();
    expect(await auth("Bearer ")).toBeNull();
    expect(f).not.toHaveBeenCalled();
    expect(await auth("Bearer malo")).toBeNull();
    expect(await makeUserAuthenticator({ fetchImpl: async () => ok({ id: "u1" }) })("Bearer x")).toBeNull();
  });
});
