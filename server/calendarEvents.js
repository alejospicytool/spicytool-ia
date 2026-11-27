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
export function taskEvent(task, { appUrl, hasLink = false } = {}) {
  if (!task || !ISO_RE.test(String(task.start_date)) || !ISO_RE.test(String(task.end_date))) return null;
  if (task.stage === "Archivado") return null;
  const done = task.stage === "Finalizado";
  if (done && !hasLink) return null;
  const end = task.end_date < task.start_date ? task.start_date : task.end_date;
  return base({
    key: "task:" + task.id,
    summary: `${done ? "✓ " : ""}Tarea: ${clip(task.title || "Sin título", 150)}`,
    lines: [task.priority ? `Prioridad: ${task.priority}` : "", task.stage ? `Etapa: ${task.stage}` : "", task.description ? clip(task.description, 600) : ""],
    url: link(appUrl, "task", task.id), start: task.start_date, end, colorId: done ? "8" : (PRIO_COLOR[task.priority] || "5"),
  });
}

// Próximo paso de un cliente de Onboarding → evento de día completo (o null si no tiene paso con fecha).
export function onboardingEvent(row, { appUrl } = {}) {
  if (!row || !row.proximo_paso || !ISO_RE.test(String(row.proximo_paso_fecha))) return null;
  return base({
    key: "onboarding:" + row.id,
    summary: `Onboarding · ${clip(row.client_name || "Cliente", 60)}: ${clip(row.proximo_paso, 120)}`,
    lines: [`Cliente: ${row.client_name || "—"}`, row.etapa_actual ? `Etapa: ${row.etapa_actual}` : "", `Paso: ${row.proximo_paso}`, row.proximo_paso_quien ? `Responsable: ${row.proximo_paso_quien}` : ""],
    url: link(appUrl, "onboarding", row.id), start: row.proximo_paso_fecha, end: row.proximo_paso_fecha, colorId: "3",
  });
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
