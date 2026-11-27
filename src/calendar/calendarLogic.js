// Textos y reglas de la pantalla de Google Calendar. Todo puro, para poder probarlo.

// Qué mostrar cuando Google devuelve a la persona al backoffice con ?calendar=… en la dirección.
export function explainReturn(code) {
  const c = String(code || "");
  if (!c) return null;
  if (c === "ok") return { tone: "ok", text: "Listo: tu Google Calendar quedó conectado. En unos segundos aparecen tus tareas y pasos de Onboarding." };
  const bad = {
    denegado: "Cancelaste el permiso en Google, así que no se conectó nada. Podés volver a intentarlo cuando quieras.",
    sin_permiso_calendar: "Google no nos dio permiso para crear eventos. Al conectar, dejá tildada la casilla de Calendar y volvé a intentarlo.",
    sin_refresh_token: "Google no nos dejó un permiso duradero. Probá de nuevo; si sigue, sacá el acceso de Spicytool en tu cuenta de Google y volvé a conectar.",
    state_invalido: "El intento de conexión venció o no era válido (tienen 10 minutos). Volvé a tocar “Conectar”.",
    google_fallo: "Google no respondió bien al conectar. Probá de nuevo en un rato.",
    no_configurado: "Google Calendar todavía no está activado en el servidor.",
  };
  return { tone: "bad", text: bad[c] || "No se pudo conectar tu Google Calendar. Probá de nuevo." };
}

// Estado de la conexión → { tone, label } para el punto de color y el texto corto del botón.
export function connectionBadge(status) {
  if (!status) return { tone: "off", label: "Calendar" };
  if (!status.configured) return { tone: "off", label: "Calendar" };
  if (status.needsReconnect) return { tone: "warn", label: "Calendar: reconectar" };
  if (status.connected) return { tone: "ok", label: "Calendar" };
  return { tone: "off", label: "Calendar" };
}

// Texto del renglón en el menú lateral (más descriptivo que el de la barra de arriba).
export function sidebarLabel(status) {
  if (!status || !status.configured) return "Google Calendar";
  if (status.needsReconnect) return "Google Calendar · reconectar";
  return status.connected ? "Google Calendar · conectado" : "Conectar Google Calendar";
}

// "hace 5 min", "hace 2 h", "ayer"… a partir de una fecha ISO.
export function timeAgo(iso, now = Date.now()) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "todavía no se sincronizó";
  const min = Math.max(0, Math.round((now - t) / 60_000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

// Saca ?calendar=… de la dirección y conserva el resto (devuelve "" o "?a=b").
export function withoutCalendarParam(search) {
  const q = new URLSearchParams(search || "");
  q.delete("calendar");
  const rest = q.toString();
  return rest ? "?" + rest : "";
}
