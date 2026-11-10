// Asistente de IA del CRM comercial ("Pegar conversación", "Resumen de hoy", "Sugerir siguiente paso" y el
// panel ✦ Asistente). El navegador NUNCA ve la key de Anthropic: la llama este servidor.
//
// DEPLOY (Supabase Dashboard → Edge Functions → Create function → "crm-ai" → pegar este archivo):
//   1. Settings de la función: dejar activada "Enforce JWT Verification" (solo entra gente logueada).
//   2. Edge Functions → Secrets: agregar  ANTHROPIC_API_KEY = <tu key>   (opcional: CRM_AI_MODEL).
//   3. Deploy. El front la llama con sb.functions.invoke("crm-ai", { body }).
// Además de la sesión, exige acceso al CRM (rpc has_crm_access): admin o sección "CRM".
// Los prompts son los del HTML original (_import/crm-comercial-spicytool.html).

export const AI_RULES = 'Sos el asistente comercial del CRM de Spicytool, un software comercial para inmobiliarias y desarrolladoras (agente conversacional con IA, CRM, portales y automatizaciones) que se vende por suscripción mensual. Hablás con Hernán, cofundador, que lleva las ventas. Respondé en español rioplatense con voseo, directo y breve, como un colega de ventas con experiencia: primero la respuesta, después el porqué. Usá solo los datos del CRM que van abajo; si algo no está, decilo y no lo inventes. Nombrá deals y clientes concretos. Montos en USD. Formato: párrafos cortos y, cuando sirva, viñetas que empiecen con "- ". Podés usar **negrita** para lo clave. No uses tablas ni títulos.';

export const BRIEF_Q = (hoy: string) => "Hoy es " + hoy + ". Decime en 3 o 4 viñetas qué es lo más importante para hacer hoy, en orden de prioridad, con nombres concretos y el porqué en pocas palabras. Pensá en demos, follow-ups vencidos, deals frenados, firmados sin pagar y la meta de MRR. Sin introducción.";

export const PASTE_PROMPT = (ctx: unknown, txt: string) => 'Sos el asistente comercial del CRM de Spicytool, un software para inmobiliarias y desarrolladoras. Leé la conversación con un lead y armá los datos del deal. Valores permitidos y contexto (JSON):\n' + JSON.stringify(ctx) +
  '\n\nConversación (entre las líneas ---):\n---\n' + txt.slice(0, 12000) + '\n---\n\nRespondé SOLO un objeto JSON con estas claves: "empresa" (nombre de la inmobiliaria o desarrolladora; si no aparece, el nombre del contacto), "contacto" (nombre de la persona), "telefono" (en formato internacional con +, o ""), "pais" (uno de paises o ""), "tipoCuenta" (uno de tiposDeCuenta o ""), "origen" (uno de origenes o ""), "partner" (uno de partners si lo menciona, o ""), "etiquetas" (lista con nombres exactos de etiquetasPorGrupo que se deduzcan con claridad: tamaño del equipo, CRM que usan, intereses), "mrrEstimado" (número solo si se habló de precio, si no null), "etapa" (id de etapasAbiertas: si es una reserva de demo, la etapa de demo agendada; si no, la que corresponda), "proxima" (objeto con "accion" de máximo 6 palabras, preferentemente una de accionesRapidas, "tipo" ("reunion" para demos o reuniones, si no "followup"), "fecha" YYYY-MM-DD y "hora" HH:MM en UTC-3; si es una reserva de Cal.com usá la fecha y hora de la reserva convertida a UTC-3 y la acción "Hacer demo"; si no hay un próximo paso claro, proponé un follow-up el próximo día hábil a las 10:00), "resumen" (2 a 4 líneas en español con lo importante: qué buscan, tamaño, qué usan hoy, timing, objeciones), "esReservaDeDemo" (true o false). No inventes datos que no estén en la conversación.';

export const NEXT_PROMPT = (info: unknown) => AI_RULES + "\n\nAnalizá este deal y proponé el siguiente paso concreto para avanzarlo. Datos del deal (JSON):\n" + JSON.stringify(info) +
  '\n\nRespondé SOLO con un objeto JSON con estas claves: "analisis" (2 o 3 oraciones: dónde está el deal y qué lo traba), "accion" (la próxima acción, máximo 6 palabras), "tipo" ("followup" o "reunion"), "fecha" (YYYY-MM-DD, hoy o después), "hora" (HH:MM entre 09:00 y 18:00), "mensaje" (un WhatsApp listo para mandarle al contacto, en voseo, cálido y concreto, máximo 450 caracteres, sin firma).';

const MAX_BODY_CHARS = 200_000;
const MAX_TURNS = 9;
const MAX_MSG_CHARS = 4000;
const RATE_MAX = 30;        // pedidos
const RATE_WINDOW_MS = 10 * 60 * 1000; // por persona cada 10 minutos

export type Plan = { json: boolean; system?: string; messages: { role: "user" | "assistant"; content: string }[]; maxTokens: number };

// Valida el pedido y arma lo que se le manda a Claude. Devuelve { error } si es inválido.
export function buildPlan(body: any): Plan | { error: string } {
  if (!body || typeof body !== "object") return { error: "bad_request" };
  const isObj = (x: unknown) => !!x && typeof x === "object";
  if (body.mode === "chat") {
    if (!isObj(body.data) || !Array.isArray(body.messages)) return { error: "bad_request" };
    let turns = body.messages.filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, MAX_MSG_CHARS) })).slice(-MAX_TURNS);
    while (turns.length && turns[0].role !== "user") turns.shift();
    if (!turns.length || turns[turns.length - 1].role !== "user") return { error: "bad_request" };
    turns[0] = { role: "user", content: "Datos del CRM (JSON):\n" + JSON.stringify(body.data) + "\n\nPregunta: " + turns[0].content };
    return { json: false, system: AI_RULES, messages: turns, maxTokens: 1024 };
  }
  if (body.mode === "brief") {
    if (!isObj(body.data) || typeof body.hoy !== "string") return { error: "bad_request" };
    return { json: false, system: AI_RULES, messages: [{ role: "user", content: "Datos del CRM (JSON):\n" + JSON.stringify(body.data) + "\n\n" + BRIEF_Q(body.hoy.slice(0, 10)) }], maxTokens: 700 };
  }
  if (body.mode === "paste") {
    if (typeof body.text !== "string" || body.text.trim().length < 10 || !isObj(body.context)) return { error: "bad_request" };
    return { json: true, messages: [{ role: "user", content: PASTE_PROMPT(body.context, body.text) }], maxTokens: 900 };
  }
  if (body.mode === "next") {
    if (!isObj(body.info)) return { error: "bad_request" };
    return { json: true, messages: [{ role: "user", content: NEXT_PROMPT(body.info) }], maxTokens: 700 };
  }
  return { error: "bad_request" };
}

// Saca el objeto JSON de la respuesta (a veces viene entre ``` o con texto alrededor)
export function extractJson(text: string): unknown | null {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(text.slice(a, b + 1)); } catch { return null; }
}

const hits = new Map<string, number[]>();
export function rateLimited(key: string, now = Date.now()): boolean {
  const arr = (hits.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) { hits.set(key, arr); return true; }
  arr.push(now); hits.set(key, arr);
  return false;
}
export function resetRateLimit() { hits.clear(); }

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS } });
function userKey(req: Request): string {
  try { const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").split(".")[1]; return JSON.parse(atob(t.replace(/-/g, "+").replace(/_/g, "/"))).sub || "anon"; } catch { return "anon"; }
}

export type Deps = {
  apiKey: string | undefined;
  model: string;
  hasAccess: (req: Request) => Promise<boolean>;
  callClaude: (payload: Record<string, unknown>, apiKey: string) => Promise<{ status: number; body: any }>;
};

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  if (!deps.apiKey) return reply({ error: "no_key" }, 500);
  if (!(await deps.hasAccess(req))) return reply({ error: "forbidden" }, 403);
  const raw = await req.text();
  if (raw.length > MAX_BODY_CHARS) return reply({ error: "too_large" }, 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return reply({ error: "bad_request" }, 400); }
  const plan = buildPlan(body);
  if ("error" in plan) return reply({ error: plan.error }, 400);
  if (rateLimited(userKey(req))) return reply({ error: "rate_limited" }, 429);
  const payload: Record<string, unknown> = { model: deps.model, max_tokens: plan.maxTokens, messages: plan.messages };
  if (plan.system) payload.system = plan.system;
  let r;
  try { r = await deps.callClaude(payload, deps.apiKey); } catch { return reply({ error: "upstream_error" }, 502); }
  if (r.status === 429) return reply({ error: "rate_limited" }, 429);
  if (r.status < 200 || r.status >= 300) return reply({ error: "upstream_error" }, 502);
  const text = (r.body?.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  if (!plan.json) return reply({ text });
  const json = extractJson(text);
  return json ? reply({ json }) : reply({ error: "bad_model_output" }, 502);
}

// Solo corre dentro de Supabase (en los tests no existe Deno)
declare const Deno: any;
if (typeof Deno !== "undefined" && Deno.serve) {
  Deno.serve((req: Request) => handle(req, {
    apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
    model: Deno.env.get("CRM_AI_MODEL") || "claude-sonnet-5-5",
    hasAccess: async (r: Request) => {
      const auth = r.headers.get("authorization");
      if (!auth) return false;
      const { createClient } = await import("npm:@supabase/supabase-js@2");
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
      const { data, error } = await sb.rpc("has_crm_access");
      return !error && data === true;
    },
    callClaude: async (payload: Record<string, unknown>, apiKey: string) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify(payload) });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    },
  }));
}
