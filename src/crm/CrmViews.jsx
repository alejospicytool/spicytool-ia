import { useEffect, useRef, useState } from "react";
import { addMonths, fmtDate, initials, money, monthLabel, daysBetween, sum, ESTADOS, EST_NEXT, EST_LATE, KINDS_STAGE, TKINDS, TTIPO } from "./crmLogic.js";
import * as A from "./crmActions.js";
import { callAi } from "./crmAi.js";
import { WA_ICON, md } from "./crmUi.jsx";

const Table = ({ head, rows, total }) => (
  <div className="crm-tbl-wrap"><table className="crm-tbl"><thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>
    {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
    {total && <tr className="total">{total.map((c, j) => <td key={j}>{c}</td>)}</tr>}
  </tbody></table></div>
);
const Kpi = ({ label, value, sub, subClass }) => <div className="crm-kpi"><p>{label}</p><strong>{value}</strong><span className={subClass || ""}>{sub}</span></div>;
const WaLink = ({ href, onClick, label }) => (href ? <a className="crm-wa" href={href} target="_blank" rel="noopener" onClick={onClick} title="WhatsApp" aria-label={label || "Abrir WhatsApp"}>{WA_ICON}</a> : null);

// Marcar una tarea / próxima acción como hecha y abrir lo que corresponda después
export function useTaskToggle({ commit, open }) {
  return (k, id) => {
    const res = commit((crm) => A.toggleTask(crm, k, id));
    if (!res) return;
    if (res.open === "deal-calif") open.deal(res.dealId, { focusCalif: true });
    else if (res.open === "next") open.next(res.ctx);
  };
}
const logWa = (commit, dealId, text) => commit((crm) => { const d = crm.dealById(dealId); if (d) A.logH(crm, d, "WhatsApp: " + text); });

// ── HOY ─────────────────────────────────────────────────────────────────────
export function HoyView({ crm, commit, open }) {
  const h = crm.hoyData();
  const toggle = useTaskToggle({ commit, open });
  const S = crm.S;
  const dn = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][new Date(crm.today + "T12:00:00").getDay()];
  const [brief, setBrief] = useState(() => { try { const b = JSON.parse(sessionStorage.getItem("crm-brief") || "null"); return b && b.d === crm.today ? b : null; } catch { return null; } });
  const [briefState, setBriefState] = useState(null);
  async function runBrief() {
    setBriefState({ loading: true });
    try {
      const r = await callAi(sb, { mode: "brief", data: crm.aiData(), hoy: crm.today });
      const b = { d: crm.today, text: r.text };
      try { sessionStorage.setItem("crm-brief", JSON.stringify(b)); } catch { /* sin storage */ }
      setBrief(b); setBriefState(null);
    } catch (e) { setBriefState({ err: e.message }); }
  }
  const taskR = (x) => {
    const d = x.deal;
    return (
      <li key={x.k + x.id} className={"crm-trow" + (x.fecha < crm.today ? " late" : "")}>
        <button className="crm-tcheck" aria-label="Marcar como hecha" onClick={() => toggle(x.k, x.id)} />
        <div className="crm-tmain" onClick={() => (x.k === "deal" ? open.deal(x.id) : open.task(x.id))}><strong>{x.titulo}</strong>{d && <span className="crm-tmeta"><span>{d.empresa}</span></span>}</div>
        <div className="crm-twhen">{(x.fecha < crm.today ? "Vencida, " : "") + crm.fmtDay(x.fecha) + " " + (x.hora || "")}</div>
        <WaLink href={d ? crm.waLink({ ...d, proxima: x.titulo }) : ""} onClick={() => d && logWa(commit, d.id, x.titulo)} />
      </li>
    );
  };
  const dealR = (d, sub, extra) => (
    <li key={d.id} className={"crm-trow" + (extra && extra.late ? " late" : "")}>
      <span className="crm-tcheck" style={{ visibility: "hidden" }} />
      <div className="crm-tmain"><button className="crm-lnk" style={{ fontSize: 13, fontWeight: 600, textDecoration: "none", color: "#111" }} onClick={() => open.deal(d.id)}>{d.empresa}</button><span className="crm-tmeta"><span>{sub}</span></span></div>
      <div className="crm-twhen">{extra && extra.when}</div>
      <WaLink href={extra && extra.wa} onClick={() => logWa(commit, d.id, d.proxima || "mensaje general")} />
    </li>
  );
  const Card = ({ title, n, rows, empty, late }) => <section className={"crm-tgroup" + (late && n ? " late" : "")}><h2>{title}<span>{n}</span></h2><ul className="crm-tlist">{rows.length ? rows : <li className="crm-empty2">{empty}</li>}</ul></section>;
  const mr = h.mr, meta = h.meta;
  return (
    <>
      <div className="crm-hoy-h"><h1>Hoy, {dn} {fmtDate(crm.today)}</h1><span>MRR real <b>{money(S.config.mrrActual)}</b></span>
        <span>Proyectado a {monthLabel(mr.m)} <b>{money(mr.proj)}</b>{meta ? (mr.proj >= meta ? ", supera la meta" : ", faltan " + money(meta - mr.proj) + " para la meta") : ""}</span></div>
      <div className="crm-brief">
        {brief ? <><div dangerouslySetInnerHTML={{ __html: md(brief.text) }} /><button className="crm-btn sm" onClick={runBrief}>✦ Actualizar</button></>
          : briefState && briefState.loading ? <p>Leyendo tu CRM…</p>
          : <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><button className="crm-btn sm primary" onClick={runBrief}>✦ ¿Qué es lo más importante hoy?</button><span style={{ color: "#888", fontSize: 12.5 }}>La IA lee tu CRM y te dice por dónde arrancar.</span></div>}
        {briefState && briefState.err && <p className="crm-err" style={{ marginTop: 8 }}>{briefState.err}</p>}
      </div>
      <div className="crm-toolbar"><button className="crm-btn" onClick={open.paste}>✦ Pegar conversación</button><button className="crm-btn" onClick={() => open.task(null)}>Nueva tarea</button><button className="crm-btn primary" onClick={() => open.deal(null)}>Nuevo deal</button></div>
      <div className="crm-hoy">
        <Card title="Demos de hoy y mañana" n={h.demos.length} rows={h.demos.map(taskR)} empty="No hay demos para hoy ni mañana." />
        <Card title="Para hacer hoy" n={h.todo.length} rows={h.todo.map(taskR)} empty="Nada pendiente para hoy." late={h.todo.some((x) => x.fecha < crm.today)} />
        <Card title="Deals frenados" n={h.frenados.length} rows={h.frenados.map((d) => dealR(d, crm.daysIn(d) + " días en " + crm.stageById(d.stage).name + (d.proxima ? ". Próximo: " + d.proxima : ". Sin próximo paso"), { wa: crm.waLink(d), late: true }))} empty="Ningún deal pasó su límite de días." late />
        <Card title="Firmados sin pagar" n={h.unpaid.length} late={h.unpaid.some((d) => daysBetween(d.estadoDesde || d.cerradoEn || crm.today, crm.today) >= EST_LATE.pago)}
          rows={h.unpaid.map((d) => { const n = daysBetween(d.estadoDesde || d.cerradoEn || crm.today, crm.today); return dealR(d, (crm.hasPromo(d) ? crm.promoTxt(d) + " → " + money(d.mrr) : money(d.mrr)) + "/mes", { when: n === 0 ? "Desde hoy" : "Hace " + n + (n === 1 ? " día" : " días"), late: n >= EST_LATE.pago, wa: crm.waCustom(d, crm.fillTpl(d, (S.config.waTemplates || {})["Recordatorio de pago"])) }); })} empty="Todos los firmados ya pagaron." />
        <Card title="Clientes: arranque y hitos" n={h.hitos.length} rows={h.hitos.map((x) => dealR(x.d, x.t, { wa: crm.waLink(x.d) }))} empty="Sin onboardings ni hitos este mes." />
      </div>
    </>
  );
}

// ── PIPELINE ────────────────────────────────────────────────────────────────
function DealCard({ crm, d, onOpen, commit, onDragStart }) {
  const tags = (d.tags || []).map(crm.tagById).filter(Boolean), shown = tags.slice(0, 3);
  const sub = [d.contacto && d.contacto !== d.empresa ? d.contacto : "", d.pais].filter(Boolean).join(", ");
  const rl = crm.rotLevel(d), dn = crm.daysIn(d), st = crm.stageById(d.stage) || {};
  const cs = crm.califState(d);
  const wa = crm.waLink(d);
  return (
    <article className={"crm-card" + (crm.overdue(d) ? " is-late" : "") + (rl ? " rot-" + rl : "")} draggable data-id={d.id} tabIndex={0} aria-label={d.empresa}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", d.id); onDragStart(d.id); }}
      onClick={() => onOpen(d.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(d.id); } }}>
      <div className="crm-c-top"><h3>{d.empresa}</h3><span className="crm-mrr">{crm.hasPromo(d) ? <>{crm.promoTxt(d)}<small> → {Math.round(d.mrr).toLocaleString("es-AR")}/mes</small></> : <>{money(d.mrr)}<small>/mes</small></>}</span></div>
      {crm.hasPromo(d) && <p className="crm-c-sub">Promo {d.promoMeses}{+d.promoMeses === 1 ? " mes" : " meses"}, precio normal desde {monthLabel(addMonths(d.cierre || crm.curMonth(), +d.promoMeses))}</p>}
      {sub ? <p className="crm-c-sub">{sub}{d.plan === "Anual" ? ", plan anual" : ""}</p> : d.plan === "Anual" ? <p className="crm-c-sub">Plan anual</p> : null}
      {d.partner && <p className="crm-c-via">Vía {d.partner}</p>}
      {cs === "calificada" && <span className={"crm-pill" + (crm.califScore(d) <= 1 ? " warn" : "")} title="Calificación de la demo">Calificación {crm.califScore(d)}/4</span>}
      {cs === "sin_calificar" && <span className="crm-pill warn" title="Cargá la calificación de la demo">Demo sin calificar</span>}
      {st.kind === "won" && <span className={"crm-pill" + ((d.estado || "activo") === "pago" ? " warn" : (d.estado || "activo") === "activo" ? " ok" : "")}>{crm.estLabel(d.estado)}</span>}
      {st.kind === "lost" && d.motivo && <p className="crm-c-lost">{d.motivo}</p>}
      {shown.length > 0 && <ul className="crm-chips">{shown.map((t) => <li key={t.id} className="crm-chip"><i style={{ background: t.color }} />{t.name}</li>)}{tags.length > 3 && <li className="crm-chip">+{tags.length - 3}</li>}</ul>}
      {st.kind === "open" && <p className="crm-c-days">{dn === 0 ? "Entró hoy a " + st.name : dn + (dn === 1 ? " día" : " días") + " en " + st.name}{rl === "red" ? ", frenado" : ""}</p>}
      <footer className="crm-c-foot">
        <span className="crm-next">{d.proxima ? <>{d.proximaTipo === "reunion" ? "Reunión: " : ""}{d.proxima}{d.proximaFecha && <time>{fmtDate(d.proximaFecha)}{d.proximaHora ? " " + d.proximaHora : ""}</time>}</> : <em>Sin próxima acción</em>}</span>
        <span className="crm-right">
          {wa && <a className="crm-wa" href={wa} target="_blank" rel="noopener" title="WhatsApp" aria-label={"Abrir WhatsApp con " + d.empresa} onClick={(e) => { e.stopPropagation(); logWa(commit, d.id, d.proxima || "mensaje general"); }}>{WA_ICON}</a>}
          <span className="crm-who" title={d.vendedor}>{initials(d.vendedor)}</span>
        </span>
      </footer>
    </article>
  );
}

export function PipelineView({ crm, view, setView, commit, open, toast, setTab }) {
  const S = crm.S, c = S.config;
  const dragId = useRef(null);
  const [overCol, setOverCol] = useState(null);
  const q = view.q.trim().toLowerCase();
  const list = S.deals.filter((d) => {
    if (q && (d.empresa + " " + d.contacto + " " + (d.notas || "") + " " + (d.partner || "")).toLowerCase().indexOf(q) < 0) return false;
    if (view.seller && d.vendedor !== view.seller) return false;
    if (view.country && d.pais !== view.country) return false;
    if (view.tag && (d.tags || []).indexOf(view.tag) < 0) return false;
    if (view.flag === "vencidas" && !crm.overdue(d)) return false;
    if (view.flag === "sinaccion" && (d.proxima || !crm.isOpen(d))) return false;
    if (view.flag === "frenados" && crm.rotLevel(d) !== "red") return false;
    return true;
  });
  const nV = S.deals.filter(crm.overdue).length, nS = S.deals.filter((d) => crm.isOpen(d) && !d.proxima).length, nF = S.deals.filter((d) => crm.rotLevel(d) === "red").length;
  const flag = (k, l, n, cls) => <button className={"crm-flag " + (cls || "")} aria-pressed={view.flag === k} onClick={() => setView({ flag: view.flag === k ? "" : k })}>{l}<b>{n}</b></button>;
  const groups = []; c.tags.forEach((t) => { if (groups.indexOf(t.group) < 0) groups.push(t.group); });
  const dc = crm.dueCounts();
  const sort = (a, b) => { const x = a.proximaFecha || "9999", y = b.proximaFecha || "9999"; return x < y ? -1 : x > y ? 1 : (b.mrr || 0) - (a.mrr || 0); };

  function drop(stageId) {
    const id = dragId.current; dragId.current = null; setOverCol(null);
    if (!id) return;
    const res = commit((crmN) => A.moveDealToStage(crmN, id, stageId));
    if (!res || !res.moved) return;
    if (res.openDeal === "motivo") open.deal(id, { focusMotivo: true });
    else if (res.openDeal === "reagendar") open.deal(id, { prefill: { proxima: (crm.dealById(id).proxima || "Reagendar demo") } });
    else toast(res.deal.empresa + " pasó a " + res.stage.name);
  }

  return (
    <>
      {(dc.v || dc.h) ? <div className={"crm-due" + (dc.v ? " late" : "")}><span>{(dc.h ? "Hoy tenés " + dc.h + (dc.h === 1 ? " tarea" : " tareas") : "Nada para hoy") + (dc.v ? ", y " + dc.v + (dc.v === 1 ? " vencida" : " vencidas") : "")}.</span><button onClick={() => setTab("tareas")}>Ver tareas</button></div> : null}
      <section className="crm-toolbar">
        <input className="spicy-input" type="search" placeholder="Buscar empresa, contacto, partner o nota" aria-label="Buscar" value={view.q} onChange={(e) => setView({ q: e.target.value })} />
        <select className="spicy-select" aria-label="Vendedor" value={view.seller} onChange={(e) => setView({ seller: e.target.value })}><option value="">Todos los vendedores</option>{c.sellers.map((x) => <option key={x}>{x}</option>)}</select>
        <select className="spicy-select" aria-label="País" value={view.country} onChange={(e) => setView({ country: e.target.value })}><option value="">Todos los países</option>{c.countries.map((x) => <option key={x}>{x}</option>)}</select>
        <select className="spicy-select" aria-label="Etiqueta" value={view.tag} onChange={(e) => setView({ tag: e.target.value })}><option value="">Todas las etiquetas</option>{groups.map((g) => <optgroup key={g} label={g}>{c.tags.filter((t) => t.group === g).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>)}</select>
        <button className="crm-btn" onClick={open.paste}>✦ Pegar conversación</button><button className="crm-btn primary" onClick={() => open.deal(null)}>Nuevo deal</button>
      </section>
      <div className="crm-flags" role="group" aria-label="Atajos">{flag("vencidas", "Acciones vencidas", nV, "late")}{flag("sinaccion", "Sin próxima acción", nS)}{flag("frenados", "Deals frenados", nF, "rot")}</div>
      <div className="crm-board">
        {c.stages.map((s) => {
          const ds = list.filter((d) => d.stage === s.id && (s.kind !== "won" || (!!d.cerradoEn && daysBetween(d.cerradoEn, crm.today) <= 30))).sort(sort);
          const tot = sum(ds, (d) => +d.mrr || 0), w = sum(ds, crm.weighted);
          return (
            <section key={s.id} className={"crm-col" + (overCol === s.id ? " over" : "")} style={{ "--stage": s.color || "#6B7A90" }} aria-label={s.name}
              onDragOver={(e) => { if (dragId.current) { e.preventDefault(); setOverCol(s.id); } }} onDragLeave={() => setOverCol((x) => (x === s.id ? null : x))} onDrop={(e) => { e.preventDefault(); drop(s.id); }}>
              <header className="crm-col-h"><div className="crm-col-t"><h2>{s.name}</h2>{s.kind === "open" && <span className="crm-prob">{s.prob}%</span>}</div>
                <div className="crm-col-m"><span>{ds.length}{ds.length === 1 ? " deal" : " deals"}</span><span>{money(tot)}</span></div>
                {s.kind === "won" && <button className="crm-lnk" onClick={() => setTab("clientes")}>Últimos 30 días. Ver todos en Clientes</button>}
                {s.kind === "open" && <><div className="crm-col-w" aria-hidden="true"><span style={{ width: s.prob + "%" }} /></div><div className="crm-col-wv">Ponderado {money(w)}</div></>}
              </header>
              <div>{ds.length ? ds.map((d) => <DealCard key={d.id} crm={crm} d={d} commit={commit} onOpen={(id) => open.deal(id)} onDragStart={(id) => { dragId.current = id; }} />) : <p className="crm-empty">Arrastrá un deal acá</p>}</div>
            </section>
          );
        })}
      </div>
    </>
  );
}

// ── TAREAS ──────────────────────────────────────────────────────────────────
export function TasksView({ crm, view, setView, commit, open }) {
  const toggle = useTaskToggle({ commit, open });
  const kk = view.tkind || "";
  const { groups, cnt, missingDemo } = crm.taskGroups(kk, view.tseller, view.tdone);
  const row = (x) => {
    const late = !x.done && x.fecha < crm.today;
    return (
      <li key={x.k + x.id} className={"crm-trow" + (x.done ? " done" : "") + (late ? " late" : "")}>
        <button className="crm-tcheck" aria-label={x.done ? "Marcar como pendiente" : "Marcar como hecha"} aria-pressed={x.done} onClick={() => toggle(x.k, x.id)}>{x.done ? "✓" : ""}</button>
        <div className="crm-tmain" onClick={() => (x.k === "deal" ? open.deal(x.id) : open.task(x.id))}><strong>{x.titulo}</strong>
          <span className="crm-tmeta"><span className="crm-ttype">{TTIPO[x.tipo][0]}</span>{x.deal && <span>{x.deal.empresa}</span>}{x.k === "deal" && <span>Próxima acción del deal</span>}</span></div>
        <div className="crm-twhen"><time>{crm.fmtDay(x.fecha)} {x.hora}</time></div>
        <span className="crm-who" title={x.vendedor || ""}>{initials(x.vendedor)}</span>
      </li>
    );
  };
  const body = groups.filter((g) => g[1].length);
  return (
    <>
      <section className="crm-toolbar">
        <select className="spicy-select" aria-label="Vendedor" value={view.tseller} onChange={(e) => setView({ tseller: e.target.value })}><option value="">Todos los vendedores</option>{crm.S.config.sellers.map((x) => <option key={x}>{x}</option>)}</select>
        <button className="crm-btn" aria-pressed={!!view.tdone} onClick={() => setView({ tdone: !view.tdone })}>{view.tdone ? "Ocultar hechas" : "Ver hechas"}</button>
        <button className="crm-btn primary" onClick={() => open.task(null)}>Nueva tarea</button>
      </section>
      <div className="crm-flags" role="group" aria-label="Tipo de tarea">{TKINDS.map((k) => <button key={k[0]} className="crm-flag" aria-pressed={kk === k[0]} onClick={() => setView({ tkind: k[0] })}>{k[1]}<b>{cnt[k[0]] || 0}</b></button>)}</div>
      <p className="crm-note" style={{ maxWidth: "72ch" }}>Acá ves tus tareas y la próxima acción de cada deal. Al marcar como hecha la próxima acción de un deal, se abre el deal para que cargues el siguiente paso.</p>
      {kk === "demo" && missingDemo.length > 0 && (
        <section className="crm-tgroup late"><h2>En Demo agendada sin fecha de demo<span>{missingDemo.length}</span></h2><ul className="crm-tlist">
          {missingDemo.map((d) => <li key={d.id} className="crm-trow"><span className="crm-tcheck" style={{ visibility: "hidden" }} /><div className="crm-tmain"><button className="crm-lnk" style={{ fontSize: 13, fontWeight: 600, textDecoration: "none", color: "#111" }} onClick={() => open.deal(d.id)}>{d.empresa}</button><span className="crm-tmeta"><span>Cargá la demo como próxima acción (tipo Reunión) o como tarea</span></span></div><span className="crm-who" title={d.vendedor}>{initials(d.vendedor)}</span></li>)}
        </ul></section>
      )}
      {body.map((g) => <section key={g[0]} className={"crm-tgroup " + g[2]}><h2>{g[0]}<span>{g[1].length}</span></h2><ul className="crm-tlist">{g[1].map(row)}</ul></section>)}
      {!body.length && !(kk === "demo" && missingDemo.length) && <div className="crm-panel"><p className="crm-note" style={{ margin: 0 }}>{kk ? "No hay " + TKINDS.find((k) => k[0] === kk)[1].toLowerCase() + " pendientes." : "No tenés tareas pendientes. Creá una con Nueva tarea."}</p></div>}
    </>
  );
}

// ── CLIENTES ────────────────────────────────────────────────────────────────
export function ClientsView({ crm, commit, open }) {
  const cd = crm.clientsData();
  const { act, arr, gone, mrrHoy, real, unpaid, ups, renov, b90, risk } = cd;
  const setField = (id, field, value) => {
    const res = commit((crmN) => {
      const d = crmN.dealById(id);
      if (!d) return null;
      if (field === "estado") return { estado: A.setEstado(crmN, d, value), d: d.empresa };
      A.setClientField(crmN, d, field, value);
      return null;
    });
    if (res && res.estado && res.estado.askOnboarding) open.task(null, id, { titulo: "Onboarding", tipo: "reunion", fecha: crm.isoPlus(1), hora: "10:00" });
  };
  const nextEstado = (id) => { const d = crm.dealById(id); const ix = ESTADOS.findIndex((x) => x[0] === (d.estado || "pago")); setField(id, "estado", ESTADOS[Math.min(ESTADOS.length - 1, ix + 1)][0]); };
  const cm = cd.cm;
  const gr = {}; gone.forEach((d) => { const k = d.bajaMotivo || "Sin motivo"; gr[k] = (gr[k] || 0) + 1; });
  const rows = act.map((d) => { const p = crm.priceAt(d, cm); return [
    <button key="n" className="crm-lnk" style={{ fontSize: 13 }} onClick={() => open.deal(d.id)}>{d.empresa}</button>,
    <>{money(p)}{crm.hasPromo(d) && p < +d.mrr ? <small> → {money(d.mrr)}</small> : null}</>, d.plan || "Mensual",
    <select key="c" className="crm-sel" value={d.cobro || "Stripe"} onChange={(e) => setField(d.id, "cobro", e.target.value)}><option>Stripe</option><option>Transferencia</option></select>,
    crm.nextMilestone(d), crm.lastContact(d),
    <select key="s" className={"crm-sel " + (d.salud || "bien")} value={d.salud || "bien"} onChange={(e) => setField(d.id, "salud", e.target.value)}><option value="bien">Bien</option><option value="atencion">Atención</option><option value="riesgo">Riesgo</option></select>,
    <button key="b" className="crm-btn sm" onClick={() => open.baja(d.id)}>Dar de baja</button>]; });
  return (
    <>
      <section className="crm-toolbar"><span style={{ flex: 1, color: "#888", fontSize: 13 }}>Clientes ganados. La salud y el cobro se cambian directo en la tabla.</span>
        <button className="crm-btn primary" onClick={() => open.deal(null, { stage: (crm.S.config.stages.find((s) => s.kind === "won") || {}).id, preset: { cierre: addMonths(crm.curMonth(), -1), cobro: "Stripe", salud: "bien", estado: "activo" } })}>Agregar cliente existente</button></section>
      {real && mrrHoy < real * 0.95 ? <div className="crm-alert">En el CRM hay cargados clientes por {money(mrrHoy)} de MRR y tu MRR real es {money(real)}. Faltan cargar clientes por unos {money(real - mrrHoy)}. Con todos cargados, el churn y las renovaciones se calculan completos.</div> : null}
      <div className="crm-kpis">
        <Kpi label="Clientes activos" value={act.length} sub={(arr.length ? arr.length + " arrancando, " : "") + (risk ? risk + " en riesgo" : "ninguno en riesgo")} />
        <Kpi label="MRR de la cartera hoy" value={money(mrrHoy)} sub={unpaid.length ? "+" + money(sum(unpaid, (d) => (crm.hasPromo(d) ? +d.promoMrr : +d.mrr))) + " firmados sin pagar" : "Clientes que ya pagaron"} />
        <Kpi label="Suben de precio en 90 días" value={"+" + money(sum(ups, (d) => (+d.mrr) - (+d.promoMrr)))} sub={ups.length + (ups.length === 1 ? " cliente" : " clientes") + " terminan su promo"} />
        <Kpi label="Bajas últimos 3 meses" value={b90.length} sub={(b90.length ? "−" + money(sum(b90, (d) => +d.mrr || 0)) + " de MRR" : "Sin bajas") + (renov.length ? ". " + renov.length + " renuevan en 60 días" : "")} />
      </div>
      <section className="crm-panel"><h2>Arranque de clientes</h2>
        <p className="crm-note">Clientes que dijeron que sí y todavía no están activos. Se marcan en rojo si llevan demasiado en el paso: más de {EST_LATE.pago} días esperando pago, {EST_LATE.agendado} con el onboarding agendado o {EST_LATE.onboarding} en onboarding. Cuando pasan a Agendado, te propone agendar la reunión de onboarding.</p>
        <div className="crm-arr">{ESTADOS.slice(0, 3).map((e) => { const ds = arr.filter((d) => (d.estado || "pago") === e[0]); return (
          <div key={e[0]} className="crm-arr-col"><h3><span>{e[1]}</span><span>{ds.length}</span></h3>
            {ds.length ? ds.map((d) => { const n = daysBetween(d.estadoDesde || d.cerradoEn || crm.today, crm.today), late = n >= EST_LATE[e[0]];
              const ob = crm.tasks().filter((t) => t.dealId === d.id && !t.hecha).sort((a, b) => ((a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1))[0];
              return (<div key={d.id} className={"crm-arr-card" + (late ? " late" : "")}><button className="crm-lnk" style={{ fontSize: 13, fontWeight: 600 }} onClick={() => open.deal(d.id)}>{d.empresa}</button>
                <p>{crm.hasPromo(d) ? crm.promoTxt(d) + " → " + money(d.mrr) : money(d.mrr)}/mes</p><p>{n === 0 ? "Desde hoy" : "Hace " + n + (n === 1 ? " día" : " días")}{late ? ", demorado" : ""}</p>
                {ob ? <p>{ob.titulo}: {crm.fmtDay(ob.fecha)} {ob.hora || ""}</p> : d.proxima ? <p>{d.proxima}{d.proximaFecha ? ": " + crm.fmtDay(d.proximaFecha) : ""}</p> : null}
                <button className="crm-btn sm" onClick={() => nextEstado(d.id)}>{EST_NEXT[e[0]]}</button></div>); }) : <p className="crm-arr-empty">Nadie acá</p>}
          </div>); })}</div>
      </section>
      <section className="crm-panel"><h2>Cartera activa</h2><p className="crm-note">Ordenada por MRR. Próximo hito muestra lo que viene primero: fin de promo, renovación anual o inicio de cobro.</p>
        {rows.length ? <Table head={["Cliente", "MRR hoy", "Plan", "Cobro", "Próximo hito", "Último contacto", "Salud", ""]} rows={rows} total={["Total (" + act.length + ")", money(mrrHoy), "", "", "", "", "", ""]} /> : <p className="crm-note" style={{ margin: 0 }}>Todavía no hay clientes. Pasá deals a Ganado o agregá clientes existentes.</p>}
      </section>
      {gone.length > 0 && (
        <section className="crm-panel"><h2>Bajas</h2><p className="crm-note">Por qué se van: {Object.keys(gr).sort((a, b) => gr[b] - gr[a]).map((k) => k + " (" + gr[k] + ")").join(", ")}.</p>
          <Table head={["Cliente", "MRR", "Desde", "Motivo", ""]} rows={gone.map((d) => [
            <button key="n" className="crm-lnk" style={{ fontSize: 13 }} onClick={() => open.deal(d.id)}>{d.empresa}</button>, money(d.mrr), monthLabel(d.bajaMes), (d.bajaMotivo || "") + (d.bajaDetalle ? " (" + d.bajaDetalle + ")" : ""),
            <button key="r" className="crm-btn sm" onClick={() => { commit((crmN) => A.reactivate(crmN, crmN.dealById(d.id))); open.toast(d.empresa + " vuelve a estar activo"); }}>Reactivar</button>])} /></section>
      )}
    </>
  );
}

// ── FORECAST ("Cómo vamos") ─────────────────────────────────────────────────
export function ForecastView({ crm, commit, open, setTab }) {
  const f = crm.forecastData(), c = crm.S.config;
  const { rows, meta, base, totOpen, totW, thisM, commitM, metaRow, gap, byStage, lost, noShow, lostReasons, open: openDeals } = f;
  const cs = crm.convStats(), pct = (a, b) => (b ? Math.round(a * 100 / b) + "%" : "–");
  const g = (list) => list.map((r) => [r[0], r[1], money(r[2]), money(r[3])]);
  return (
    <>
      <div className="crm-toolbar" style={{ justifyContent: "flex-end" }}><button className="crm-btn" onClick={open.weekly}>Texto para WhatsApp</button><button className="crm-btn primary" onClick={open.present}>Presentar cómo vamos</button></div>
      {!base && <div className="crm-alert">Falta el MRR real de hoy (Stripe + transferencias). Sin ese número la proyección arranca en cero. <button onClick={() => setTab("config")}>Cargarlo en Configuración</button></div>}
      <div className="crm-kpis">
        <Kpi label="Pipeline abierto" value={money(totOpen)} sub={openDeals.length + " deals, MRR total"} />
        <Kpi label="Pipeline ponderado" value={money(totW)} sub="MRR por probabilidad de etapa" />
        <Kpi label={"Commit de " + monthLabel(thisM.m)} value={money(commitM)} sub="Ganado + negociación ponderada" />
        <Kpi label={"MRR proyectado a " + monthLabel(metaRow.m)} value={money(metaRow.proj)} subClass={meta ? (gap >= 0 ? "crm-pos" : "crm-neg") : ""} sub={meta ? (gap >= 0 ? "Supera la meta por " : "Faltan ") + money(Math.abs(gap)) + " para la meta de " + money(meta) : "Definí una meta en Configuración"} />
      </div>
      <section className="crm-panel"><h2>Nuevo MRR por mes de cierre</h2>
        <p className="crm-note">Cada deal abierto suma su MRR multiplicado por la probabilidad de su etapa, en el mes de cierre estimado. Commit es 80% o más, best case entre 40% y 79%, pipeline debajo de 40%. Los clientes con precio promocional entran con el precio de promo y suman la diferencia (fin de promo) el mes en que pasan al precio normal.{f.F.lateClose ? " " + f.F.lateClose + " deals tienen la fecha de cierre vencida y se cuentan en el mes actual: conviene actualizarlas." : ""}</p>
        <div dangerouslySetInnerHTML={{ __html: crm.chartSvg(rows) }} />
        <div className="crm-legend"><span><i style={{ background: "#1A1A2E" }} />Ganado</span><span><i style={{ background: "#EF3E3E" }} />Commit</span><span><i style={{ background: "#F5A3A3" }} />Best case</span><span><i style={{ background: "#D9D9E0" }} />Pipeline</span><span><i style={{ background: "#888", opacity: 0.55 }} />Fin de promo</span></div>
      </section>
      <section className="crm-panel"><h2>Proyección de MRR</h2>
        <p className="crm-note">Parte del MRR real de hoy ({money(base)}) y acumula el nuevo MRR ponderado de cada mes. Descuenta las bajas cargadas en Clientes{+c.churnPct ? " y un churn estimado de " + c.churnPct + "% mensual" : ""}.</p>
        <Table head={["Mes", "Ganado", "Commit", "Best case", "Pipeline", "Fin de promo", "Bajas", "Neto del mes", "MRR proyectado"].concat(meta ? ["vs meta"] : [])}
          rows={rows.map((r) => { const cells = [monthLabel(r.m), money(r.won), money(r.commit), money(r.best), money(r.pipe), money(r.sube), r.bajas < -0.5 ? <span className="crm-neg">−{money(-r.bajas)}</span> : money(0), money(r.nuevo + r.bajas), <strong>{money(r.proj)}</strong>];
            if (meta) { const gg = r.proj - meta; cells.push(<span className={gg >= 0 ? "crm-pos" : "crm-neg"}>{(gg >= 0 ? "+" : "−") + money(Math.abs(gg))}</span>); } return cells; })} /></section>
      <div className="crm-grid2">
        <section className="crm-panel"><h2>Por etapa</h2><Table head={["Etapa", "Deals", "Prob.", "MRR", "Ponderado"]} rows={byStage.map((x) => [x.stage.name, x.deals, x.stage.prob + "%", money(x.mrr), money(x.weighted)])} total={["Total", openDeals.length, "", money(totOpen), money(totW)]} /></section>
        <section className="crm-panel"><h2>Por vendedor</h2><Table head={["Vendedor", "Deals", "MRR", "Ponderado"]} rows={g(f.bySeller)} /></section>
        <section className="crm-panel"><h2>Por origen</h2><Table head={["Origen", "Deals", "MRR", "Ponderado"]} rows={g(f.byOrigin)} /></section>
        <section className="crm-panel"><h2>Por partner</h2><Table head={["Partner", "Deals", "MRR", "Ponderado"]} rows={g(f.byPartner).concat(f.anyPartner ? [] : [["Ningún deal abierto viene de partners todavía", "", "", ""]])} /></section>
      </div>
      <section className="crm-panel" style={{ marginTop: 0 }}><h2>Conversión real del embudo</h2>
        <p className="crm-note">Se calcula con el recorrido de cada deal por las etapas, que se registra desde el 1 de noviembre. Cierre real es, de los deals ya ganados o perdidos que llegaron a esa etapa, cuántos se ganaron. Con pocos deals cerrados los números se mueven mucho.</p>
        <Table head={["Etapa", "Llegaron", "Pasaron a la siguiente", "% a la siguiente", "Cerrados", "Cierre real", "Prob. actual"]} rows={cs.rows.map((r) => [r.stage.name, r.reached, r.next, pct(r.next, r.reached), r.dec, r.dec ? Math.round(r.win * 100) + "%" : "–", r.stage.prob + "%"])} />
        <p style={{ margin: "12px 0 0" }}><button className="crm-btn" disabled={!cs.ready} onClick={() => { commit((crmN) => A.applyConvAsProbabilities(crmN)); open.toast("Probabilidades actualizadas con tus datos reales"); }}>Usar el cierre real como probabilidades</button> <span className="crm-note" style={{ margin: 0 }}>{cs.ready ? "" : "Se habilita cuando cada etapa tenga al menos 5 deals cerrados."}</span></p>
      </section>
      <section className="crm-panel"><h2>Por qué perdemos</h2>
        <p className="crm-note">Cada deal que pasa a Lost pide un motivo. {noShow.length ? noShow.length + " deals están en No show y quedan fuera del forecast hasta reagendar." : ""}</p>
        {lost.length ? <Table head={["Motivo", "Deals", "MRR perdido", "", ""]} rows={lostReasons.map((x) => [x.motivo, x.deals, money(x.mrr), <div key="b" className="crm-bar" title={x.pct + "%"}><span style={{ width: x.pct + "%" }} /></div>, x.pct + "%"])} total={["Total", lost.length, money(sum(lost, (d) => +d.mrr || 0)), "", ""]} /> : <p className="crm-note" style={{ margin: 0 }}>Todavía no hay deals en Lost. Cuando muevas uno, acá vas a ver los motivos.</p>}
      </section>
    </>
  );
}

// ── CONFIGURACIÓN ───────────────────────────────────────────────────────────
function Text({ value, onCommit, type = "text", ...rest }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);
  return <input className="spicy-input" type={type} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (String(v) !== String(value ?? "")) onCommit(v); }} {...rest} />;
}
function ColorPick({ value, onCommit }) {
  const [v, setV] = useState(value || "#6B7A90"), t = useRef(null);
  useEffect(() => { setV(value || "#6B7A90"); }, [value]);
  return <input type="color" value={v} onChange={(e) => { const x = e.target.value; setV(x); clearTimeout(t.current); t.current = setTimeout(() => onCommit(x), 500); }} />;
}
export function ConfigView({ crm, commit }) {
  const c = crm.S.config;
  const edit = (fn) => commit((crmN) => fn(crmN));
  const groups = []; c.tags.forEach((t) => { if (groups.indexOf(t.group) < 0) groups.push(t.group); });
  const list = (k, l) => (
    <label className="crm-f" key={k}>{l}<textarea className="spicy-input" defaultValue={(c[k] || []).join("\n")} key={(c[k] || []).join("|")} onBlur={(e) => { const v = e.target.value.split("\n").map((x) => x.trim()).filter(Boolean); if (v.join("|") !== (c[k] || []).join("|")) edit((crmN) => { crmN.S.config[k] = v; }); }} /></label>
  );
  return (
    <>
      <section className="crm-panel"><h2>Números base del forecast</h2><p className="crm-note">El MRR real es Stripe más los clientes que pagan por transferencia (ChartMogul solo ve Stripe).</p>
        <div className="crm-fields">
          <label className="crm-f">MRR real hoy (USD)<Text type="number" min="0" value={c.mrrActual || ""} placeholder="Ej. 4800" onCommit={(v) => edit((x) => A.applyConfigField(x, "mrrActual", v, true))} /></label>
          <label className="crm-f">Meta de MRR (USD)<Text type="number" min="0" value={c.metaMrr || ""} onCommit={(v) => edit((x) => A.applyConfigField(x, "metaMrr", v, true))} /></label>
          <label className="crm-f">Mes de la meta<Text type="month" value={c.metaMes} onCommit={(v) => edit((x) => A.applyConfigField(x, "metaMes", v, false))} /></label>
          <label className="crm-f">Churn estimado mensual (%)<Text type="number" min="0" max="50" step="0.5" value={c.churnPct || ""} placeholder="Ej. 2" onCommit={(v) => edit((x) => A.applyConfigField(x, "churnPct", v, true))} /></label>
          <label className="crm-f">Ticket por defecto en deals nuevos (USD/mes)<Text type="number" min="0" value={c.ticket || ""} onCommit={(v) => edit((x) => A.applyConfigField(x, "ticket", v, true))} /></label>
        </div></section>
      <section className="crm-panel"><h2>Etapas del pipeline</h2><p className="crm-note">Nombre, probabilidad de cierre, tipo y color. Solo las etapas abiertas entran al ponderado; No show queda fuera hasta que se reagende. Días límite: cuando un deal pasa el 70% de ese plazo en la etapa se pone amarillo, y al pasarlo, rojo (frenado).</p>
        <div className="crm-row-h" aria-hidden="true"><span>Etapa</span><span>Prob. %</span><span>Tipo</span><span>Días límite</span><span>Color</span><span /></div>
        {c.stages.map((s, i) => (
          <div className="crm-row" key={s.id}>
            <Text aria-label="Nombre de etapa" value={s.name} onCommit={(v) => edit((x) => A.setStageField(x, i, "name", v))} />
            <Text type="number" min="0" max="100" aria-label="Probabilidad" value={s.prob} onCommit={(v) => edit((x) => A.setStageField(x, i, "prob", v))} />
            <select className="spicy-select" aria-label="Tipo de etapa" value={s.kind} onChange={(e) => edit((x) => A.setStageField(x, i, "kind", e.target.value))}>{KINDS_STAGE.map((k) => <option key={k[0]} value={k[0]}>{k[1]}</option>)}</select>
            <Text type="number" min="0" max="365" aria-label="Días límite antes de frenarse" value={s.rot || 0} disabled={s.kind !== "open"} onCommit={(v) => edit((x) => A.setStageField(x, i, "rot", v))} />
            <ColorPick value={s.color} onCommit={(v) => edit((x) => A.setStageField(x, i, "color", v))} />
            <span className="crm-acts"><button className="crm-icon" aria-label="Subir" onClick={() => edit((x) => A.moveStage(x, i, -1))}>↑</button><button className="crm-icon" aria-label="Bajar" onClick={() => edit((x) => A.moveStage(x, i, 1))}>↓</button>
              <button className="crm-icon" aria-label="Eliminar etapa" onClick={() => { let msg = ""; const res = commit((x) => { msg = A.deleteStage(x, i); return msg ? { error: msg } : null; }); if (res && res.error) alert(res.error); }}>✕</button></span>
          </div>))}
        <p><button className="crm-btn" onClick={() => edit((x) => A.addStage(x))}>Agregar etapa</button></p></section>
      <section className="crm-panel"><h2>Etiquetas</h2><p className="crm-note">El grupo ordena las etiquetas en el filtro y en la ficha del deal.</p>
        <datalist id="crm-tag-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
        {c.tags.map((t, i) => (
          <div className="crm-row tag" key={t.id}>
            <Text aria-label="Etiqueta" value={t.name} onCommit={(v) => edit((x) => { x.S.config.tags[i].name = v; })} />
            <Text aria-label="Grupo" list="crm-tag-groups" value={t.group} onCommit={(v) => edit((x) => { x.S.config.tags[i].group = v; })} />
            <ColorPick value={t.color} onCommit={(v) => edit((x) => { x.S.config.tags[i].color = v; })} />
            <span className="crm-acts"><button className="crm-icon" aria-label="Eliminar etiqueta" onClick={() => edit((x) => A.deleteTag(x, i))}>✕</button></span>
          </div>))}
        <p><button className="crm-btn" onClick={() => edit((x) => A.addTag(x))}>Agregar etiqueta</button></p></section>
      <section className="crm-panel"><h2>Mensajes de WhatsApp</h2><p className="crm-note">El botón de WhatsApp usa el mensaje de la próxima acción del deal; si no hay uno para esa acción, usa el general. Podés usar {"{nombre}"}, {"{empresa}"} y {"{vendedor}"}.</p>
        <div className="crm-lists">{(c.acciones || []).concat(["Recordatorio de pago", "_general"]).map((k) => (
          <label className="crm-f" key={k}>{k === "_general" ? "General" : k}<textarea className="spicy-input" defaultValue={(c.waTemplates || {})[k] || ""} key={(c.waTemplates || {})[k] || ""} onBlur={(e) => { if (e.target.value !== ((c.waTemplates || {})[k] || "")) edit((x) => { x.S.config.waTemplates = x.S.config.waTemplates || {}; x.S.config.waTemplates[k] = e.target.value; }); }} /></label>))}</div></section>
      <section className="crm-panel"><h2>Listas</h2><p className="crm-note">Una opción por línea.</p>
        <div className="crm-lists">{list("sellers", "Vendedores")}{list("countries", "Países")}{list("types", "Tipos de cuenta")}{list("sources", "Orígenes")}{list("partners", "Partners")}{list("acciones", "Acciones rápidas")}{list("lostReasons", "Motivos de pérdida")}{list("churnReasons", "Motivos de baja")}</div></section>
    </>
  );
}
