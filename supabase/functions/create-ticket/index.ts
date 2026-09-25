// Webhook para crear tickets desde afuera (n8n, un chatbot, Zapier, etc.).
// Deploy: Supabase Dashboard → Edge Functions → Create function → "create-ticket"
// → pegar este código → ANTES de deployar, reemplazar WEBHOOK_SECRET de abajo
// por el valor real (te lo paso aparte, no lo dejes en git) → Deploy.
// En Settings de la función, desactivar "Enforce JWT Verification" si querés
// llamarla solo con el secret de abajo (si la dejás activada, además del
// header x-webhook-secret hay que mandar Authorization: Bearer <anon key> y
// apikey: <anon key>).
//
// Body esperado (JSON):
// {
//   "client_name": "Nombre del cliente" (obligatorio),
//   "category": "Bloqueante" | "Funcional" | "Duda de uso" | "Mejora" | "Administrativo" (obligatorio),
//   "channel": "WhatsApp" | "Email" (default: "WhatsApp"),
//   "priority": "Alta" | "Media" | "Baja" (default: "Media"),
//   "message": "texto libre" (opcional),
//   "assigned_to": nombre del responsable (opcional, texto libre)
// }
// El ticket nace sin puntaje Fibonacci (fibonacci_score), como cualquier ticket nuevo.
// Header: x-webhook-secret: <WEBHOOK_SECRET>

import { createClient } from "npm:@supabase/supabase-js@2";

const WEBHOOK_SECRET = "REPLACE_WITH_YOUR_SECRET";
const CATEGORIES = ["Bloqueante", "Funcional", "Duda de uso", "Mejora", "Administrativo"];
const PRIORITIES = ["Alta", "Media", "Baja"];
const CHANNELS = ["WhatsApp", "Email"];

function json(obj: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
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
  const category = body?.category;
  const channel = CHANNELS.includes(body?.channel) ? body.channel : "WhatsApp";
  const priority = PRIORITIES.includes(body?.priority) ? body.priority : "Media";

  if (!client_name) return json({ error: "client_name es obligatorio" }, 400, cors);
  if (!CATEGORIES.includes(category)) {
    return json({ error: `category debe ser una de: ${CATEGORIES.join(", ")}` }, 400, cors);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("tickets")
    .insert({
      id: "tk_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      client_name,
      category,
      priority,
      channel,
      message: typeof body?.message === "string" ? body.message.trim() || null : null,
      assigned_to: typeof body?.assigned_to === "string" ? body.assigned_to.trim() || null : null,
      status: "Inicio por OPS",
    })
    .select()
    .single();

  if (error) return json({ error: error.message }, 500, cors);

  await supabase.from("ticket_status_history").insert({
    id: "tsh_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    ticket_id: data.id,
    status: "Inicio por OPS",
    changed_by: "webhook",
  });

  return json({ ok: true, ticket: data }, 200, cors);
});
