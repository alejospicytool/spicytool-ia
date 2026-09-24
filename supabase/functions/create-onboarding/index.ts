// Webhook para crear un cliente nuevo en Onboarding desde afuera (n8n, un
// chatbot, un formulario de registro, etc.).
// Deploy: Supabase Dashboard → Edge Functions → Create function → "create-onboarding"
// → pegar este código → ANTES de deployar, reemplazar WEBHOOK_SECRET de abajo
// por un valor real (el mismo o distinto al de create-ticket/create-task, a
// gusto — no lo dejes en git) → Deploy. En Settings de la función, desactivar
// "Enforce JWT Verification" si querés llamarla solo con el secret de abajo
// (si la dejás activada, además del header x-webhook-secret hay que mandar
// Authorization: Bearer <anon key> y apikey: <anon key>).
//
// Body esperado (JSON):
// {
//   "client_name": "Nombre del cliente" (obligatorio),
//   "fecha_registro": "2026-09-23" (opcional, default: hoy),
//   "responsable": "Nico" | "Ticiana" | "Lucas" (opcional),
//   "fuente_de_leads": ["Meta Ads", "Tokko"] (opcional, subset de Meta Ads/Tokko/EasyBroker/WhatsApp/Tera),
//   "bloqueado": false (opcional, default false)
// }
// Header: x-webhook-secret: <WEBHOOK_SECRET>
//
// La etapa siempre arranca en "Crear cuenta" (la primera de las 8) — no se
// puede elegir por webhook, mantiene consistencia con el flujo real. Ese
// primer registro en onboarding_stage_history NO dispara el webhook de
// cambio de etapa (esa es la regla: solo dispara en cambios posteriores).

import { createClient } from "npm:@supabase/supabase-js@2";

const WEBHOOK_SECRET = "REPLACE_WITH_YOUR_SECRET";
const PRIMERA_ETAPA = "Crear cuenta";
const FUENTES_VALIDAS = ["Meta Ads", "Tokko", "EasyBroker", "WhatsApp", "Tera"];

function json(obj: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-webhook-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405, cors);

  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return json({ error: "unauthorized" }, 401, cors);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json body" }, 400, cors);
  }

  const client_name = typeof body?.client_name === "string" ? body.client_name.trim() : "";
  if (!client_name) return json({ error: "client_name es obligatorio" }, 400, cors);

  const fecha_registro = typeof body?.fecha_registro === "string" && body.fecha_registro ? body.fecha_registro : todayISO();
  const responsable = typeof body?.responsable === "string" ? body.responsable.trim() || null : null;
  const bloqueado = body?.bloqueado === true;
  const fuente_de_leads = Array.isArray(body?.fuente_de_leads)
    ? body.fuente_de_leads.filter((s: unknown) => FUENTES_VALIDAS.includes(s as string))
    : [];

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const id = "ob_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

  const { data, error } = await supabase
    .from("onboarding")
    .insert({
      id,
      client_name,
      etapa_actual: PRIMERA_ETAPA,
      fecha_registro,
      fecha_entrada_etapa_actual: fecha_registro,
      responsable,
      bloqueado,
      fuente_de_leads,
      estado_de_pago: "No Cobrado",
    })
    .select()
    .single();

  if (error) return json({ error: error.message }, 500, cors);

  await supabase.from("onboarding_stage_history").insert({
    id: "oh_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    onboarding_id: id,
    etapa: PRIMERA_ETAPA,
    fecha_entrada: fecha_registro,
  });

  return json({ ok: true, onboarding: data }, 200, cors);
});
