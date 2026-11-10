// CRM comercial dentro del backoffice. Datos en Supabase (crm_config / crm_deals / crm_tasks), lógica en
// crmLogic.js / crmActions.js (portadas del HTML original), pantallas en CrmViews.jsx / CrmDialogs.jsx.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createCrm } from "./crmLogic.js";
import * as A from "./crmActions.js";
import { diffState, isEmptyDiff, loadAll, persist } from "./crmStore.js";
import { CrmStyles } from "./crmUi.jsx";
import { HoyView, PipelineView, TasksView, ClientsView, ForecastView, ConfigView } from "./CrmViews.jsx";
import { DealDialog, TaskDialog, NextDialog, BajaDialog, WeeklyDialog, PasteDialog, PresentOverlay } from "./CrmDialogs.jsx";
import CrmAssistant from "./CrmAssistant.jsx";
import { formatTimeBA } from "../timeTracking.js";

const VIEW_KEY = "crm-view";
const loadView = () => { try { return { tab: "hoy", q: "", seller: "", tag: "", country: "", flag: "", tkind: "", tseller: "", tdone: false, ...(JSON.parse(sessionStorage.getItem(VIEW_KEY) || "null") || {}) }; } catch { return { tab: "hoy", q: "", seller: "", tag: "", country: "", flag: "", tkind: "", tseller: "", tdone: false }; } };

// Estado del CRM + guardado de lo que cambia (con control de versión)
function useCrmData(sb, onToast) {
  const [S, setS] = useState(null);
  const [status, setStatus] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const ref = useRef({ S: null, versions: null, queue: Promise.resolve(), pending: 0, epoch: 0 });

  const load = useCallback(async () => {
    try {
      const { state, versions } = await loadAll(sb);
      ref.current.S = state; ref.current.versions = versions;
      setS(state);
      setStatus(state.config ? "ready" : "empty");
    } catch (e) { setLoadError(e.message || String(e)); setStatus("error"); }
  }, [sb]);

  useEffect(() => { load(); }, [load]);

  // Refresco silencioso para ver lo que cambió otra persona (sin pisar lo que se está escribiendo)
  useEffect(() => {
    const refresh = () => {
      const a = document.activeElement;
      if (ref.current.pending || document.visibilityState !== "visible" || document.querySelector(".crm-overlay,.crm-drawer") || (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) return;
      load();
    };
    const t = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);

  // commit(fn): fn(crm) modifica una copia del estado; si devuelve { error } no se guarda nada.
  const commit = useCallback((fn) => {
    const cur = ref.current;
    const next = A.cloneState(cur.S);
    const res = fn(createCrm(next, { now: new Date() }));
    if (res && res.error) return res;
    const diff = diffState(cur.S, next);
    cur.S = next; setS(next);
    if (!isEmptyDiff(diff)) {
      cur.pending++; setSaveState("saving");
      const epoch = cur.epoch;
      cur.queue = cur.queue.then(async () => {
        if (epoch !== cur.epoch) return; // hubo un conflicto: este cambio quedó viejo
        try {
          const r = await persist(sb, diff, cur.versions);
          if (r.conflict) { cur.epoch++; onToast("Alguien guardó cambios antes: cargando la última versión"); await load(); }
          else cur.versions = r.versions;
        } catch (e) { setSaveState("error"); onToast("No se pudo guardar: " + (e.message || e)); }
      }).finally(() => { cur.pending--; if (!cur.pending) setSaveState((s) => (s === "error" ? "error" : "saved")); });
    }
    return res;
  }, [sb, load, onToast]);

  return { S, status, loadError, saveState, commit };
}

export default function CrmApp({ sb }) {
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);
  const toast = useCallback((m) => { setToastMsg(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToastMsg(""), 2800); }, []);
  const { S, status, loadError, saveState, commit } = useCrmData(sb, toast);
  const [view, setViewState] = useState(loadView);
  const setView = (patch) => setViewState((v) => { const n = { ...v, ...patch }; try { sessionStorage.setItem(VIEW_KEY, JSON.stringify(n)); } catch { /* sin storage */ } return n; });
  const setTab = (tab) => { setView({ tab }); window.scrollTo(0, 0); };
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  const crm = useMemo(() => (S && S.config ? createCrm(S, { now }) : null), [S, now]);
  const [stack, setStack] = useState([]); // diálogos abiertos (uno encima del otro)
  const [aiOpen, setAiOpen] = useState(() => { try { return sessionStorage.getItem("crm-ai-open") === "1"; } catch { return false; } });
  const [nudge, setNudge] = useState(null);
  const idc = useRef(0);
  const push = (d) => setStack((s) => [...s, { ...d, key: ++idc.current }]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const open = useMemo(() => ({
    deal: (id, o = {}) => push({ type: "deal", id, ...o }),
    task: (id, dealId, preset) => push({ type: "task", id, dealId, preset }),
    next: (ctx) => push({ type: "next", ctx }),
    baja: (id) => push({ type: "baja", id }),
    weekly: () => push({ type: "weekly" }), paste: () => push({ type: "paste" }), present: () => push({ type: "present" }), toast,
  }), [toast]);

  // Avisos dentro del CRM a la hora de cada tarea + resumen del día al entrar
  useEffect(() => {
    if (!crm) return;
    const check = () => {
      const c2 = createCrm(S, { now: new Date() }), d = new Date(), hm = formatTimeBA(d), prev = formatTimeBA(new Date(d.getTime() - 3 * 60000));
      let seen = {}; try { seen = JSON.parse(sessionStorage.getItem("crm-nudged") || "{}"); } catch { /* sin storage */ }
      c2.taskItems(true).forEach((x) => { if (x.done || x.fecha !== c2.today) return; const key = x.k + x.id + x.fecha + x.hora; if (seen[key]) return; if (x.hora <= hm && x.hora > prev) { seen[key] = 1; setNudge(x); } });
      try { sessionStorage.setItem("crm-nudged", JSON.stringify(seen)); } catch { /* sin storage */ }
    };
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [S]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownDue = useRef(false);
  useEffect(() => {
    if (!crm || shownDue.current) return;
    shownDue.current = true;
    const c = crm.dueCounts();
    try { if ((c.v || c.h) && sessionStorage.getItem("crm-due-shown") !== crm.today) { sessionStorage.setItem("crm-due-shown", crm.today); toast("Hoy: " + c.h + (c.h === 1 ? " tarea" : " tareas") + (c.v ? ", " + c.v + (c.v === 1 ? " vencida" : " vencidas") : "")); } } catch { /* sin storage */ }
  }, [crm]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "loading") return <div style={{ padding: "4rem 1rem", textAlign: "center", color: "#888", fontSize: 14 }}>Cargando el CRM...</div>;
  if (status === "error") return <div style={{ padding: "4rem 1rem", textAlign: "center", color: "#EF3E3E", fontSize: 14 }}>No se pudo cargar el CRM{loadError ? ": " + loadError : ""}. Si no tenés acceso, pedile a un admin que habilite la sección CRM.</div>;
  if (status === "empty") return <div style={{ padding: "4rem 1rem", textAlign: "center", color: "#888", fontSize: 14 }}>Todavía no hay datos cargados en el CRM. Hay que importarlos (scripts/crm-import.py).</div>;

  const dc = crm.dueCounts(), n = dc.v + dc.h;
  const tabs = [["hoy", "Hoy"], ["pipeline", "Pipeline"], ["tareas", "Tareas"], ["clientes", "Clientes"], ["forecast", "Forecast"], ["config", "Configuración"]];
  const chip = saveState === "saving" ? ["busy", "Guardando…"] : saveState === "error" ? ["err", "No se pudo guardar"] : ["ok", "Guardado"];
  const common = { crm, commit, open, toast, sb };
  const handleNudgeOpen = () => { const x = nudge; setNudge(null); if (x.k === "deal") open.deal(x.id); else open.task(x.id); };

  return (
    <div className="crm-root">
      <CrmStyles />
      <div className="crm-top">
        <div className="crm-title">CRM comercial<small>Spicytool</small></div>
        <nav className="crm-tabs" role="tablist">{tabs.map((t) => (
          <button key={t[0]} className="crm-tab" role="tab" aria-selected={view.tab === t[0]} onClick={() => setTab(t[0])}>{t[1]}{t[0] === "tareas" && n > 0 && <span className={"crm-badge" + (dc.v ? " late" : "")}>{n}</span>}</button>))}</nav>
        <span className="crm-save" data-state={chip[0]} aria-live="polite">{chip[1]}</span>
        <button className="crm-ai-btn" onClick={() => { setAiOpen(true); try { sessionStorage.setItem("crm-ai-open", "1"); } catch { /* sin storage */ } }}><i>✦</i>Asistente</button>
      </div>

      {view.tab === "hoy" && <HoyView {...common} />}
      {view.tab === "pipeline" && <PipelineView {...common} view={view} setView={setView} setTab={setTab} />}
      {view.tab === "tareas" && <TasksView {...common} view={view} setView={setView} />}
      {view.tab === "clientes" && <ClientsView {...common} />}
      {view.tab === "forecast" && <ForecastView {...common} setTab={setTab} />}
      {view.tab === "config" && <ConfigView {...common} />}

      {stack.map((d) => {
        if (d.type === "deal") return <DealDialog key={d.key} {...common} id={d.id} stage={d.stage} preset={d.preset} prefill={d.prefill} focusCalif={d.focusCalif} onClose={pop} openTask={(id, dealId, preset) => open.task(id, dealId, preset)} />;
        if (d.type === "task") return <TaskDialog key={d.key} {...common} id={d.id} dealId={d.dealId} preset={d.preset} onClose={pop} />;
        if (d.type === "next") return <NextDialog key={d.key} {...common} ctx={d.ctx} onClose={pop} openDeal={(id) => open.deal(id)} />;
        if (d.type === "baja") return <BajaDialog key={d.key} {...common} id={d.id} onClose={pop} />;
        if (d.type === "weekly") return <WeeklyDialog key={d.key} {...common} onClose={pop} />;
        if (d.type === "present") return <PresentOverlay key={d.key} {...common} onClose={pop} />;
        if (d.type === "paste") return <PasteDialog key={d.key} {...common} onClose={pop} onUse={(r, ex) => {
          pop();
          const x = A.buildPasteResult(crm, r, ex);
          if (x.existingId) { open.deal(x.existingId, { prefill: x.prefill }); toast("Revisá los cambios y guardá el deal"); }
          else { open.deal(null, { stage: x.stage, preset: x.preset }); toast("Revisá los datos y tocá Crear deal"); }
        }} />;
        return null;
      })}
      {aiOpen && <CrmAssistant crm={crm} sb={sb} onClose={() => { setAiOpen(false); try { sessionStorage.setItem("crm-ai-open", "0"); } catch { /* sin storage */ } }} />}
      {nudge && (
        <div className="crm-nudge" role="alert"><p style={{ margin: 0 }}><strong>Ahora: {nudge.titulo}</strong>{nudge.deal && <><br /><span style={{ color: "#888" }}>{nudge.deal.empresa}</span></>}</p>
          <div><button className="crm-btn" onClick={() => setNudge(null)}>Cerrar</button><button className="crm-btn primary" onClick={handleNudgeOpen}>Ver</button></div></div>
      )}
      {toastMsg && <div className="crm-toast" role="status">{toastMsg}</div>}
    </div>
  );
}
