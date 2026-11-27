// Lógica de negocio del módulo de Onboarding — separada de App.jsx a propósito,
// es la única parte del repo que necesita testearse de forma aislada.

export const ONBOARDING_STAGES = [
  { key: "Crear cuenta",       quien: "Cliente" },
  { key: "Crear company",      quien: "Cliente" },
  { key: "Crear Pipeline",     quien: "Equipo" },
  { key: "Conectar WhatsApp",  quien: "Cliente" },
  { key: "Templates WhatsApp", quien: "Equipo" },
  { key: "Workflow",           quien: "Equipo" },
  { key: "Spicy Finalizado",   quien: "Equipo" },
  { key: "Aha confirmado",     quien: "Cliente" },
];

export const ONBOARDING_LEAD_SOURCES = ["Meta Ads", "Tokko", "EasyBroker", "WhatsApp", "Tera"];
export const ONBOARDING_PAYMENT_STATUS = ["Cobrado", "No Cobrado"];

export const ONBOARDING_THRESHOLDS = {
  ATRASADO_GENERAL_DIAS: 20,
  CLIENTE_ETAPA_DIAS: 3,
  EQUIPO_ETAPA_DIAS: 5,
};

// Días transcurridos entre una fecha ISO (YYYY-MM-DD) y "hoy". null si no hay fecha.
export function diasEntre(fechaISO, hoy = new Date()) {
  if (!fechaISO) return null;
  const inicio = new Date(fechaISO + "T00:00:00");
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.floor((fin - inicio) / 86400000);
}

// (posición de la etapa en la lista, 1-indexed) / cantidad total de etapas → 0 a 1.
export function calcularAvance(etapaActual) {
  const idx = ONBOARDING_STAGES.findIndex(s => s.key === etapaActual);
  if (idx === -1) return 0;
  return (idx + 1) / ONBOARDING_STAGES.length;
}

function quienEjecuta(etapaActual) {
  return ONBOARDING_STAGES.find(s => s.key === etapaActual)?.quien || null;
}

// Evalúa las reglas en orden, gana la primera que se cumple.
export function calcularEstado(record, hoy = new Date()) {
  const { etapa_actual, integraciones_pendientes, bloqueado, fecha_entrada_etapa_actual } = record;

  if (etapa_actual === "Aha confirmado") {
    return (integraciones_pendientes && integraciones_pendientes.length > 0) ? "revisar" : "ok";
  }
  if (etapa_actual === "Spicy Finalizado") return "esperando aha";
  if (record.pausa_desde) return "en pausa"; // esperando al cliente: no es atraso nuestro (gana sobre "bloqueado" y sobre los días)
  if (bloqueado) return "bloqueado";
  if (!fecha_entrada_etapa_actual) return "sin fecha";

  const diasDesdeRegistro = diasRegistroActivos(record, hoy);
  if (diasDesdeRegistro != null && diasDesdeRegistro > ONBOARDING_THRESHOLDS.ATRASADO_GENERAL_DIAS) {
    return "atrasado general";
  }

  const diasEnEtapa = diasEntre(fecha_entrada_etapa_actual, hoy);
  const quien = quienEjecuta(etapa_actual);
  if (quien === "Cliente") return diasEnEtapa > ONBOARDING_THRESHOLDS.CLIENTE_ETAPA_DIAS ? "amarillo" : "verde";
  if (quien === "Equipo") return diasEnEtapa > ONBOARDING_THRESHOLDS.EQUIPO_ETAPA_DIAS ? "rojo" : "verde";
  return "sin fecha";
}

// Cómo mostrar cada valor de calcularEstado() en la UI.
export const ESTADO_BADGE = {
  ok:                { label: "OK",              color: "#16A34A", bg: "#EDFAF3" },
  revisar:           { label: "Revisar",         color: "#D97706", bg: "#FEF3C7" },
  "esperando aha":    { label: "Esperando aha",   color: "#5B5B63", bg: "#F4F4F5" },
  "en pausa":         { label: "En pausa",        color: "#533AB7", bg: "#F1EEFB" },
  bloqueado:         { label: "Bloqueado",        color: "#EF3E3E", bg: "#FEF0F0" },
  "sin fecha":        { label: "Sin fecha",        color: "#9CA3AF", bg: "#F4F4F5" },
  "atrasado general": { label: "Atrasado",         color: "#EF3E3E", bg: "#FEF0F0" },
  amarillo:          { label: "En curso",         color: "#D97706", bg: "#FEF3C7" },
  verde:             { label: "A tiempo",         color: "#16A34A", bg: "#EDFAF3" },
  rojo:              { label: "Atrasado",         color: "#EF3E3E", bg: "#FEF0F0" },
};

// ── Vínculo con la cuenta de Spicytool ────────────────────────────────────────────────────────────
// El onboarding guarda el id de la company de Spicytool (no el email: el del CRM suele ser otro). Lo elige una persona
// en un buscador; esto solo da forma a cada resultado para mostrarlo y guardarlo.
export function companyOption(c) {
  if (!c || !c._id) return null;
  return { id: String(c._id), name: String(c.name || "").trim() || "Sin nombre", email: c.userEmail ? String(c.userEmail) : "", phone: c.phoneNumber ? String(c.phoneNumber) : "" };
}

// Texto que se busca por defecto: el nombre del cliente tal cual, sin espacios de más.
export const defaultCompanySearch = (clientName) => String(clientName || "").trim().replace(/\s+/g, " ");

// ── Próximo paso (recordatorio por cliente) ──────────────────────────────────────────────────────
// Cada cliente puede tener UN próximo paso: qué hay que hacer (texto corto), para qué día y quién. Los tres van juntos o no hay ninguno.
// Todo lo de abajo es puro (sin pantalla ni base) para poder probarlo.
export const PASO_MIN = 3;
export const PASO_MAX = 200;
export const ETAPAS_SIN_PASO = ["Spicy Finalizado", "Aha confirmado"]; // ya no hay nada del equipo por hacer: no se marca "sin próximo paso"

const pad2 = (n) => String(n).padStart(2, "0");
// Date → "YYYY-MM-DD" con la fecha LOCAL (toISOString la correría de día a la noche).
export const isoLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const fmtDiaMes = (iso) => { const p = String(iso || "").split("-"); return p.length === 3 ? `${p[2]}/${p[1]}` : ""; };
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

// Fecha real en formato YYYY-MM-DD (rechaza 2026-02-31).
export function esFechaISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  if (!m) return false;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3];
}

// Atajos de fecha del formulario: hoy, mañana, en 3 días, el próximo lunes y en una semana.
export function atajosFecha(hoy = new Date()) {
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const mas = (n) => { const d = new Date(base); d.setDate(d.getDate() + n); return isoLocal(d); };
  const alLunes = ((8 - base.getDay()) % 7) || 7; // 1..7 días hasta el próximo lunes (si hoy es lunes, el de la semana que viene)
  return [
    { label: "Hoy", iso: mas(0) }, { label: "Mañana", iso: mas(1) }, { label: "En 3 días", iso: mas(3) },
    { label: "El lunes", iso: mas(alLunes) }, { label: "En 1 semana", iso: mas(7) },
  ];
}

// Valida lo que se escribió. Devuelve { value: { proximo_paso, proximo_paso_fecha, proximo_paso_quien } } o { error }.
export function validarPaso({ texto, fecha, quien } = {}) {
  const t = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (t.length < PASO_MIN) return { error: "Escribí qué hay que hacer (al menos " + PASO_MIN + " letras)." };
  if (t.length > PASO_MAX) return { error: "Quedó muy largo: máximo " + PASO_MAX + " letras. El detalle va en las notas." };
  if (!esFechaISO(fecha)) return { error: "Elegí para qué día." };
  return { value: { proximo_paso: t, proximo_paso_fecha: fecha, proximo_paso_quien: String(quien || "").trim() || null } };
}

export const tienePaso = (r) => !!(r && r.proximo_paso && r.proximo_paso_fecha);
export const quienDelPaso = (r) => (r && (r.proximo_paso_quien || r.responsable)) || "";
export const PASO_VACIO = { proximo_paso: null, proximo_paso_fecha: null, proximo_paso_quien: null };

// Cómo está el paso respecto de hoy: { kind: "vencido"|"hoy"|"manana"|"futuro", dias } (dias = cuántos días de atraso, o cuántos faltan). null si no hay paso.
export function estadoPaso(r, hoy = new Date()) {
  if (!tienePaso(r)) return null;
  const atraso = diasEntre(r.proximo_paso_fecha, hoy); // >0: pasó hace N días · 0: hoy · <0: faltan
  if (atraso > 0) return { kind: "vencido", dias: atraso };
  if (atraso === 0) return { kind: "hoy", dias: 0 };
  if (atraso === -1) return { kind: "manana", dias: 1 };
  return { kind: "futuro", dias: -atraso };
}

// Etiqueta corta y color para mostrar el paso (tarjeta, tabla, Inicio).
export const PASO_TONOS = {
  red:   { color: "#EF3E3E", bg: "#FEF0F0" },
  amber: { color: "#D97706", bg: "#FEF3C7" },
  gray:  { color: "#5B5B63", bg: "#F4F4F5" },
};
export function chipPaso(r, hoy = new Date()) {
  const e = estadoPaso(r, hoy);
  if (!e) return null;
  if (e.kind === "vencido") return { ...e, label: `Vencido hace ${e.dias} día${e.dias === 1 ? "" : "s"}`, tone: "red" };
  if (e.kind === "hoy") return { ...e, label: "Hoy", tone: "amber" };
  if (e.kind === "manana") return { ...e, label: "Mañana", tone: "gray" };
  return { ...e, label: e.dias <= 6 ? `En ${e.dias} días` : `El ${fmtDiaMes(r.proximo_paso_fecha)}`, tone: "gray" };
}

// ¿Hay que avisar? Solo si el paso es de hoy o está vencido.
export const pasoParaHoy = (r, hoy = new Date()) => { const e = estadoPaso(r, hoy); return !!e && (e.kind === "vencido" || e.kind === "hoy"); };

// Un cliente en curso sin ningún próximo paso cargado (para marcarlo en el Kanban).
export const sinPaso = (r) => !!r && !tienePaso(r) && !r.pausa_desde && !ETAPAS_SIN_PASO.includes(r.etapa_actual);

// ¿El paso es de esta persona? El responsable se guarda como nombre ("Nico"), no como usuario: se compara con el nombre o el mail de quien está conectado
// ("Nico" coincide con "Nicolás" o con nicolas@…). Sin nombre no es de nadie.
export function esMio(r, me) {
  const n = norm(quienDelPaso(r));
  if (!n || !me) return false;
  const first = norm(me.first_name), local = norm(String(me.email || "").split("@")[0]);
  return (!!first && (first === n || first.startsWith(n) || n.startsWith(first))) || (!!local && local.startsWith(n));
}

// Los pasos de hoy o vencidos, del más atrasado al más nuevo. `filtro` es opcional (por ejemplo, solo los míos).
export function pasosParaHacer(clientes, hoy = new Date(), filtro = null) {
  return (clientes || []).filter((r) => pasoParaHoy(r, hoy) && (!filtro || filtro(r)))
    .sort((a, b) => a.proximo_paso_fecha.localeCompare(b.proximo_paso_fecha) || String(a.client_name || "").localeCompare(String(b.client_name || ""), "es"));
}

// Texto de la nota que queda en el cliente cuando se marca hecho.
export const notaPasoHecho = (r) => `✓ Paso hecho: ${r.proximo_paso}${r.proximo_paso_fecha ? " (era para el " + fmtDiaMes(r.proximo_paso_fecha) + ")" : ""}`;

// ── En pausa (esperando al cliente) ──────────────────────────────────────────────────────────────
// Para cuando la demora no es nuestra (el cliente cambió el nombre de la empresa, no armó el portfolio…). Mientras está en pausa el cliente no figura
// como atrasado y esos días no cuentan: ni los de la etapa ni los del atraso general. Quién la puso y por qué queda en las notas del cliente.
export const PAUSA_MIN = 3;
export const PAUSA_MAX = 200;
export const PAUSA_VACIA = { pausa_desde: null, pausa_motivo: null };
export const enPausa = (r) => !!(r && r.pausa_desde);

const sumarDias = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return isoLocal(new Date(y, m - 1, d + n)); };
const plural = (n) => `${n} día${n === 1 ? "" : "s"}`;

// Días que lleva en la pausa actual (0 si no está en pausa).
export const diasEnPausa = (r, hoy = new Date()) => (enPausa(r) ? Math.max(0, diasEntre(r.pausa_desde, hoy) ?? 0) : 0);

// Días desde el registro sin contar el tiempo en pausa (el de pausas anteriores y el de la actual). null si no hay fecha de registro.
export function diasRegistroActivos(r, hoy = new Date()) {
  const d = diasEntre(r && r.fecha_registro, hoy);
  if (d == null) return null;
  return Math.max(0, d - (Number(r.pausa_dias_acum) || 0) - diasEnPausa(r, hoy));
}

// Pone (o actualiza) la pausa. Devuelve { patch, nota } para guardar y anotar, o { error }.
// `revisar` (opcional, día) crea el recordatorio "Revisar pausa: …" como próximo paso del cliente: reemplaza el que tuviera.
export function armarPausa(r, { motivo, revisar = "", quien = "" } = {}, hoy = new Date()) {
  const m = String(motivo ?? "").replace(/\s+/g, " ").trim();
  if (m.length < PAUSA_MIN) return { error: "Contá en una línea por qué está en pausa (al menos " + PAUSA_MIN + " letras)." };
  if (m.length > PAUSA_MAX) return { error: "Quedó muy largo: máximo " + PAUSA_MAX + " letras. El detalle va en las notas." };
  const hoyISO = isoLocal(hoy);
  const yaEstaba = enPausa(r);
  const patch = { pausa_desde: yaEstaba ? r.pausa_desde : hoyISO, pausa_motivo: m };
  if (revisar) {
    if (!esFechaISO(revisar)) return { error: "La fecha para revisarlo no es válida." };
    if (revisar < hoyISO) return { error: "La fecha para revisarlo no puede ser anterior a hoy." };
    patch.proximo_paso = ("Revisar pausa: " + m).slice(0, PASO_MAX);
    patch.proximo_paso_fecha = revisar;
    patch.proximo_paso_quien = String(quien || "").trim() || null;
  }
  return { patch, nota: yaEstaba ? `⏸ Motivo de la pausa actualizado: ${m}` : `⏸ En pausa (esperando al cliente): ${m}${revisar ? " · se revisa el " + fmtDiaMes(revisar) : ""}` };
}

// Saca de la pausa. Suma los días a lo acumulado y corre la fecha de entrada a la etapa para que esos días no cuenten como demora.
export function armarRetomar(r, hoy = new Date()) {
  if (!enPausa(r)) return { error: "Este cliente no está en pausa." };
  const dias = diasEnPausa(r, hoy);
  const patch = { pausa_desde: null, pausa_motivo: null, pausa_dias_acum: (Number(r.pausa_dias_acum) || 0) + dias };
  if (r.fecha_entrada_etapa_actual) {
    // Solo cuentan los días en pausa DENTRO de la etapa actual (si cambió de etapa durante la pausa, desde que entró a la nueva).
    const desde = r.fecha_entrada_etapa_actual > r.pausa_desde ? r.fecha_entrada_etapa_actual : r.pausa_desde;
    const enEtapa = Math.max(0, diasEntre(desde, hoy) ?? 0);
    patch.fecha_entrada_etapa_actual = sumarDias(r.fecha_entrada_etapa_actual, enEtapa);
  }
  return { patch, dias, nota: `▶ Retomado ${dias === 0 ? "el mismo día" : "después de " + plural(dias) + " en pausa"} (motivo: ${r.pausa_motivo})` };
}

// "En pausa hace 12 días" / "En pausa desde hoy".
export const textoPausa = (r, hoy = new Date()) => { const d = diasEnPausa(r, hoy); return d === 0 ? "En pausa desde hoy" : `En pausa hace ${plural(d)}`; };
