// Cliente del asistente de IA: llama a la Edge Function `crm-ai` (la key de Anthropic vive en el servidor).
export const AI_SUG = ["¿Qué deals tengo que empujar esta semana y por qué?", "¿Cómo vengo contra la meta y qué necesito cerrar para llegar?", "¿Qué clientes están en riesgo o tienen hitos cerca?", "Armame el plan de mañana con mis tareas y follow-ups", "¿Dónde se me traban los deals y qué cambiarías?"];

const MESSAGES = {
  forbidden: "No tenés acceso al CRM para usar el asistente.",
  no_key: "El asistente todavía no está configurado (falta la ANTHROPIC_API_KEY en Supabase).",
  rate_limited: "Llegaste al límite de uso por ahora. Probá de nuevo en un rato.",
  too_large: "Hay demasiados datos para el asistente.",
  bad_model_output: "No pude interpretar la respuesta. Probá de nuevo.",
  upstream_error: "No pude responder. Probá de nuevo.",
  bad_request: "No pude armar el pedido. Probá de nuevo.",
  not_deployed: "El asistente todavía no está instalado (falta desplegar la función crm-ai en Supabase).",
};
export const aiErrorMessage = (code) => MESSAGES[code] || MESSAGES.upstream_error;

// body: { mode: 'chat'|'brief'|'paste'|'next', ... } -> { text } | { json } ; si falla lanza Error con .code
export async function callAi(sb, body) {
  const { data, error } = await sb.functions.invoke("crm-ai", { body });
  if (error) {
    let code = "upstream_error";
    try { const j = await error.context.json(); if (j && j.error) code = j.error; } catch { /* sin detalle */ }
    if (error.context && error.context.status === 404) code = "not_deployed";
    const e = new Error(aiErrorMessage(code)); e.code = code; throw e;
  }
  if (!data || data.error) { const e = new Error(aiErrorMessage(data && data.error)); e.code = data && data.error; throw e; }
  return data;
}
