// Lógica pura de las métricas de Devs (velocidad, carga de trabajo): sin React ni Supabase.
import { baDateISO, weekRangeISO } from "./timeTracking.js";

// Fecha (YYYY-MM-DD) y lunes de la semana de un instante, en horario de Buenos Aires.
export const dayBA = (iso) => baDateISO(new Date(iso));
export const weekStartBA = (iso) => weekRangeISO(dayBA(iso)).desde;

// Un solo evento de cierre por ticket/tarea: el ÚLTIMO ingreso al grupo de estados cerrados,
// y solo si hoy sigue cerrada. Así Testeando → Solucionado → Archivado cuenta UNA vez (el día en
// que entró al grupo) y un ticket reabierto no suma hasta que se vuelva a cerrar.
export function closureEvents(history, idField, statusField, closedStatuses, currentStatusById) {
  const byId = {};
  history.forEach((h) => { (byId[h[idField]] = byId[h[idField]] || []).push(h); });
  const events = [];
  Object.entries(byId).forEach(([id, list]) => {
    if (!closedStatuses.includes(currentStatusById[id])) return;
    const sorted = [...list].sort((a, b) => a.changed_at.localeCompare(b.changed_at));
    let entry = null;
    sorted.forEach((h, i) => {
      const closed = closedStatuses.includes(h[statusField]);
      const prevClosed = i > 0 && closedStatuses.includes(sorted[i - 1][statusField]);
      if (closed && !prevClosed) entry = h;
    });
    if (entry) events.push({ id, changed_at: entry.changed_at });
  });
  return events;
}

// ¿Se le puede sacar el puntaje a algo que está en este estado? (no si ya está en curso o cerrado)
export function scoreRequiredForStatus(groupName, groupsRequiringScore = ["En curso", "Cerrados"]) {
  return groupsRequiringScore.includes(groupName);
}
