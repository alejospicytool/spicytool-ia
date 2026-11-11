// Consultas de SOLO LECTURA a Mongo para el backoffice. Nada acá escribe, actualiza ni borra.
// Las pantallas esperan la misma forma que tenía el simulador (src/admin/adminApi.js); la forma la fija shape.js.
import { ObjectId } from "mongodb";
import { matchesSearch, matchesFilters, isOwner, isPaused, matchesCompanySearch, sortCompaniesByName, sortUsersRecent, paginate, companyIdOf } from "../src/admin/adminLogic.js";
import { USER_PROJECTION, COMPANY_PROJECTION, CHILD, SUPPORT_PROJECTION, shapeUser, shapeCompany, shapeSupportSession, numbered } from "./shape.js";

const MAX_MS = 8000;
const SNAPSHOT_MS = 30_000;
const CONTACTS_LIMIT = 100;
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
        const [u, c] = await Promise.all([
          col("users").find({}, { projection: USER_PROJECTION }).maxTimeMS(MAX_MS).toArray(),
          col("companies").find({}, { projection: COMPANY_PROJECTION }).maxTimeMS(MAX_MS).toArray(),
        ]);
        const users = u.map(shapeUser), companies = c.map(shapeCompany);
        snap = { users, companies, companyById: new Map(companies.map((x) => [x._id, x])) };
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

    async listUsers({ search = "", page = 1, pageSize = 8, owners = false, activeOnly = false } = {}) {
      const s = await snapshot();
      const rows = s.users.map((u) => ({ u, co: s.companyById.get(companyIdOf(u)) })).filter(({ u, co }) => matchesSearch(u, search) && matchesFilters(u, co, { owners, activeOnly }));
      const p = paginate(sortUsersRecent(rows.map((r) => r.u)), page, pageSize);
      return { ...p, items: p.items.map((u) => { const co = s.companyById.get(companyIdOf(u)); return { ...u, companyName: co ? co.name : "—", companyStatus: co ? co.status : null, isOwner: isOwner(u, co) }; }) };
    },

    async listCompanies({ status = "active", search = "", page = 1, pageSize = 8 } = {}) {
      const s = await snapshot();
      const found = s.companies.filter((c) => matchesCompanySearch(c, search));
      const counts = { active: found.filter((c) => !isPaused(c)).length, paused: found.filter(isPaused).length };
      const p = paginate(sortCompaniesByName(found.filter((c) => (status === "paused" ? isPaused(c) : !isPaused(c)))), page, pageSize);
      return { ...p, counts, items: p.items.map((c) => ({ ...c, userCount: s.users.filter((u) => u.companies.includes(c._id)).length })) };
    },

    async listCompanyUsers(companyId) {
      const s = await snapshot();
      const co = s.companyById.get(companyId);
      if (!co) return null;
      return s.users.filter((u) => u.companies.includes(companyId)).map((u) => ({ ...u, isOwner: isOwner(u, co) }))
        .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`, "es", { sensitivity: "base" }));
    },

    async getUser(id) {
      const _id = oid(id);
      if (!_id) return null;
      const d = await col("users").findOne({ _id }, { projection: USER_PROJECTION, maxTimeMS: MAX_MS });
      return d ? shapeUser(d) : null;
    },

    // Todo lo de una company. Contactos: solo los últimos 100 (hay companies con decenas de miles) más el total real en "counts".
    async getCompanyBundle(companyId) {
      const _id = oid(companyId);
      if (!_id) return null;
      const d = await col("companies").findOne({ _id }, { projection: COMPANY_PROJECTION, maxTimeMS: MAX_MS });
      if (!d) return null;
      const byCompany = { companyId };
      const [users, contacts, contactsTotal, campaigns, landings, conversions, whatsappConversions, pipelines, templates, webforms, contactLists, workflows] = await Promise.all([
        col("users").find({ companies: companyId }, { projection: USER_PROJECTION }).maxTimeMS(MAX_MS).toArray(),
        find("contacts", byCompany, { sort: { _id: -1 }, limit: CONTACTS_LIMIT }),
        col("contacts").countDocuments(byCompany, { maxTimeMS: MAX_MS }),
        find("campaigns", byCompany), find("landings", byCompany), find("companyconversions", byCompany),
        find("whatsappconversions", byCompany, { sort: { _id: -1 }, limit: 100 }),
        find("pipelines", byCompany), find("whatsapptemplates", byCompany), find("webforms", byCompany, { sort: { created: 1 } }),
        find("contactlists", byCompany), find("workflows", byCompany),
      ]);
      const sh = (name, rows) => rows.map(CHILD[name].shape);
      return {
        company: shapeCompany(d), users: users.map(shapeUser),
        contacts: sh("contacts", contacts), campaigns: sh("campaigns", campaigns), landings: sh("landings", landings), conversions: sh("companyconversions", conversions),
        whatsappConversions: sh("whatsappconversions", whatsappConversions), pipelines: sh("pipelines", pipelines), templates: sh("whatsapptemplates", templates),
        webforms: numbered(sh("webforms", webforms)), contactLists: numbered(sh("contactlists", contactLists)), workflows: sh("workflows", workflows),
        counts: { contacts: contactsTotal },
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
