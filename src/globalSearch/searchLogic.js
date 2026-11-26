// Buscador global del backoffice (lógica pura, sin React ni Supabase). Busca en lo que la app ya tiene cargado en memoria: clientes de Seguimiento,
// tickets, tareas, tareas de Devs, onboarding, notas, ideas y las secciones del menú. Los usuarios de Admin Spicy se buscan aparte (los trae el servidor).
// Cada palabra escrita tiene que aparecer en algún lado del registro (sin distinguir mayúsculas ni tildes); los teléfonos se comparan solo por dígitos.

export const MIN_CHARS = 2;
export const fold = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const digitsOf = (s) => String(s ?? "").replace(/\D/g, "");
const clip = (s, n = 70) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

// Orden y nombre de cada grupo de resultados.
export const GROUPS = [
  ["client", "Clientes"], ["spicy_user", "Usuarios de Admin Spicy"], ["ticket", "Tickets"], ["task", "Tareas"], ["dev_task", "Tareas de Devs"],
  ["onboarding", "Onboarding"], ["note", "Notas"], ["idea", "Ideas"], ["view", "Ir a una sección"],
];

// Convierte la consulta en palabras. Devuelve [] si es demasiado corta.
export function queryWords(q) {
  const t = fold(q).trim();
  return t.length < MIN_CHARS ? [] : t.split(/\s+/).filter(Boolean);
}

// ¿Aparecen todas las palabras en el texto (o, si son dígitos, en los dígitos)?
function matches(words, hay, digits) {
  return words.every((w) => hay.includes(w) || (/^\d{3,}$/.test(w) && digits && digits.includes(w)));
}
// Puntaje: mejor si el título empieza con lo escrito o lo contiene entero; después se desempata por lo más reciente.
function score(words, title, q) {
  const t = fold(title), full = fold(q).trim();
  let s = 1;
  if (t.startsWith(full)) s += 4;
  else if (words.every((w) => t.includes(w))) s += 3;
  else if (words.some((w) => t.includes(w))) s += 1;
  return s;
}

// data: { followup, tickets, tasks, devTasks, onboarding, notes, ideas, views, can: { ops, devs } }
//   views = [{ id, label, section }] ya filtradas por permisos; can.ops = puede ver Operaciones; can.devs = puede ver Devs.
// Devuelve { groups: [{ type, label, items, more }], total }. `limit` = cuántos se muestran por grupo (more = cuántos quedaron afuera).
export function searchAll(q, data = {}, { limit = 5 } = {}) {
  const words = queryWords(q);
  if (!words.length) return { groups: [], total: 0 };
  const can = data.can || {};
  const cands = [];
  const add = (type, id, title, sub, hayParts, when, extra = {}) => {
    const hay = fold(hayParts.join(" ")), digits = digitsOf(hayParts.join(" "));
    if (matches(words, hay, digits)) cands.push({ type, id: String(id), title: title || "(sin título)", sub: sub || "", score: score(words, title, q), when: when || "", ...extra });
  };
  if (can.ops) {
    for (const r of data.followup || []) add("client", r.company_id, r.company_name, [r.contact_name, r.contact_email].filter(Boolean).join(" · ") + (r.baja_en ? " · de baja" : ""), [r.company_name, r.contact_name, r.contact_email, r.contact_phone, r.company_id], r.updated_at, { companyId: r.company_id });
    for (const t of data.tickets || []) add("ticket", t.id, t.title || t.client_name, [t.client_name, t.status].filter(Boolean).join(" · "), [t.title, t.client_name, t.message, t.category, t.status], t.created_at);
    for (const t of data.tasks || []) add("task", t.id, t.title, t.stage, [t.title, t.description, t.stage], t.created_at);
    for (const o of data.onboarding || []) add("onboarding", o.id, o.client_name, [o.etapa_actual, o.responsable].filter(Boolean).join(" · "), [o.client_name, o.responsable, o.etapa_actual, o.proximo_paso], o.created_at);
  }
  if (can.devs) for (const t of data.devTasks || []) add("dev_task", t.id, t.title, t.stage, [t.title, t.description, t.stage], t.created_at);
  for (const n of data.notes || []) add("note", n.id, n.title, clip(n.content), [n.title, n.content], n.updated_at);
  for (const i of data.ideas || []) add("idea", i.id, i.title, [i.requested_by && "Pedido por " + i.requested_by, i.status].filter(Boolean).join(" · "), [i.title, i.description, i.requested_by], i.created_at);
  for (const v of data.views || []) add("view", v.id, v.label, v.section && v.section !== v.label ? v.section : "", [v.label, v.section], "");
  const groups = [];
  for (const [type, label] of GROUPS) {
    const all = cands.filter((c) => c.type === type).sort((a, b) => b.score - a.score || String(b.when).localeCompare(String(a.when)) || a.title.localeCompare(b.title, "es"));
    if (all.length) groups.push({ type, label, items: all.slice(0, limit), more: Math.max(0, all.length - limit) });
  }
  return { groups, total: cands.length };
}

// Usuarios de Admin Spicy (los trae el servidor) con la forma de un resultado.
export function spicyUserItems(items, nameOf) {
  return (items || []).map((u) => ({ type: "spicy_user", id: String(u._id), title: nameOf(u), sub: [u.email, u.companyName && u.companyName !== "—" ? u.companyName : null].filter(Boolean).join(" · "), score: 0, when: "" }));
}

// Une los grupos de memoria con el de Admin Spicy, respetando el orden de GROUPS.
export function withSpicyGroup(groups, spicyItems, more = 0) {
  if (!spicyItems || !spicyItems.length) return groups;
  const label = GROUPS.find((g) => g[0] === "spicy_user")[1];
  const order = GROUPS.map((g) => g[0]);
  return [...groups, { type: "spicy_user", label, items: spicyItems, more }].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
}

// Lista plana de todos los resultados en el orden en que se ven (para moverse con las flechas).
export const flatItems = (groups) => groups.flatMap((g) => g.items);
