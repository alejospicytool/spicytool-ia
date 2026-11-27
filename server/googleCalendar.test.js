import { describe, it, expect, vi } from "vitest";
import { makeGoogle, GoogleError, SCOPES } from "./googleCalendar.js";

const cfg = { clientId: "cid", clientSecret: "csecret", redirectUri: "https://app.test/api/admin/calendar/callback" };
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const idToken = (email) => "x." + Buffer.from(JSON.stringify({ email })).toString("base64url") + ".y";

describe("makeGoogle", () => {
  it("sin credenciales no está configurado", () => {
    expect(makeGoogle({}).configured).toBe(false);
    expect(makeGoogle({ clientId: "a", clientSecret: "b" }).configured).toBe(false);
    expect(makeGoogle(cfg).configured).toBe(true);
  });

  it("authUrl pide permiso offline, solo eventos de calendario, con state y el mail como pista", () => {
    const u = new URL(makeGoogle(cfg).authUrl("ST", "nico@spicytool.net"));
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("client_id")).toBe("cid");
    expect(u.searchParams.get("redirect_uri")).toBe(cfg.redirectUri);
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("state")).toBe("ST");
    expect(u.searchParams.get("login_hint")).toBe("nico@spicytool.net");
    expect(u.searchParams.get("scope")).toBe(SCOPES.join(" "));
    expect(SCOPES).toContain("https://www.googleapis.com/auth/calendar.events");
    expect(SCOPES.some((s) => /auth\/calendar$/.test(s))).toBe(false); // nunca el permiso total del calendario
  });

  it("exchangeCode devuelve el token de larga duración y el mail de la cuenta", async () => {
    const f = vi.fn(async () => json(200, { refresh_token: "R", access_token: "A", scope: "openid email https://www.googleapis.com/auth/calendar.events", id_token: idToken("nico@spicytool.net") }));
    const r = await makeGoogle({ ...cfg, fetchImpl: f }).exchangeCode("CODE");
    expect(r).toMatchObject({ refreshToken: "R", accessToken: "A", googleEmail: "nico@spicytool.net" });
    const body = new URLSearchParams(f.mock.calls[0][1].body);
    expect(body.get("code")).toBe("CODE");
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_secret")).toBe("csecret");
  });

  it("invalid_grant se reconoce como permiso revocado", async () => {
    const g = makeGoogle({ ...cfg, fetchImpl: async () => json(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." }) });
    const e = await g.accessToken("R").catch((x) => x);
    expect(e).toBeInstanceOf(GoogleError);
    expect(e.revoked).toBe(true);
    const otro = makeGoogle({ ...cfg, fetchImpl: async () => json(500, { error: "backend_error" }) });
    expect((await otro.accessToken("R").catch((x) => x)).revoked).toBe(false);
  });

  it("crea, actualiza y borra eventos en el calendario principal con el token de acceso", async () => {
    const f = vi.fn(async (url, init) => (init.method === "DELETE" ? { ok: true, status: 204, json: async () => { throw new Error("sin cuerpo"); } } : json(200, { id: "evt1" })));
    const g = makeGoogle({ ...cfg, fetchImpl: f });
    expect(await g.insertEvent("AT", { summary: "x" })).toEqual({ id: "evt1" });
    await g.updateEvent("AT", "evt1", { summary: "y" });
    await g.deleteEvent("AT", "evt1");
    expect(f.mock.calls.map((c) => [c[1].method, c[0]])).toEqual([
      ["POST", "https://www.googleapis.com/calendar/v3/calendars/primary/events"],
      ["PUT", "https://www.googleapis.com/calendar/v3/calendars/primary/events/evt1"],
      ["DELETE", "https://www.googleapis.com/calendar/v3/calendars/primary/events/evt1"],
    ]);
    expect(f.mock.calls[0][1].headers.Authorization).toBe("Bearer AT");
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ summary: "x" });
  });

  it("borrar un evento que ya no existe no es un error; cualquier otro fallo sí", async () => {
    await expect(makeGoogle({ ...cfg, fetchImpl: async () => json(404, { error: { code: 404, status: "NOT_FOUND" } }) }).deleteEvent("AT", "x")).resolves.toBeUndefined();
    await expect(makeGoogle({ ...cfg, fetchImpl: async () => json(410, { error: { code: 410 } }) }).deleteEvent("AT", "x")).resolves.toBeUndefined();
    await expect(makeGoogle({ ...cfg, fetchImpl: async () => json(403, { error: { code: 403, status: "PERMISSION_DENIED", message: "no" } }) }).deleteEvent("AT", "x")).rejects.toMatchObject({ status: 403 });
  });

  it("un error de Calendar trae su estado HTTP (para distinguir 404 de lo demás)", async () => {
    const e = await makeGoogle({ ...cfg, fetchImpl: async () => json(404, { error: { code: 404, status: "NOT_FOUND", message: "Not Found" } }) }).updateEvent("AT", "e", {}).catch((x) => x);
    expect(e).toBeInstanceOf(GoogleError);
    expect(e.status).toBe(404);
  });
});
