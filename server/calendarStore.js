// Acceso a Supabase (REST) para el calendario, con la clave de servicio (SUPABASE_SERVICE_ROLE_KEY): solo el servidor la tiene.
// Las tablas calendar_connections / calendar_links no tienen políticas, así que solo esta clave puede tocarlas.
import { SUPABASE_URL } from "./auth.js";

export function makeCalendarStore({ serviceKey, url = SUPABASE_URL, fetchImpl = globalThis.fetch, timeoutMs = 15_000 } = {}) {
  const configured = !!serviceKey;
  const enc = encodeURIComponent;

  async function rest(method, path, { body, prefer } = {}) {
    if (!configured) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
    const res = await fetchImpl(`${url}/rest/v1/${path}`, {
      method, signal: AbortSignal.timeout(timeoutMs),
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(prefer ? { Prefer: prefer } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Supabase ${method} ${path.split("?")[0]} → ${res.status}`);
    if (res.status === 204) return null;
    const t = await res.text();
    return t ? JSON.parse(t) : null;
  }
  const upsert = (table, row, onConflict) => rest("POST", `${table}?on_conflict=${onConflict}`, { body: row, prefer: "resolution=merge-duplicates,return=minimal" });

  return {
    configured,
    // Conexiones
    async getConnection(userId) { const r = await rest("GET", `calendar_connections?select=*&user_id=eq.${enc(userId)}`); return (r && r[0]) || null; },
    async listConnections() { return (await rest("GET", "calendar_connections?select=*&status=eq.active")) || []; },
    saveConnection: (c) => upsert("calendar_connections", { user_id: c.userId, email: c.email || null, google_email: c.googleEmail || null, refresh_token_enc: c.refreshTokenEnc, status: "active", connected_at: new Date().toISOString(), last_error: null }, "user_id"),
    markRevoked: (userId, why) => rest("PATCH", `calendar_connections?user_id=eq.${enc(userId)}`, { body: { status: "revoked", last_error: String(why || "").slice(0, 300) }, prefer: "return=minimal" }),
    touchSync: (userId, error = null) => rest("PATCH", `calendar_connections?user_id=eq.${enc(userId)}`, { body: { last_sync_at: new Date().toISOString(), last_error: error ? String(error).slice(0, 300) : null }, prefer: "return=minimal" }),
    deleteConnection: (userId) => rest("DELETE", `calendar_connections?user_id=eq.${enc(userId)}`),

    // Vínculos entre cosas y eventos
    async listLinks() { return (await rest("GET", "calendar_links?select=*")) || []; },
    async listLinksOfUser(userId) { return (await rest("GET", `calendar_links?select=*&user_id=eq.${enc(userId)}`)) || []; },
    saveLink: (l) => upsert("calendar_links", { entity_type: l.entityType, entity_id: l.entityId, user_id: l.userId, google_event_id: l.eventId, payload_hash: l.hash, updated_at: new Date().toISOString() }, "entity_type,entity_id,user_id"),
    deleteLink: (l) => rest("DELETE", `calendar_links?entity_type=eq.${enc(l.entityType)}&entity_id=eq.${enc(l.entityId)}&user_id=eq.${enc(l.userId)}`),

    // Lo que se agenda
    async listTasks() { return (await rest("GET", "tasks?select=id,title,start_date,end_date,priority,stage,description")) || []; },
    async listTaskAssignees() { return (await rest("GET", "entity_assignees?select=entity_id,user_id&entity_type=eq.task")) || []; },
    async listOnboarding() { return (await rest("GET", "onboarding?select=id,client_name,etapa_actual,proximo_paso,proximo_paso_fecha,proximo_paso_quien&proximo_paso=not.is.null")) || []; },
    async listPeople() { return (await rest("GET", "user_roles?select=user_id,email,first_name")) || []; },
  };
}
