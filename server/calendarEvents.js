// Qué evento le corresponde a cada cosa con fecha. Todo puro (sin red ni base) para poder probarlo.
// Para sumar una sección nueva (CRM, tickets…) alcanza con agregar un armador acá y cargarla en calendarSync.js: la conexión de Google es la misma.
import { createHash } from "node:crypto";

const clip = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

// Los eventos "de día completo" de Google terminan el día SIGUIENTE (el fin es exclusivo).
export function nextDay(iso) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// "Hoy" en Argentina (YYYY-MM-DD), que es como trabaja el equipo: el servidor puede estar en otra zona horaria.
export const todayInBA = (ms = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
const fmtDM = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export const eventHash = (event) => createHash("sha1").update(JSON.stringify(event)).digest("hex");

const PRIO_COLOR = { Alta: "11", Media: "5", Baja: "8" }; // colores de Google: rojo, amarillo, gris
const link = (appUrl, param, id) => `${String(appUrl).replace(/\/+$/, "")}/?${param}=${encodeURIComponent(id)}`;

function base({ key, summary, lines, url, start, end, colorId }) {
  return {
    summary,
    description: [...lines.filter(Boolean), "", `Abrir en el backoffice: ${url}`].join("\n"),
    start: { date: start }, end: { date: nextDay(end) },
    transparency: "transparent",            // no te marca "ocupado" en el calendario
    reminders: { useDefault: true },
    colorId,
    source: { title: "Backoffice Spicytool", url },
    extendedProperties: { private: { spicytool: key } },
  };
}

// Tarea de Operaciones → evento (o null si no tiene que haber evento).
// Archivada: sin evento. Finalizada: solo si ya tenía uno (queda con ✓, para no llenar el calendario con tareas viejas al conectar).
// Arrastre de lo vencido: si pasó la fecha y sigue pendiente, el evento se estira hasta hoy (así no desaparece del calendario). `today` en YYYY-MM-DD; sin `today` no se arrastra nada.
// Solo para las tareas de prioridad Alta (el resto queda en su fecha, para no llenar el calendario) y para los pasos de Onboarding.
export function taskEvent(task, { appUrl, hasLink = false, today = null } = {}) {
  if (!task || !ISO_RE.test(String(task.start_date)) || !ISO_RE.test(String(task.end_date))) return null;
  if (task.stage === "Archivado") return null;
  const done = task.stage === "Finalizado";
  if (done && !hasLink) return null;
  let end = task.end_date < task.start_date ? task.start_date : task.end_date;
  const overdue = !done && task.priority === "Alta" && !!today && ISO_RE.test(today) && end < today;
  const dueDay = end;
  if (overdue) end = today;
  return base({
    key: "task:" + task.id,
    summary: `${done ? "✓ " : overdue ? "Vencida · " : ""}Tarea: ${clip(task.title || "Sin título", 150)}`,
    lines: [overdue ? `Venció el ${fmtDM(dueDay)}` : "", task.priority ? `Prioridad: ${task.priority}` : "", task.stage ? `Etapa: ${task.stage}` : "", task.description ? clip(task.description, 600) : ""],
    url: link(appUrl, "task", task.id), start: task.start_date, end, colorId: overdue ? "11" : done ? "8" : (PRIO_COLOR[task.priority] || "5"),
  });
}

// Próximo paso de un cliente de Onboarding → evento de día completo (o null si no tiene paso con fecha).
export function onboardingEvent(row, { appUrl, today = null } = {}) {
  if (!row || !row.proximo_paso || !ISO_RE.test(String(row.proximo_paso_fecha))) return null;
  const overdue = !!today && ISO_RE.test(today) && row.proximo_paso_fecha < today;
  return base({
    key: "onboarding:" + row.id,
    summary: `${overdue ? "Vencido · " : ""}Onboarding · ${clip(row.client_name || "Cliente", 60)}: ${clip(row.proximo_paso, 120)}`,
    lines: [overdue ? `Venció el ${fmtDM(row.proximo_paso_fecha)}` : "", `Cliente: ${row.client_name || "—"}`, row.etapa_actual ? `Etapa: ${row.etapa_actual}` : "", `Paso: ${row.proximo_paso}`, row.proximo_paso_quien ? `Responsable: ${row.proximo_paso_quien}` : ""],
    url: link(appUrl, "onboarding", row.id), start: row.proximo_paso_fecha, end: overdue ? today : row.proximo_paso_fecha, colorId: overdue ? "11" : "3",
  });
}

// ── CRM comercial ───────────────────────────────────────────────────────────────────────────────
// Dos fuentes, igual que la pestaña "Tareas" del CRM: las tareas (crm_tasks) y la "próxima acción" de cada deal.
// Tienen hora, así que son eventos con horario (hora de Argentina). Duraciones como en el formulario del CRM ("Tarea 15 min", "Follow-up 15 min", "Reunión 30 min"): las reuniones BLOQUEAN el horario; el resto no.
// No se arrastra lo vencido. Una tarea hecha solo queda (con ✓) si ya tenía evento; las que vencieron hace más de 14 días y nunca se agendaron no se crean.
const TZ = "America/Argentina/Buenos_Aires";
const HM_RE = /^\d{2}:\d{2}$/;
const CRM_TIPO = { reunion: "Reunión", followup: "Seguimiento", tarea: "Tarea CRM" };
export const CRM_STALE_DAYS = 14;

// "2026-11-30" + "23:50" + 15 min → "2026-12-01T00:05:00" (hora local, sin zona: la zona va aparte)
export function addMinutesLocal(dateIso, hm, minutes) {
  const [y, m, d] = dateIso.split("-").map(Number), [h, mi] = hm.split(":").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, h, mi + minutes, 0));
  return t.toISOString().slice(0, 19);
}
const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);

// item: { k: "task"|"deal", id, titulo, fecha, hora, tipo, done, calOn, dealId, empresa, vendedor, notas } → evento o null.
export function crmEvent(item, { appUrl, hasLink = false, today = null } = {}) {
  if (!item || !ISO_RE.test(String(item.fecha)) || item.calOn === false) return null;
  const done = !!item.done;
  if (done && !hasLink) return null;
  if (!hasLink && today && ISO_RE.test(today) && daysBetween(item.fecha, today) > CRM_STALE_DAYS) return null;
  const hora = HM_RE.test(String(item.hora)) ? item.hora : "09:00";
  const tipo = CRM_TIPO[item.tipo] ? item.tipo : "tarea";
  const meeting = tipo === "reunion";
  const url = `${String(appUrl).replace(/\/+$/, "")}/?crm=${encodeURIComponent(item.dealId || "tareas")}`;
  const title = clip(item.titulo || CRM_TIPO[tipo], 120);
  return {
    summary: `${done ? "✓ " : ""}${CRM_TIPO[tipo]} · ${item.empresa ? clip(item.empresa, 60) + ": " : ""}${title}`,
    description: [...[item.empresa ? `Empresa: ${item.empresa}` : "", `Tipo: ${CRM_TIPO[tipo]}`, item.vendedor ? `Vendedor: ${item.vendedor}` : "", item.notas ? clip(item.notas, 600) : ""].filter(Boolean), "", `Abrir en el backoffice: ${url}`].join("\n"),
    start: { dateTime: `${item.fecha}T${hora}:00`, timeZone: TZ },
    end: { dateTime: addMinutesLocal(item.fecha, hora, meeting ? 30 : 15), timeZone: TZ },
    transparency: meeting && !done ? "opaque" : "transparent", // las reuniones ocupan el horario; todo lo demás no
    reminders: { useDefault: true },
    colorId: done ? "8" : meeting ? "9" : "10",
    source: { title: "Backoffice Spicytool", url },
    extendedProperties: { private: { spicytool: `${item.k === "deal" ? "crm_deal" : "crm_task"}:${item.id}` } },
  };
}

// El responsable de un paso de Onboarding se guarda como nombre ("Nico"), no como usuario. Se busca entre las personas del backoffice
// con la misma regla del front (esMio): "Nico" coincide con "Nicolás" o con nicolas@… Si hay más de una coincidencia se queda con la que se llama
// exactamente así; si sigue habiendo duda no se elige a nadie (mejor ningún evento que el evento en el calendario equivocado).
export function usersForName(name, users) {
  const n = norm(name);
  if (!n) return { users: [], ambiguous: false };
  const first = (u) => norm(u.first_name), local = (u) => norm(String(u.email || "").split("@")[0]);
  const hits = (users || []).filter((u) => (first(u) && (first(u) === n || first(u).startsWith(n) || n.startsWith(first(u)))) || (local(u) && local(u).startsWith(n)));
  if (hits.length <= 1) return { users: hits, ambiguous: false };
  const exact = hits.filter((u) => first(u) === n || local(u) === n);
  return exact.length === 1 ? { users: exact, ambiguous: false } : { users: [], ambiguous: true };
}
