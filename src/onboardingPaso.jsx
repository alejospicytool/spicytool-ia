// Pantallas del "próximo paso" de Onboarding: el chip (Hoy / Vencido…), la sección del detalle del cliente (agregar, editar, marcar hecho)
// y la tarjeta de Inicio con lo que hay que hacer hoy. La lógica (fechas, validación, quién es "mío") está en onboardingLogic.js.
import { useState } from "react";
import { atajosFecha, validarPaso, tienePaso, quienDelPaso, chipPaso, sinPaso, enPausa, textoPausa, PASO_MAX, PASO_VACIO, PASO_TONOS, PAUSA_MAX } from "./onboardingLogic.js";

// Chip de color con la etiqueta ("Vencido hace 2 días", "Hoy", "Mañana", "En 3 días", "El 12/12").
export function PasoChip({ r, hoy = new Date(), style = {} }) {
  const c = chipPaso(r, hoy);
  if (!c) return null;
  const t = PASO_TONOS[c.tone];
  return <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, fontWeight: 700, background: t.bg, color: t.color, whiteSpace: "nowrap", flexShrink: 0, ...style }}>{c.label}</span>;
}

// Línea para la tarjeta del Kanban y la tabla: chip + texto del paso; o "Sin próximo paso" (apagado) si el cliente está en curso y no tiene.
export function PasoLinea({ r, hoy = new Date(), conTexto = true }) {
  if (tienePaso(r)) {
    return (
      <div title={`${r.proximo_paso} · ${quienDelPaso(r) || "sin asignar"}`} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, minWidth: 0 }}>
        <PasoChip r={r} hoy={hoy} />
        {conTexto && <span style={{ fontSize: 11, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.proximo_paso}</span>}
      </div>
    );
  }
  if (conTexto && sinPaso(r)) return <div style={{ fontSize: 11, color: "#C4C4CA", marginBottom: 6 }}>Sin próximo paso</div>;
  return null;
}

// Motivo de la pausa en la tarjeta del Kanban / la tabla (una línea, el texto completo en el tooltip). Nada si no está en pausa.
export function PausaLinea({ r, hoy = new Date() }) {
  if (!enPausa(r)) return null;
  return (
    <div title={`${textoPausa(r, hoy)}: ${r.pausa_motivo}`} style={{ fontSize: 11, color: "#533AB7", background: "#F1EEFB", borderRadius: 6, padding: "3px 7px", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      ⏸ {r.pausa_motivo}
    </div>
  );
}

const lbl = { fontSize: 12, color: "#666", fontWeight: 500 };

// Sección del detalle del cliente. Usarla con key={cliente.id} para que el formulario arranque limpio al cambiar de cliente.
// onSave(patch) y onComplete(record) devuelven una promesa con { error } si algo falló.
export function PasoEditor({ record, team, canEdit, onSave, onComplete }) {
  const [form, setForm] = useState(null);              // null = no se está editando
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [avisoHecho, setAvisoHecho] = useState(false); // después de marcar hecho: "¿cuál es el siguiente?"
  const hoy = new Date();
  const atajos = atajosFecha(hoy);

  const abrir = (editar) => {
    setError("");
    setForm(editar ? { texto: record.proximo_paso || "", fecha: record.proximo_paso_fecha || atajos[1].iso, quien: record.proximo_paso_quien || record.responsable || "" }
      : { texto: "", fecha: atajos[1].iso, quien: record.responsable || "" });
  };
  const run = async (fn) => { setBusy(true); setError(""); const r = await fn(); setBusy(false); if (r && r.error) { setError(r.error); return false; } return true; };

  async function guardar(e) {
    e.preventDefault();
    const v = validarPaso(form);
    if (v.error) { setError(v.error); return; }
    if (await run(() => onSave(v.value))) { setForm(null); setAvisoHecho(false); }
  }
  async function hecho() { if (await run(() => onComplete(record))) { setAvisoHecho(true); abrir(false); } }
  async function quitar() { if (await run(() => onSave(PASO_VACIO))) { setForm(null); setAvisoHecho(false); } }

  const box = { borderTop: "1px solid #EEE", paddingTop: 12 };
  const titulo = <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 6 }}>Próximo paso</div>;

  if (form) {
    return (
      <div style={box}>
        {titulo}
        {avisoHecho && <div style={{ fontSize: 12, color: "#16A34A", background: "#EDFAF3", borderRadius: 6, padding: "6px 9px", marginBottom: 8 }}>✓ Hecho, quedó anotado en las notas. ¿Cuál es el siguiente paso?</div>}
        <form onSubmit={guardar} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={lbl}>Qué hay que hacer
            <input autoFocus className="spicy-input" maxLength={PASO_MAX} value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} placeholder="Ej: Pedirle el acceso a Tokko" style={{ width: "100%", marginTop: 4 }} />
          </label>
          <div style={lbl}>Para el día
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "4px 0" }}>
              {atajos.map((a) => (
                <button key={a.label} type="button" className="spicy-btn-secondary" onClick={() => setForm({ ...form, fecha: a.iso })}
                  style={{ padding: "4px 10px", fontSize: 12, ...(form.fecha === a.iso ? { borderColor: "#533AB7", color: "#533AB7", background: "#F1EEFB" } : {}) }}>{a.label}</button>
              ))}
            </div>
            <input type="date" aria-label="Fecha del próximo paso" className="spicy-input" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </div>
          <label style={lbl}>Quién lo hace
            <select className="spicy-select" value={form.quien} onChange={(e) => setForm({ ...form, quien: e.target.value })} style={{ width: "100%", marginTop: 4 }}>
              <option value="">{record.responsable ? `Responsable del cliente (${record.responsable})` : "Sin asignar"}</option>
              {team.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {error && <div role="alert" style={{ fontSize: 12, color: "#EF3E3E" }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="spicy-btn-secondary" disabled={busy} onClick={() => { setForm(null); setError(""); setAvisoHecho(false); }}>{avisoHecho ? "Por ahora ninguno" : "Cancelar"}</button>
            <button type="submit" className="spicy-btn-primary" disabled={busy}>{busy ? "Guardando…" : "Guardar paso"}</button>
          </div>
        </form>
      </div>
    );
  }

  if (!tienePaso(record)) {
    return (
      <div style={box}>
        {titulo}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#AAA" }}>Sin próximo paso.</span>
          {canEdit && <button type="button" className="spicy-btn-secondary" onClick={() => abrir(false)}>+ Agregar próximo paso</button>}
        </div>
        {error && <div role="alert" style={{ fontSize: 12, color: "#EF3E3E", marginTop: 6 }}>{error}</div>}
      </div>
    );
  }

  return (
    <div style={box}>
      {titulo}
      <div style={{ background: "#F7F7F8", border: "1px solid #EBEBEB", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <PasoChip r={record} hoy={hoy} />
          <span style={{ fontSize: 11, color: "#999" }}>{record.proximo_paso_fecha.split("-").reverse().join("/")} · {quienDelPaso(record) || "sin asignar"}</span>
        </div>
        <div style={{ fontSize: 13, color: "#111", overflowWrap: "anywhere" }}>{record.proximo_paso}</div>
        {canEdit && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="spicy-btn-primary" disabled={busy} onClick={hecho} title="Lo deja anotado en las notas y te pregunta el siguiente paso">✓ Hecho</button>
            <button type="button" className="spicy-btn-secondary" disabled={busy} onClick={() => abrir(true)}>Editar</button>
            <button type="button" className="spicy-btn-secondary" disabled={busy} onClick={quitar} title="Borra el paso sin anotarlo (por ejemplo, si ya no hace falta)">Quitar</button>
          </div>
        )}
      </div>
      {error && <div role="alert" style={{ fontSize: 12, color: "#EF3E3E", marginTop: 6 }}>{error}</div>}
    </div>
  );
}

// Tarjeta de Inicio: lo que le toca a esta persona hoy (o está vencido) en Onboarding, más cuántos hay del resto del equipo.
export function PasosHoyCard({ mios, delEquipo = 0, hoy = new Date(), onOpen, onOpenAll, max = 6 }) {
  if (!mios.length && !delEquipo) return null;
  const vencidos = mios.filter((r) => chipPaso(r, hoy).kind === "vencido").length;
  return (
    <div className="spicy-card" style={{ marginBottom: 16, borderLeft: `4px solid ${vencidos ? "#EF3E3E" : "#D97706"}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>Onboarding: para hacer hoy{mios.length ? ` (${mios.length})` : ""}</span>
        <button onClick={onOpenAll} style={{ fontSize: 12, color: "#EF3E3E", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Ir a Onboarding →</button>
      </div>
      {!mios.length && <div style={{ fontSize: 13, color: "#999" }}>No tenés pasos para hoy. 🎉</div>}
      {mios.slice(0, max).map((r) => (
        <div key={r.id} onClick={() => onOpen(r.id)} className="spicy-table-row" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <PasoChip r={r} hoy={hoy} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111", flexShrink: 0 }}>{r.client_name}</span>
          <span style={{ fontSize: 13, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.proximo_paso}</span>
        </div>
      ))}
      {mios.length > max && <div style={{ fontSize: 12, color: "#999", marginTop: 6 }}>Y {mios.length - max} más en Onboarding.</div>}
      {delEquipo > 0 && <div style={{ fontSize: 12, color: "#999", marginTop: 8 }}>El resto del equipo tiene {delEquipo} paso{delEquipo === 1 ? "" : "s"} más para hoy o vencido{delEquipo === 1 ? "" : "s"}.</div>}
    </div>
  );
}

// Sección del detalle: poner en pausa (esperando al cliente), editar el motivo o retomar. Usarla con key={cliente.id}.
// onPausar({ motivo, revisar, quien }) y onRetomar() devuelven una promesa con { error } si algo falló.
export function PausaEditor({ record, team, canEdit, onPausar, onRetomar }) {
  const [form, setForm] = useState(null);   // null = no se está editando
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hoy = new Date();
  const atajos = atajosFecha(hoy);
  const pausado = enPausa(record);

  const abrir = () => { setError(""); setForm({ motivo: pausado ? record.pausa_motivo : "", revisar: pausado ? "" : atajos[4].iso, quien: record.proximo_paso_quien || record.responsable || "" }); };
  async function guardar(e) {
    e.preventDefault();
    setBusy(true); setError("");
    const r = await onPausar(form);
    setBusy(false);
    if (r && r.error) setError(r.error); else setForm(null);
  }
  async function retomar() { setBusy(true); setError(""); const r = await onRetomar(); setBusy(false); if (r && r.error) setError(r.error); }

  const box = { borderTop: "1px solid #EEE", paddingTop: 12 };
  const titulo = <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 6 }}>Pausa (esperando al cliente)</div>;

  if (form) {
    const reemplaza = !!form.revisar && tienePaso(record) && !(record.proximo_paso || "").startsWith("Revisar pausa:");
    return (
      <div style={box}>
        {titulo}
        <form onSubmit={guardar} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={lbl}>Por qué está en pausa
            <input autoFocus className="spicy-input" maxLength={PAUSA_MAX} value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ej: Cambió el nombre de la inmobiliaria: redes, dominio y mail nuevos" style={{ width: "100%", marginTop: 4 }} />
          </label>
          {!pausado && (
            <div style={lbl}>¿Cuándo lo revisamos? (opcional: ese día aparece en Inicio como recordatorio)
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "4px 0" }}>
                {[...atajos.slice(2), { label: "Sin fecha", iso: "" }].map((a) => (
                  <button key={a.label} type="button" className="spicy-btn-secondary" onClick={() => setForm({ ...form, revisar: a.iso })}
                    style={{ padding: "4px 10px", fontSize: 12, ...(form.revisar === a.iso ? { borderColor: "#533AB7", color: "#533AB7", background: "#F1EEFB" } : {}) }}>{a.label}</button>
                ))}
              </div>
              <input type="date" aria-label="Fecha para revisar la pausa" className="spicy-input" value={form.revisar} onChange={(e) => setForm({ ...form, revisar: e.target.value })} />
            </div>
          )}
          {!pausado && form.revisar && (
            <label style={lbl}>Quién lo revisa
              <select className="spicy-select" value={form.quien} onChange={(e) => setForm({ ...form, quien: e.target.value })} style={{ width: "100%", marginTop: 4 }}>
                <option value="">{record.responsable ? `Responsable del cliente (${record.responsable})` : "Sin asignar"}</option>
                {team.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
          {reemplaza && <div style={{ fontSize: 12, color: "#92400E", background: "#FEF3C7", borderRadius: 6, padding: "6px 9px" }}>El recordatorio de revisión reemplaza el próximo paso actual («{record.proximo_paso}»). Si no querés eso, elegí "Sin fecha".</div>}
          {error && <div role="alert" style={{ fontSize: 12, color: "#EF3E3E" }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="spicy-btn-secondary" disabled={busy} onClick={() => { setForm(null); setError(""); }}>Cancelar</button>
            <button type="submit" className="spicy-btn-primary" disabled={busy}>{busy ? "Guardando…" : pausado ? "Guardar motivo" : "Poner en pausa"}</button>
          </div>
        </form>
      </div>
    );
  }

  if (!pausado) {
    return (
      <div style={box}>
        {titulo}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#AAA" }}>Si la demora depende del cliente, no figura como atrasado.</span>
          {canEdit && <button type="button" className="spicy-btn-secondary" onClick={abrir}>⏸ Poner en pausa</button>}
        </div>
        {error && <div role="alert" style={{ fontSize: 12, color: "#EF3E3E", marginTop: 6 }}>{error}</div>}
      </div>
    );
  }

  return (
    <div style={box}>
      {titulo}
      <div style={{ background: "#F1EEFB", border: "1px solid #DDD5F6", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 11, color: "#533AB7", fontWeight: 700 }}>{textoPausa(record, hoy)} · desde el {record.pausa_desde.split("-").reverse().join("/")}</div>
        <div style={{ fontSize: 13, color: "#111", overflowWrap: "anywhere" }}>{record.pausa_motivo}</div>
        <div style={{ fontSize: 11, color: "#888" }}>Mientras está en pausa no figura como atrasado y estos días no cuentan.</div>
        {canEdit && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="spicy-btn-primary" disabled={busy} onClick={retomar} title="Lo saca de pausa y deja una nota con los días que estuvo así">▶ Retomar</button>
            <button type="button" className="spicy-btn-secondary" disabled={busy} onClick={abrir}>Editar motivo</button>
          </div>
        )}
      </div>
      {error && <div role="alert" style={{ fontSize: 12, color: "#EF3E3E", marginTop: 6 }}>{error}</div>}
    </div>
  );
}
