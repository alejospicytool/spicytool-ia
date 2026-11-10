import { useEffect, useMemo, useRef, useState } from "react";
import { fmtDate, ESTADOS, Q_DEC, Q_TIM } from "./crmLogic.js";
import * as A from "./crmActions.js";
import { callAi } from "./crmAi.js";
import { rpSlides, rpStandalone, RP_CSS, RP_VARS } from "./crmPresentation.js";
import { Overlay, DlgHead, Field, WA_ICON, copyText } from "./crmUi.jsx";
import { formatTimeBA } from "../timeTracking.js";

const Sel = ({ value, onChange, options, blank, name }) => (
  <select className="spicy-select" name={name} value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={{ width: "100%" }}>
    {blank != null && <option value="">{blank}</option>}
    {options.map((o) => { const v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return <option key={v} value={v}>{l}</option>; })}
  </select>
);
const QuickActions = ({ list, onPick }) => (
  <div className="crm-qa">{(list || []).map((a) => <button key={a} type="button" onClick={() => onPick(a)}>{a}</button>)}</div>
);
const stamp = (crm, iso) => crm.fmtStampDate(iso) + " " + formatTimeBA(iso);

// ── Ficha del deal ──────────────────────────────────────────────────────────
export function DealDialog({ crm, id, stage, preset, prefill, focusCalif, onClose, commit, toast, openTask, sb }) {
  const c = crm.S.config;
  const editing = useMemo(() => (id ? A.cloneState(crm.dealById(id)) : A.blankDeal(crm, stage, preset)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const isNew = !id;
  const d0 = editing;
  const [f, setF] = useState(() => ({
    empresa: d0.empresa || "", contacto: d0.contacto || "", telefono: d0.telefono || "", stage: d0.stage, vendedor: d0.vendedor || "", mrr: d0.mrr ?? 0, plan: d0.plan || "Mensual", cierre: d0.cierre || "",
    estado: d0.estado || "pago", promoMrr: d0.promoMrr || "", promoMeses: d0.promoMeses || "", pais: d0.pais || "", tipo: d0.tipo || "", origen: d0.origen || "", partner: d0.partner || "",
    proxima: d0.proxima || "", proximaTipo: d0.proximaTipo || "followup", proximaFecha: d0.proximaFecha || "", proximaHora: d0.proximaHora || "09:00",
    tags: d0.tags || [], motivo: d0.motivo || "", motivoDetalle: d0.motivoDetalle || "", notas: d0.notas || "",
    calif: { decisor: "", problema: "", usaHoy: "", timing: "", ...(d0.calif || {}) },
    ...(prefill || {}),
  }));
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  const [armed, setArmed] = useState(false);
  const [ai, setAi] = useState(null); // { loading } | { data } | { err }
  const califRef = useRef(null);
  const kind = (crm.stageById(f.stage) || {}).kind;
  const waTmp = { telefono: f.telefono, proxima: f.proxima, contacto: f.contacto, empresa: f.empresa, vendedor: f.vendedor };
  const waHref = crm.waLink(waTmp);
  const groups = []; c.tags.forEach((t) => { if (groups.indexOf(t.group) < 0) groups.push(t.group); });
  const tasks = isNew ? [] : crm.tasks().filter((t) => t.dealId === id && !t.hecha).sort((a, b) => ((a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1));
  const hist = (d0.hist || []).slice().reverse();

  useEffect(() => {
    if (focusCalif && califRef.current) { califRef.current.scrollIntoView({ block: "center" }); toast("¿Cómo fue la demo con " + d0.empresa + "? Completá la calificación y el próximo paso"); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function submit(e) {
    e.preventDefault();
    const res = commit((crmN) => A.saveDeal(crmN, editing, { ...f, calOn: d0.calOn !== false, calif: isNew ? null : f.calif }));
    if (res && res.error) { setErr(res.error); return; }
    onClose();
    toast(isNew ? "Deal creado" : "Deal guardado");
  }
  function remove() {
    if (!armed) { setArmed(true); return; }
    commit((crmN) => A.deleteDeal(crmN, id));
    onClose();
    toast("Deal eliminado");
  }
  async function suggest() {
    setAi({ loading: true });
    try {
      const live = A.cloneState(crm.dealById(id));
      const r = await callAi(sb, { mode: "next", info: crm.dealAiInfo(live) });
      setAi({ data: r.json });
    } catch (e) { setAi({ err: e.message }); }
  }
  function useSuggestion() {
    const s = ai.data;
    setF((p) => ({ ...p, proxima: s.accion || p.proxima, proximaTipo: s.tipo === "reunion" ? "reunion" : "followup", proximaFecha: s.fecha && s.fecha >= crm.today ? s.fecha : p.proximaFecha, proximaHora: /^\d\d:\d\d$/.test(s.hora || "") ? s.hora : p.proximaHora }));
    toast("Cargado en próxima acción. Guardá el deal");
  }
  const [aiText, setAiText] = useState("");
  useEffect(() => { if (ai && ai.data) setAiText(ai.data.mensaje || ""); }, [ai]);
  const aiPhone = String(f.telefono || "").replace(/\D/g, "");

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
        <DlgHead title={isNew ? "Nuevo deal" : d0.empresa} onClose={onClose} />
        <div className="crm-dlg-b">
          <Field label="Empresa"><input className="spicy-input" autoFocus={isNew} value={f.empresa} onChange={(e) => set("empresa", e.target.value)} /></Field>
          <Field label="Contacto"><input className="spicy-input" value={f.contacto} onChange={(e) => set("contacto", e.target.value)} /></Field>
          <Field label="WhatsApp del contacto"><input className="spicy-input" type="tel" inputMode="tel" placeholder="+54 9 341 555 1234" value={f.telefono} onChange={(e) => set("telefono", e.target.value)} /></Field>
          <div className="crm-f" style={{ justifyContent: "flex-end" }}>
            <a className="crm-btn" target="_blank" rel="noopener" href={waHref || "#"} aria-disabled={!waHref} onClick={(e) => { if (!waHref) e.preventDefault(); else if (!isNew) commit((crmN) => { const lv = crmN.dealById(id); if (lv) A.logH(crmN, lv, "WhatsApp: " + (f.proxima || "mensaje general")); }); }} style={{ display: "inline-flex", gap: 6, alignItems: "center", justifyContent: "center", textDecoration: "none", opacity: waHref ? 1 : 0.5 }}><span className="crm-wa" style={{ width: 16 }}>{WA_ICON}</span>Abrir WhatsApp</a>
          </div>
          <Field label="Etapa"><Sel value={f.stage} onChange={(v) => set("stage", v)} options={c.stages.map((s) => [s.id, s.name + (s.kind === "open" ? " (" + s.prob + "%)" : "")])} /></Field>
          <Field label="Vendedor"><Sel value={f.vendedor} onChange={(v) => set("vendedor", v)} options={c.sellers} blank="Sin asignar" /></Field>
          <Field label="MRR precio normal (USD/mes)"><input className="spicy-input" type="number" min="0" step="10" value={f.mrr} onChange={(e) => set("mrr", e.target.value)} /></Field>
          <Field label="Plan"><Sel value={f.plan} onChange={(v) => set("plan", v)} options={["Mensual", "Anual"]} /></Field>
          <Field label="Cierre estimado (primer mes de pago)"><input className="spicy-input" type="month" value={f.cierre} onChange={(e) => set("cierre", e.target.value)} /></Field>
          {kind === "won" && <Field label="Estado del cliente"><Sel value={f.estado} onChange={(v) => set("estado", v)} options={ESTADOS} /></Field>}
          <Field label="Precio promocional (USD/mes, 0 si es gratis)"><input className="spicy-input" type="number" min="0" step="10" placeholder="Ej. 130" value={f.promoMrr} onChange={(e) => set("promoMrr", e.target.value)} /></Field>
          <Field label="Meses con precio promocional"><input className="spicy-input" type="number" min="0" max="24" step="1" placeholder="Ej. 3" value={f.promoMeses} onChange={(e) => set("promoMeses", e.target.value)} /></Field>
          <Field label="País"><Sel value={f.pais} onChange={(v) => set("pais", v)} options={c.countries} blank="Sin dato" /></Field>
          <Field label="Tipo de cuenta"><Sel value={f.tipo} onChange={(v) => set("tipo", v)} options={c.types} blank="Sin dato" /></Field>
          <Field label="Origen"><Sel value={f.origen} onChange={(v) => set("origen", v)} options={c.sources} blank="Sin dato" /></Field>
          <Field label="Partner que lo refirió" full><Sel value={f.partner} onChange={(v) => set("partner", v)} options={c.partners} blank="Ninguno" /></Field>

          {!isNew && (
            <div className="crm-aibox full">
              {!ai && <button type="button" className="crm-btn sm" onClick={suggest}>✦ Sugerir siguiente paso con IA</button>}
              {ai && ai.loading && <p>Analizando el deal…</p>}
              {ai && ai.err && <><p>{ai.err}</p><button type="button" className="crm-btn sm" onClick={suggest}>Reintentar</button></>}
              {ai && ai.data && (
                <>
                  <p>{ai.data.analisis}</p>
                  <p><strong>Siguiente paso:</strong> {ai.data.accion}{ai.data.fecha ? ", " + fmtDate(ai.data.fecha) + (ai.data.hora ? " " + ai.data.hora : "") : ""}</p>
                  <Field label="Mensaje sugerido (lo podés editar)"><textarea className="spicy-input" value={aiText} onChange={(e) => setAiText(e.target.value)} /></Field>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    <button type="button" className="crm-btn sm primary" onClick={useSuggestion}>Usar como próxima acción</button>
                    <a className="crm-btn sm" target="_blank" rel="noopener" style={{ textDecoration: "none", opacity: aiPhone.length >= 8 ? 1 : 0.5 }} href={aiPhone.length >= 8 ? "https://wa.me/" + aiPhone + "?text=" + encodeURIComponent(aiText) : "#"} onClick={(e) => { if (aiPhone.length < 8) { e.preventDefault(); toast("Cargá el WhatsApp del contacto"); } else commit((crmN) => { const lv = crmN.dealById(id); if (lv) A.logH(crmN, lv, "WhatsApp (mensaje IA)"); }); }}>Abrir en WhatsApp</a>
                    <button type="button" className="crm-btn sm" onClick={async () => { toast((await copyText(aiText)) ? "Mensaje copiado" : "No se pudo copiar"); }}>Copiar mensaje</button>
                    <button type="button" className="crm-btn sm" onClick={suggest}>Otra sugerencia</button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="full">
            <Field label="Próxima acción"><input className="spicy-input" placeholder="Escribí o elegí una acción" value={f.proxima} onChange={(e) => set("proxima", e.target.value)} /></Field>
            <QuickActions list={c.acciones} onPick={(a) => set("proxima", a)} />
          </div>
          <div className="full" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            <Field label="Tipo"><Sel value={f.proximaTipo} onChange={(v) => set("proximaTipo", v)} options={[["followup", "Follow-up (15 min)"], ["reunion", "Reunión (30 min)"]]} /></Field>
            <Field label="Fecha"><input className="spicy-input" type="date" value={f.proximaFecha} onChange={(e) => set("proximaFecha", e.target.value)} /></Field>
            <Field label="Hora"><input className="spicy-input" type="time" step="900" value={f.proximaHora} onChange={(e) => set("proximaHora", e.target.value)} /></Field>
          </div>

          {!isNew && (
            <div className="full">
              <p style={{ fontSize: 12, color: "#666", fontWeight: 500, margin: "0 0 6px" }}>Otras tareas de este deal</p>
              {tasks.length ? tasks.map((t) => (
                <button key={t.id} type="button" className="crm-dtask" onClick={() => openTask(t.id)}><span>{t.titulo}</span><time>{crm.fmtDay(t.fecha)} {t.hora || ""}</time></button>
              )) : <p className="crm-note" style={{ margin: 0 }}>Sin otras tareas.</p>}
              <button type="button" className="crm-btn sm" style={{ marginTop: 6 }} onClick={() => openTask(null, id)}>Agregar tarea</button>
            </div>
          )}

          <div className="full">
            <p style={{ fontSize: 12, color: "#666", fontWeight: 500, margin: "0 0 4px" }}>Etiquetas</p>
            {groups.map((g) => (
              <div key={g} className="crm-tg-group"><p>{g}</p><div className="crm-tg-list">
                {c.tags.filter((t) => t.group === g).map((t) => (
                  <label key={t.id} className="crm-tg"><input type="checkbox" checked={f.tags.indexOf(t.id) >= 0} onChange={(e) => set("tags", e.target.checked ? [...f.tags, t.id] : f.tags.filter((x) => x !== t.id))} /><i style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, display: "inline-block" }} />{t.name}</label>
                ))}
              </div></div>
            ))}
          </div>

          {kind === "lost" && (
            <div className="full" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Motivo de pérdida"><Sel value={f.motivo} onChange={(v) => set("motivo", v)} options={c.lostReasons || []} blank="Elegí un motivo" /></Field>
              <Field label="Detalle"><input className="spicy-input" placeholder="Ej. Se quedó con Tokko por precio" value={f.motivoDetalle} onChange={(e) => set("motivoDetalle", e.target.value)} /></Field>
            </div>
          )}

          {!isNew && (
            <div className={"crm-calif full" + (focusCalif ? " focus" : "")} ref={califRef}>
              <p className="lg">Calificación de la demo <span>{crm.califFilled({ calif: f.calif }) ? crm.califScore({ calif: f.calif }) + "/4" : "completala después de la demo"}</span></p>
              <Field label="¿Quién decide?"><Sel value={f.calif.decisor} onChange={(v) => set("calif", { ...f.calif, decisor: v })} options={Q_DEC} blank="Sin dato" /></Field>
              <Field label="¿Para cuándo lo necesitan?"><Sel value={f.calif.timing} onChange={(v) => set("calif", { ...f.calif, timing: v })} options={Q_TIM} blank="Sin dato" /></Field>
              <Field label="¿Qué problema quieren resolver?"><input className="spicy-input" placeholder="Ej. Pierden leads de portales a la noche" value={f.calif.problema} onChange={(e) => set("calif", { ...f.calif, problema: e.target.value })} /></Field>
              <Field label="¿Qué usan hoy?"><input className="spicy-input" placeholder="Ej. Tokko + planilla" value={f.calif.usaHoy} onChange={(e) => set("calif", { ...f.calif, usaHoy: e.target.value })} /></Field>
            </div>
          )}

          <Field label="Notas" full><textarea className="spicy-input" rows={3} value={f.notas} onChange={(e) => set("notas", e.target.value)} /></Field>
          {!isNew && (
            <details className="crm-hist full"><summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "#555" }}>Historial ({hist.length})</summary>
              {hist.length ? <ol>{hist.map((x, i) => <li key={i}><time>{stamp(crm, x.t)}</time>{x.x}</li>)}</ol> : <p className="crm-note" style={{ margin: "6px 0 0" }}>Todavía no hay movimientos. Desde ahora se registran solos.</p>}
            </details>
          )}
          {err && <p className="crm-err full">{err}</p>}
        </div>
        <div className="crm-dlg-f">
          {!isNew && <button type="button" className="crm-btn danger" onClick={remove}>{armed ? "Confirmar eliminación" : "Eliminar deal"}</button>}
          <button type="button" className="crm-btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="crm-btn primary">{isNew ? "Crear deal" : "Guardar deal"}</button>
        </div>
      </form>
    </Overlay>
  );
}

// ── Tarea ───────────────────────────────────────────────────────────────────
export function TaskDialog({ crm, id, dealId, preset, onClose, commit, toast }) {
  const c = crm.S.config;
  const editing = useMemo(() => (id ? A.cloneState(crm.tasks().find((x) => x.id === id)) : A.blankTask(crm, dealId, preset)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const isNew = !id;
  const [f, setF] = useState(() => ({ titulo: editing.titulo || "", tipo: editing.tipo || "tarea", vendedor: editing.vendedor || "", fecha: editing.fecha || "", hora: editing.hora || "09:00", dealId: editing.dealId || "", notas: editing.notas || "" }));
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  const [armed, setArmed] = useState(false);
  const deals = crm.S.deals.slice().sort((a, b) => a.empresa.localeCompare(b.empresa)).map((d) => [d.id, d.empresa]);
  function submit(e) {
    e.preventDefault();
    const res = commit((crmN) => A.saveTask(crmN, editing, { ...f, calOn: editing.calOn !== false }));
    if (res && res.error) { setErr(res.error); return; }
    onClose();
    toast(isNew ? "Tarea creada" : "Tarea guardada");
  }
  function remove() {
    if (!armed) { setArmed(true); return; }
    commit((crmN) => A.deleteTask(crmN, id));
    onClose();
    toast("Tarea eliminada");
  }
  return (
    <Overlay onClose={onClose} small>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
        <DlgHead title={isNew ? "Nueva tarea" : "Editar tarea"} onClose={onClose} />
        <div className="crm-dlg-b">
          <div className="full"><Field label="Tarea"><input className="spicy-input" autoFocus={isNew} placeholder="Escribí o elegí una acción" value={f.titulo} onChange={(e) => set("titulo", e.target.value)} /></Field><QuickActions list={c.acciones} onPick={(a) => set("titulo", a)} /></div>
          <Field label="Tipo"><Sel value={f.tipo} onChange={(v) => set("tipo", v)} options={[["tarea", "Tarea (15 min)"], ["followup", "Follow-up (15 min)"], ["reunion", "Reunión (30 min)"]]} /></Field>
          <Field label="Vendedor"><Sel value={f.vendedor} onChange={(v) => set("vendedor", v)} options={c.sellers} blank="Sin asignar" /></Field>
          <Field label="Fecha"><input className="spicy-input" type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></Field>
          <Field label="Hora"><input className="spicy-input" type="time" step="900" value={f.hora} onChange={(e) => set("hora", e.target.value)} /></Field>
          <Field label="Deal relacionado (opcional)" full><Sel value={f.dealId} onChange={(v) => set("dealId", v)} options={deals} blank="Sin deal" /></Field>
          <Field label="Notas" full><textarea className="spicy-input" rows={3} value={f.notas} onChange={(e) => set("notas", e.target.value)} /></Field>
          {err && <p className="crm-err full">{err}</p>}
        </div>
        <div className="crm-dlg-f">
          {!isNew && <button type="button" className="crm-btn danger" onClick={remove}>{armed ? "Confirmar eliminación" : "Eliminar tarea"}</button>}
          <button type="button" className="crm-btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="crm-btn primary">{isNew ? "Crear tarea" : "Guardar tarea"}</button>
        </div>
      </form>
    </Overlay>
  );
}

// ── "Hecho. ¿Agendamos el próximo paso?" ────────────────────────────────────
export function NextDialog({ crm, ctx, onClose, commit, toast, openDeal }) {
  const p = ctx.prev || {};
  const d = ctx.dealId ? crm.dealById(ctx.dealId) : null;
  const days = useMemo(() => crm.nextDays(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState(() => ({ titulo: p.titulo && !/^(Seguimiento|Reunión|Tarea)$/.test(p.titulo) ? p.titulo : "Follow up", fecha: "", hora: p.hora || "10:00", tipo: p.tipo === "reunion" ? "reunion" : p.tipo === "tarea" && !d ? "tarea" : "followup" }));
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const [err, setErr] = useState("");
  function submit(e) {
    e.preventDefault();
    const res = commit((crmN) => A.saveNext(crmN, ctx, f));
    if (res && res.error) { setErr(res.error); return; }
    onClose();
    toast("Agendado: " + res.titulo + ", " + crm.fmtDay(res.fecha) + " " + res.hora);
  }
  return (
    <Overlay onClose={() => { onClose(); toast("Listo"); }} small>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
        <DlgHead title="Hecho. ¿Agendamos el próximo paso?" onClose={() => { onClose(); toast("Listo"); }} />
        <div className="crm-dlg-b">
          {d && <p className="crm-nctx full">{d.empresa}{d.contacto && d.contacto !== d.empresa ? ", " + d.contacto : ""}</p>}
          <div className="full"><Field label="Próximo paso"><input className="spicy-input" value={f.titulo} onChange={(e) => set("titulo", e.target.value)} /></Field><QuickActions list={crm.S.config.acciones} onPick={(a) => set("titulo", a)} /></div>
          <div className="full"><Field label="¿Cuándo?"><input className="spicy-input" type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></Field>
            <div className="crm-ndays" role="group" aria-label="Fechas rápidas">{days.map((x) => <button key={x[0]} type="button" aria-pressed={f.fecha === x[0]} onClick={() => set("fecha", x[0])}>{x[1]}</button>)}</div></div>
          <Field label="Hora"><input className="spicy-input" type="time" step="900" value={f.hora} onChange={(e) => set("hora", e.target.value)} /></Field>
          <Field label="Tipo"><Sel value={f.tipo} onChange={(v) => set("tipo", v)} options={[["followup", "Follow-up (15 min)"], ["reunion", "Reunión (30 min)"], ["tarea", "Tarea (15 min)"]]} /></Field>
          {err && <p className="crm-err full">{err}</p>}
        </div>
        <div className="crm-dlg-f">
          {d && <button type="button" className="crm-btn danger" style={{ color: "#111" }} onClick={() => { onClose(); openDeal(d.id); }}>Abrir el deal</button>}
          <button type="button" className="crm-btn" onClick={() => { onClose(); toast("Listo"); }}>No, por ahora</button>
          <button type="submit" className="crm-btn primary">Agendar</button>
        </div>
      </form>
    </Overlay>
  );
}

// ── Baja de cliente ─────────────────────────────────────────────────────────
export function BajaDialog({ crm, id, onClose, commit, toast }) {
  const d = crm.dealById(id);
  const [f, setF] = useState({ mes: crm.curMonth(), motivo: "", detalle: "" });
  if (!d) return null;
  function submit(e) {
    e.preventDefault();
    commit((crmN) => A.giveBaja(crmN, crmN.dealById(id), f));
    onClose();
    toast(d.empresa + " dado de baja");
  }
  return (
    <Overlay onClose={onClose} small>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
        <DlgHead title={"Dar de baja a " + d.empresa} onClose={onClose} />
        <div className="crm-dlg-b">
          <Field label="Primer mes que ya no paga"><input className="spicy-input" type="month" required value={f.mes} onChange={(e) => setF({ ...f, mes: e.target.value })} /></Field>
          <Field label="Motivo"><Sel value={f.motivo} onChange={(v) => setF({ ...f, motivo: v })} options={crm.S.config.churnReasons || []} blank="Elegí un motivo" /></Field>
          <Field label="Detalle" full><input className="spicy-input" placeholder="Ej. Volvieron a trabajar con planilla" value={f.detalle} onChange={(e) => setF({ ...f, detalle: e.target.value })} /></Field>
          <p className="crm-note full" style={{ margin: 0 }}>El forecast descuenta su MRR desde ese mes.</p>
        </div>
        <div className="crm-dlg-f"><button type="button" className="crm-btn" onClick={onClose}>Cancelar</button><button type="submit" className="crm-btn primary">Confirmar baja</button></div>
      </form>
    </Overlay>
  );
}

// ── Texto del lunes ─────────────────────────────────────────────────────────
export function WeeklyDialog({ crm, onClose, toast }) {
  const text = useMemo(() => crm.weeklyText(), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Overlay onClose={onClose} small>
      <DlgHead title="Resumen del lunes" onClose={onClose} />
      <div style={{ padding: "16px 20px" }}>
        <p className="crm-note">Listo para pegar en WhatsApp: los asteriscos quedan en negrita.</p>
        <textarea readOnly className="spicy-input" style={{ minHeight: 320, fontFamily: "inherit" }} value={text} aria-label="Resumen" />
      </div>
      <div className="crm-dlg-f"><button className="crm-btn" onClick={onClose}>Cerrar</button><button className="crm-btn primary" onClick={async () => toast((await copyText(text)) ? "Resumen copiado" : "Seleccioná el texto y copialo a mano")}>Copiar resumen</button></div>
    </Overlay>
  );
}

// ── Pegar conversación (IA) ─────────────────────────────────────────────────
export function PasteDialog({ crm, sb, onClose, onUse }) {
  const [txt, setTxt] = useState("");
  const [state, setState] = useState(null); // {loading}|{err}|{r, ex}
  async function analyze() {
    if (txt.trim().length < 10) { setState({ err: "Pegá una conversación para analizar." }); return; }
    setState({ loading: true });
    try {
      const { json } = await callAi(sb, { mode: "paste", text: txt.slice(0, 12000), context: crm.pasteContext() });
      setState({ r: json || {}, ex: crm.pasteMatch(json || {}) });
    } catch (e) { setState({ err: e.message }); }
  }
  const r = state && state.r, p = (r && r.proxima) || {};
  return (
    <Overlay onClose={onClose}>
      <DlgHead title="✦ Pegar conversación" onClose={onClose} />
      <div style={{ padding: "16px 20px", overflowY: "auto" }}>
        <p className="crm-note">Pegá el chat de WhatsApp, el mail de confirmación de Cal.com o cualquier mensaje de un lead. La IA arma el deal y vos lo revisás antes de guardar.</p>
        <textarea className="spicy-input" style={{ minHeight: 160 }} aria-label="Conversación" placeholder="Pegá acá la conversación" value={txt} onChange={(e) => setTxt(e.target.value)} autoFocus />
        {state && state.loading && <div className="crm-aibox" style={{ marginTop: 12 }}><p>Analizando la conversación…</p></div>}
        {state && state.err && <p className="crm-err" style={{ marginTop: 12 }}>{state.err}</p>}
        {r && (
          <div className="crm-aibox" style={{ marginTop: 12 }}>
            <p><strong>{state.ex ? "Ya existe: " + state.ex.empresa + ". Se va a actualizar ese deal." : "Deal nuevo: " + (r.empresa || "Sin nombre")}</strong></p>
            <p>{[r.contacto, r.telefono, r.pais].filter(Boolean).join(", ")}</p>
            {r.resumen && <p>{r.resumen}</p>}
            {p.accion && <p>Próximo paso: {p.accion}{p.fecha ? ", " + fmtDate(p.fecha) + (p.hora ? " " + p.hora : "") : ""}</p>}
            {(r.etiquetas || []).length > 0 && <p style={{ color: "#888" }}>Etiquetas: {r.etiquetas.join(", ")}</p>}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button type="button" className="crm-btn primary" onClick={() => onUse(r, state.ex)}>{state.ex ? "Revisar y actualizar" : "Revisar y crear"}</button>
              <button type="button" className="crm-btn" onClick={analyze}>Volver a analizar</button>
            </div>
          </div>
        )}
      </div>
      <div className="crm-dlg-f"><button className="crm-btn" onClick={onClose}>Cancelar</button><button className="crm-btn primary" onClick={analyze} disabled={state && state.loading}>Analizar con IA</button></div>
    </Overlay>
  );
}

// ── Presentación "Cómo vamos" ───────────────────────────────────────────────
export function PresentOverlay({ crm, onClose, toast }) {
  const slides = useMemo(() => rpSlides(crm), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const stage = useRef(null), page = useRef(null);
  const go = (n) => setI((x) => Math.max(0, Math.min(slides.length - 1, x + n)));
  const fit = () => {
    const st = stage.current, pg = page.current;
    if (!st || !pg || !pg.firstElementChild) return;
    const sc = Math.min((st.clientWidth - 24) / 1280, (st.clientHeight - 24) / 720);
    pg.style.width = 1280 * sc + "px"; pg.style.height = 720 * sc + "px"; pg.firstElementChild.style.transform = "scale(" + sc + ")";
  };
  useEffect(() => { if (page.current) { page.current.innerHTML = slides[i]; fit(); } }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); }
      else if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", k); window.addEventListener("resize", fit);
    return () => { document.removeEventListener("keydown", k); window.removeEventListener("resize", fit); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function download() {
    const blob = new Blob([rpStandalone(crm)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "spicytool-como-vamos-" + crm.today + ".html";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast("Presentación descargada");
  }
  return (
    <div className="crm-rp-overlay" role="dialog" aria-label="Presentación cómo vamos">
      <style>{":root{" + RP_VARS + "}" + RP_CSS}</style>
      <div className="crm-rp-stage" ref={stage}><div className="crm-rp-page" ref={page} /></div>
      <div className="crm-rp-ctrl">
        <button className="crm-btn" onClick={onClose}>Cerrar</button><span className="sp" />
        <button className="crm-btn" onClick={() => go(-1)} aria-label="Anterior">‹</button><span>{i + 1} / {slides.length}</span><button className="crm-btn" onClick={() => go(1)} aria-label="Siguiente">›</button>
        <span className="sp" /><button className="crm-btn primary" onClick={download}>Descargar HTML</button>
      </div>
    </div>
  );
}
