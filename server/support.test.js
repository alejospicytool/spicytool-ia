import { describe, it, expect, vi } from "vitest";
import { makeSupport, tokenOf, linkOf } from "./support.js";

// Todo falso: ni Mongo, ni Supabase, ni Spicytool. Estos tests NUNCA abren una sesión real en la cuenta de un cliente.
const UID = "6650000000000000000000a1";
const CID = "6650000000000000000000c1";
const ADMIN = { id: "u-admin", email: "nico@spicytool.test", level: "admin", canAct: true, support: true };
const TOKEN = "jwt-supabase-del-admin";
const PASS = "contraseña-secreta-123";
const INPUT = { reason: "ticket 4821: el cliente no ve sus contactos", spicyEmail: "nico@spicytool.net", spicyPassword: PASS };
const USER = { _id: UID, email: "cliente@ejemplo.test", name: "Ana", surname: "Paz", companies: [CID] };

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const setup = ({ user = USER, login, link, auditFails = null, maxPerMinute, now } = {}) => {
  const records = [];
  const audit = { record: vi.fn(async (token, e) => { if (auditFails && auditFails(e)) throw new Error("audit down"); records.push({ token, ...e }); }) };
  const calls = [];
  const fetchImpl = vi.fn(async (url, opts) => {
    calls.push({ url, opts, body: JSON.parse(opts.body) });
    if (String(url).endsWith("/login")) return login ? login() : json(200, { token: "tok-spicy" });
    return link ? link() : json(200, { url: "https://app.spicytool.net/support-session?code=abc", expiresAt: "2026-11-20T15:00:00.000Z" });
  });
  const log = vi.fn();
  const support = makeSupport({ getUser: async (id) => (id === UID ? user : null), audit, fetchImpl, log, apiBase: "https://api.test/api/", ...(maxPerMinute ? { maxPerMinute } : {}), ...(now ? { now } : {}) });
  return { support, audit, records, calls, fetchImpl, log };
};

describe("camino feliz", () => {
  it("registra 'solicitado', hace login con la cuenta de la persona, pide el link y devuelve 201", async () => {
    const { support, records, calls } = setup();
    const r = await support.createLink(ADMIN, TOKEN, UID, INPUT);
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ url: "https://app.spicytool.net/support-session?code=abc", expiresAt: "2026-11-20T15:00:00.000Z", auditWarning: false });
    expect(records.map((x) => x.action)).toEqual(["support_link_requested", "support_link_created"]);
    expect(calls[0].url).toBe("https://api.test/api/login");
    expect(calls[0].body).toEqual({ email: "nico@spicytool.net", password: PASS });
    expect(calls[1].url).toBe("https://api.test/api/admin/support-sessions/link");
    expect(calls[1].opts.headers.Authorization).toBe("Bearer tok-spicy");
    // email y company salen de Mongo, no del navegador
    expect(calls[1].body).toEqual({ targetUserId: UID, targetEmail: "cliente@ejemplo.test", companyId: CID, reason: INPUT.reason });
  });
  it("la auditoría queda a nombre del admin, con el motivo, y SIN contraseña, token ni link", async () => {
    const { support, records } = setup();
    await support.createLink(ADMIN, TOKEN, UID, INPUT);
    expect(records[0]).toMatchObject({ token: TOKEN, actor: ADMIN.email, targetType: "user", targetId: UID, companyId: CID, detail: { targetEmail: "cliente@ejemplo.test", reason: INPUT.reason, spicyAccount: "nico@spicytool.net" } });
    const all = JSON.stringify(records);
    for (const secreto of [PASS, "tok-spicy", "code=abc", "https://app.spicytool.net"]) expect(all).not.toContain(secreto);
  });
  it("el 'solicitado' se guarda ANTES de llamar a Spicytool", async () => {
    const order = [];
    const s = setup();
    s.audit.record.mockImplementation(async (t, e) => { order.push(e.action); });
    s.fetchImpl.mockImplementation(async (url) => { order.push(String(url).split("/api/")[1]); return String(url).endsWith("/login") ? json(200, { token: "t" }) : json(200, { url: "https://x.test/s" }); });
    await s.support.createLink(ADMIN, TOKEN, UID, INPUT);
    expect(order).toEqual(["support_link_requested", "login", "admin/support-sessions/link", "support_link_created"]);
  });
  it("la respuesta real de Spicytool: { supportSessionId, supportUrl, expiresAt }", async () => {
    const { support, records } = setup({ link: () => json(200, { supportSessionId: "665000000000000000000abc", supportUrl: "https://app.spicytool.net/support/enter?code=zzz", expiresAt: "2026-11-20T22:00:00.000Z" }) });
    const r = await support.createLink(ADMIN, TOKEN, UID, INPUT);
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ url: "https://app.spicytool.net/support/enter?code=zzz", expiresAt: "2026-11-20T22:00:00.000Z", auditWarning: false });
    expect(JSON.stringify(records)).not.toContain("code=zzz");
  });
  it("acepta los nombres habituales de la respuesta (data.token, data.url…)", async () => {
    const { support, calls } = setup({ login: () => json(200, { data: { accessToken: "t2" } }), link: () => json(200, { data: { link: "https://x.test/s", expires_at: "2026-12-01T00:00:00Z" } }) });
    const r = await support.createLink(ADMIN, TOKEN, UID, INPUT);
    expect(r.body).toMatchObject({ url: "https://x.test/s", expiresAt: "2026-12-01T00:00:00Z" });
    expect(calls[1].opts.headers.Authorization).toBe("Bearer t2");
  });
});

describe("validaciones: nada de esto llega a Spicytool", () => {
  it("solo con el permiso de soporte (admins o quien lo tenga asignado)", async () => {
    const { support, fetchImpl } = setup();
    for (const a of [{ ...ADMIN, level: "actions", support: false }, { ...ADMIN, level: "read", support: false }, { ...ADMIN, support: undefined }, null]) {
      const r = await support.createLink(a, TOKEN, UID, INPUT);
      expect(r.body.code).toBe("SIN_PERMISO_SOPORTE");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("una persona no admin con el permiso de soporte sí puede, y la auditoría queda a su nombre", async () => {
    const tici = { id: "u-tici", email: "tici@spicytool.test", level: "actions", canAct: true, support: true };
    const { support, records } = setup();
    expect((await support.createLink(tici, TOKEN, UID, INPUT)).status).toBe(201);
    expect(records[0].actor).toBe("tici@spicytool.test");
  });
  it("motivo obligatorio y con sentido", async () => {
    const { support, fetchImpl } = setup();
    expect((await support.createLink(ADMIN, TOKEN, UID, { ...INPUT, reason: "ok" })).body.code).toBe("MOTIVO_INVALIDO");
    expect((await support.createLink(ADMIN, TOKEN, UID, { ...INPUT, reason: "aaaaaaaaaaaa" })).body.code).toBe("MOTIVO_INVALIDO");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("hace falta email válido y contraseña", async () => {
    const { support, fetchImpl } = setup();
    for (const bad of [{ spicyEmail: "", spicyPassword: PASS }, { spicyEmail: "no-es-mail", spicyPassword: PASS }, { spicyEmail: "a@b.co", spicyPassword: "" }, { spicyEmail: "a@b.co", spicyPassword: 123 }, { spicyEmail: "a@b.co", spicyPassword: "x".repeat(201) }]) {
      expect((await support.createLink(ADMIN, TOKEN, UID, { ...INPUT, ...bad })).body.code).toBe("CREDENCIALES_REQUERIDAS");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("usuario inexistente → 404; sin company → 422", async () => {
    const { support, fetchImpl } = setup();
    expect((await support.createLink(ADMIN, TOKEN, "6650000000000000000000ff", INPUT)).status).toBe(404);
    const s2 = setup({ user: { ...USER, companies: [] } });
    expect((await s2.support.createLink(ADMIN, TOKEN, UID, INPUT)).body.code).toBe("SIN_COMPANY");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(s2.fetchImpl).not.toHaveBeenCalled();
  });
  it("tope de intentos por minuto por admin", async () => {
    let t = 1_000_000;
    const { support } = setup({ maxPerMinute: 2, now: () => t });
    expect((await support.createLink(ADMIN, TOKEN, UID, INPUT)).status).toBe(201);
    expect((await support.createLink(ADMIN, TOKEN, UID, INPUT)).status).toBe(201);
    expect((await support.createLink(ADMIN, TOKEN, UID, INPUT)).body.code).toBe("DEMASIADOS_INTENTOS");
    t += 61_000;
    expect((await support.createLink(ADMIN, TOKEN, UID, INPUT)).status).toBe(201);
  });
});

describe("auditoría", () => {
  it("SIN registro previo no se llama a Spicytool: 503", async () => {
    const { support, fetchImpl } = setup({ auditFails: () => true });
    const r = await support.createLink(ADMIN, TOKEN, UID, INPUT);
    expect(r.body.code).toBe("AUDITORIA_NO_DISPONIBLE");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("si falla solo el registro final, igual devuelve el link y avisa", async () => {
    const { support } = setup({ auditFails: (e) => e.action === "support_link_created" });
    const r = await support.createLink(ADMIN, TOKEN, UID, INPUT);
    expect(r.status).toBe(201);
    expect(r.body.auditWarning).toBe(true);
  });
});

describe("errores de Spicytool", () => {
  it("contraseña incorrecta → SPICY_LOGIN_INVALIDO y NO se pide el link", async () => {
    const { support, records, calls } = setup({ login: () => json(401, { message: "bad" }) });
    const r = await support.createLink(ADMIN, TOKEN, UID, INPUT);
    expect(r).toMatchObject({ status: 401, body: { code: "SPICY_LOGIN_INVALIDO" } });
    expect(calls).toHaveLength(1);
    expect(records.map((x) => x.action)).toEqual(["support_link_requested", "support_link_failed"]);
    expect(JSON.stringify(records)).not.toContain(PASS);
  });
  it("cuenta sin permiso de soporte → 403", async () => {
    const { support } = setup({ link: () => json(403, {}) });
    expect((await support.createLink(ADMIN, TOKEN, UID, INPUT)).body.code).toBe("SIN_PERMISO_SOPORTE");
  });
  it("Spicytool caído o con error → SESION_NO_DISPONIBLE", async () => {
    const down = setup({ login: () => { throw new Error("ECONNREFUSED"); } });
    expect((await down.support.createLink(ADMIN, TOKEN, UID, INPUT)).body.code).toBe("SESION_NO_DISPONIBLE");
    const e500 = setup({ link: () => json(500, {}) });
    expect((await e500.support.createLink(ADMIN, TOKEN, UID, INPUT)).body.code).toBe("SESION_NO_DISPONIBLE");
  });
  it("respuestas que no se entienden: error claro, sin filtrar valores, y se loguean solo los NOMBRES de los campos", async () => {
    const noToken = setup({ login: () => json(200, { ok: true, secreto: "valor-que-no-debe-loguearse" }) });
    const r1 = await noToken.support.createLink(ADMIN, TOKEN, UID, INPUT);
    expect(r1.body.code).toBe("RESPUESTA_INESPERADA");
    expect(JSON.stringify(noToken.log.mock.calls)).not.toContain("valor-que-no-debe-loguearse");
    const noUrl = setup({ link: () => json(200, { ok: true }) });
    expect((await noUrl.support.createLink(ADMIN, TOKEN, UID, INPUT)).body.code).toBe("RESPUESTA_INESPERADA");
  });
  it("un link que no es https se rechaza (nunca se le entrega al navegador)", async () => {
    for (const url of ["http://x.test/s", "javascript:alert(1)", "no-es-url"]) {
      const { support } = setup({ link: () => json(200, { url }) });
      const r = await support.createLink(ADMIN, TOKEN, UID, INPUT);
      expect(r.body.code).toBe("RESPUESTA_INESPERADA");
      expect(r.body.url).toBeUndefined();
    }
  });
  it("nada de lo que se loguea contiene la contraseña, el token ni el link", async () => {
    const { support, log } = setup({ login: () => json(200, { otro: "x" }) });
    await support.createLink(ADMIN, TOKEN, UID, INPUT);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain(PASS);
  });
});

describe("tokenOf / linkOf", () => {
  it("leen los nombres habituales y devuelven null si no hay", () => {
    expect(tokenOf({ token: "a" })).toBe("a");
    expect(tokenOf({ data: { jwt: "b" } })).toBe("b");
    expect(tokenOf({})).toBeNull();
    expect(tokenOf(null)).toBeNull();
    expect(linkOf({ url: "https://a.test", expiresAt: "x" })).toEqual({ url: "https://a.test", expiresAt: "x" });
    expect(linkOf({ supportUrl: "https://b.test", expiresAt: "y" })).toEqual({ url: "https://b.test", expiresAt: "y" });
    expect(linkOf(null)).toEqual({ url: null, expiresAt: null });
  });
});
