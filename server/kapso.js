// Cambiar QUÉ conexión de WhatsApp (Kapso) usa un usuario. En Mongo es un solo campo: users.kapso.kapsoAppId = _id de una conexión de la colección
// kapsoapps (comprobado con la base real: las 251 coincidencias son con kapsoapps._id, y en companies con varias conexiones cada usuario puede
// apuntar a una distinta). NO se toca isDefault (la "principal" de la company) ni nada más.
// Reglas, pensadas para no dejar a un cliente sin WhatsApp:
//  · La conexión tiene que existir, estar CONECTADA (status "success") y ser de una company a la que el usuario pertenece (como dueño o colaborador).
//  · Solo usuarios del proveedor Kapso que ya tienen una conexión asignada (no se inventa el campo desde cero).
//  · Se escribe solo si nadie lo cambió en el medio, con auditoría ANTES (sin registro no se cambia nada), tope por minuto, y el valor anterior queda
//    en el registro para poder volver atrás. Si la escritura falla queda un segundo registro "kapso_app_change_failed".
import { ObjectId } from "mongodb";
import { userFullName, companyIdOf } from "../src/admin/adminLogic.js";
import { idsOf } from "./shape.js";

const ID_RE = /^[0-9a-f]{24}$/i;
const fail = (status, code, message) => ({ status, body: { code, message } });
const label = (a) => (a ? [a.alias, a.displayPhoneNumber].filter(Boolean).join(" · ") || String(a._id) : null);

export function makeKapsoAdmin({ db, audit, invalidate = () => {}, now = () => Date.now(), maxPerMinute = 30, log = console.error }) {
  const attempts = new Map();
  const tooMany = (email) => {
    const t = now(), recent = (attempts.get(email) || []).filter((x) => t - x < 60_000);
    if (recent.length >= maxPerMinute) { attempts.set(email, recent); return true; }
    attempts.set(email, [...recent, t]);
    return false;
  };

  return {
    async setUserApp(admin, token, userId, appId) {
      if (!ID_RE.test(String(userId)) || !ID_RE.test(String(appId ?? ""))) return fail(400, "ID_INVALIDO", "Id inválido.");
      const users = db.collection("users"), apps = db.collection("kapsoapps");
      const _id = new ObjectId(String(userId));

      const u = await users.findOne({ _id }, { projection: { name: 1, surname: 1, email: 1, companies: 1, companiesWhereICollaborate: 1, activeWhatsAppProvider: 1, "kapso.kapsoAppId": 1 } });
      if (!u) return fail(404, "USUARIO_NO_ENCONTRADO", "No se encontró el usuario.");
      const app = await apps.findOne({ _id: new ObjectId(String(appId)) }, { projection: { alias: 1, displayPhoneNumber: 1, status: 1, companyId: 1 } });
      if (!app) return fail(404, "CONEXION_NO_ENCONTRADA", "No se encontró esa conexión de WhatsApp.");

      if (String(u.activeWhatsAppProvider || "").toLowerCase() === "gupshup") return fail(422, "PROVEEDOR_NO_KAPSO", "Este usuario usa Gupshup, no Kapso: cambiar la conexión de Kapso no tendría efecto.");
      const current = String((u.kapso && u.kapso.kapsoAppId) || "");
      if (!current) return fail(422, "SIN_CONEXION_ACTUAL", "Este usuario todavía no tiene una conexión de Kapso asignada. Eso lo tiene que configurar un desarrollador.");
      const memberOf = new Set([...(Array.isArray(u.companies) ? u.companies.map(String) : []), ...idsOf(u.companiesWhereICollaborate)]);
      if (!memberOf.has(String(app.companyId))) return fail(422, "CONEXION_AJENA", "Esa conexión es de otra company: solo se puede elegir entre las de las companies del usuario.");
      if (app.status !== "success") return fail(422, "CONEXION_NO_CONECTADA", "Esa conexión todavía no está conectada (le falta terminar de conectar el número): no se puede asignar.");
      if (current === String(appId)) return { status: 200, body: { _id: String(userId), kapsoAppId: current, changed: false } };
      if (tooMany(admin.email)) return fail(429, "DEMASIADOS_INTENTOS", "Demasiados cambios en un minuto. Esperá un momento.");

      const from = await apps.findOne({ _id: new ObjectId(current) }, { projection: { alias: 1, displayPhoneNumber: 1 } }).catch(() => null);
      const base = { actor: admin.email, targetType: "user", targetId: String(userId), targetLabel: userFullName(u), companyId: companyIdOf({ companies: Array.isArray(u.companies) ? u.companies.map(String) : [], collaboratesIn: idsOf(u.companiesWhereICollaborate) }) };
      const detail = { from: current, to: String(appId), fromLabel: label(from), toLabel: label(app) };
      try { await audit.record(token, { ...base, action: "kapso_app_change", detail }); }
      catch (e) { log("Auditoría no disponible:", e.message); return fail(503, "AUDITORIA_NO_DISPONIBLE", "No se pudo guardar el registro de auditoría, por eso no se cambió nada."); }
      const failedAudit = async () => { try { await audit.record(token, { ...base, action: "kapso_app_change_failed", detail }); } catch (e2) { log("AUDITORÍA SIN GUARDAR (kapso_app_change_failed):", e2.message); } };

      let res;
      try { res = await users.updateOne({ _id, "kapso.kapsoAppId": current }, { $set: { "kapso.kapsoAppId": String(appId) } }); }
      catch (e) { log("Error al escribir la conexión del usuario:", e.message); await failedAudit(); return fail(502, "ERROR_ESCRITURA", "No se pudo guardar el cambio en la base. No se modificó el usuario."); }
      if (!res || res.matchedCount !== 1) {
        await failedAudit();
        return fail(409, "CAMBIO_CONCURRENTE", "Alguien cambió la conexión de este usuario mientras tanto. Recargá y volvé a intentar.");
      }
      invalidate();
      return { status: 200, body: { _id: String(userId), kapsoAppId: String(appId), previousKapsoAppId: current, changed: true } };
    },
  };
}
