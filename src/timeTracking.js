// Lógica pura del tracker de tiempo (control de jornada). Sin React ni Supabase,
// para poder testearla con vitest. El cálculo de horas "oficial" vive en la base
// (funciones SQL); acá solo hay formato, fechas en Buenos Aires y la lógica de
// heartbeat/inactividad del cliente.

export const BA_TZ = "America/Argentina/Buenos_Aires";
// Argentina no tiene horario de verano desde 2009: el offset es fijo.
const BA_OFFSET = "-03:00";

const pad = (n) => String(n).padStart(2, "0");

export function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function formatHM(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${pad(m)}m` : `${m}m`;
}

export function formatHours(hours) {
  const v = Math.round((hours || 0) * 100) / 100;
  return `${String(v).replace(".", ",")} h`;
}

export function formatDiffHours(hours) {
  const v = Math.round((hours || 0) * 100) / 100;
  return `${v > 0 ? "+" : ""}${String(v).replace(".", ",")} h`;
}

export function baDateISO(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BA_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function addDaysISO(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Semana lunes–domingo que contiene a la fecha.
export function weekRangeISO(iso) {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = domingo
  const desde = addDaysISO(iso, -((dow + 6) % 7));
  return { desde, hasta: addDaysISO(desde, 6) };
}

export function monthRangeISO(iso) {
  const [y, m] = iso.split("-").map(Number);
  const desde = `${y}-${pad(m)}-01`;
  const hasta = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { desde, hasta };
}

// "2026-10-12" + "09:30" → instante ISO con el offset de Buenos Aires.
export function baTimeToISO(dateISO, hhmm) {
  return `${dateISO}T${hhmm}:00${BA_OFFSET}`;
}

export function formatTimeBA(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-AR", { timeZone: BA_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

export function hhmmBA(iso) {
  return formatTimeBA(iso);
}

export function formatDateBA(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-AR", { timeZone: BA_TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

export function formatDateTimeBA(iso) {
  if (!iso) return "—";
  return `${formatDateBA(iso)} ${formatTimeBA(iso)}`;
}

export function formatISODateShort(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

const WEEKDAYS_ES = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
export function weekdayShort(isoDate) {
  const dow = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return WEEKDAYS_ES[(dow + 6) % 7];
}

// 'sin_iniciar' | 'trabajando' | 'pausa' | 'finalizada' a partir de la respuesta de time_estado().
export function estadoUI(estado) {
  if (!estado) return "sin_iniciar";
  if (estado.jornada) return estado.jornada.estado;
  return estado.jornadas_hoy > 0 ? "finalizada" : "sin_iniciar";
}

// Segundos trabajados hoy para mostrar en vivo: lo que informó el servidor más lo
// transcurrido localmente, sin pasar del tope que calcula el servidor.
export function liveSeconds(estado, receivedAtMs, nowMs) {
  if (!estado) return 0;
  const base = estado.hoy_segundos || 0;
  if (estado.jornada?.estado !== "trabajando") return base;
  const elapsed = Math.max(0, (nowMs - receivedAtMs) / 1000);
  return Math.floor(base + Math.min(elapsed, estado.puede_extender_segundos || 0));
}

// El heartbeat solo sale si la pestaña está visible y hubo interacción reciente.
export function shouldSendHeartbeat({ visible, idleMs, heartbeatSeconds }) {
  return !!visible && idleMs <= heartbeatSeconds * 1000;
}

export function isIdleExpired({ idleMs, inactivityMinutes }) {
  return idleMs >= inactivityMinutes * 60 * 1000;
}

export function csvEscape(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// columns: [{ key, label }]
export function toCSV(rows, columns) {
  const header = columns.map((c) => csvEscape(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => csvEscape(r[c.key])).join(","));
  return [header, ...body].join("\r\n");
}

export const DIAS_SEMANA = [
  { iso: 1, label: "Lun" }, { iso: 2, label: "Mar" }, { iso: 3, label: "Mié" }, { iso: 4, label: "Jue" },
  { iso: 5, label: "Vie" }, { iso: 6, label: "Sáb" }, { iso: 7, label: "Dom" },
];

// Los errores de las funciones SQL llegan como códigos cortos; los traducimos.
const ERROR_MESSAGES = {
  ya_hay_jornada_abierta: "Ya tenés una jornada abierta.",
  sin_jornada_abierta: "No hay una jornada abierta.",
  no_autorizado: "No tenés permiso para hacer esto.",
  rango_invalido: "El rango de fechas u horarios no es válido.",
  motivo_requerido: "Tenés que indicar un motivo.",
  se_superpone: "El horario se superpone con otra jornada de esa persona.",
  jornada_abierta: "No se puede editar una jornada que todavía está abierta.",
  solicitud_ya_resuelta: "Esa solicitud ya fue resuelta.",
  datos_invalidos: "Faltan datos o no son válidos.",
};
export function timeErrorMessage(error) {
  const raw = (error && (error.message || String(error))) || "";
  const code = Object.keys(ERROR_MESSAGES).find((k) => raw.includes(k));
  return code ? ERROR_MESSAGES[code] : (raw || "Ocurrió un error.");
}
