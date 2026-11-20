// Lógica pura del Seguimiento de clientes (sin React ni Supabase), para poder probarla con vitest.
// Una "rutina" no crea tareas: cada cliente tiene una frecuencia (por defecto 7 días) y el próximo toque se CALCULA a partir
// del último toque registrado. Así no hay nada que se desactualice ni se duplique.
import { addDaysISO, weekRangeISO, baDateISO } from "../timeTracking.js";

export const DEFAULT_FRECUENCIA = 7;

export const CANALES = [
  { key: "whatsapp", label: "WhatsApp", icon: "💬" },
  { key: "llamada", label: "Llamada", icon: "📞" },
  { key: "reunion", label: "Reunión", icon: "🤝" },
  { key: "email", label: "Email", icon: "✉️" },
  { key: "otro", label: "Otro", icon: "•" },
];
export const RESULTADOS = [
  { key: "respondio", label: "Respondió", short: "Respondió", color: "#16A34A", bg: "#EDFAF3" },
  { key: "queja", label: "Respondió con una queja", short: "Queja", color: "#B45309", bg: "#FEF3C7" },
  { key: "no_respondio", label: "No respondió", short: "No respondió", color: "#C42F2F", bg: "#FEF0F0" },
];
export const SEMAFOROS = [
  { key: "verde", label: "Verde", color: "#16A34A", bg: "#EDFAF3" },
  { key: "amarillo", label: "Amarillo", color: "#D99A00", bg: "#FEF6DA" },
  { key: "rojo", label: "Rojo", color: "#C42F2F", bg: "#FEF0F0" },
];
export const canalLabel = (k) => (CANALES.find((c) => c.key === k) || { label: k || "—" }).label;
export const resultadoInfo = (k) => RESULTADOS.find((r) => r.key === k) || { key: k, label: k || "—", short: k || "—", color: "#666", bg: "#F4F4F5" };
export const semaforoInfo = (k) => SEMAFOROS.find((s) => s.key === k) || SEMAFOROS[0];

const isISO = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const createdDay = (row) => (row && row.created_at ? baDateISO(new Date(row.created_at)) : null);

// Días entre dos fechas ISO (b - a).
export function diasEntre(a, b) {
  if (!isISO(a) || !isISO(b)) return null;
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}
export const diasDesde = (iso, today) => diasEntre(iso, today);

export function normFrecuencia(v) {
  if (v === null || v === "" || v === undefined) return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 365 ? n : null;
}

// Fecha en la que le toca el próximo contacto. null = no hay rutina (de baja, o sin frecuencia).
// 1) Si una persona fijó una fecha puntual, esa. 2) Si no, último toque + frecuencia.
// 3) Si todavía no hubo ningún toque, le toca desde el día que se sumó a la cartera.
export function proximoToque(row) {
  if (!row || row.baja_en) return null;
  if (isISO(row.proximo_toque)) return row.proximo_toque;
  const f = normFrecuencia(row.frecuencia_dias);
  if (f === null) return null;
  if (isISO(row.ultimo_toque)) return addDaysISO(row.ultimo_toque, f);
  return createdDay(row);
}

// Estado de la rutina: 'baja' | 'sin_rutina' | 'vencido' | 'esta_semana' | 'al_dia'.
// 'vencido' = ya pasó la fecha. 'esta_semana' = le toca hoy o antes del domingo.
export function estadoToque(row, today) {
  if (!row || row.baja_en) return "baja";
  const p = proximoToque(row);
  if (!p) return "sin_rutina";
  if (p < today) return "vencido";
  if (p <= weekRangeISO(today).hasta) return "esta_semana";
  return "al_dia";
}
export const tocaEstaSemana = (row, today) => { const e = estadoToque(row, today); return e === "vencido" || e === "esta_semana"; };

// Orden de trabajo: primero los vencidos (el más atrasado arriba), después los de la semana, después el resto.
const ORDEN = { vencido: 0, esta_semana: 1, al_dia: 2, sin_rutina: 3, baja: 4 };
export function sortPorUrgencia(rows, today) {
  return [...rows].sort((a, b) => {
    const ea = ORDEN[estadoToque(a, today)], eb = ORDEN[estadoToque(b, today)];
    if (ea !== eb) return ea - eb;
    const pa = proximoToque(a) || "9999", pb = proximoToque(b) || "9999";
    if (pa !== pb) return pa < pb ? -1 : 1;
    return String(a.company_name || "").localeCompare(String(b.company_name || ""), "es", { sensitivity: "base" });
  });
}

// Números del cartel y del encabezado. `userId` (opcional) limita a los clientes de una persona.
export function resumen(rows, today, userId = null) {
  const activos = (rows || []).filter((r) => !r.baja_en && (!userId || r.responsable_id === userId));
  const semana = weekRangeISO(today).desde;
  const vencidos = activos.filter((r) => estadoToque(r, today) === "vencido").length;
  const estaSemana = activos.filter((r) => estadoToque(r, today) === "esta_semana").length;
  const tocados = activos.filter((r) => isISO(r.ultimo_toque) && r.ultimo_toque >= semana).length;
  return {
    total: activos.length, vencidos, estaSemana, toca: vencidos + estaSemana, tocadosSemana: tocados,
    pctTocados: activos.length ? Math.round((tocados / activos.length) * 100) : 0,
    rojos: activos.filter((r) => r.semaforo === "rojo").length,
    sinRespuesta: activos.filter((r) => Number(r.sin_respuesta) >= 2).length,
  };
}

// Link que abre el chat de WhatsApp con ese número (el mensaje lo escribe y lo manda la persona). null si no parece un teléfono.
export function whatsappLink(phone) {
  const digits = String(phone || "").replace(/\D/g, "").replace(/^00/, "");
  return digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}

// Validación del formulario "Registrar toque".
export function validateToque({ canal, resultado, fecha, proximo }, today) {
  const errors = {};
  if (!CANALES.some((c) => c.key === canal)) errors.canal = "Elegí cómo fue el contacto.";
  if (!RESULTADOS.some((r) => r.key === resultado)) errors.resultado = "Elegí si respondió o no.";
  if (!isISO(fecha)) errors.fecha = "La fecha no es válida.";
  else if (fecha > today) errors.fecha = "El toque no puede ser de una fecha futura.";
  if (proximo && !isISO(proximo)) errors.proximo = "La fecha del próximo toque no es válida.";
  return { ok: Object.keys(errors).length === 0, errors };
}

// Clientes sugeridos para sumar a la cartera: dueños (owners) de cuentas no pausadas con un plan pago.
// "Plan pago" = cualquier plan que no sea Freemium, Free trial ni vacío. Una persona confirma la lista antes de agregarlos.
const NO_PAGOS = ["freemium", "freetrial", "free trial", ""];
export function candidatosCartera(users, existingIds = []) {
  const ya = new Set((existingIds || []).map(String));
  const seen = new Set();
  const out = [];
  for (const u of users || []) {
    const id = u && Array.isArray(u.companies) && u.companies[0] ? String(u.companies[0]) : null;
    const plan = (u && u.subscription && u.subscription.subscriptionType) || "";
    if (!id || ya.has(id) || seen.has(id) || !u.isOwner || u.companyStatus === "paused") continue;
    if (NO_PAGOS.includes(String(plan).trim().toLowerCase())) continue;
    seen.add(id);
    out.push({ company_id: id, company_name: u.companyName && u.companyName !== "—" ? u.companyName : (u.name || u.email || "Sin nombre"), contact_name: [u.name, u.surname].filter(Boolean).join(" "), contact_email: u.email || "", contact_phone: u.phoneNumber || "", plan });
  }
  return out.sort((a, b) => a.company_name.localeCompare(b.company_name, "es", { sensitivity: "base" }));
}

// Fila de client_followup a partir de una cuenta de Spicytool (búsqueda manual) o de un candidato.
export function filaDesdeCuenta(c, { responsableId = null, userId = null } = {}) {
  return {
    company_id: String(c.company_id), company_name: String(c.company_name || "").trim() || "Sin nombre",
    contact_name: c.contact_name || null, contact_email: c.contact_email || null, contact_phone: c.contact_phone || null, plan: c.plan || null,
    responsable_id: responsableId, frecuencia_dias: DEFAULT_FRECUENCIA, semaforo: "verde", created_by: userId,
  };
}

const fmtFecha = (iso) => (isISO(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
export { fmtFecha };

// Constancia de contacto: texto plano con todos los intentos, para respaldar una baja ("lo intentamos N veces sin respuesta").
export function buildConstancia(row, touches, today) {
  const list = [...(touches || [])].sort((a, b) => (a.fecha === b.fecha ? String(a.created_at).localeCompare(String(b.created_at)) : a.fecha < b.fecha ? -1 : 1));
  const n = list.length;
  const sin = list.filter((t) => t.resultado === "no_respondio").length;
  const efectivos = list.filter((t) => t.resultado !== "no_respondio");
  const ultimoEfectivo = efectivos.length ? efectivos[efectivos.length - 1].fecha : null;
  let seguidos = 0;
  for (let i = list.length - 1; i >= 0 && list[i].resultado === "no_respondio"; i--) seguidos++;
  const lines = [];
  lines.push(`CONSTANCIA DE CONTACTO — ${row.company_name}`);
  lines.push(`Emitida el ${fmtFecha(today)}`);
  if (row.contact_name || row.contact_email || row.contact_phone) lines.push(`Contacto: ${[row.contact_name, row.contact_email, row.contact_phone].filter(Boolean).join(" · ")}`);
  lines.push("");
  if (!n) {
    lines.push("Todavía no hay intentos de contacto registrados.");
    return lines.join("\n");
  }
  lines.push(`Período: ${fmtFecha(list[0].fecha)} al ${fmtFecha(list[n - 1].fecha)}`);
  lines.push(`Intentos de contacto: ${n} (${sin} sin respuesta, ${n - sin} con respuesta)`);
  lines.push(seguidos ? `Intentos seguidos sin respuesta al día de hoy: ${seguidos}` : "El último contacto tuvo respuesta.");
  lines.push(`Último contacto con respuesta: ${ultimoEfectivo ? fmtFecha(ultimoEfectivo) : "ninguno"}`);
  lines.push("");
  lines.push("Detalle:");
  for (const t of list) {
    const quien = String(t.author_email || "").split("@")[0];
    lines.push(`- ${fmtFecha(t.fecha)} · ${canalLabel(t.canal)} · ${resultadoInfo(t.resultado).label}${t.nota ? ` · ${String(t.nota).replace(/\s+/g, " ").trim()}` : ""}${quien ? ` (${quien})` : ""}`);
  }
  return lines.join("\n");
}

// Escapa texto para meterlo en HTML (la constancia se imprime en una ventana aparte).
export const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
