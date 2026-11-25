// Consultas de SOLO LECTURA a Mongo para el backoffice. Nada acá escribe, actualiza ni borra.
// Las pantallas esperan la misma forma que tenía el simulador (src/admin/adminApi.js); la forma la fija shape.js.
import { ObjectId } from "mongodb";
import { matchesSearch, matchesFilters, planCounts, companiesView, isOwner, sortUsersRecent, paginate, companyIdOf, isMemberOf, isCollaboratorOf, collaboratesInOf, kapsoAppsOfUser, kapsoSummary, listKapsoRows } from "../src/admin/adminLogic.js";
import { USER_PROJECTION, COMPANY_PROJECTION, KAPSOAPP_PROJECTION, shapeKapsoApp, CHILD, SUPPORT_PROJECTION, shapeUser, shapeCompany, shapeSupportSession, numbered } from "./shape.js";

const MAX_MS = 8000;
const SNAPSHOT_MS = 30_000;
const oid = (id) => (/^[0-9a-f]{24}$/i.test(String(id)) ? new ObjectId(String(id)) : null);

export function makeQueries(db) {
  const col = (name) => db.collection(name);
  const find = (name, filter, { sort, limit } = {}) => {
    let c = col(name).find(filter, { projection: CHILD[name].projection }).maxTimeMS(MAX_MS);
    if (sort) c = c.sort(sort);
    if (limit) c = c.limit(limit);
    return c.toArray();
  };

  // Usuarios y companies son chicos (~1000 y ~400): se leen enteros (solo campos permitidos) y se guardan 30 s en memoria.
  let snap = null, snapAt = 0, loading = null;
  async function snapshot() {
    if (snap && Date.now() - snapAt < SNAPSHOT_MS) return snap;
    if (!loading) {
      loading = (async () => {
        const [u, c, k] = await Promise.all([
          col("users").find({}, { projection: USER_PROJECTION }).maxTimeMS(MAX_MS).toArray(),
          col("companies").find({}, { projection: COMPANY_PROJECTION }).maxTimeMS(MAX_MS).toArray(),
          // Las conexiones de WhatsApp son un extra de la lista: si no se pueden leer, usuarios y companies siguen andando.
          col("kapsoapps").find({}, { projection: KAPSOAPP_PROJECTION }).maxTimeMS(MAX_MS).toArray().catch(() => []),
        ]);
        const users = u.map(shapeUser), companies = c.map(shapeCompany), kapsoApps = k.map(shapeKapsoApp);
        snap = { users, companies, kapsoApps, companyById: new Map(companies.map((x) => [x._id, x])) };
        snapAt = Date.now();
        return snap;
      })().finally(() => { loading = null; });
    }
    return loading;
  }

  return {
    // Tras una escritura se descarta la copia de 30 s para que las listas muestren el cambio enseguida.
    invalidate() { snap = null; snapAt = 0; },

    async health() { await db.command({ ping: 1 }); return { ok: true, mode: "real" }; },

    async listUsers({ search = "", page = 1, pageSize = 8, owners = false, activeOnly = false, plan = "" } = {}) {
      const s = await snapshot();
      // Los conteos por plan respetan la búsqueda y los demás filtros (pero no el plan elegido) para que el selector muestre cuántos hay de cada uno.
      const base = s.users.map((u) => ({ u, co: s.companyById.get(companyIdOf(u)) })).filter(({ u, co }) => matchesSearch(u, search) && matchesFilters(u, co, { owners, activeOnly }));
      const rows = base.filter(({ u, co }) => matchesFilters(u, co, { plan }));
      const p = paginate(sortUsersRecent(rows.map((r) => r.u)), page, pageSize);
      return { ...p, planCounts: planCounts(base.map((r) => r.u)), items: p.items.map((u) => { const co = s.companyById.get(companyIdOf(u)); return { ...u, kapsoApps: kapsoAppsOfUser(s.kapsoApps, u).map(kapsoSummary), companyName: co ? co.name : "—", companyStatus: co ? co.status : null, isCollaborator: !!co && isCollaboratorOf(u, co._id), otherCollabs: Math.max(0, collaboratesInOf(u).filter((x) => x !== (co && co._id)).length), isOwner: isOwner(u, co) }; }) };
    },

    // Conexiones de WhatsApp por Kapso de todas las companies (vista "Conexiones de WhatsApp").
    async listKapsoApps(params = {}) {
      const s = await snapshot();
      return listKapsoRows({ apps: s.kapsoApps, users: s.users, companies: s.companies }, params);
    },

    async listCompanies({ status = "active", search = "", plan = "", page = 1, pageSize = 8 } = {}) {
      const s = await snapshot();
      return companiesView({ companies: s.companies, users: s.users, status, search, plan, page, pageSize });
    },

    async listCompanyUsers(companyId) {
      const s = await snapshot();
      const co = s.companyById.get(companyId);
      if (!co) return null;
      return s.users.filter((u) => isMemberOf(u, companyId)).map((u) => ({ ...u, isOwner: isOwner(u, co), isCollaborator: isCollaboratorOf(u, companyId) }))
        .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`, "es", { sensitivity: "base" }));
    },

    async getUser(id) {
      const _id = oid(id);
      if (!_id) return null;
      const d = await col("users").findOne({ _id }, { projection: USER_PROJECTION, maxTimeMS: MAX_MS });
      return d ? shapeUser(d) : null;
    },

    // Todo lo de una company. NO incluye los contactos de la company (decenas de miles por company y datos personales de terceros).
    async getCompanyBundle(companyId) {
      const _id = oid(companyId);
      if (!_id) return null;
      const d = await col("companies").findOne({ _id }, { projection: COMPANY_PROJECTION, maxTimeMS: MAX_MS });
      if (!d) return null;
      const byCompany = { companyId };
      const [users, campaigns, landings, conversions, whatsappConversions, pipelines, templates, webforms, contactLists, workflows, kapsoApps] = await Promise.all([
        col("users").find({ $or: [{ companies: companyId }, { companiesWhereICollaborate: { $in: [companyId, ...(oid(companyId) ? [oid(companyId)] : [])] } }] }, { projection: USER_PROJECTION }).maxTimeMS(MAX_MS).toArray(),
        find("campaigns", byCompany), find("landings", byCompany), find("companyconversions", byCompany),
        find("whatsappconversions", byCompany, { sort: { _id: -1 }, limit: 100 }),
        find("pipelines", byCompany), find("whatsapptemplates", byCompany), find("webforms", byCompany, { sort: { created: 1 } }),
        find("contactlists", byCompany), find("workflows", byCompany),
        find("kapsoapps", byCompany, { sort: { createdAt: 1 } }).catch(() => []),
      ]);
      const sh = (name, rows) => rows.map(CHILD[name].shape);
      return {
        company: shapeCompany(d), users: users.map(shapeUser),
        campaigns: sh("campaigns", campaigns), landings: sh("landings", landings), conversions: sh("companyconversions", conversions),
        whatsappConversions: sh("whatsappconversions", whatsappConversions), pipelines: sh("pipelines", pipelines), templates: sh("whatsapptemplates", templates),
        webforms: numbered(sh("webforms", webforms)), contactLists: numbered(sh("contactlists", contactLists)), workflows: sh("workflows", workflows), kapsoApps: sh("kapsoapps", kapsoApps),
      };
    },

    async getPipelineStages(pipelineId) {
      return (await find("pipelinestages", { pipelineId: String(pipelineId) }, { sort: { position: 1 } })).map(CHILD.pipelinestages.shape);
    },

    // Registro de sesiones de soporte que ya guarda Spicytool (colección supportsessions). Sin links ni códigos.
    async listSupportSessions({ search = "", page = 1, pageSize = 10 } = {}) {
      const s = await snapshot();
      const docs = await col("supportsessions").find({}, { projection: SUPPORT_PROJECTION }).sort({ createdAt: -1 }).limit(500).maxTimeMS(MAX_MS).toArray();
      const q = String(search || "").trim().toLowerCase();
      const rows = docs.map((d) => shapeSupportSession(d, (s.companyById.get(String(d.companyId)) || {}).name))
        .filter((a) => !q || [a.actor, a.targetLabel, a.detail.targetEmail, a.detail.companyName, a.detail.reason].some((v) => v && String(v).toLowerCase().includes(q)));
      return paginate(rows, page, pageSize);
    },
  };
}
