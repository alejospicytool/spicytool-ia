import { describe, it, expect, vi } from "vitest";
import { ObjectId } from "mongodb";
import { makeKapsoAdmin } from "./kapso.js";

// Base y auditoría FALSAS: estos tests nunca tocan Mongo ni Supabase.
const UID = "6650000000000000000000a1";
const C1 = "6650000000000000000000c1", C2 = "6650000000000000000000c2";
const A1 = "6650000000000000000000b1", A2 = "6650000000000000000000b2", A3 = "6650000000000000000000b3", A4 = "6650000000000000000000b4", A5 = "6650000000000000000000b5";
const ADMIN = { id: "u1", email: "tici@spicytool.test" };
const TOKEN = "jwt-admin";
const user = { _id: new ObjectId(UID), name: "Ana", surname: "Paz", email: "ana@ejemplo.test", companies: [C1], activeWhatsAppProvider: "kapso", kapso: { kapsoAppId: A1 } };
const APPS = {
  [A1]: { _id: new ObjectId(A1), alias: "Principal", displayPhoneNumber: "+5491100", status: "success", companyId: C1 },
  [A2]: { _id: new ObjectId(A2), alias: "Ventas", displayPhoneNumber: "+5491122", status: "success", companyId: C1 },
  [A3]: { _id: new ObjectId(A3), alias: "Pendiente", displayPhoneNumber: null, status: "pending_setup", companyId: C1 },
  [A4]: { _id: new ObjectId(A4), alias: "De otra company", displayPhoneNumber: "+5499999", status: "success", companyId: C2 },
};

const setup = ({ u = user, updateOne, auditFails = null, maxPerMinute, now } = {}) => {
  const order = [];
  const usersCol = { findOne: vi.fn(async () => u), updateOne: vi.fn(updateOne || (async () => { order.push("escritura"); return { matchedCount: 1, modifiedCount: 1 }; })) };
  const appsCol = { findOne: vi.fn(async (f) => APPS[String(f._id)] || null) };
  const db = { collection: vi.fn((n) => (n === "users" ? usersCol : appsCol)) };
  const records = [];
  const audit = { record: vi.fn(async (token, e) => { order.push("auditoria:" + e.action); if (auditFails && auditFails(e)) throw new Error("audit down"); records.push({ token, ...e }); }) };
  const invalidate = vi.fn();
  const svc = makeKapsoAdmin({ db, audit, invalidate, log: vi.fn(), ...(maxPerMinute ? { maxPerMinute } : {}), ...(now ? { now } : {}) });
  return { svc, usersCol, appsCol, audit, records, invalidate, order };
};

describe("cambiar la conexión de WhatsApp de un usuario", () => {
  it("camino feliz: auditoría ANTES, escribe SOLO users.kapso.kapsoAppId y solo si nadie lo cambió en el medio", async () => {
    const { svc, usersCol, order, records, invalidate } = setup();
    const r = await svc.setUserApp(ADMIN, TOKEN, UID, A2);
    expect(r).toEqual({ status: 200, body: { _id: UID, kapsoAppId: A2, previousKapsoAppId: A1, changed: true } });
    expect(order).toEqual(["auditoria:kapso_app_change", "escritura"]);
    const [filter, update] = usersCol.updateOne.mock.calls[0];
    expect(update).toEqual({ $set: { "kapso.kapsoAppId": A2 } });
    expect(filter).toEqual({ _id: new ObjectId(UID), "kapso.kapsoAppId": A1 });
    expect(records[0]).toMatchObject({ token: TOKEN, actor: ADMIN.email, targetType: "user", targetId: UID, targetLabel: "Ana Paz", companyId: C1, detail: { from: A1, to: A2, fromLabel: "Principal · +5491100", toLabel: "Ventas · +5491122" } });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
  it("el valor anterior queda en el registro (se puede volver atrás)", async () => {
    const { svc, records } = setup();
    await svc.setUserApp(ADMIN, TOKEN, UID, A2);
    expect(records[0].detail.from).toBe(A1);
  });
  it("elegir la que ya tiene no cambia nada ni audita", async () => {
    const { svc, usersCol, audit } = setup();
    const r = await svc.setUserApp(ADMIN, TOKEN, UID, A1);
    expect(r.body.changed).toBe(false);
    expect(usersCol.updateOne).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
  it("ids inválidos, usuario o conexión inexistentes", async () => {
    const s = setup();
    expect((await s.svc.setUserApp(ADMIN, TOKEN, "xyz", A2)).body.code).toBe("ID_INVALIDO");
    expect((await s.svc.setUserApp(ADMIN, TOKEN, UID, "no-es-id")).body.code).toBe("ID_INVALIDO");
    expect((await s.svc.setUserApp(ADMIN, TOKEN, UID, undefined)).body.code).toBe("ID_INVALIDO");
    expect((await s.svc.setUserApp(ADMIN, TOKEN, UID, "6650000000000000000000ff")).body.code).toBe("CONEXION_NO_ENCONTRADA");
    expect((await setup({ u: null }).svc.setUserApp(ADMIN, TOKEN, UID, A2)).body.code).toBe("USUARIO_NO_ENCONTRADO");
    expect(s.usersCol.updateOne).not.toHaveBeenCalled();
  });
  it("no deja elegir una conexión de OTRA company ni una que todavía no está conectada", async () => {
    const s = setup();
    expect((await s.svc.setUserApp(ADMIN, TOKEN, UID, A4)).body.code).toBe("CONEXION_AJENA");
    expect((await s.svc.setUserApp(ADMIN, TOKEN, UID, A3)).body.code).toBe("CONEXION_NO_CONECTADA");
    expect(s.audit.record).not.toHaveBeenCalled();
    expect(s.usersCol.updateOne).not.toHaveBeenCalled();
  });
  it("un colaborador puede elegir entre las conexiones de la company en la que colabora", async () => {
    const colab = { ...user, companies: [], companiesWhereICollaborate: [C2] };
    const { svc, records } = setup({ u: colab });
    expect((await svc.setUserApp(ADMIN, TOKEN, UID, A4)).status).toBe(200);
    expect(records[0].companyId).toBe(C2);
    expect((await setup({ u: colab }).svc.setUserApp(ADMIN, TOKEN, UID, A2)).body.code).toBe("CONEXION_AJENA");
  });
  it("usuarios de Gupshup o sin conexión asignada: se rechaza (no se inventa el campo)", async () => {
    expect((await setup({ u: { ...user, activeWhatsAppProvider: "gupshup" } }).svc.setUserApp(ADMIN, TOKEN, UID, A2)).body.code).toBe("PROVEEDOR_NO_KAPSO");
    expect((await setup({ u: { ...user, kapso: {} } }).svc.setUserApp(ADMIN, TOKEN, UID, A2)).body.code).toBe("SIN_CONEXION_ACTUAL");
    expect((await setup({ u: { ...user, kapso: undefined } }).svc.setUserApp(ADMIN, TOKEN, UID, A2)).body.code).toBe("SIN_CONEXION_ACTUAL");
  });
  it("SIN auditoría previa no se cambia nada: 503", async () => {
    const { svc, usersCol } = setup({ auditFails: () => true });
    expect((await svc.setUserApp(ADMIN, TOKEN, UID, A2)).body.code).toBe("AUDITORIA_NO_DISPONIBLE");
    expect(usersCol.updateOne).not.toHaveBeenCalled();
  });
  it("si alguien lo cambió en el medio (matchedCount 0): 409 y queda el registro de fallo", async () => {
    const { svc, order, invalidate } = setup({ updateOne: async () => ({ matchedCount: 0 }) });
    expect((await svc.setUserApp(ADMIN, TOKEN, UID, A2)).body.code).toBe("CAMBIO_CONCURRENTE");
    expect(order).toEqual(["auditoria:kapso_app_change", "auditoria:kapso_app_change_failed"]);
    expect(invalidate).not.toHaveBeenCalled();
  });
  it("si la escritura tira error: 502, sin detalles internos y con registro de fallo", async () => {
    const { svc, order } = setup({ updateOne: async () => { throw new Error("mongodb://usuario:clave@host fallo"); } });
    const r = await svc.setUserApp(ADMIN, TOKEN, UID, A2);
    expect(r).toMatchObject({ status: 502, body: { code: "ERROR_ESCRITURA" } });
    expect(JSON.stringify(r)).not.toContain("clave");
    expect(order).toEqual(["auditoria:kapso_app_change", "auditoria:kapso_app_change_failed"]);
  });
  it("tope de cambios por minuto por admin (y elegir la misma conexión no cuenta como cambio)", async () => {
    let t = 1_000_000;
    const { svc } = setup({ maxPerMinute: 1, now: () => t });
    expect((await svc.setUserApp(ADMIN, TOKEN, UID, A1)).body.changed).toBe(false); // misma conexión: no cuenta
    expect((await svc.setUserApp(ADMIN, TOKEN, UID, A2)).status).toBe(200);
    expect((await svc.setUserApp(ADMIN, TOKEN, UID, A2)).body.code).toBe("DEMASIADOS_INTENTOS");
    t += 61_000;
    expect((await svc.setUserApp(ADMIN, TOKEN, UID, A2)).status).toBe(200);
  });
});

describe("link de conexión de una conexión pendiente", () => {
  const URL_SECRETA = "https://kapso.test/setup/LINK_SECRETO_123";
  const NOW = Date.parse("2026-11-25T12:00:00Z");
  const withLink = (over = {}) => ({ [A3]: { ...APPS[A3], userId: UID, setupLinkUrl: URL_SECRETA, setupLinkExpiresAt: new Date("2026-11-30T12:00:00Z"), ...over } });
  const build = (apps, extra = {}) => {
    const order = [], records = [];
    const readDb = { collection: vi.fn(() => ({ findOne: vi.fn(async (f) => apps[String(f._id)] || null) })) };
    const audit = { record: vi.fn(async (token, e) => { order.push("auditoria"); if (extra.auditFails) throw new Error("audit down"); records.push({ token, ...e }); }) };
    // La base de ESCRITURA no se usa para leer: si se la usara, este test fallaría.
    const db = { collection: () => { throw new Error("no debe leer de la base de escritura"); } };
    const svc = makeKapsoAdmin({ db, readDb, audit, log: vi.fn(), now: () => NOW, ...(extra.maxPerMinute ? { maxPerMinute: extra.maxPerMinute } : {}) });
    return { svc, readDb, audit, records, order };
  };
  it("camino feliz: devuelve el link y deja registro ANTES (sin el link adentro)", async () => {
    const { svc, records } = build(withLink());
    const r = await svc.getSetupLink(ADMIN, TOKEN, A3);
    expect(r).toEqual({ status: 200, body: { url: URL_SECRETA, expiresAt: "2026-11-30T12:00:00.000Z", alias: "Pendiente", displayPhoneNumber: null } });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ token: TOKEN, actor: ADMIN.email, action: "kapso_setup_link_view", targetType: "kapsoapp", targetId: A3, companyId: C1 });
    expect(JSON.stringify(records)).not.toContain("LINK_SECRETO");
  });
  it("sin registro de auditoría no se muestra el link: 503 y el link no sale en la respuesta", async () => {
    const { svc } = build(withLink(), { auditFails: true });
    const r = await svc.getSetupLink(ADMIN, TOKEN, A3);
    expect(r.status).toBe(503);
    expect(r.body.code).toBe("AUDITORIA_NO_DISPONIBLE");
    expect(JSON.stringify(r)).not.toContain("LINK_SECRETO");
  });
  it("no ofrece el link si la conexión ya está conectada, venció, no existe o no es https", async () => {
    expect((await build({ [A1]: { ...APPS[A1], setupLinkUrl: URL_SECRETA } }).svc.getSetupLink(ADMIN, TOKEN, A1)).body.code).toBe("CONEXION_YA_CONECTADA");
    const venc = await build(withLink({ setupLinkExpiresAt: new Date("2026-11-20T12:00:00Z") })).svc.getSetupLink(ADMIN, TOKEN, A3);
    expect(venc).toMatchObject({ status: 410, body: { code: "LINK_VENCIDO" } });
    expect(JSON.stringify(venc)).not.toContain("LINK_SECRETO");
    expect((await build({}).svc.getSetupLink(ADMIN, TOKEN, A3)).body.code).toBe("CONEXION_NO_ENCONTRADA");
    expect((await build(withLink({ setupLinkUrl: "" })).svc.getSetupLink(ADMIN, TOKEN, A3)).body.code).toBe("SIN_LINK");
    expect((await build(withLink({ setupLinkUrl: "javascript:alert(1)" })).svc.getSetupLink(ADMIN, TOKEN, A3)).body.code).toBe("SIN_LINK");
    expect((await build(withLink({ setupLinkUrl: "http://inseguro.test/x" })).svc.getSetupLink(ADMIN, TOKEN, A3)).body.code).toBe("SIN_LINK");
    expect((await build(withLink()).svc.getSetupLink(ADMIN, TOKEN, "xyz")).body.code).toBe("ID_INVALIDO");
  });
  it("sin vencimiento guardado igual se muestra; y hay tope por minuto", async () => {
    const { svc } = build(withLink({ setupLinkExpiresAt: undefined }), { maxPerMinute: 1 });
    const r = await svc.getSetupLink(ADMIN, TOKEN, A3);
    expect(r.status).toBe(200);
    expect(r.body.expiresAt).toBeNull();
    expect((await svc.getSetupLink(ADMIN, TOKEN, A3)).body.code).toBe("DEMASIADOS_INTENTOS");
  });
  it("pide a Mongo solo los campos necesarios", async () => {
    const { svc, readDb } = build(withLink());
    await svc.getSetupLink(ADMIN, TOKEN, A3);
    expect(readDb.collection).toHaveBeenCalledWith("kapsoapps");
  });
});
