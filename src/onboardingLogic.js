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
  const { etapa_actual, integraciones_pendientes, bloqueado, fecha_registro, fecha_entrada_etapa_actual } = record;

  if (etapa_actual === "Aha confirmado") {
    return (integraciones_pendientes && integraciones_pendientes.length > 0) ? "revisar" : "ok";
  }
  if (etapa_actual === "Spicy Finalizado") return "esperando aha";
  if (bloqueado) return "bloqueado";
  if (!fecha_entrada_etapa_actual) return "sin fecha";

  const diasDesdeRegistro = diasEntre(fecha_registro, hoy);
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
  bloqueado:         { label: "Bloqueado",        color: "#EF3E3E", bg: "#FEF0F0" },
  "sin fecha":        { label: "Sin fecha",        color: "#9CA3AF", bg: "#F4F4F5" },
  "atrasado general": { label: "Atrasado",         color: "#EF3E3E", bg: "#FEF0F0" },
  amarillo:          { label: "En curso",         color: "#D97706", bg: "#FEF3C7" },
  verde:             { label: "A tiempo",         color: "#16A34A", bg: "#EDFAF3" },
  rojo:              { label: "Atrasado",         color: "#EF3E3E", bg: "#FEF0F0" },
};
