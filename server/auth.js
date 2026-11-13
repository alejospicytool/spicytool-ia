// Autenticación: reutiliza el login de Supabase del backoffice. El front manda su token (Authorization: Bearer ...); acá se
// comprueba con Supabase que el token es válido y que ese usuario es admin (tabla user_roles) o tiene la sección 'Admin Spicy'
// asignada (tabla allowed_sections). No hace falta ninguna clave secreta: la URL y la clave "publishable" son públicas (están en
// el front) y las consultas de rol y de secciones van con el propio token del usuario (la base solo le deja leer lo suyo).
export const SUPABASE_URL = process.env.SUPABASE_URL || "https://khuavhbraikzreyhptog.supabase.co";
export const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_O8UPfP8BYLWhlIg0Fv45Gg_coidezqc";

export const SECTION_READ = "Admin Spicy";
export const SECTION_ACTIONS = "Admin Spicy: acciones";

export function makeAuthenticator({ fetchImpl = globalThis.fetch, now = () => Date.now(), ttlMs = 60_000 } = {}) {
  const cache = new Map(); // token → { admin, at }  (solo aciertos, y solo 1 minuto)
  return async function authenticate(authorizationHeader) {
    const m = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/.exec(String(authorizationHeader || "").trim());
    if (!m) return null;
    const token = m[1];
    const hit = cache.get(token);
    if (hit && now() - hit.at < ttlMs) return hit.admin;

    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` };
    const who = await fetchImpl(`${SUPABASE_URL}/auth/v1/user`, { headers });
    if (!who.ok) return null;
    const user = await who.json();
    if (!user || !user.id || !user.email) return null;
    const roleRes = await fetchImpl(`${SUPABASE_URL}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}`, { headers });
    if (!roleRes.ok) return null;
    const rows = await roleRes.json();
    if (!Array.isArray(rows)) return null;

    // Tres niveles: "admin" (todo), "actions" (ve Admin Spicy y puede hacer cambios) y "read" (solo ve).
    // Los no admin necesitan la sección 'Admin Spicy' en allowed_sections; para hacer cambios, además 'Admin Spicy: acciones'.
    let level = "admin";
    if (rows[0]?.role !== "admin") {
      const secRes = await fetchImpl(`${SUPABASE_URL}/rest/v1/allowed_sections?select=section&user_id=eq.${encodeURIComponent(user.id)}`, { headers });
      if (!secRes.ok) return null;
      const secs = await secRes.json();
      if (!Array.isArray(secs)) return null;
      const has = (name) => secs.some((s) => s && s.section === name);
      if (!has(SECTION_READ)) return null;
      level = has(SECTION_ACTIONS) ? "actions" : "read";
    }

    const admin = { id: user.id, email: user.email, level, canAct: level !== "read" };
    cache.set(token, { admin, at: now() });
    if (cache.size > 200) for (const [k, v] of cache) if (now() - v.at >= ttlMs) cache.delete(k);
    return admin;
  };
}
