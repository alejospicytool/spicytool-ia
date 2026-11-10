// Persistencia del CRM comercial en Supabase (tablas crm_config / crm_deals / crm_tasks, ver supabase_crm.sql).
// El front trabaja con un estado { config, deals[], tasks[] } (los objetos JSON originales) y acá se calcula
// qué filas cambiaron y se guardan con control de versión (update ... where version = <la que leí>), así dos
// personas editando a la vez no se pisan en silencio.

const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x));
const same = (a, b) => stable(a) === stable(b);

// Qué filas cambiaron entre dos estados
export function diffState(prev, next) {
  const out = { config: null, dealsUpsert: [], dealsDelete: [], tasksUpsert: [], tasksDelete: [] };
  if (!same(prev.config, next.config)) out.config = next.config;
  const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
  for (const [key, up, del] of [["deals", "dealsUpsert", "dealsDelete"], ["tasks", "tasksUpsert", "tasksDelete"]]) {
    const p = byId(prev[key]), n = byId(next[key]);
    Object.keys(n).forEach((id) => { if (!p[id] || !same(p[id], n[id])) out[up].push(n[id]); });
    Object.keys(p).forEach((id) => { if (!n[id]) out[del].push(id); });
  }
  return out;
}
export const isEmptyDiff = (d) => !d.config && !d.dealsUpsert.length && !d.dealsDelete.length && !d.tasksUpsert.length && !d.tasksDelete.length;

export async function loadAll(sb) {
  const [c, d, t] = await Promise.all([
    sb.from("crm_config").select("data,version").eq("id", 1).maybeSingle(),
    sb.from("crm_deals").select("id,data,version").order("created_at"),
    sb.from("crm_tasks").select("id,data,version").order("created_at"),
  ]);
  const error = c.error || d.error || t.error;
  if (error) throw error;
  const versions = { config: c.data ? c.data.version : 0, deals: {}, tasks: {} };
  (d.data || []).forEach((r) => { versions.deals[r.id] = r.version; });
  (t.data || []).forEach((r) => { versions.tasks[r.id] = r.version; });
  return { state: { config: c.data ? c.data.data : null, deals: (d.data || []).map((r) => r.data), tasks: (t.data || []).map((r) => r.data) }, versions };
}

// Guarda un diff. Devuelve { versions } o { conflict: true } (hay que recargar).
export async function persist(sb, diff, versions) {
  const v = { config: versions.config, deals: { ...versions.deals }, tasks: { ...versions.tasks } };
  const upsertRows = async (table, rows, map) => {
    for (const row of rows) {
      if (map[row.id] == null) {
        const { error } = await sb.from(table).insert({ id: row.id, data: row });
        if (error) { if (error.code === "23505") return false; throw error; } // ya existía: otra persona lo creó
        map[row.id] = 1;
      } else {
        const { data, error } = await sb.from(table).update({ data: row, version: map[row.id] + 1 }).eq("id", row.id).eq("version", map[row.id]).select("version");
        if (error) throw error;
        if (!data || data.length === 0) return false;
        map[row.id] = data[0].version;
      }
    }
    return true;
  };
  const deleteRows = async (table, ids, map) => {
    for (const id of ids) {
      const { error } = await sb.from(table).delete().eq("id", id);
      if (error) throw error;
      delete map[id];
    }
  };
  if (diff.config) {
    const { data, error } = await sb.from("crm_config").update({ data: diff.config, version: v.config + 1 }).eq("id", 1).eq("version", v.config).select("version");
    if (error) throw error;
    if (!data || data.length === 0) return { conflict: true };
    v.config = data[0].version;
  }
  if (!(await upsertRows("crm_deals", diff.dealsUpsert, v.deals))) return { conflict: true };
  if (!(await upsertRows("crm_tasks", diff.tasksUpsert, v.tasks))) return { conflict: true };
  await deleteRows("crm_deals", diff.dealsDelete, v.deals);
  await deleteRows("crm_tasks", diff.tasksDelete, v.tasks);
  return { versions: v };
}
