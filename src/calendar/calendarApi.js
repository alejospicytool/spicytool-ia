// Habla con el servidor del backoffice (/api/admin/calendar). Las reglas y las claves de Google viven en el SERVIDOR; acá solo se piden cosas.
// La sincronización es "dispará y olvidá": si falla, no molesta (el servidor además concilia solo cada 10 minutos).
let tokenProvider = null, enabled = true, timer = null;
export function configureCalendarApi(getToken) { tokenProvider = getToken; }

async function http(path, method = "GET") {
  const token = tokenProvider ? await tokenProvider() : null;
  if (!token) throw new Error("No hay sesión.");
  const res = await fetch(`/api/admin/calendar${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
  let body = null;
  try { body = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) throw Object.assign(new Error((body && (body.message || body.error)) || `Error ${res.status}`), { status: res.status, code: body && body.code });
  return body;
}

export async function calendarStatus() {
  const s = await http("/status");
  enabled = !!(s && s.configured);
  return s;
}
// Devuelve la dirección de Google a la que hay que llevar a la persona.
export const calendarConnectUrl = async () => (await http("/connect", "POST")).url;
export const calendarDisconnect = () => http("/disconnect", "POST");
export const calendarSyncNow = () => http("/sync", "POST");

// Después de guardar una tarea o un paso: pide conciliar. Junta varios pedidos seguidos en uno (2 segundos) y nunca tira error.
export function requestCalendarSync(delayMs = 2000) {
  if (!enabled) return;
  clearTimeout(timer);
  timer = setTimeout(() => { http("/sync", "POST").catch(() => { /* se reintenta en la próxima corrida */ }); }, delayMs);
}
