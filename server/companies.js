// Pausar / activar una company. ES UNA ESCRITURA EN MONGO, igual que hacía Retool: updateOne sobre esa company con $set { status }.
// Nada más se toca. Reglas:
//  1. Se valida el estado ("paused" | "active") y que la company exista.
//  2. Si ya está en ese estado exacto, no se escribe (409).
//  3. Tope de cambios por admin por minuto.
//  4. Primero se guarda la auditoría (quién, qué, de qué estado a cuál); si no se puede guardar, NO se cambia nada.
//  5. Si la escritura falla después, queda una segunda entrada "company_status_failed".
import { ObjectId } from "mongodb";

const ID_RE = /^[0-9a-f]{24}$/i;
const fail = (status, code, message) => ({ status, body: { code, message } });
const ACTION = { paused: "company_pause", active: "company_activate" };

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
  };
}
