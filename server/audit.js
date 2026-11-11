// Registro de auditoría en Supabase (tabla public.admin_audit, ver supabase_admin_audit.sql). Se escribe con el PROPIO token del admin:
// la política de la tabla solo deja insertar a admins y solo a nombre de su email, y no existe ningún permiso para editar ni borrar.
// Así el servidor no necesita ninguna clave secreta de Supabase.
import { SUPABASE_URL, SUPABASE_KEY } from "./auth.js";

export function makeAudit({ supabaseUrl = SUPABASE_URL, apiKey = SUPABASE_KEY, fetchImpl = globalThis.fetch } = {}) {
  const headers = (token) => ({ apikey: apiKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

  return {
    // Lanza error si no se pudo guardar: quien llama decide si sigue (nunca se cobra sin registro previo).
    async record(token, e) {
      const res = await fetchImpl(`${supabaseUrl}/rest/v1/admin_audit`, {
        method: "POST", headers: { ...headers(token), Prefer: "return=minimal" },
        body: JSON.stringify({ actor: e.actor, action: e.action, target_type: e.targetType ?? null, target_id: e.targetId ?? null, target_label: e.targetLabel ?? null, company_id: e.companyId ?? null, detail: e.detail || {} }),
      });
      if (!res.ok) throw new Error(`No se pudo guardar la auditoría (HTTP ${res.status})`);
    },

    async list(token, { companyId = null, actions = null, limit = 50 } = {}) {
      const q = new URLSearchParams({ select: "id,at,actor,action,target_type,target_id,target_label,company_id,detail", order: "at.desc,id.desc", limit: String(Math.min(Math.max(Math.floor(limit) || 50, 1), 200)) });
      if (companyId) q.set("company_id", `eq.${companyId}`);
      if (actions && actions.length) q.set("action", `in.(${actions.join(",")})`);
      const res = await fetchImpl(`${supabaseUrl}/rest/v1/admin_audit?${q}`, { headers: headers(token) });
      if (!res.ok) throw new Error(`No se pudo leer la auditoría (HTTP ${res.status})`);
      const rows = await res.json();
      return rows.map((r) => ({ id: String(r.id), at: r.at, actor: r.actor, action: r.action, targetType: r.target_type, targetId: r.target_id, targetLabel: r.target_label, companyId: r.company_id, detail: r.detail || {} }));
    },
  };
}
