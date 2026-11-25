// Seguimiento de clientes (Operaciones): cartera de clientes activos, registro de "toques" y rutina semanal.
// Los datos viven en Supabase (client_followup y client_touches, ver supabase_seguimiento_clientes.sql). Acá solo está la pantalla.
import { useEffect, useMemo, useState } from "react";
import { baDateISO } from "../timeTracking.js";
import { askConfirm } from "../confirmStore.js";
import { listUsers, listCompanies, probeAdminApi } from "../admin/adminApi.js";
import {
  CANALES, RESULTADOS, SEMAFOROS, DEFAULT_FRECUENCIA, canalLabel, resultadoInfo, semaforoInfo, diasDesde, fmtFecha, normFrecuencia,
  proximoToque, estadoToque, sortPorUrgencia, resumen, whatsappLink, validateToque, validateRespuesta, notaConRespuesta, respuestaTexto, RESPUESTAS, candidatosCartera, filaDesdeCuenta, buildConstancia, escapeHtml,
} from "./seguimientoLogic.js";

const RED = "#EF3E3E";
const userName = (u) => (u ? ((u.first_name || u.last_name) ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : u.email) : "");
const rid = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

function Dot({ semaforo, size = 10 }) {
  const s = semaforoInfo(semaforo);
  return <span title={`Semáforo ${s.label.toLowerCase()}`} style={{ width: size, height: size, borderRadius: "50%", background: s.color, display: "inline-block", flexShrink: 0 }} />;
}
const Chip = ({ children, color = "#555", bg = "#F4F4F5", title }) => <span title={title} style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5, color, background: bg, whiteSpace: "nowrap" }}>{children}</span>;

function Modal({ onClose, children, maxWidth = 560 }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 16, width: "100%", maxWidth, maxHeight: "88vh", overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}
const Err = ({ children }) => (children ? <div role="alert" style={{ fontSize: 12, color: "#C42F2F", background: "#FEF0F0", borderRadius: 6, padding: "6px 9px" }}>{children}</div> : null);
const lbl = { fontSize: 12, color: "#666", fontWeight: 500 };

// ── Cartel de Inicio: cuántos clientes le tocan a esta persona esta semana ─────────────────────────────────────────
export function SeguimientoBanner({ rows, userId, onOpen }) {
  const today = baDateISO();
  const r = resumen(rows, today, userId);
  if (!r.total) return null;
  const hot = r.toca > 0;
  return (
    <div role="status" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16, padding: "12px 16px", borderRadius: 12, border: `1px solid ${hot ? "#FCE4A0" : "#BFE9D2"}`, background: hot ? "#FEF9E7" : "#EDFAF3" }}>
      <span style={{ fontSize: 20 }} aria-hidden="true">{hot ? "📞" : "✅"}</span>
      <div style={{ flex: 1, minWidth: 220 }}>
        {hot ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>Esta semana tenés {r.toca} cliente{r.toca === 1 ? "" : "s"} para contactar</div>
            <div style={{ fontSize: 12, color: "#666" }}>{r.vencidos > 0 ? `${r.vencidos} con el contacto atrasado · ` : ""}{r.tocadosSemana} de {r.total} ya contactados esta semana</div>
          </>
        ) : (
          <div style={{ fontSize: 14, fontWeight: 700, color: "#166534" }}>Estás al día con tus {r.total} cliente{r.total === 1 ? "" : "s"}. No hay contactos pendientes esta semana.</div>
        )}
      </div>
      <button className="spicy-btn-secondary" onClick={onOpen}>Ir a Seguimiento →</button>
    </div>
  );
}

// ── Registrar un toque ──────────────────────────────────────────────────────────────────────────────────────────────
export function ToqueDialog({ sb, row, today, me, onClose, onSaved }) {
  const [canal, setCanal] = useState("whatsapp");
  const [resultado, setResultado] = useState("");
  const [nota, setNota] = useState("");
  const [fecha, setFecha] = useState(today);
  const [proximo, setProximo] = useState("");
  const [semaforo, setSemaforo] = useState(row.semaforo);
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    const v = validateToque({ canal, resultado, fecha, proximo }, today);
    setErrors(v.errors); setMsg("");
    if (!v.ok) return;
    setBusy(true);
    try {
      const { error } = await sb.from("client_touches").insert({ id: rid("tq"), company_id: row.company_id, fecha, canal, resultado, nota: nota.trim() || null, author_id: me.id, author_email: me.email });
      if (error) throw error;
      // La fecha puntual anterior (si había) ya cumplió su función: se limpia o se reemplaza por la nueva.
      const patch = { proximo_toque: proximo || null };
      if (semaforo !== row.semaforo) patch.semaforo = semaforo;
      const { error: e2 } = await sb.from("client_followup").update(patch).eq("company_id", row.company_id);
      if (e2) throw e2;
      onSaved();
    } catch (err) {
      setMsg("No se pudo guardar el toque: " + (err.message || "error") + ". Revisá que tu usuario tenga permiso para editar.");
    } finally { setBusy(false); }
  }

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>Registrar contacto</div>
          <div style={{ fontSize: 13, color: "#888" }}>{row.company_name}{row.sin_respuesta >= 1 ? ` · ${row.sin_respuesta} intento${row.sin_respuesta === 1 ? "" : "s"} seguido${row.sin_respuesta === 1 ? "" : "s"} sin respuesta` : ""}</div>
        </div>
        <div style={lbl}>¿Cómo fue el contacto?
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {CANALES.map((c) => (
              <button type="button" key={c.key} onClick={() => setCanal(c.key)} aria-pressed={canal === c.key} style={{ padding: "6px 12px", borderRadius: 20, border: `1px solid ${canal === c.key ? RED : "#E0E0E0"}`, background: canal === c.key ? "#FEF0F0" : "white", color: canal === c.key ? RED : "#555", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{c.icon} {c.label}</button>
            ))}
          </div>
          <Err>{errors.canal}</Err>
        </div>
        <div style={lbl}>¿Qué pasó?
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {RESULTADOS.map((r) => (
              <button type="button" key={r.key} onClick={() => setResultado(r.key)} aria-pressed={resultado === r.key} style={{ flex: "1 1 130px", padding: "10px 12px", borderRadius: 10, border: `2px solid ${resultado === r.key ? r.color : "#E8E8E8"}`, background: resultado === r.key ? r.bg : "white", color: resultado === r.key ? r.color : "#555", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{r.label}</button>
            ))}
          </div>
          <Err>{errors.resultado}</Err>
          <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>Si todavía no te contestó, dejalo en «Sin respuesta por ahora». Cuando responda, abrí el historial del cliente y marcá «Me respondió».</div>
        </div>
        <label style={lbl}>Nota (qué se habló, qué quedó pendiente)
          <textarea className="spicy-input" rows={3} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: Le escribí por WhatsApp para saber cómo viene con los leads. Sin respuesta." style={{ width: "100%", marginTop: 4, resize: "vertical", fontFamily: "inherit" }} />
        </label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label style={{ ...lbl, flex: "1 1 150px" }}>Fecha del contacto
            <input type="date" className="spicy-input" value={fecha} max={today} onChange={(e) => setFecha(e.target.value)} style={{ width: "100%", marginTop: 4 }} />
            <Err>{errors.fecha}</Err>
          </label>
          <label style={{ ...lbl, flex: "1 1 150px" }}>Próximo contacto (opcional)
            <input type="date" className="spicy-input" value={proximo} min={today} onChange={(e) => setProximo(e.target.value)} style={{ width: "100%", marginTop: 4 }} />
            <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>Si lo dejás vacío, vuelve a tocar según su frecuencia ({row.frecuencia_dias ? `cada ${row.frecuencia_dias} días` : "sin rutina"}).</span>
            <Err>{errors.proximo}</Err>
          </label>
        </div>
        <div style={lbl}>Semáforo
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {SEMAFOROS.map((s) => (
              <button type="button" key={s.key} onClick={() => setSemaforo(s.key)} aria-pressed={semaforo === s.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, border: `1px solid ${semaforo === s.key ? s.color : "#E0E0E0"}`, background: semaforo === s.key ? s.bg : "white", color: semaforo === s.key ? s.color : "#666", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Dot semaforo={s.key} size={8} /> {s.label}</button>
            ))}
          </div>
        </div>
        <Err>{msg}</Err>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="spicy-btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="spicy-btn-primary" disabled={busy}>{busy ? "Guardando…" : "Guardar contacto"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── "Me respondió": el cliente contestó DESPUÉS de un contacto que se había cargado sin respuesta ──────────────────────
// Actualiza ese mismo contacto (no crea otro): queda cuándo se le escribió y cuándo contestó. Lo puede hacer quien lo cargó o un admin (lo hace cumplir la base).
export function RespuestaDialog({ sb, touch, today, onClose, onSaved }) {
  const [resultado, setResultado] = useState("respondio");
  const [fecha, setFecha] = useState(today);
  const [nota, setNota] = useState("");
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    const v = validateRespuesta({ resultado, fecha }, touch, today);
    setErrors(v.errors); setMsg("");
    if (!v.ok) return;
    setBusy(true);
    try {
      const { data, error } = await sb.from("client_touches").update({ resultado, respondio_en: fecha, nota: notaConRespuesta(touch, fecha, nota) }).eq("id", touch.id).select("id");
      if (error) throw error;
      if (!data || !data.length) throw new Error("solo puede actualizarlo quien lo cargó o un admin");
      onSaved();
    } catch (err) {
      setMsg("No se pudo guardar: " + (err.message || "error"));
    } finally { setBusy(false); }
  }

  return (
    <Modal onClose={onClose} maxWidth={460}>
      <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>Me respondió</div>
          <div style={{ fontSize: 13, color: "#888" }}>Contacto del {fmtFecha(touch.fecha)} por {canalLabel(touch.canal)}. Se actualiza ese mismo contacto: queda cuándo le escribiste y cuándo contestó.</div>
        </div>
        <div style={lbl}>¿Cómo respondió?
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {RESPUESTAS.map((r) => (
              <button type="button" key={r.key} onClick={() => setResultado(r.key)} aria-pressed={resultado === r.key} style={{ flex: "1 1 130px", padding: "10px 12px", borderRadius: 10, border: `2px solid ${resultado === r.key ? r.color : "#E8E8E8"}`, background: resultado === r.key ? r.bg : "white", color: resultado === r.key ? r.color : "#555", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{r.label}</button>
            ))}
          </div>
          <Err>{errors.resultado}</Err>
        </div>
        <label style={lbl}>¿Qué día respondió?
          <input type="date" className="spicy-input" value={fecha} min={touch.fecha} max={today} onChange={(e) => setFecha(e.target.value)} style={{ width: "100%", marginTop: 4 }} />
          <Err>{errors.fecha}</Err>
        </label>
        <label style={lbl}>Qué dijo (opcional)
          <textarea className="spicy-input" rows={3} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: Dice que estuvo de viaje y que esta semana lo mira." style={{ width: "100%", marginTop: 4, resize: "vertical", fontFamily: "inherit" }} />
        </label>
        <Err>{msg}</Err>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="spicy-btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="spicy-btn-primary" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Ficha del cliente: datos, rutina, historial y constancia ───────────────────────────────────────────────────────────
function FichaDialog({ sb, row, today, me, isAdmin, canWrite, responsables, onClose, onChanged, onToque }) {
  const [touches, setTouches] = useState(null);
  const [f, setF] = useState(() => ({ contact_name: row.contact_name || "", contact_email: row.contact_email || "", contact_phone: row.contact_phone || "", responsable_id: row.responsable_id || "", sinRutina: row.frecuencia_dias == null, frecuencia: String(row.frecuencia_dias || DEFAULT_FRECUENCIA), semaforo: row.semaforo, semaforo_motivo: row.semaforo_motivo || "", proximo_toque: row.proximo_toque || "" }));
  const [msg, setMsg] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  const [bajaMotivo, setBajaMotivo] = useState(""); const [bajaOpen, setBajaOpen] = useState(false);
  const [respT, setRespT] = useState(null); // contacto al que se le marca "Me respondió"

  const load = () => sb.from("client_touches").select("*").eq("company_id", row.company_id).order("fecha", { ascending: false }).order("created_at", { ascending: false }).then(({ data, error }) => { if (error) setMsg("No se pudo leer el historial: " + error.message); setTouches(data || []); });
  useEffect(() => { load(); }, [row.company_id, row.ultimo_toque, row.sin_respuesta]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patch(p, okMsg) {
    setBusy(true); setMsg(""); setOk("");
    try {
      const { data, error } = await sb.from("client_followup").update(p).eq("company_id", row.company_id).select("company_id");
      if (error) throw error;
      if (!data || !data.length) throw new Error("tu usuario no tiene permiso para editar");
      setOk(okMsg); onChanged();
    } catch (e) { setMsg("No se guardó: " + (e.message || "error")); } finally { setBusy(false); }
  }
  const save = () => {
    const freq = f.sinRutina ? null : normFrecuencia(f.frecuencia);
    if (!f.sinRutina && freq === null) { setMsg("La frecuencia tiene que ser un número de días entre 1 y 365."); return; }
    return patch({ contact_name: f.contact_name.trim() || null, contact_email: f.contact_email.trim() || null, contact_phone: f.contact_phone.trim() || null, responsable_id: f.responsable_id || null, frecuencia_dias: freq, semaforo: f.semaforo, semaforo_motivo: f.semaforo_motivo.trim() || null, proximo_toque: f.proximo_toque || null }, "Guardado.");
  };
  async function borrarToque(t) {
    if (!(await askConfirm({ title: "Borrar contacto", message: "Se va a borrar este contacto del historial. Es parte de la constancia y no se puede deshacer.", confirmLabel: "Borrar" }))) return;
    const { data, error } = await sb.from("client_touches").delete().eq("id", t.id).select("id");
    if (error || !data || !data.length) { setMsg("No se pudo borrar: solo puede hacerlo quien lo registró (o un admin)."); return; }
    onChanged(); load();
  }

  const constancia = touches ? buildConstancia(row, touches, today) : "";
  async function copiar() { try { await navigator.clipboard.writeText(constancia); setOk("Constancia copiada."); } catch { setMsg("No se pudo copiar: seleccioná el texto de abajo y copialo a mano."); } }
  function imprimir() {
    const w = window.open("", "_blank");
    if (!w) { setMsg("El navegador bloqueó la ventana de impresión. Permitila para este sitio o usá Copiar."); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Constancia — ${escapeHtml(row.company_name)}</title><style>body{font:14px/1.5 -apple-system,Segoe UI,sans-serif;margin:32px;color:#111}pre{white-space:pre-wrap;font:inherit}</style><pre>${escapeHtml(constancia)}</pre>`);
    w.document.close(); w.focus(); w.print();
  }
  const dado = row.baja_en;

  return (
    <Modal onClose={onClose} maxWidth={640}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#111", display: "flex", alignItems: "center", gap: 8 }}><Dot semaforo={row.semaforo} /> {row.company_name}</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{row.plan ? `Plan ${row.plan} · ` : ""}En la cartera desde el {fmtFecha(String(row.created_at).slice(0, 10))}{dado ? ` · De baja desde el ${fmtFecha(dado)}${row.baja_motivo ? " (" + row.baja_motivo + ")" : ""}` : ""}</div>
        </div>
        <button onClick={onClose} aria-label="Cerrar" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#ccc", lineHeight: 1 }}>×</button>
      </div>

      {canWrite && !dado && <div><button className="spicy-btn-primary" onClick={onToque}>+ Registrar contacto</button></div>}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label style={{ ...lbl, flex: "1 1 180px" }}>Dueño de la cuenta
          <input className="spicy-input" value={f.contact_name} disabled={!canWrite} onChange={(e) => setF({ ...f, contact_name: e.target.value })} style={{ width: "100%", marginTop: 4 }} />
        </label>
        <label style={{ ...lbl, flex: "1 1 180px" }}>Teléfono
          <input className="spicy-input" value={f.contact_phone} disabled={!canWrite} onChange={(e) => setF({ ...f, contact_phone: e.target.value })} style={{ width: "100%", marginTop: 4 }} />
        </label>
        <label style={{ ...lbl, flex: "1 1 220px" }}>Email
          <input className="spicy-input" value={f.contact_email} disabled={!canWrite} onChange={(e) => setF({ ...f, contact_email: e.target.value })} style={{ width: "100%", marginTop: 4 }} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label style={{ ...lbl, flex: "1 1 180px" }}>Responsable
          <select className="spicy-select" value={f.responsable_id} disabled={!canWrite} onChange={(e) => setF({ ...f, responsable_id: e.target.value })} style={{ width: "100%", marginTop: 4 }}>
            <option value="">Sin asignar</option>
            {responsables.map((u) => <option key={u.user_id} value={u.user_id}>{userName(u)}</option>)}
          </select>
        </label>
        <div style={{ ...lbl, flex: "1 1 220px" }}>Frecuencia del contacto
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span style={{ fontWeight: 400 }}>Cada</span>
            <input aria-label="Frecuencia en días" type="number" min={1} max={365} className="spicy-input" value={f.frecuencia} disabled={!canWrite || f.sinRutina} onChange={(e) => setF({ ...f, frecuencia: e.target.value })} style={{ width: 70 }} />
            <span style={{ fontWeight: 400 }}>días</span>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#666", fontWeight: 400, marginTop: 6 }}><input type="checkbox" checked={f.sinRutina} disabled={!canWrite} onChange={(e) => setF({ ...f, sinRutina: e.target.checked })} /> Sin rutina (no aparece en "le toca")</label>
        </div>
        <label style={{ ...lbl, flex: "1 1 160px" }}>Próximo contacto fijado
          <input type="date" className="spicy-input" value={f.proximo_toque} disabled={!canWrite} onChange={(e) => setF({ ...f, proximo_toque: e.target.value })} style={{ width: "100%", marginTop: 4 }} />
          <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>Pisa la frecuencia hasta el próximo contacto.</span>
        </label>
      </div>
      <div style={lbl}>Semáforo
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
          {SEMAFOROS.map((s) => (
            <button type="button" key={s.key} disabled={!canWrite} onClick={() => setF({ ...f, semaforo: s.key })} aria-pressed={f.semaforo === s.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, border: `1px solid ${f.semaforo === s.key ? s.color : "#E0E0E0"}`, background: f.semaforo === s.key ? s.bg : "white", color: f.semaforo === s.key ? s.color : "#666", fontSize: 12, fontWeight: 600, cursor: canWrite ? "pointer" : "default" }}><Dot semaforo={s.key} size={8} /> {s.label}</button>
          ))}
          <input className="spicy-input" placeholder="Motivo (ej: poco uso, se quejó del soporte)" value={f.semaforo_motivo} disabled={!canWrite} onChange={(e) => setF({ ...f, semaforo_motivo: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
        </div>
      </div>
      {canWrite && <div style={{ display: "flex", alignItems: "center", gap: 10 }}><button className="spicy-btn-primary" disabled={busy} onClick={save}>Guardar cambios</button>{ok && <span role="status" style={{ fontSize: 12, color: "#16A34A" }}>{ok}</span>}</div>}
      <Err>{msg}</Err>

      <div style={{ borderTop: "1px solid #EEE", paddingTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 8 }}>Historial de contactos {touches ? `(${touches.length})` : ""}</div>
        {touches === null && <div style={{ fontSize: 12, color: "#bbb" }}>Cargando…</div>}
        {touches && touches.length === 0 && <div style={{ fontSize: 12, color: "#bbb" }}>Todavía no se registró ningún contacto.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
          {(touches || []).map((t) => {
            const r = resultadoInfo(t.resultado);
            return (
              <div key={t.id} style={{ background: "#F7F7F8", borderRadius: 8, padding: "7px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
                  <strong style={{ color: "#111" }}>{fmtFecha(t.fecha)}</strong>
                  <span style={{ color: "#666" }}>{canalLabel(t.canal)}</span>
                  <Chip color={r.color} bg={r.bg}>{r.short}</Chip>
                  {respuestaTexto(t) && <span style={{ color: "#16A34A", fontSize: 11 }}>{respuestaTexto(t)}</span>}
                  {t.resultado === "no_respondio" && (t.author_id === me.id || isAdmin) && <button onClick={() => setRespT(t)} style={{ background: "none", border: "1px solid #BFE9D2", borderRadius: 6, cursor: "pointer", color: "#16A34A", fontSize: 11, padding: "1px 8px" }}>Me respondió</button>}
                  <span style={{ color: "#aaa", marginLeft: "auto" }}>{String(t.author_email).split("@")[0]}</span>
                  {(t.author_id === me.id || isAdmin) && <button onClick={() => borrarToque(t)} style={{ background: "none", border: "none", cursor: "pointer", color: "#C42F2F", fontSize: 11 }}>Borrar</button>}
                </div>
                {t.nota && <div style={{ fontSize: 13, color: "#333", marginTop: 4, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{t.nota}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ borderTop: "1px solid #EEE", paddingTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>Constancia de contacto</div>
        <div style={{ fontSize: 11, color: "#999", margin: "2px 0 8px" }}>Resumen con fechas y resultados de todos los intentos, para respaldar una baja ("lo intentamos N veces sin respuesta").</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="spicy-btn-secondary" disabled={!touches} onClick={copiar}>Copiar texto</button>
          <button className="spicy-btn-secondary" disabled={!touches} onClick={imprimir}>Imprimir / guardar PDF</button>
        </div>
      </div>

      {canWrite && (
        <div style={{ borderTop: "1px solid #EEE", paddingTop: 12 }}>
          {dado ? (
            <button className="spicy-btn-secondary" disabled={busy} onClick={() => patch({ baja_en: null, baja_motivo: null }, "Cliente reactivado en la cartera.")}>Reactivar en la cartera</button>
          ) : !bajaOpen ? (
            <button className="spicy-btn-secondary" style={{ color: "#C42F2F" }} onClick={() => setBajaOpen(true)}>Dar de baja de la cartera…</button>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input className="spicy-input" autoFocus placeholder="Motivo de la baja (ej: canceló, se pasó a la competencia)" value={bajaMotivo} onChange={(e) => setBajaMotivo(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
              <button className="spicy-btn-primary" disabled={busy} onClick={() => patch({ baja_en: today, baja_motivo: bajaMotivo.trim() || null }, "Cliente dado de baja.")}>Confirmar baja</button>
              <button className="spicy-btn-secondary" onClick={() => setBajaOpen(false)}>Cancelar</button>
            </div>
          )}
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>La baja no borra nada: el historial de contactos queda guardado.</div>
        </div>
      )}
      {respT && <RespuestaDialog sb={sb} touch={respT} today={today} onClose={() => setRespT(null)} onSaved={() => { setRespT(null); setOk("Listo: el contacto quedó actualizado con la respuesta."); onChanged(); load(); }} />}
    </Modal>
  );
}

// ── Sumar clientes a la cartera (desde Spicytool) ────────────────────────────────────────────────────────────────────
async function fetchAllOwners() {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const r = await listUsers({ owners: true, activeOnly: true, page, pageSize: 50 });
    out.push(...(r.items || []));
    if (page >= (r.pages || 1)) break;
  }
  return out;
}

function AgregarDialog({ sb, existingIds, me, responsables, defaultResponsable, onClose, onAdded }) {
  const [tab, setTab] = useState("sugeridos");
  const [resp, setResp] = useState(defaultResponsable || "");
  const [cands, setCands] = useState(null);
  const [sel, setSel] = useState({});
  const [q, setQ] = useState(""); const [found, setFound] = useState(null);
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const existing = useMemo(() => new Set(existingIds), [existingIds]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if ((await probeAdminApi()) !== "real") { if (alive) { setCands([]); setMsg("El buscador de cuentas de Spicytool no está conectado en este momento."); } return; }
        const list = candidatosCartera(await fetchAllOwners(), existingIds);
        if (alive) { setCands(list); setSel(Object.fromEntries(list.map((c) => [c.company_id, true]))); }
      } catch (e) { if (alive) { setCands([]); setMsg("No se pudo leer Spicytool: " + (e.message || "error")); } }
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function insert(list) {
    setBusy(true); setMsg("");
    try {
      const { error } = await sb.from("client_followup").insert(list.map((c) => filaDesdeCuenta(c, { responsableId: resp || null, userId: me.id })));
      if (error) throw error;
      onAdded();
    } catch (e) { setMsg("No se pudieron agregar: " + (e.message || "error") + ". Revisá que tu usuario tenga permiso para editar."); } finally { setBusy(false); }
  }
  async function buscar(e) {
    e.preventDefault(); setMsg(""); setFound(null);
    if (!q.trim()) return;
    setBusy(true);
    try {
      if ((await probeAdminApi()) !== "real") { setMsg("El buscador de cuentas de Spicytool no está conectado en este momento."); return; }
      const r = await listCompanies({ status: "active", search: q.trim(), pageSize: 8 });
      setFound(r.items || []);
      if (!(r.items || []).length) setMsg("No encontré cuentas activas con ese nombre o email.");
    } catch (err) { setMsg("No se pudo buscar: " + (err.message || "error")); } finally { setBusy(false); }
  }
  const chosen = (cands || []).filter((c) => sel[c.company_id]);
  const tabBtn = (k, t) => <button type="button" onClick={() => setTab(k)} style={{ padding: "6px 14px", border: "none", borderBottom: `2px solid ${tab === k ? RED : "transparent"}`, background: "none", fontSize: 13, fontWeight: 600, color: tab === k ? RED : "#888", cursor: "pointer" }}>{t}</button>;

  return (
    <Modal onClose={onClose} maxWidth={620}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>Sumar clientes a la cartera</div>
      <label style={lbl}>Responsable de los clientes que sumes
        <select className="spicy-select" value={resp} onChange={(e) => setResp(e.target.value)} style={{ width: "100%", marginTop: 4 }}>
          <option value="">Sin asignar</option>
          {responsables.map((u) => <option key={u.user_id} value={u.user_id}>{userName(u)}</option>)}
        </select>
      </label>
      <div style={{ display: "flex", borderBottom: "1px solid #EEE" }}>{tabBtn("sugeridos", "Clientes con plan pago")}{tabBtn("buscar", "Buscar una cuenta")}</div>
      {tab === "sugeridos" ? (
        <>
          <div style={{ fontSize: 12, color: "#888" }}>Dueños de cuentas activas de Spicytool con un plan pago (no Freemium ni Free trial) que todavía no están en la cartera. Destildá los que no correspondan.</div>
          {cands === null && <div style={{ fontSize: 13, color: "#bbb" }}>Leyendo Spicytool…</div>}
          {cands && cands.length === 0 && !msg && <div style={{ fontSize: 13, color: "#16A34A" }}>No hay clientes pagos sin sumar. 🎉</div>}
          {cands && cands.length > 0 && (
            <>
              <label style={{ fontSize: 12, color: "#666", display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={chosen.length === cands.length} onChange={(e) => setSel(Object.fromEntries(cands.map((c) => [c.company_id, e.target.checked])))} /> Elegir todos ({cands.length})</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflowY: "auto" }}>
                {cands.map((c) => (
                  <label key={c.company_id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 8px", border: "1px solid #EEE", borderRadius: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!sel[c.company_id]} onChange={(e) => setSel({ ...sel, [c.company_id]: e.target.checked })} />
                    <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{c.company_name}</span><span style={{ display: "block", fontSize: 11, color: "#888" }}>{[c.contact_name, c.contact_email, c.contact_phone].filter(Boolean).join(" · ")}</span></span>
                    <Chip>{c.plan}</Chip>
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}><button className="spicy-btn-primary" disabled={busy || !chosen.length} onClick={() => insert(chosen)}>{busy ? "Agregando…" : `Agregar ${chosen.length} cliente${chosen.length === 1 ? "" : "s"}`}</button></div>
            </>
          )}
        </>
      ) : (
        <>
          <form onSubmit={buscar} style={{ display: "flex", gap: 6 }}>
            <input aria-label="Buscar cuenta de Spicytool" className="spicy-input" autoFocus placeholder="Nombre de la empresa o email del dueño" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="spicy-btn-primary" disabled={busy || !q.trim()}>Buscar</button>
          </form>
          {found && found.map((c) => {
            const id = String(c._id), ya = existing.has(id);
            return (
              <div key={id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 10px", border: "1px solid #EEE", borderRadius: 8 }}>
                <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{c.name || "Sin nombre"}</span><span style={{ display: "block", fontSize: 11, color: "#888" }}>{[c.userEmail, c.phoneNumber].filter(Boolean).join(" · ") || "sin datos de contacto"}</span></span>
                {ya ? <Chip>Ya está</Chip> : <button className="spicy-btn-secondary" disabled={busy} onClick={() => insert([{ company_id: id, company_name: c.name, contact_email: c.userEmail, contact_phone: c.phoneNumber }])}>Agregar</button>}
              </div>
            );
          })}
        </>
      )}
      <Err>{msg}</Err>
    </Modal>
  );
}

// ── Pantalla principal ──────────────────────────────────────────────────────────────────────────────────────────────────
export default function SeguimientoApp({ sb, rows, allUsers, me, isAdmin, canWrite, canSearchSpicy, onRefresh, onOpenCliente360 }) {
  const today = baDateISO();
  const responsables = useMemo(() => allUsers.filter((u) => ["admin", "dev", "editor"].includes(u.role)), [allUsers]);
  const nameOfUser = (id) => userName(allUsers.find((u) => u.user_id === id)) || "Sin asignar";
  const [scope, setScope] = useState(() => (rows.some((r) => r.responsable_id === me.id && !r.baja_en) ? me.id : "all"));
  const [tab, setTab] = useState("toca");
  const [q, setQ] = useState("");
  const [fSem, setFSem] = useState("");
  const [toque, setToque] = useState(null);   // company_id
  const [ficha, setFicha] = useState(null);   // company_id
  const [agregar, setAgregar] = useState(false);
  const [paused, setPaused] = useState([]);   // clientes de la cartera que están pausados en Spicytool
  const [pmsg, setPmsg] = useState("");

  const rowOf = (id) => rows.find((r) => r.company_id === id) || null;
  const scoped = rows.filter((r) => scope === "all" || (scope === "none" ? !r.responsable_id : r.responsable_id === scope));
  const activos = scoped.filter((r) => !r.baja_en);
  const R = resumen(scoped, today);

  // Avisa de los clientes de la cartera cuya cuenta se pausó en Spicytool (la baja la confirma una persona).
  useEffect(() => {
    if (!canSearchSpicy || !rows.some((r) => !r.baja_en)) return;
    let alive = true;
    (async () => {
      try {
        if ((await probeAdminApi()) !== "real") return;
        const ids = new Set();
        for (let page = 1; page <= 10; page++) {
          const r = await listCompanies({ status: "paused", page, pageSize: 50 });
          (r.items || []).forEach((c) => ids.add(String(c._id)));
          if (page >= (r.pages || 1)) break;
        }
        if (alive) setPaused(rows.filter((r) => !r.baja_en && ids.has(r.company_id)));
      } catch { /* sin conexión con Spicytool: no se avisa */ }
    })();
    return () => { alive = false; };
  }, [canSearchSpicy, rows.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function bajaPausados() {
    const { data, error } = await sb.from("client_followup").update({ baja_en: today, baja_motivo: "Cuenta pausada en Spicytool" }).in("company_id", paused.map((r) => r.company_id)).select("company_id");
    if (error || !data || !data.length) { setPmsg("No se pudo dar de baja: " + (error ? error.message : "tu usuario no tiene permiso para editar")); return; }
    setPaused([]); setPmsg(""); onRefresh();
  }

  const tabs = [
    { k: "toca", t: "Le toca esta semana", n: R.toca },
    { k: "vencidos", t: "Atrasados", n: R.vencidos },
    { k: "todos", t: "Todos", n: R.total },
    { k: "sinrutina", t: "Sin rutina", n: activos.filter((r) => estadoToque(r, today) === "sin_rutina").length },
    { k: "bajas", t: "De baja", n: scoped.filter((r) => r.baja_en).length },
  ];
  const matches = (r) => {
    const e = estadoToque(r, today);
    if (tab === "bajas") { if (e !== "baja") return false; }
    else if (e === "baja") return false;
    if (tab === "toca" && e !== "vencido" && e !== "esta_semana") return false;
    if (tab === "vencidos" && e !== "vencido") return false;
    if (tab === "sinrutina" && e !== "sin_rutina") return false;
    if (fSem && r.semaforo !== fSem) return false;
    const t = q.trim().toLowerCase();
    return !t || [r.company_name, r.contact_name, r.contact_email, r.contact_phone].some((x) => String(x || "").toLowerCase().includes(t));
  };
  const visible = sortPorUrgencia(scoped.filter(matches), today);

  const th = { textAlign: "left", fontSize: 11, color: "#888", fontWeight: 600, padding: "10px 12px", borderBottom: "1px solid #EBEBEB", whiteSpace: "nowrap" };
  const td = { padding: "10px 12px", borderBottom: "1px solid #F5F5F5", fontSize: 12, color: "#555", verticalAlign: "top" };
  const kpi = (label, value, sub, color) => (
    <div className="spicy-card" style={{ flex: "1 1 150px", padding: "14px 16px" }}>
      <div style={{ fontSize: 11, color: "#888", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || "#111", lineHeight: 1.2, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{sub}</div>}
    </div>
  );
  const fRow = ficha ? rowOf(ficha) : null, tRow = toque ? rowOf(toque) : null;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>Seguimiento de clientes</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>Un contacto por semana con el dueño de cada cuenta activa · Operaciones</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select aria-label="Responsable" className="spicy-select" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">Todos los clientes</option>
            {rows.some((r) => !r.responsable_id) && <option value="none">Sin responsable</option>}
            {responsables.map((u) => <option key={u.user_id} value={u.user_id}>{u.user_id === me.id ? "Mis clientes" : userName(u)}</option>)}
          </select>
          {canWrite && <button className="spicy-btn-primary" onClick={() => setAgregar(true)}>+ Sumar clientes</button>}
        </div>
      </div>

      {paused.length > 0 && canWrite && (
        <div role="status" style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "#FEF3C7", border: "1px solid #FCE4A0", fontSize: 13, color: "#92400E", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 220 }}>{paused.length === 1 ? "1 cliente de la cartera tiene la cuenta pausada en Spicytool" : `${paused.length} clientes de la cartera tienen la cuenta pausada en Spicytool`}: {paused.map((r) => r.company_name).join(", ")}.</span>
          <button className="spicy-btn-secondary" onClick={bajaPausados}>Pasar a baja</button>
          {pmsg && <Err>{pmsg}</Err>}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        {kpi("En la cartera", R.total, null)}
        {kpi("Le toca esta semana", R.toca, R.toca ? "incluye los atrasados" : "todo al día", R.toca ? "#B45309" : "#16A34A")}
        {kpi("Atrasados", R.vencidos, "ya pasó su fecha", R.vencidos ? "#C42F2F" : "#16A34A")}
        {kpi("Contactados esta semana", `${R.pctTocados}%`, `${R.tocadosSemana} de ${R.total}`)}
        {kpi("En rojo", R.rojos, R.sinRespuesta ? `${R.sinRespuesta} con 2+ intentos sin respuesta` : null, R.rojos ? "#C42F2F" : "#111")}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {tabs.map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} aria-pressed={tab === t.k} style={{ padding: "6px 13px", borderRadius: 20, border: `1px solid ${tab === t.k ? RED : "#E0E0E0"}`, background: tab === t.k ? "#FEF0F0" : "white", color: tab === t.k ? RED : "#666", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{t.t} · {t.n}</button>
          ))}
        </div>
        <select aria-label="Filtrar por semáforo" className="spicy-select" value={fSem} onChange={(e) => setFSem(e.target.value)}>
          <option value="">Todos los semáforos</option>
          {SEMAFOROS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <input aria-label="Buscar cliente" className="spicy-input" placeholder="Buscar cliente, dueño, email…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
      </div>

      {rows.length === 0 ? (
        <div className="spicy-card" style={{ textAlign: "center", padding: "32px 16px" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>Todavía no hay clientes en la cartera</div>
          <div style={{ fontSize: 13, color: "#888", margin: "6px 0 14px" }}>Sumá a los dueños de las cuentas con plan pago desde Spicytool y empezá a registrar los contactos.</div>
          {canWrite && (canSearchSpicy ? <button className="spicy-btn-primary" onClick={() => setAgregar(true)}>+ Sumar clientes</button> : <div style={{ fontSize: 12, color: "#999" }}>Para sumar clientes hace falta el permiso de Admin Spicy.</div>)}
        </div>
      ) : (
        <div className="spicy-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 940 }}>
              <thead><tr style={{ background: "#FAFAFA" }}>{["Cliente", "Dueño de la cuenta", "Responsable", "Último contacto", "Próximo contacto", ""].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {visible.map((r) => {
                  const e = estadoToque(r, today), p = proximoToque(r), ult = r.ultimo_toque ? diasDesde(r.ultimo_toque, today) : null;
                  const wa = whatsappLink(r.contact_phone);
                  return (
                    <tr key={r.company_id} onClick={() => (onOpenCliente360 ? onOpenCliente360(r.company_id) : setFicha(r.company_id))} style={{ cursor: "pointer" }} title="Abrir la ficha 360 del cliente">
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Dot semaforo={r.semaforo} /><span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{r.company_name}</span></div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                          {r.plan && <Chip>{r.plan}</Chip>}
                          {r.sin_respuesta >= 1 && <Chip color="#C42F2F" bg="#FEF0F0" title="Intentos de contacto seguidos sin respuesta">{r.sin_respuesta} sin respuesta</Chip>}
                          {r.semaforo !== "verde" && r.semaforo_motivo && <span style={{ fontSize: 11, color: "#888" }}>{r.semaforo_motivo}</span>}
                        </div>
                      </td>
                      <td style={td}>
                        <div style={{ color: "#333" }}>{r.contact_name || "—"}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }} onClick={(ev) => ev.stopPropagation()}>
                          {r.contact_phone && (wa ? <a href={wa} target="_blank" rel="noopener noreferrer" title="Abrir el chat de WhatsApp" style={{ color: "#16A34A", fontWeight: 600, textDecoration: "none" }}>💬 {r.contact_phone}</a> : <span>{r.contact_phone}</span>)}
                          {r.contact_email && <a href={`mailto:${r.contact_email}`} style={{ color: "#888" }}>{r.contact_email}</a>}
                        </div>
                      </td>
                      <td style={td}>{nameOfUser(r.responsable_id)}</td>
                      <td style={td}>{ult === null ? <span style={{ color: "#aaa" }}>Sin contactos</span> : ult === 0 ? "Hoy" : `Hace ${ult} día${ult === 1 ? "" : "s"}`}{r.ultimo_toque && <div style={{ fontSize: 11, color: "#aaa" }}>{fmtFecha(r.ultimo_toque)}</div>}</td>
                      <td style={td}>
                        {e === "baja" ? <span style={{ color: "#aaa" }}>De baja{r.baja_motivo ? ` · ${r.baja_motivo}` : ""}</span> : e === "sin_rutina" ? <span style={{ color: "#aaa" }}>Sin rutina</span> : (
                          <><span style={{ fontWeight: 600, color: e === "vencido" ? "#C42F2F" : e === "esta_semana" ? "#B45309" : "#16A34A" }}>{fmtFecha(p)}</span>
                            <div style={{ fontSize: 11, color: "#aaa" }}>{e === "vencido" ? `Atrasado ${diasDesde(p, today)} día${diasDesde(p, today) === 1 ? "" : "s"}` : e === "esta_semana" ? (p === today ? "Hoy" : "Esta semana") : "Al día"}</div></>
                        )}
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap" }} onClick={(ev) => ev.stopPropagation()}>
                        {canWrite && !r.baja_en && <button className="spicy-btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setToque(r.company_id)}>Registrar contacto</button>}
                        {onOpenCliente360 && <button className="spicy-btn-secondary" style={{ padding: "4px 10px", fontSize: 12, marginLeft: 6 }} title="Editar frecuencia, semáforo, responsable, historial y baja" onClick={() => setFicha(r.company_id)}>Editar</button>}
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#bbb", fontSize: 13 }}>{tab === "toca" && !q && !fSem ? "No hay contactos pendientes esta semana. 🎉" : "No hay clientes que coincidan."}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tRow && <ToqueDialog sb={sb} row={tRow} today={today} me={me} onClose={() => setToque(null)} onSaved={() => { setToque(null); onRefresh(); }} />}
      {fRow && !tRow && <FichaDialog key={fRow.company_id} sb={sb} row={fRow} today={today} me={me} isAdmin={isAdmin} canWrite={canWrite} responsables={responsables} onClose={() => setFicha(null)} onChanged={onRefresh} onToque={() => setToque(fRow.company_id)} />}
      {agregar && <AgregarDialog sb={sb} existingIds={rows.map((r) => r.company_id)} me={me} responsables={responsables} defaultResponsable={(allUsers.find((u) => /^tic/i.test(u.first_name || "")) || {}).user_id || me.id} onClose={() => setAgregar(false)} onAdded={() => { setAgregar(false); onRefresh(); }} />}
    </>
  );
}
