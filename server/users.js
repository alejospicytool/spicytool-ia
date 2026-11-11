// Editar la ficha de contacto de un USUARIO en Mongo, como hacía Retool (updateOne sobre users con $set), pero:
//  · SOLO nombre, apellido y teléfono. El EMAIL NO SE EDITA: es el login, la forma en que Spicytool encuentra al cliente para cobrarle,
//    y lo usan como vínculo companies.userEmail (dueño), campaigns.userEmail y landings.userEmail. Cambiarlo acá dejaría todo eso huérfano.
//  · Tampoco se escribe subscription.* (el plan se cambia solo con el webhook que cobra).
// Reglas: se escribe solo lo que cambió, solo si nadie lo tocó en el medio, con auditoría ANTES (sin registro no se cambia nada),
// tope por minuto, y un segundo registro "contact_edit_failed" si la escritura falla.
import { ObjectId } from "mongodb";
import { validateContactEdit, diffFields, userFullName } from "../src/admin/adminLogic.js";

const ID_RE = /^[0-9a-f]{24}$/i;
const fail = (status, code, message) => ({ status, body: { code, message } });
const KEYS = ["name", "surname", "phoneNumber"];
const MAX_TEXT = 100, MAX_PHONE = 30;

export function makeUserAdmin({ db, audit, invalidate = () => {}, now = () => Date.now(), maxPerMinute = 30, log = console.error }) {
  const attempts = new Map();
  const tooMany = (email) => {
    const t = now(), recent = (attempts.get(email) || []).filter((x) => t - x < 60_000);
    if (recent.length >= maxPerMinute) { attempts.set(email, recent); return true; }
    attempts.set(email, [...recent, t]);
    return false;
  };

  return {
    async editContact(admin, token, userId, input = {}) {
      if (!ID_RE.test(String(userId))) return fail(400, "ID_INVALIDO", "Id inválido.");
      if (!input || typeof input !== "object" || Array.isArray(input)) return fail(400, "DATOS_INVALIDOS", "Datos inválidos.");
      const _id = new ObjectId(String(userId));
      const col = db.collection("users");

      const u = await col.findOne({ _id }, { projection: { name: 1, surname: 1, phoneNumber: 1, email: 1, companies: 1 } });
      if (!u) return fail(404, "USUARIO_NO_ENCONTRADO", "No se encontró el usuario.");

      // El email se muestra pero no se cambia: si viene uno distinto, se rechaza en vez de ignorarlo en silencio.
      if (input.email != null && String(input.email).trim().toLowerCase() !== String(u.email || "").trim().toLowerCase()) {
        return fail(400, "EMAIL_NO_EDITABLE", "El email no se puede cambiar desde el backoffice: es el login del usuario y vincula su company, campañas y landings.");
      }

      const v = validateContactEdit({ name: input.name ?? u.name, surname: input.surname ?? u.surname ?? "", phoneNumber: input.phoneNumber ?? u.phoneNumber ?? "" }, { currentPhone: u.phoneNumber });
      if (!v.ok) return fail(400, "DATOS_INVALIDOS", Object.values(v.errors)[0]);
      if (v.value.name.length > MAX_TEXT || v.value.surname.length > MAX_TEXT) return fail(400, "DATOS_INVALIDOS", `Nombre y apellido no pueden tener más de ${MAX_TEXT} caracteres.`);
      if (v.value.phoneNumber.length > MAX_PHONE) return fail(400, "DATOS_INVALIDOS", `El teléfono no puede tener más de ${MAX_PHONE} caracteres.`);

      const after = { name: v.value.name, surname: v.value.surname, phoneNumber: v.value.phoneNumber };
      const changes = diffFields({ name: u.name, surname: u.surname, phoneNumber: u.phoneNumber }, after, KEYS);
      const shown = { _id: String(userId), name: u.name || "", surname: u.surname || "", phoneNumber: u.phoneNumber || "" };
      if (changes.length === 0) return { status: 200, body: { ...shown, changed: false, changes: [] } };
      if (tooMany(admin.email)) return fail(429, "DEMASIADOS_INTENTOS", "Demasiados cambios en un minuto. Esperá un momento.");

      const base = { actor: admin.email, targetType: "user", targetId: String(userId), targetLabel: userFullName(u), companyId: (Array.isArray(u.companies) && u.companies[0] && String(u.companies[0])) || null };
      try { await audit.record(token, { ...base, action: "contact_edit", detail: { changes } }); }
      catch (e) { log("Auditoría no disponible:", e.message); return fail(503, "AUDITORIA_NO_DISPONIBLE", "No se pudo guardar el registro de auditoría, por eso no se cambió nada."); }
      const failedAudit = async () => { try { await audit.record(token, { ...base, action: "contact_edit_failed", detail: { changes } }); } catch (e2) { log("AUDITORÍA SIN GUARDAR (contact_edit_failed):", userId, e2.message); } };

      const $set = Object.fromEntries(changes.map((c) => [c.key, after[c.key]]));
      const filter = { _id, ...Object.fromEntries(changes.map((c) => [c.key, c.from ?? null])) }; // null también cubre "el campo no existe"
      let res;
      try { res = await col.updateOne(filter, { $set }); }
      catch (e) { log("Error al escribir el usuario:", e.message); await failedAudit(); return fail(502, "ERROR_ESCRITURA", "No se pudo guardar el cambio en la base. No se modificó el usuario."); }
      if (!res || res.matchedCount !== 1) {
        await failedAudit();
        const still = await col.findOne({ _id }, { projection: { _id: 1 } });
        return still ? fail(409, "CAMBIO_CONCURRENTE", "Alguien modificó este usuario mientras lo editabas. Recargá y volvé a intentar.") : fail(404, "USUARIO_NO_ENCONTRADO", "El usuario ya no existe.");
      }
      invalidate();
      return { status: 200, body: { ...shown, ...after, changed: true, changes } };
    },
  };
}
