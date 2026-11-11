// Escrituras sobre una COMPANY en Mongo, como hacía Retool (updateOne con $set):
//  · setStatus: pausar/activar → $set { status }.
//  · edit: editar → $set de nombre, teléfono y/o créditos, SOLO de los campos que cambiaron.
// Nada más se toca. Reglas comunes:
//  1. Se valida el estado ("paused" | "active") y que la company exista.
//  2. Si ya está en ese estado exacto, no se escribe (409).
//  3. Tope de cambios por admin por minuto.
//  4. Primero se guarda la auditoría (quién, qué, de qué estado a cuál); si no se puede guardar, NO se cambia nada.
//  5. Si la escritura falla después, queda una segunda entrada "company_status_failed".
import { ObjectId } from "mongodb";
import { validateCompanyEdit, diffFields } from "../src/admin/adminLogic.js";

const ID_RE = /^[0-9a-f]{24}$/i;
const fail = (status, code, message) => ({ status, body: { code, message } });
const ACTION = { paused: "company_pause", active: "company_activate" };
const EDIT_KEYS = ["name", "phoneNumber", "credits"];
const MAX_NAME = 200, MAX_CREDITS = 1_000_000_000;

export function makeCompanyAdmin({ db, audit, invalidate = () => {}, now = () => Date.now(), maxPerMinute = 30, log = console.error }) {
  const attempts = new Map();
  const tooMany = (email) => {
    const t = now(), recent = (attempts.get(email) || []).filter((x) => t - x < 60_000);
    if (recent.length >= maxPerMinute) { attempts.set(email, recent); return true; }
    attempts.set(email, [...recent, t]);
    return false;
  };

  return {
    async setStatus(admin, token, companyId, status) {
      if (status !== "paused" && status !== "active") return fail(400, "ESTADO_INVALIDO", "El estado tiene que ser “paused” o “active”.");
      if (!ID_RE.test(String(companyId))) return fail(400, "ID_INVALIDO", "Id inválido.");
      const _id = new ObjectId(String(companyId));
      const col = db.collection("companies");

      const co = await col.findOne({ _id }, { projection: { name: 1, status: 1 } });
      if (!co) return fail(404, "COMPANY_NO_ENCONTRADA", "No se encontró la company.");
      const from = co.status == null ? null : String(co.status);
      if (from === status) return fail(409, "YA_ESTA", status === "paused" ? "La company ya está pausada." : "La company ya está activa.");
      if (tooMany(admin.email)) return fail(429, "DEMASIADOS_INTENTOS", "Demasiados cambios en un minuto. Esperá un momento.");

      const base = { actor: admin.email, targetType: "company", targetId: String(companyId), targetLabel: co.name || String(companyId), companyId: String(companyId) };
      try { await audit.record(token, { ...base, action: ACTION[status], detail: { from, to: status } }); }
      catch (e) { log("Auditoría no disponible:", e.message); return fail(503, "AUDITORIA_NO_DISPONIBLE", "No se pudo guardar el registro de auditoría, por eso no se cambió nada."); }

      let r;
      try { r = await col.updateOne({ _id }, { $set: { status } }); }
      catch (e) {
        log("Error al escribir el estado de la company:", e.message);
        try { await audit.record(token, { ...base, action: "company_status_failed", detail: { from, to: status } }); } catch (e2) { log("AUDITORÍA SIN GUARDAR (company_status_failed):", companyId, e2.message); }
        return fail(502, "ERROR_ESCRITURA", "No se pudo guardar el cambio en la base. No se modificó la company.");
      }
      if (!r || r.matchedCount !== 1) {
        try { await audit.record(token, { ...base, action: "company_status_failed", detail: { from, to: status } }); } catch (e2) { log("AUDITORÍA SIN GUARDAR (company_status_failed):", companyId, e2.message); }
        return fail(404, "COMPANY_NO_ENCONTRADA", "La company ya no existe.");
      }
      invalidate();
      return { status: 200, body: { _id: String(companyId), name: co.name || "", status, from } };
    },

    // Editar nombre, teléfono y créditos. Créditos vacío = no cambiarlos (la mayoría de las companies ni tiene ese campo).
    // Solo se escriben los campos que cambiaron, y solo si nadie los modificó mientras tanto.
    async edit(admin, token, companyId, input = {}) {
      if (!ID_RE.test(String(companyId))) return fail(400, "ID_INVALIDO", "Id inválido.");
      if (!input || typeof input !== "object" || Array.isArray(input)) return fail(400, "DATOS_INVALIDOS", "Datos inválidos.");
      const _id = new ObjectId(String(companyId));
      const col = db.collection("companies");

      const co = await col.findOne({ _id }, { projection: { name: 1, phoneNumber: 1, credits: 1 } });
      if (!co) return fail(404, "COMPANY_NO_ENCONTRADA", "No se encontró la company.");

      const v = validateCompanyEdit({ name: input.name ?? co.name, phoneNumber: input.phoneNumber ?? co.phoneNumber ?? "", credits: input.credits }, { currentPhone: co.phoneNumber });
      if (!v.ok) return fail(400, "DATOS_INVALIDOS", Object.values(v.errors)[0]);
      if (v.value.name.length > MAX_NAME) return fail(400, "DATOS_INVALIDOS", `El nombre no puede tener más de ${MAX_NAME} caracteres.`);
      if (v.value.credits !== null && v.value.credits > MAX_CREDITS) return fail(400, "DATOS_INVALIDOS", "Los créditos son demasiado grandes.");

      const after = { name: v.value.name, phoneNumber: v.value.phoneNumber, ...(v.value.credits !== null ? { credits: v.value.credits } : {}) };
      const changes = diffFields({ name: co.name, phoneNumber: co.phoneNumber, credits: co.credits }, after, EDIT_KEYS.filter((k) => k in after));
      const shown = { _id: String(companyId), name: co.name || "", phoneNumber: co.phoneNumber || "", credits: typeof co.credits === "number" ? co.credits : null };
      if (changes.length === 0) return { status: 200, body: { ...shown, changed: false, changes: [] } };
      if (tooMany(admin.email)) return fail(429, "DEMASIADOS_INTENTOS", "Demasiados cambios en un minuto. Esperá un momento.");

      const base = { actor: admin.email, targetType: "company", targetId: String(companyId), targetLabel: co.name || String(companyId), companyId: String(companyId) };
      try { await audit.record(token, { ...base, action: "company_edit", detail: { changes } }); }
      catch (e) { log("Auditoría no disponible:", e.message); return fail(503, "AUDITORIA_NO_DISPONIBLE", "No se pudo guardar el registro de auditoría, por eso no se cambió nada."); }
      const failedAudit = async () => { try { await audit.record(token, { ...base, action: "company_edit_failed", detail: { changes } }); } catch (e2) { log("AUDITORÍA SIN GUARDAR (company_edit_failed):", companyId, e2.message); } };

      // Solo los campos que cambiaron, y solo si siguen valiendo lo que leímos (null también cubre "no existe el campo").
      const $set = Object.fromEntries(changes.map((c) => [c.key, after[c.key]]));
      const filter = { _id, ...Object.fromEntries(changes.map((c) => [c.key, c.from ?? null])) };
      let res;
      try { res = await col.updateOne(filter, { $set }); }
      catch (e) { log("Error al escribir la company:", e.message); await failedAudit(); return fail(502, "ERROR_ESCRITURA", "No se pudo guardar el cambio en la base. No se modificó la company."); }
      if (!res || res.matchedCount !== 1) {
        await failedAudit();
        const still = await col.findOne({ _id }, { projection: { _id: 1 } });
        return still ? fail(409, "CAMBIO_CONCURRENTE", "Alguien modificó esta company mientras la editabas. Recargá y volvé a intentar.") : fail(404, "COMPANY_NO_ENCONTRADA", "La company ya no existe.");
      }
      invalidate();
      return { status: 200, body: { ...shown, ...after, changed: true, changes } };
    },
  };
}
