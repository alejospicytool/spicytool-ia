import { describe, it, expect, vi } from "vitest";
import { ObjectId } from "mongodb";
import { makeUserAdmin } from "./users.js";

// Base y auditoría FALSAS: estos tests nunca tocan Mongo ni Supabase.
const UID = "6650000000000000000000a1";
const ADMIN = { id: "u1", email: "nico@spicytool.test" };
const TOKEN = "jwt-admin";
const doc = { _id: new ObjectId(UID), name: "Ana", surname: "Paz", phoneNumber: "+54 11 5555-0101", email: "ana@ejemplo.test", companies: ["6650000000000000000000c1"] };

const setup = ({ user = doc, updateOne, auditFails = null, maxPerMinute, now } = {}) => {
  const order = [];
  const col = {
    findOne: vi.fn(async () => user),
    updateOne: vi.fn(updateOne || (async () => { order.push("escritura"); return { matchedCount: 1, modifiedCount: 1 }; })),
  };
  const db = { collection: vi.fn(() => col) };
  const records = [];
  const audit = { record: vi.fn(async (token, e) => { order.push("auditoria:" + e.action); if (auditFails && auditFails(e)) throw new Error("audit down"); records.push({ token, ...e }); }) };
  const invalidate = vi.fn();
  const svc = makeUserAdmin({ db, audit, invalidate, log: vi.fn(), ...(maxPerMinute ? { maxPerMinute } : {}), ...(now ? { now } : {}) });
  return { svc, col, db, audit, records, invalidate, order };
};

describe("editar ficha de contacto de un usuario", () => {
  it("guarda solo lo que cambió, con auditoría ANTES y un filtro que exige que no haya cambiado mientras tanto", async () => {
    const { svc, col, order, records, invalidate } = setup();
    const r = await svc.editContact(ADMIN, TOKEN, UID, { name: "Ana María", surname: "Paz", phoneNumber: "+54 11 4444-0000" });
    expect(r.status).toBe(200);
    expect(r.body.changes).toEqual([{ key: "name", from: "Ana", to: "Ana María" }, { key: "phoneNumber", from: "+54 11 5555-0101", to: "+54 11 4444-0000" }]);
    expect(order).toEqual(["auditoria:contact_edit", "escritura"]);
    const [filter, update] = col.updateOne.mock.calls[0];
    expect(update).toEqual({ $set: { name: "Ana María", phoneNumber: "+54 11 4444-0000" } });
    expect(Object.keys(filter).sort()).toEqual(["_id", "name", "phoneNumber"]);
    expect(filter).toMatchObject({ name: "Ana", phoneNumber: "+54 11 5555-0101" });
    expect(records[0]).toMatchObject({ token: TOKEN, actor: ADMIN.email, action: "contact_edit", targetType: "user", targetId: UID, targetLabel: "Ana Paz", companyId: "6650000000000000000000c1" });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
  it("el EMAIL no se cambia nunca: uno distinto se rechaza (EMAIL_NO_EDITABLE) sin auditar ni escribir; el mismo (aunque con otras mayúsculas) se ignora", async () => {
    const a = setup();
    for (const email of ["otro@ejemplo.test", "ANA@ejemplo.test.ar", " "]) {
      const r = await a.svc.editContact(ADMIN, TOKEN, UID, { name: "Ana", surname: "Paz", phoneNumber: doc.phoneNumber, email });
      expect(r.body.code).toBe("EMAIL_NO_EDITABLE");
    }
    expect(a.col.updateOne).not.toHaveBeenCalled();
    expect(a.audit.record).not.toHaveBeenCalled();
    const b = setup();
    const r = await b.svc.editContact(ADMIN, TOKEN, UID, { name: "Nuevo", surname: "Paz", phoneNumber: doc.phoneNumber, email: " ANA@ejemplo.test " });
    expect(r.status).toBe(200);
    expect(b.col.updateOne.mock.calls[0][1]).toEqual({ $set: { name: "Nuevo" } });
    expect(JSON.stringify(b.col.updateOne.mock.calls[0])).not.toContain("email");
  });
  it("jamás escribe subscription, stripe, companies ni ningún otro campo, aunque vengan en el cuerpo", async () => {
    const { svc, col } = setup();
    await svc.editContact(ADMIN, TOKEN, UID, { name: "Nuevo", surname: "Paz", phoneNumber: doc.phoneNumber, subscription: { subscriptionType: "SpicyProMax" }, "subscription.tier": "tier7", companies: ["x"], role: "admin", passwordHash: "x", $set: { y: 1 }, _id: "otro" });
    expect(col.updateOne.mock.calls[0][1]).toEqual({ $set: { name: "Nuevo" } });
    expect(Object.keys(col.updateOne.mock.calls[0][0]).sort()).toEqual(["_id", "name"]);
    expect(String(col.updateOne.mock.calls[0][0]._id)).toBe(UID);
  });
  it("sin cambios: 200 con changed=false, sin auditar ni escribir", async () => {
    const { svc, col, audit } = setup();
    const r = await svc.editContact(ADMIN, TOKEN, UID, { name: " Ana ", surname: "Paz", phoneNumber: "+54 11 5555-0101" });
    expect(r).toMatchObject({ status: 200, body: { changed: false, changes: [] } });
    expect(col.updateOne).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
  it("apellido o teléfono que no existían en el usuario: el filtro usa null (cubre 'el campo no existe')", async () => {
    const { svc, col } = setup({ user: { _id: new ObjectId(UID), name: "Ana", email: "ana@ejemplo.test" } });
    await svc.editContact(ADMIN, TOKEN, UID, { name: "Ana", surname: "Paz", phoneNumber: "+54 11 4444-0000" });
    expect(col.updateOne.mock.calls[0][0]).toMatchObject({ surname: null, phoneNumber: null });
  });
  it("datos inválidos: nombre vacío, textos larguísimos, teléfono nuevo raro, cuerpo que no es un objeto. No audita ni escribe", async () => {
    const { svc, col, audit } = setup();
    const bad = [{ name: "" }, { name: "x".repeat(101) }, { surname: "y".repeat(101) }, { phoneNumber: "hola" }, { phoneNumber: "1".repeat(31) }];
    for (const b of bad) expect((await svc.editContact(ADMIN, TOKEN, UID, { name: "ok", surname: "ok", phoneNumber: doc.phoneNumber, ...b })).body.code).toBe("DATOS_INVALIDOS");
    for (const body of [null, "texto", [1], 5]) expect((await svc.editContact(ADMIN, TOKEN, UID, body)).body.code).toBe("DATOS_INVALIDOS");
    expect(col.updateOne).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
  it("un teléfono ya guardado con formato raro no impide editar el nombre", async () => {
    const { svc, col } = setup({ user: { ...doc, phoneNumber: "int. 44 / 7" } });
    expect((await svc.editContact(ADMIN, TOKEN, UID, { name: "Nuevo", surname: "Paz", phoneNumber: "int. 44 / 7" })).status).toBe(200);
    expect(col.updateOne.mock.calls[0][1]).toEqual({ $set: { name: "Nuevo" } });
  });
  it("id inválido o usuario inexistente", async () => {
    const a = setup();
    expect((await a.svc.editContact(ADMIN, TOKEN, "xyz", { name: "x" })).body.code).toBe("ID_INVALIDO");
    expect(a.db.collection).not.toHaveBeenCalled();
    const b = setup({ user: null });
    expect((await b.svc.editContact(ADMIN, TOKEN, UID, { name: "x" })).status).toBe(404);
    expect(b.audit.record).not.toHaveBeenCalled();
  });
  it("SIN auditoría previa no se cambia nada: 503 y no se escribe", async () => {
    const { svc, col } = setup({ auditFails: () => true });
    expect(await svc.editContact(ADMIN, TOKEN, UID, { name: "Nuevo", surname: "Paz", phoneNumber: doc.phoneNumber })).toMatchObject({ status: 503, body: { code: "AUDITORIA_NO_DISPONIBLE" } });
    expect(col.updateOne).not.toHaveBeenCalled();
  });
  it("si alguien lo cambió en el medio: 409 y queda 'contact_edit_failed'; si la escritura falla: 502 sin detalles internos", async () => {
    const a = setup({ updateOne: async () => ({ matchedCount: 0, modifiedCount: 0 }) });
    expect(await a.svc.editContact(ADMIN, TOKEN, UID, { name: "Nuevo", surname: "Paz", phoneNumber: doc.phoneNumber })).toMatchObject({ status: 409, body: { code: "CAMBIO_CONCURRENTE" } });
    expect(a.records.map((x) => x.action)).toEqual(["contact_edit", "contact_edit_failed"]);
    expect(a.invalidate).not.toHaveBeenCalled();
    const b = setup({ updateOne: async () => { throw new Error("mongo caído"); } });
    const r = await b.svc.editContact(ADMIN, TOKEN, UID, { name: "Nuevo", surname: "Paz", phoneNumber: doc.phoneNumber });
    expect(r).toMatchObject({ status: 502, body: { code: "ERROR_ESCRITURA" } });
    expect(JSON.stringify(r)).not.toContain("mongo caído");
    expect(b.records.map((x) => x.action)).toEqual(["contact_edit", "contact_edit_failed"]);
  });
  it("tope por minuto y solo escribe en la colección users", async () => {
    let t = 7_000_000;
    const { svc, db } = setup({ maxPerMinute: 1, now: () => t });
    expect((await svc.editContact(ADMIN, TOKEN, UID, { name: "Uno", surname: "Paz", phoneNumber: doc.phoneNumber })).status).toBe(200);
    expect((await svc.editContact(ADMIN, TOKEN, UID, { name: "Dos", surname: "Paz", phoneNumber: doc.phoneNumber })).status).toBe(429);
    expect([...new Set(db.collection.mock.calls.map((c) => c[0]))]).toEqual(["users"]);
  });
});
