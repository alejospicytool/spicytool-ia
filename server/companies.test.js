import { describe, it, expect, vi } from "vitest";
import { ObjectId } from "mongodb";
import { makeCompanyAdmin } from "./companies.js";

// Base y auditoría FALSAS: estos tests nunca tocan Mongo ni Supabase.
const CID = "6650000000000000000000c1";
const ADMIN = { id: "u1", email: "nico@spicytool.test" };
const TOKEN = "jwt-admin";

const setup = ({ company = { _id: new ObjectId(CID), name: "Casa SRL", status: "active" }, updateOne, auditFails = null, maxPerMinute, now } = {}) => {
  const order = [];
  const col = {
    findOne: vi.fn(async () => company),
    updateOne: vi.fn(updateOne || (async () => { order.push("escritura"); return { matchedCount: 1, modifiedCount: 1 }; })),
  };
  const db = { collection: vi.fn(() => col) };
  const records = [];
  const audit = { record: vi.fn(async (token, e) => { order.push("auditoria:" + e.action); if (auditFails && auditFails(e)) throw new Error("audit down"); records.push({ token, ...e }); }) };
  const invalidate = vi.fn();
  const log = vi.fn();
  const svc = makeCompanyAdmin({ db, audit, invalidate, log, ...(maxPerMinute ? { maxPerMinute } : {}), ...(now ? { now } : {}) });
  return { svc, col, db, audit, records, invalidate, order, log };
};

describe("pausar / activar company", () => {
  it("pausar: guarda la auditoría ANTES, escribe solo { status } y refresca la copia en memoria", async () => {
    const { svc, col, order, records, invalidate } = setup();
    const r = await svc.setStatus(ADMIN, TOKEN, CID, "paused");
    expect(r).toEqual({ status: 200, body: { _id: CID, name: "Casa SRL", status: "paused", from: "active" } });
    expect(order).toEqual(["auditoria:company_pause", "escritura"]);
    expect(col.updateOne).toHaveBeenCalledTimes(1);
    const [filter, update] = col.updateOne.mock.calls[0];
    expect(String(filter._id)).toBe(CID);
    expect(Object.keys(filter)).toEqual(["_id"]);
    expect(update).toEqual({ $set: { status: "paused" } }); // nada más se toca
    expect(records[0]).toMatchObject({ token: TOKEN, actor: ADMIN.email, action: "company_pause", targetType: "company", targetId: CID, targetLabel: "Casa SRL", companyId: CID, detail: { from: "active", to: "paused" } });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
  it("activar una company pausada", async () => {
    const { svc, col, records } = setup({ company: { _id: new ObjectId(CID), name: "Casa SRL", status: "paused" } });
    const r = await svc.setStatus(ADMIN, TOKEN, CID, "active");
    expect(r.status).toBe(200);
    expect(col.updateOne.mock.calls[0][1]).toEqual({ $set: { status: "active" } });
    expect(records[0]).toMatchObject({ action: "company_activate", detail: { from: "paused", to: "active" } });
  });
  it("si ya está en ese estado exacto: 409, sin auditar ni escribir", async () => {
    for (const [from, to] of [["active", "active"], ["paused", "paused"]]) {
      const { svc, col, audit } = setup({ company: { _id: new ObjectId(CID), name: "X", status: from } });
      expect(await svc.setStatus(ADMIN, TOKEN, CID, to)).toMatchObject({ status: 409, body: { code: "YA_ESTA" } });
      expect(col.updateOne).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    }
  });
  it("estados raros de la base ('', 'undefined', faltante) se pueden normalizar a active o paused", async () => {
    for (const status of ["", "undefined", undefined]) {
      const { svc, col, records } = setup({ company: { _id: new ObjectId(CID), name: "X", status } });
      expect((await svc.setStatus(ADMIN, TOKEN, CID, "active")).status).toBe(200);
      expect(col.updateOne.mock.calls[0][1]).toEqual({ $set: { status: "active" } });
      expect(records[0].detail.from).toBe(status === undefined ? null : status);
    }
  });
  it("estado inválido o id inválido: 400 sin consultar la base", async () => {
    const { svc, db } = setup();
    for (const s of ["inactive", "", undefined, "PAUSED", { $ne: 1 }]) expect((await svc.setStatus(ADMIN, TOKEN, CID, s)).body.code).toBe("ESTADO_INVALIDO");
    for (const id of ["xyz", "", "6650000000000000000000c", "$ne"]) expect((await svc.setStatus(ADMIN, TOKEN, id, "paused")).body.code).toBe("ID_INVALIDO");
    expect(db.collection).not.toHaveBeenCalled();
  });
  it("company inexistente: 404 sin auditar ni escribir", async () => {
    const { svc, col, audit } = setup({ company: null });
    expect((await svc.setStatus(ADMIN, TOKEN, CID, "paused")).status).toBe(404);
    expect(col.updateOne).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
  it("SIN auditoría previa NO se cambia nada: 503 y no se escribe", async () => {
    const { svc, col } = setup({ auditFails: () => true });
    expect(await svc.setStatus(ADMIN, TOKEN, CID, "paused")).toMatchObject({ status: 503, body: { code: "AUDITORIA_NO_DISPONIBLE" } });
    expect(col.updateOne).not.toHaveBeenCalled();
  });
  it("si la escritura falla: 502, queda 'company_status_failed' y no se refresca nada", async () => {
    const { svc, records, invalidate } = setup({ updateOne: async () => { throw new Error("mongo caído"); } });
    const r = await svc.setStatus(ADMIN, TOKEN, CID, "paused");
    expect(r).toMatchObject({ status: 502, body: { code: "ERROR_ESCRITURA" } });
    expect(records.map((x) => x.action)).toEqual(["company_pause", "company_status_failed"]);
    expect(invalidate).not.toHaveBeenCalled();
    expect(JSON.stringify(r)).not.toContain("mongo caído");
  });
  it("si la company desapareció en el medio (matchedCount 0): 404 y queda 'company_status_failed'", async () => {
    const { svc, records } = setup({ updateOne: async () => ({ matchedCount: 0, modifiedCount: 0 }) });
    expect((await svc.setStatus(ADMIN, TOKEN, CID, "paused")).status).toBe(404);
    expect(records.map((x) => x.action)).toEqual(["company_pause", "company_status_failed"]);
  });
  it("tope por admin por minuto: el siguiente da 429; pasado el minuto vuelve a andar", async () => {
    let t = 5_000_000;
    const { svc, col } = setup({ maxPerMinute: 2, now: () => t, company: { _id: new ObjectId(CID), name: "X", status: "paused" } });
    expect((await svc.setStatus(ADMIN, TOKEN, CID, "active")).status).toBe(200);
    expect((await svc.setStatus(ADMIN, TOKEN, CID, "active")).status).toBe(200);
    expect(await svc.setStatus(ADMIN, TOKEN, CID, "active")).toMatchObject({ status: 429, body: { code: "DEMASIADOS_INTENTOS" } });
    expect(col.updateOne).toHaveBeenCalledTimes(2);
    t += 61_000;
    expect((await svc.setStatus(ADMIN, TOKEN, CID, "active")).status).toBe(200);
  });
  it("solo escribe en la colección companies", async () => {
    const { svc, db } = setup();
    await svc.setStatus(ADMIN, TOKEN, CID, "paused");
    expect([...new Set(db.collection.mock.calls.map((c) => c[0]))]).toEqual(["companies"]);
  });
});

describe("editar company (nombre, teléfono, créditos)", () => {
  const doc = { _id: new ObjectId(CID), name: "Casa SRL", phoneNumber: "+54 11 5555-0101", credits: 100 };
  const sup = (over = {}) => setup({ company: { ...doc, ...over } });

  it("guarda solo los campos que cambiaron, con auditoría antes y un filtro que exige que no hayan cambiado mientras tanto", async () => {
    const { svc, col, order, records, invalidate } = sup();
    const r = await svc.edit(ADMIN, TOKEN, CID, { name: "Casa SA", phoneNumber: "+54 11 5555-0101", credits: 250 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ _id: CID, name: "Casa SA", credits: 250, changed: true });
    expect(r.body.changes).toEqual([{ key: "name", from: "Casa SRL", to: "Casa SA" }, { key: "credits", from: 100, to: 250 }]);
    expect(order).toEqual(["auditoria:company_edit", "escritura"]);
    const [filter, update] = col.updateOne.mock.calls[0];
    expect(update).toEqual({ $set: { name: "Casa SA", credits: 250 } }); // el teléfono no cambió: no se escribe
    expect(filter).toMatchObject({ name: "Casa SRL", credits: 100 });
    expect(Object.keys(filter).sort()).toEqual(["_id", "credits", "name"]);
    expect(records[0]).toMatchObject({ action: "company_edit", actor: ADMIN.email, targetId: CID, detail: { changes: r.body.changes } });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
  it("créditos vacío no toca los créditos aunque la company no los tenga (no escribe un 0)", async () => {
    for (const credits of ["", null, undefined]) {
      const { svc, col } = setup({ company: { _id: new ObjectId(CID), name: "Casa SRL", phoneNumber: "+54 11 5555-0101" } }); // sin campo credits
      const r = await svc.edit(ADMIN, TOKEN, CID, { name: "Nuevo", phoneNumber: "+54 11 5555-0101", credits });
      expect(r.status).toBe(200);
      expect(col.updateOne.mock.calls[0][1]).toEqual({ $set: { name: "Nuevo" } });
    }
  });
  it("poner créditos en una company que no los tenía: el filtro usa null (cubre 'el campo no existe')", async () => {
    const { svc, col } = setup({ company: { _id: new ObjectId(CID), name: "Casa SRL", phoneNumber: "+54 11 5555-0101" } });
    await svc.edit(ADMIN, TOKEN, CID, { name: "Casa SRL", phoneNumber: "+54 11 5555-0101", credits: 50 });
    expect(col.updateOne.mock.calls[0][0]).toMatchObject({ credits: null });
    expect(col.updateOne.mock.calls[0][1]).toEqual({ $set: { credits: 50 } });
  });
  it("sin cambios: 200 con changed=false, sin auditar ni escribir", async () => {
    const { svc, col, audit } = sup();
    const r = await svc.edit(ADMIN, TOKEN, CID, { name: " Casa SRL ", phoneNumber: "+54 11 5555-0101", credits: "100" });
    expect(r).toMatchObject({ status: 200, body: { changed: false, changes: [] } });
    expect(col.updateOne).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
  it("solo se pueden tocar nombre, teléfono y créditos: cualquier otro campo del cuerpo se ignora", async () => {
    const { svc, col } = sup();
    await svc.edit(ADMIN, TOKEN, CID, { name: "Nuevo", phoneNumber: doc.phoneNumber, credits: 100, status: "paused", userEmail: "x@y.test", $set: { x: 1 }, _id: "otra" });
    expect(col.updateOne.mock.calls[0][1]).toEqual({ $set: { name: "Nuevo" } });
    expect(Object.keys(col.updateOne.mock.calls[0][0]).sort()).toEqual(["_id", "name"]);
    expect(String(col.updateOne.mock.calls[0][0]._id)).toBe(CID);
  });
  it("datos inválidos: nombre vacío o larguísimo, créditos negativos/texto/enormes, teléfono nuevo raro. No audita ni escribe", async () => {
    const { svc, col, audit } = sup();
    const bad = [{ name: "" }, { name: "x".repeat(201) }, { credits: -1 }, { credits: "abc" }, { credits: 2e9 }, { phoneNumber: "hola" }];
    for (const b of bad) expect((await svc.edit(ADMIN, TOKEN, CID, { name: "ok", phoneNumber: doc.phoneNumber, credits: 1, ...b })).body.code).toBe("DATOS_INVALIDOS");
    for (const body of [null, "texto", [1], 5]) expect((await svc.edit(ADMIN, TOKEN, CID, body)).body.code).toBe("DATOS_INVALIDOS");
    expect(col.updateOne).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
  it("un teléfono ya guardado con formato raro no impide editar el nombre", async () => {
    const { svc, col } = sup({ phoneNumber: "tel: 4444 ext.7" });
    const r = await svc.edit(ADMIN, TOKEN, CID, { name: "Nuevo", phoneNumber: "tel: 4444 ext.7", credits: 100 });
    expect(r.status).toBe(200);
    expect(col.updateOne.mock.calls[0][1]).toEqual({ $set: { name: "Nuevo" } });
  });
  it("id inválido o company inexistente", async () => {
    const a = sup();
    expect((await a.svc.edit(ADMIN, TOKEN, "xyz", { name: "x" })).body.code).toBe("ID_INVALIDO");
    expect(a.db.collection).not.toHaveBeenCalled();
    const b = setup({ company: null });
    expect((await b.svc.edit(ADMIN, TOKEN, CID, { name: "x" })).status).toBe(404);
    expect(b.audit.record).not.toHaveBeenCalled();
  });
  it("SIN auditoría previa no se cambia nada: 503 y no se escribe", async () => {
    const { svc, col } = setup({ company: doc, auditFails: () => true });
    expect(await svc.edit(ADMIN, TOKEN, CID, { name: "Nuevo", phoneNumber: doc.phoneNumber, credits: 100 })).toMatchObject({ status: 503, body: { code: "AUDITORIA_NO_DISPONIBLE" } });
    expect(col.updateOne).not.toHaveBeenCalled();
  });
  it("si alguien cambió la company en el medio (el filtro ya no coincide): 409, queda 'company_edit_failed' y no se pisa nada", async () => {
    const { svc, records, invalidate } = setup({ company: doc, updateOne: async () => ({ matchedCount: 0, modifiedCount: 0 }) });
    const r = await svc.edit(ADMIN, TOKEN, CID, { name: "Nuevo", phoneNumber: doc.phoneNumber, credits: 100 });
    expect(r).toMatchObject({ status: 409, body: { code: "CAMBIO_CONCURRENTE" } });
    expect(records.map((x) => x.action)).toEqual(["company_edit", "company_edit_failed"]);
    expect(invalidate).not.toHaveBeenCalled();
  });
  it("si la escritura falla: 502 sin detalles internos y queda 'company_edit_failed'", async () => {
    const { svc, records } = setup({ company: doc, updateOne: async () => { throw new Error("mongo caído"); } });
    const r = await svc.edit(ADMIN, TOKEN, CID, { name: "Nuevo", phoneNumber: doc.phoneNumber, credits: 100 });
    expect(r).toMatchObject({ status: 502, body: { code: "ERROR_ESCRITURA" } });
    expect(JSON.stringify(r)).not.toContain("mongo caído");
    expect(records.map((x) => x.action)).toEqual(["company_edit", "company_edit_failed"]);
  });
  it("comparte el tope de cambios por minuto con pausar/activar", async () => {
    let t = 9_000_000;
    const { svc } = setup({ company: doc, maxPerMinute: 1, now: () => t });
    expect((await svc.edit(ADMIN, TOKEN, CID, { name: "Uno", phoneNumber: doc.phoneNumber, credits: 100 })).status).toBe(200);
    expect((await svc.edit(ADMIN, TOKEN, CID, { name: "Dos", phoneNumber: doc.phoneNumber, credits: 100 })).status).toBe(429);
  });
  it("solo escribe en la colección companies", async () => {
    const { svc, db } = sup();
    await svc.edit(ADMIN, TOKEN, CID, { name: "Nuevo", phoneNumber: doc.phoneNumber, credits: 100 });
    expect([...new Set(db.collection.mock.calls.map((c) => c[0]))]).toEqual(["companies"]);
  });
});
