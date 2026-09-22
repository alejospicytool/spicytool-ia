// Webhook para crear tareas desde afuera (n8n, un chatbot, Zapier, etc.).
// Deploy: Supabase Dashboard → Edge Functions → Create function → "create-task"
// → pegar este código → ANTES de deployar, reemplazar WEBHOOK_SECRET de abajo
// por el valor real (el mismo o distinto al de create-ticket, a gusto) →
// Deploy. En Settings de la función, desactivar "Enforce JWT Verification"
// si querés llamarla solo con el secret de abajo (si la dejás activada,
// además del header x-webhook-secret hay que mandar Authorization: Bearer
// <anon key> y apikey: <anon key>).
//
// Body esperado (JSON):
// {
//   "title": "Nombre de la tarea" (obligatorio),
//   "start_date": "2026-09-20" (opcional, default: hoy),
//   "end_date": "2026-09-22" (opcional, default: igual a start_date),
//   "assigned_to": "Nico" | "Ticiana" | "Lucas" (opcional),
//   "priority": "Alta" | "Media" | "Baja" (default: "Media"),
//   "description": "texto libre" (opcional)
// }
// Header: x-webhook-secret: <WEBHOOK_SECRET>

import { createClient } from "npm:@supabase/supabase-js@2";

const WEBHOOK_SECRET = "REPLACE_WITH_YOUR_SECRET";
const PRIORITIES = ["Alta", "Media", "Baja"];

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

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return json({ error: "title es obligatorio" }, 400, cors);

  const start_date = typeof body?.start_date === "string" && body.start_date ? body.start_date : todayISO();
  let end_date = typeof body?.end_date === "string" && body.end_date ? body.end_date : start_date;
  if (end_date < start_date) end_date = start_date;
  const priority = PRIORITIES.includes(body?.priority) ? body.priority : "Media";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      id: "task_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      title,
      start_date,
      end_date,
      assigned_to: typeof body?.assigned_to === "string" ? body.assigned_to.trim() || null : null,
      priority,
      stage: "Sin Empezar",
      description: typeof body?.description === "string" ? body.description.trim() || null : null,
    })
    .select()
    .single();

  if (error) return json({ error: error.message }, 500, cors);
  return json({ ok: true, task: data }, 200, cors);
});
