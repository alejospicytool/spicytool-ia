// Botón de la barra de arriba + ventanita para conectar (o desconectar) tu Google Calendar.
// Qué se agenda: tus tareas de Operaciones y los próximos pasos de Onboarding que tengan tu nombre.
import { useEffect, useState } from "react";
import { calendarStatus, calendarConnectUrl, calendarDisconnect, calendarSyncNow } from "./calendarApi.js";
import { explainReturn, connectionBadge, timeAgo, withoutCalendarParam } from "./calendarLogic.js";

const DOT = { ok: "#16A34A", warn: "#D97706", off: "#C4C4CC" };
const RED = "#EF3E3E";

export default function CalendarConnect() {
  // Si Google nos devolvió acá (?calendar=ok / error), se muestra el resultado apenas abre y se limpia la dirección.
  const [back] = useState(() => new URLSearchParams(window.location.search).get("calendar") || "");
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(!!back);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(() => explainReturn(back)); // { tone: 'ok'|'bad', text }

  async function load() { try { setStatus(await calendarStatus()); } catch { setStatus(null); } }

  useEffect(() => {
    let alive = true;
    calendarStatus().then((s) => { if (alive) setStatus(s); }).catch(() => { if (alive) setStatus(null); });
    if (back) { try { window.history.replaceState(null, "", window.location.pathname + withoutCalendarParam(window.location.search) + window.location.hash); } catch { /* sin historial */ } }
    return () => { alive = false; };
  }, [back]);

  async function run(kind, fn) {
    setBusy(kind); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ tone: "bad", text: e.message || "No se pudo completar." }); }
    setBusy("");
  }
  const connect = () => run("connect", async () => { window.location.href = await calendarConnectUrl(); });
  const syncNow = () => run("sync", async () => { await calendarSyncNow(); await load(); setMsg({ tone: "ok", text: "Calendario actualizado." }); });
  const disconnect = () => run("off", async () => { await calendarDisconnect(); await load(); setMsg({ tone: "ok", text: "Se desconectó tu calendario y se borraron de Google los eventos que había creado el backoffice." }); });

  const badge = connectionBadge(status);
  const s = status || {};
  return (
    <>
      <button type="button" className="spicy-btn-secondary" onClick={() => { setMsg(null); setOpen(true); load(); }} title="Conectar tus tareas y pasos con Google Calendar"
        style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: DOT[badge.tone] }} aria-hidden="true"/>
        {badge.label}
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 250, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div role="dialog" aria-label="Google Calendar" onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 460, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>Google Calendar</div>

            {msg && <div role="status" style={{ fontSize: 13, borderRadius: 10, padding: "9px 12px", color: msg.tone === "ok" ? "#166534" : RED, background: msg.tone === "ok" ? "#EDFAF3" : "#FEF0F0" }}>{msg.text}</div>}

            {status && !s.configured && (
              <div style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>Todavía no está activado en el servidor: falta cargar las claves de Google. Mientras tanto el resto del backoffice funciona igual.</div>
            )}
            {!status && <div style={{ fontSize: 13, color: "#555" }}>No se pudo consultar el estado. Probá de nuevo en un momento.</div>}

            {s.configured && (
              <>
                <div style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>
                  Se agregan solos a tu Google Calendar, como eventos de día completo:
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    <li>tus <b>tareas</b> de Operaciones (del inicio al fin)</li>
                    <li>los <b>próximos pasos de Onboarding</b> que tengan tu nombre</li>
                  </ul>
                  Las <b>tareas del CRM comercial</b> y la próxima acción de tus deals van con su <b>hora</b> (las reuniones duran 30 minutos y ocupan ese horario; el resto son avisos de 15 minutos que no bloquean).
                  Si cambiás una fecha, el evento se actualiza; si finalizás, borrás o hacés el paso, se saca o queda con ✓. Lo vencido (pasos de Onboarding y tareas de prioridad Alta) se va estirando hasta hoy con “Vencido/a” en el título. Cada evento trae el link para volver acá.
                </div>

                {s.connected && (
                  <div style={{ fontSize: 13, color: "#111", background: "#F7F7F8", borderRadius: 10, padding: "9px 12px" }}>
                    Conectado{s.googleEmail ? <> a <b>{s.googleEmail}</b></> : null}. Última sincronización: {timeAgo(s.lastSyncAt)}.
                    {s.lastError && <div style={{ color: RED, marginTop: 4, fontSize: 12 }}>Último aviso de Google: {s.lastError}</div>}
                  </div>
                )}
                {s.needsReconnect && <div style={{ fontSize: 13, color: "#92400E", background: "#FEF3C7", borderRadius: 10, padding: "9px 12px" }}>El permiso de Google ya no vale (lo sacaste o venció). Volvé a conectar para seguir sincronizando.</div>}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  {s.connected && <button className="spicy-btn-secondary" disabled={!!busy} onClick={disconnect} style={{ color: RED, borderColor: "#FBD5D5" }}>{busy === "off" ? "Desconectando…" : "Desconectar"}</button>}
                  {s.connected && <button className="spicy-btn-secondary" disabled={!!busy} onClick={syncNow}>{busy === "sync" ? "Sincronizando…" : "Sincronizar ahora"}</button>}
                  {!s.connected && <button className="spicy-btn-primary" disabled={!!busy} onClick={connect}>{busy === "connect" ? "Abriendo Google…" : s.needsReconnect ? "Volver a conectar" : "Conectar mi Google Calendar"}</button>}
                </div>
              </>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}><button className="spicy-btn-secondary" onClick={() => setOpen(false)}>Cerrar</button></div>
          </div>
        </div>
      )}
    </>
  );
}
