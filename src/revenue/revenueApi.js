// Llamadas a la Edge Function revenue-sync y lectura paginada de las tablas rev_*.
const ERRORS = {
  forbidden: "No tenés permiso (solo admins).",
  planes_sin_clasificar: "Todavía hay planes sin clasificar. Clasificalos en la pestaña Planes y volvé a intentar.",
  baseline_ya_hecho: "La carga inicial ya se hizo (es de una sola vez).",
  sin_carga_inicial: "Primero hay que hacer la carga inicial.",
  monto_invalido: "El monto no es válido.", intervalo_invalido: "El intervalo no es válido.", estado_invalido: "El estado no es válido.",
  cliente_requerido: "Falta el nombre del cliente.", cliente_invalido: "Cliente inválido.", plan_inexistente: "Elegí un plan válido.", suscripcion_invalida: "Esa suscripción no se puede editar a mano.",
};

export async function callFn(sb, route, body) {
  const { data, error } = await sb.functions.invoke("revenue-sync/" + route, { body: body || {} });
  if (error) {
    let code = "error";
    try { const j = await error.context.json(); code = j.error || code; } catch { /* sin detalle */ }
    if (error.context && error.context.status === 404) throw new Error("La función revenue-sync todavía no está subida en Supabase.");
    throw new Error(ERRORS[code] || "No se pudo completar (" + code + ").");
  }
  return data;
}

export async function fetchAll(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if ((data || []).length < 1000) return out;
  }
}
