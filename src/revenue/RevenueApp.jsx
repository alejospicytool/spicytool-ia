// Sección "Métricas" (solo admins): MRR, clientes y movimientos calculados con Stripe + carga manual,
// más el histórico de ChartMogul. Los datos están en las tablas rev_* de Supabase (supabase_revenue.sql) y se
// escriben desde la Edge Function revenue-sync; desde acá solo se leen, salvo clasificar planes y tipos de cambio.
import { useCallback, useEffect, useMemo, useState } from "react";
import { MOV_TYPES, MOV_LABEL, summarize, movementsFor, churnRate, liveSeries, combinedSeries, compareWithHistory, healthAlerts, baselineDate, monthKeyOf, monthsBetween } from "./revenueMetrics.js";

const RED = "#EF3E3E", GREEN = "#16A34A", AMBER = "#D97706", GRAY = "#888";
const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const monthLabel = (m) => MONTHS_ES[Number(m.slice(5, 7)) - 1] + " " + m.slice(0, 4);
const usd = (n) => "USD " + Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + usd(Math.abs(n));
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }) : "—");
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }) : "—");

const CATEGORIES = [["sin_clasificar", "Sin clasificar"], ["saas", "SaaS (suma al MRR)"], ["pass_through", "Pass-through (créditos Ads)"], ["servicio", "Servicio (honorarios, landing, web)"], ["test", "Test (planes de 1 dólar)"]];
const DEFAULT_COUNTS = { saas: true, pass_through: false, servicio: false, test: false, sin_clasificar: false };
const ERRORS = {
  forbidden: "No tenés permiso (solo admins).",
  planes_sin_clasificar: "Todavía hay planes sin clasificar. Clasificalos en la pestaña Planes y volvé a intentar.",
  baseline_ya_hecho: "La carga inicial ya se hizo (es de una sola vez).",
  sin_carga_inicial: "Primero hay que hacer la carga inicial.",
  monto_invalido: "El monto no es válido.", intervalo_invalido: "El intervalo no es válido.", estado_invalido: "El estado no es válido.",
  cliente_requerido: "Falta el nombre del cliente.", plan_inexistente: "Elegí un plan válido.", suscripcion_invalida: "Esa suscripción no se puede editar a mano.",
};

async function callFn(sb, route, body) {
  const { data, error } = await sb.functions.invoke("revenue-sync/" + route, { body: body || {} });
  if (error) {
    let code = "error";
    try { const j = await error.context.json(); code = j.error || code; } catch { /* sin detalle */ }
    if (error.context && error.context.status === 404) throw new Error("La función revenue-sync todavía no está subida en Supabase.");
    throw new Error(ERRORS[code] || "No se pudo completar (" + code + ").");
  }
  return data;
}
async function fetchAll(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if ((data || []).length < 1000) return out;
  }
}

function useRevenueData(sb) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [customers, events, plans, runs, history, fx, audit] = await Promise.all([
        fetchAll((a, b) => sb.from("rev_customers").select("key,name,email,source,company_id,country,mrr,ever_paid,first_paid_at").order("key").range(a, b)),
        fetchAll((a, b) => sb.from("rev_mrr_events").select("id,customer_key,date,type,mrr_before,mrr_after,delta,baseline,cause").order("id").range(a, b)),
        fetchAll((a, b) => sb.from("rev_plans").select("price_id,name,category,counts_in_mrr").order("price_id").range(a, b)),
        sb.from("rev_sync_runs").select("id,at,kind,fixes,stale,unclassified,errors").order("at", { ascending: false }).limit(30).then((r) => { if (r.error) throw r.error; return r.data || []; }),
        fetchAll((a, b) => sb.from("rev_history_monthly").select("month,data").order("month").range(a, b)),
        sb.from("rev_fx_rates").select("currency,rate").then((r) => { if (r.error) throw r.error; return r.data || []; }),
        sb.from("rev_manual_audit").select("id,subscription_id,before,after,user_id,at").order("at", { ascending: false }).limit(20).then((r) => { if (r.error) throw r.error; return r.data || []; }),
      ]);
      setData({ customers, events, plans, runs, history, fx, audit });
      setError("");
    } catch (e) { setError(e.message || String(e)); }
  }, [sb]);
  useEffect(() => { load(); }, [load]);
  return { data, error, reload: load };
}

// ── Piezas visuales (mismo lenguaje que el resto del backoffice) ───────────────────────────────────────
const Title = ({ title, sub }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 4 }}>{title}</div>
    {sub && <div style={{ fontSize: 13, color: GRAY }}>{sub}</div>}
  </div>
);
const Kpi = ({ label, value, sub, warn }) => (
  <div className="spicy-kpi"><div className="spicy-kpi-label">{label}</div><div className="spicy-kpi-value" style={{ color: warn ? RED : "#111" }}>{value}</div>{sub && <div className="spicy-kpi-sub">{sub}</div>}</div>
);
const Alerts = ({ alerts, go }) => !alerts.length ? null : (
  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
    {alerts.map((a) => {
      const c = a.level === "error" ? { bg: "#FEF0F0", fg: "#C42F2F", bd: "#F8CACA" } : a.level === "warn" ? { bg: "#FEF3C7", fg: "#92400E", bd: "#FCE4A0" } : { bg: "#EEF4FB", fg: "#185FA5", bd: "#CFE0F3" };
      return (
        <div key={a.code} role="alert" style={{ background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ flex: 1 }}>{a.text}</span>
          {a.tab && <button className="spicy-btn-secondary" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => go(a.tab)}>Ver</button>}
        </div>
      );
    })}
  </div>
);
const Notice = ({ n }) => !n ? null : <div role="status" style={{ marginBottom: 12, fontSize: 13, padding: "9px 14px", borderRadius: 10, background: n.ok ? "#EDFAF3" : "#FEF0F0", color: n.ok ? "#15803D" : "#C42F2F", border: `1px solid ${n.ok ? "#BFE8D0" : "#F8CACA"}` }}>{n.text}</div>;

// Gráfico de MRR: gris = histórico ChartMogul (cerrado), rojo = sistema nuevo (el último punto es el mes en curso)
function MrrChart({ series }) {
  if (series.length < 2) return <div style={{ fontSize: 13, color: GRAY, padding: "24px 0" }}>Todavía no hay suficientes meses para graficar.</div>;
  const W = 760, H = 230, L = 56, R = 14, T = 14, B = 30;
  const max = Math.max(...series.map((p) => p.mrr), 1), top = Math.ceil(max / 1000) * 1000 || 1000;
  const x = (i) => L + (i * (W - L - R)) / (series.length - 1), y = (v) => T + (H - T - B) * (1 - v / top);
  const seg = (src) => series.map((p, i) => ({ p, i })).filter((q) => q.p.source === src);
  const path = (pts) => pts.map((q, k) => (k ? "L" : "M") + x(q.i).toFixed(1) + " " + y(q.p.mrr).toFixed(1)).join(" ");
  const old = seg("chartmogul"), nuevo = seg("nuevo");
  const joint = old.length && nuevo.length ? [old[old.length - 1], nuevo[0]] : null;
  const step = Math.ceil(series.length / 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="MRR por mes">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (<g key={f}><line x1={L} x2={W - R} y1={y(top * f)} y2={y(top * f)} stroke="#F0F0F0" /><text x={L - 8} y={y(top * f) + 4} fontSize="10" fill="#999" textAnchor="end">{Math.round((top * f) / 1000)}k</text></g>))}
      {old.length > 0 && <path d={path(old)} fill="none" stroke="#9AA3B2" strokeWidth="2" />}
      {joint && <path d={path(joint)} fill="none" stroke="#C9CED8" strokeWidth="2" strokeDasharray="4 4" />}
      {nuevo.length > 0 && <path d={path(nuevo)} fill="none" stroke={RED} strokeWidth="2.5" />}
      {series.map((p, i) => (
        <g key={p.month}>
          <circle cx={x(i)} cy={y(p.mrr)} r={p.source === "nuevo" ? 3.5 : 2.5} fill={p.source === "nuevo" ? RED : "#9AA3B2"} stroke={p.partial ? "#fff" : "none"}><title>{monthLabel(p.month)}: {usd(p.mrr)} · {p.customers} clientes{p.partial ? " (mes en curso)" : ""}{p.source === "chartmogul" ? " · ChartMogul" : ""}</title></circle>
          {i % step === 0 && <text x={x(i)} y={H - 10} fontSize="10" fill="#999" textAnchor="middle">{MONTHS_ES[Number(p.month.slice(5)) - 1]} {p.month.slice(2, 4)}</text>}
        </g>
      ))}
    </svg>
  );
}

// ── Resumen ────────────────────────────────────────────────────────────────────────────────────────────
function Resumen({ sb, d, reload, go }) {
  const now = useMemo(() => new Date(), []);
  const done = d.events.some((e) => e.baseline) || d.runs.some((r) => r.kind === "baseline");
  const sum = useMemo(() => summarize(d.customers), [d.customers]);
  const live = useMemo(() => liveSeries(d.customers, d.events, now), [d, now]);
  const series = useMemo(() => combinedSeries(d.history, live), [d.history, live]);
  const cur = monthKeyOf(now);
  const months = useMemo(() => (baselineDate(d.events) ? monthsBetween(monthKeyOf(baselineDate(d.events)), cur) : [cur]), [d.events, cur]);
  const [month, setMonth] = useState(cur);
  const mov = useMemo(() => movementsFor(d.events, month), [d.events, month]);
  const churn = useMemo(() => churnRate(d.customers, d.events, month), [d, month]);
  const cmp = useMemo(() => compareWithHistory(d.history, sum.mrr), [d.history, sum.mrr]);
  const alerts = useMemo(() => healthAlerts({ plans: d.plans, runs: d.runs, events: d.events, now }), [d, now]);
  const [busy, setBusy] = useState(""); const [notice, setNotice] = useState(null);
  const unclassified = d.plans.filter((p) => p.category === "sin_clasificar").length;

  async function run(kind) {
    if (kind === "baseline" && !window.confirm("Se va a registrar el MRR actual de cada cliente como punto de partida. Es de una sola vez y no se puede repetir. ¿Seguimos?")) return;
    setBusy(kind); setNotice(null);
    try {
      const r = await callFn(sb, kind === "pull" ? "pull" : "reconcile", kind === "baseline" ? { baseline: true } : {});
      setNotice({ ok: true, text: kind === "pull" ? `Se trajeron ${r.subscriptions} suscripciones de Stripe. Planes sin clasificar: ${r.unclassified}.` : `Carga inicial hecha: ${r.fixes.length} clientes con MRR.${r.errors.length ? ` ${r.errors.length} con error.` : ""}` });
      await reload();
    } catch (e) { setNotice({ ok: false, text: e.message }); }
    setBusy("");
  }

  return (
    <div>
      <Title title="Métricas de revenue" sub="MRR calculado con Stripe y los clientes que pagan por fuera. Reemplaza a ChartMogul." />
      <Alerts alerts={alerts.filter((a) => a.code !== "sin_baseline")} go={go} />
      <Notice n={notice} />

      {!done && (
        <div className="spicy-card" style={{ borderColor: "#CFE0F3" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Puesta en marcha</div>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 14 }}>Tres pasos, en este orden (así la carga inicial no cuenta toda la base como "nuevos").</div>
          <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
            <li>Traer las suscripciones de Stripe. {d.plans.length > 0 && <span style={{ color: GREEN }}>Hecho ({d.plans.length} planes).</span>}<div><button className="spicy-btn-secondary" style={{ marginTop: 6 }} disabled={!!busy} onClick={() => run("pull")}>{busy === "pull" ? "Trayendo…" : "Traer de Stripe"}</button></div></li>
            <li>Clasificar los planes (SaaS, pass-through, servicio, test) y cargar tipos de cambio si hay cobros que no son en USD. {d.plans.length > 0 && (unclassified ? <span style={{ color: AMBER }}>Faltan {unclassified}.</span> : <span style={{ color: GREEN }}>Todos clasificados.</span>)}<div><button className="spicy-btn-secondary" style={{ marginTop: 6 }} onClick={() => go("planes")}>Ir a Planes</button></div></li>
            <li>Carga inicial: registra el MRR actual de cada cliente como punto de partida.<div><button className="spicy-btn-primary" style={{ marginTop: 6 }} disabled={!!busy || !d.plans.length || unclassified > 0} onClick={() => run("baseline")}>{busy === "baseline" ? "Cargando…" : "Hacer carga inicial"}</button></div></li>
          </ol>
        </div>
      )}

      {done && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 16 }}>
            <Kpi label="MRR actual" value={usd(sum.mrr)} sub={`ARR ${usd(sum.arr)}`} />
            <Kpi label="Clientes que pagan" value={sum.customers} />
            <Kpi label="ARPA" value={usd(sum.arpa)} sub="MRR / clientes" />
            <Kpi label={"Churn de clientes · " + monthLabel(month)} value={churn ? (churn.rate * 100).toFixed(1) + "%" : "—"} sub={churn ? `${mov.churn.count} de ${churn.startCustomers} al inicio` : "sin base de comparación"} warn={churn && churn.rate > 0.05} />
          </div>

          <div className="spicy-card">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Movimientos del mes</div>
              <select className="spicy-select" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mes">{[...months].reverse().map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>
            </div>
            {MOV_TYPES.map((t) => (
              <div key={t} className="spicy-table-row">
                <div style={{ flex: 1, fontSize: 13 }}>{MOV_LABEL[t]}</div>
                <div style={{ width: 70, fontSize: 13, color: GRAY, textAlign: "right" }}>{mov[t].count} {mov[t].count === 1 ? "cliente" : "clientes"}</div>
                <div style={{ width: 130, fontSize: 13, fontWeight: 600, textAlign: "right", color: mov[t].mrr > 0 ? GREEN : mov[t].mrr < 0 ? RED : "#111" }}>{mov[t].mrr ? signed(mov[t].mrr) : usd(0)}</div>
              </div>
            ))}
            <div className="spicy-table-row" style={{ fontWeight: 700 }}>
              <div style={{ flex: 1, fontSize: 13 }}>Neto</div><div style={{ width: 70 }} />
              <div style={{ width: 130, fontSize: 13, textAlign: "right", color: mov.net > 0 ? GREEN : mov.net < 0 ? RED : "#111" }}>{mov.net ? signed(mov.net) : usd(0)}</div>
            </div>
          </div>
        </>
      )}

      <div className="spicy-card">
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>MRR por mes</div>
        <div style={{ fontSize: 12, color: GRAY, marginBottom: 12 }}>
          <span style={{ color: "#9AA3B2", fontWeight: 600 }}>● Histórico ChartMogul</span> (incluye planes que no son SaaS) · <span style={{ color: RED, fontWeight: 600 }}>● Sistema nuevo</span> (solo planes que cuentan como MRR)
        </div>
        <MrrChart series={series} />
        {cmp && done && <div style={{ fontSize: 12, color: GRAY, marginTop: 10 }}>Referencia: ChartMogul cerró {monthLabel(cmp.month)} en {usd(cmp.chartmogulMrr)}; hoy el sistema nuevo marca {usd(sum.mrr)} ({signed(cmp.diff)}). Se esperan diferencias porque ChartMogul sumaba planes que no son SaaS.</div>}
      </div>
    </div>
  );
}

// ── Clientes ───────────────────────────────────────────────────────────────────────────────────────────
function Clientes({ sb, d }) {
  const [q, setQ] = useState(""), [onlyActive, setOnlyActive] = useState(true), [open, setOpen] = useState(null), [subs, setSubs] = useState([]);
  const rows = useMemo(() => d.customers.filter((c) => (!onlyActive || Number(c.mrr) > 0) && (!q || ((c.name || "") + " " + (c.email || "") + " " + c.key).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => Number(b.mrr) - Number(a.mrr)), [d.customers, q, onlyActive]);
  const planName = useMemo(() => Object.fromEntries(d.plans.map((p) => [p.price_id, p.name || p.price_id])), [d.plans]);
  async function toggle(key) {
    if (open === key) { setOpen(null); return; }
    setOpen(key); setSubs([]);
    const { data } = await sb.from("rev_subscriptions").select("id,status,currency,items,discount").eq("customer_key", key);
    setSubs(data || []);
  }
  return (
    <div>
      <Title title="Clientes" sub={`${rows.length} ${rows.length === 1 ? "cliente" : "clientes"}${onlyActive ? " activos" : ""}`} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <input className="spicy-input" style={{ maxWidth: 300 }} placeholder="Buscar por nombre o email" aria-label="Buscar cliente" value={q} onChange={(e) => setQ(e.target.value)} />
        <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />Solo los que pagan hoy</label>
      </div>
      <div className="spicy-card" style={{ padding: "8px 24px" }}>
        {rows.length === 0 && <div style={{ padding: "20px 0", fontSize: 13, color: GRAY }}>No hay clientes para mostrar.</div>}
        {rows.map((c) => {
          const evs = d.events.filter((e) => e.customer_key === c.key).sort((a, b) => (a.date < b.date ? 1 : -1));
          return (
            <div key={c.key} style={{ borderBottom: "1px solid #F0F0F0" }}>
              <div className="spicy-table-row" style={{ borderBottom: "none", cursor: "pointer" }} onClick={() => toggle(c.key)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") toggle(c.key); }}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{c.name || c.email || c.key}</div><div style={{ fontSize: 11, color: GRAY }}>{c.email || c.key}</div></div>
                <span className={c.source === "stripe" ? "spicy-badge-gray" : "spicy-badge-amber"}>{c.source === "stripe" ? "Stripe" : "Manual"}</span>
                <div style={{ width: 110, fontSize: 13, fontWeight: 600, textAlign: "right" }}>{usd(c.mrr)}</div>
                <div style={{ width: 90, fontSize: 12, color: GRAY, textAlign: "right" }}>{c.first_paid_at ? "desde " + fmtDate(c.first_paid_at) : "—"}</div>
              </div>
              {open === c.key && (
                <div style={{ padding: "0 0 14px 4px", fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Suscripciones</div>
                  {subs.length === 0 ? <div style={{ color: GRAY }}>—</div> : subs.map((s) => (
                    <div key={s.id} style={{ marginBottom: 4 }}>{s.status} · {(s.items || []).map((it) => `${planName[it.priceId] || it.priceId} ${(it.unitAmount * it.quantity / 100).toLocaleString("es-AR")} ${String(s.currency).toUpperCase()}/${it.interval === "year" ? "año" : "mes"}`).join(", ")}{s.discount ? " · con descuento" : ""}</div>
                  ))}
                  <div style={{ fontWeight: 600, margin: "10px 0 4px" }}>Movimientos</div>
                  {evs.length === 0 ? <div style={{ color: GRAY }}>Sin movimientos.</div> : evs.map((e) => (
                    <div key={e.id} style={{ display: "flex", gap: 10, marginBottom: 3 }}><span style={{ width: 80, color: GRAY }}>{fmtDate(e.date)}</span><span style={{ width: 110 }}>{e.baseline ? "Carga inicial" : MOV_LABEL[e.type] || e.type}</span><span>{usd(e.mrr_before)} → {usd(e.mrr_after)}</span></div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Planes y tipos de cambio ───────────────────────────────────────────────────────────────────────────
function Planes({ sb, d, reload }) {
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState(null);
  const [fxForm, setFxForm] = useState({ currency: "", rate: "" });
  const done = d.events.some((e) => e.baseline) || d.runs.some((r) => r.kind === "baseline");
  const sorted = useMemo(() => [...d.plans].sort((a, b) => (a.category === "sin_clasificar" ? 0 : 1) - (b.category === "sin_clasificar" ? 0 : 1) || String(a.name || a.price_id).localeCompare(String(b.name || b.price_id))), [d.plans]);

  async function update(p, patch) {
    setNotice(null);
    const { error } = await sb.from("rev_plans").update(patch).eq("price_id", p.price_id);
    if (error) { setNotice({ ok: false, text: "No se pudo guardar: " + error.message }); return; }
    setDirty(true); await reload();
  }
  async function recompute() {
    setBusy(true); setNotice(null);
    try { const r = await callFn(sb, "recompute"); setNotice({ ok: true, text: `MRR recalculado: ${r.fixes.length} ${r.fixes.length === 1 ? "cliente cambió" : "clientes cambiaron"}.${r.errors.length ? " " + r.errors.length + " con error (¿falta un tipo de cambio?)." : ""}` }); setDirty(false); await reload(); }
    catch (e) { setNotice({ ok: false, text: e.message }); }
    setBusy(false);
  }
  async function saveFx(e) {
    e.preventDefault();
    const currency = fxForm.currency.trim().toLowerCase(), rate = Number(fxForm.rate);
    if (!/^[a-z]{3}$/.test(currency) || !(rate > 0)) { setNotice({ ok: false, text: "Poné la moneda (3 letras, ej. ARS) y una tasa mayor a 0 (cuántos USD vale 1 unidad)." }); return; }
    const { error } = await sb.from("rev_fx_rates").upsert({ currency, rate, updated_at: new Date().toISOString() }, { onConflict: "currency" });
    if (error) { setNotice({ ok: false, text: "No se pudo guardar: " + error.message }); return; }
    setFxForm({ currency: "", rate: "" }); setDirty(true); await reload();
  }
  async function delFx(currency) { await sb.from("rev_fx_rates").delete().eq("currency", currency); setDirty(true); await reload(); }

  return (
    <div>
      <Title title="Planes" sub="Los planes nuevos de Stripe entran sin clasificar y no suman al MRR hasta que los clasifiques." />
      <Notice n={notice} />
      {dirty && done && (
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 12, background: "#FEF3C7", border: "1px solid #FCE4A0", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#92400E" }}>
          <span style={{ flex: 1 }}>Hiciste cambios: hay que recalcular el MRR para que se apliquen.</span>
          <button className="spicy-btn-primary" disabled={busy} onClick={recompute}>{busy ? "Recalculando…" : "Aplicar y recalcular"}</button>
        </div>
      )}
      <div className="spicy-card" style={{ padding: "8px 24px" }}>
        {sorted.length === 0 && <div style={{ padding: "20px 0", fontSize: 13, color: GRAY }}>Todavía no hay planes. Se cargan al traer los datos de Stripe (Resumen → Puesta en marcha).</div>}
        {sorted.map((p) => (
          <div key={p.price_id} className="spicy-table-row">
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{p.name || "(sin nombre)"}</div><div style={{ fontSize: 11, color: GRAY, fontFamily: "monospace" }}>{p.price_id}</div></div>
            <select className="spicy-select" aria-label={"Categoría de " + (p.name || p.price_id)} value={p.category} onChange={(e) => update(p, { category: e.target.value, counts_in_mrr: DEFAULT_COUNTS[e.target.value] })}>
              {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center", width: 120 }}><input type="checkbox" checked={p.counts_in_mrr} disabled={p.category === "sin_clasificar"} onChange={(e) => update(p, { counts_in_mrr: e.target.checked })} />Suma al MRR</label>
          </div>
        ))}
      </div>

      <div className="spicy-card">
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Tipos de cambio</div>
        <div style={{ fontSize: 12, color: GRAY, marginBottom: 12 }}>Solo hace falta si algún cobro no es en USD. Sin tasa cargada el cálculo da error en vez de inventar un número.</div>
        {d.fx.map((f) => (
          <div key={f.currency} className="spicy-table-row"><div style={{ flex: 1, fontSize: 13 }}>1 {String(f.currency).toUpperCase()} = {Number(f.rate)} USD</div><button className="spicy-btn-secondary" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => delFx(f.currency)}>Quitar</button></div>
        ))}
        <form onSubmit={saveFx} style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input className="spicy-input" style={{ width: 90 }} placeholder="ARS" aria-label="Moneda" maxLength={3} value={fxForm.currency} onChange={(e) => setFxForm({ ...fxForm, currency: e.target.value })} />
          <input className="spicy-input" style={{ width: 140 }} placeholder="0.0009" aria-label="USD por unidad" inputMode="decimal" value={fxForm.rate} onChange={(e) => setFxForm({ ...fxForm, rate: e.target.value })} />
          <button className="spicy-btn-secondary" type="submit">Guardar tasa</button>
        </form>
      </div>
    </div>
  );
}

// ── Carga manual ───────────────────────────────────────────────────────────────────────────────────────
const EMPTY = { customerKey: "", customerName: "", email: "", planPriceId: "", newPlanName: "", amount: "", currency: "usd", interval: "month", status: "active", subscriptionId: "" };
function Manual({ sb, d, reload }) {
  const [f, setF] = useState(EMPTY), [busy, setBusy] = useState(false), [notice, setNotice] = useState(null), [subs, setSubs] = useState([]);
  const counted = d.plans.filter((p) => p.counts_in_mrr);
  const names = useMemo(() => Object.fromEntries(d.customers.map((c) => [c.key, c.name || c.email || c.key])), [d.customers]);
  const planName = useMemo(() => Object.fromEntries(d.plans.map((p) => [p.price_id, p.name || p.price_id])), [d.plans]);
  const loadSubs = useCallback(async () => { const { data } = await sb.from("rev_subscriptions").select("id,customer_key,status,currency,items").eq("source", "manual").order("updated_at", { ascending: false }); setSubs(data || []); }, [sb]);
  useEffect(() => { loadSubs(); }, [loadSubs]);

  function edit(s) {
    const it = s.items[0] || {};
    setNotice(null);
    setF({ customerKey: s.customer_key, customerName: names[s.customer_key] || "", email: "", planPriceId: it.priceId || "", newPlanName: "", amount: String((it.unitAmount || 0) / 100), currency: s.currency, interval: it.interval || "month", status: s.status, subscriptionId: s.id });
    window.scrollTo(0, 0);
  }
  async function submit(e) {
    e.preventDefault(); setBusy(true); setNotice(null);
    try {
      const body = { customerKey: f.customerKey || undefined, customerName: f.customerName, email: f.email || undefined, amount: Number(f.amount), currency: f.currency, interval: f.interval, status: f.status, subscriptionId: f.subscriptionId || undefined };
      if (f.planPriceId) body.planPriceId = f.planPriceId; else if (f.newPlanName.trim()) body.newPlan = { name: f.newPlanName.trim(), category: "saas", countsInMrr: true };
      await callFn(sb, "manual", body);
      setNotice({ ok: true, text: f.subscriptionId ? "Suscripción actualizada." : "Suscripción creada." });
      setF(EMPTY); await reload(); await loadSubs();
    } catch (err) { setNotice({ ok: false, text: err.message }); }
    setBusy(false);
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const lbl = { fontSize: 12, color: GRAY, marginBottom: 4, display: "block" };

  return (
    <div>
      <Title title="Carga manual" sub="Clientes que pagan por fuera de Stripe. Usan el mismo cálculo; cada cambio queda auditado." />
      <Notice n={notice} />
      <form className="spicy-card" onSubmit={submit}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>{f.subscriptionId ? "Editar suscripción" : "Nueva suscripción"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          <div><label style={lbl} htmlFor="m-name">Cliente</label><input id="m-name" className="spicy-input" value={f.customerName} onChange={set("customerName")} disabled={!!f.customerKey} placeholder="Nombre de la empresa" /></div>
          <div><label style={lbl} htmlFor="m-email">Email (opcional)</label><input id="m-email" className="spicy-input" type="email" value={f.email} onChange={set("email")} /></div>
          <div><label style={lbl} htmlFor="m-plan">Plan</label>
            <select id="m-plan" className="spicy-select" style={{ width: "100%" }} value={f.planPriceId} onChange={set("planPriceId")}><option value="">Crear un plan nuevo…</option>{counted.map((p) => <option key={p.price_id} value={p.price_id}>{p.name || p.price_id}</option>)}</select></div>
          {!f.planPriceId && <div><label style={lbl} htmlFor="m-newplan">Nombre del plan nuevo</label><input id="m-newplan" className="spicy-input" value={f.newPlanName} onChange={set("newPlanName")} placeholder="Ej: Plan Pro (directo)" /></div>}
          <div><label style={lbl} htmlFor="m-amount">Monto</label><input id="m-amount" className="spicy-input" inputMode="decimal" value={f.amount} onChange={set("amount")} placeholder="250" /></div>
          <div><label style={lbl} htmlFor="m-cur">Moneda</label><input id="m-cur" className="spicy-input" maxLength={3} value={f.currency} onChange={set("currency")} /></div>
          <div><label style={lbl} htmlFor="m-int">Cobro</label><select id="m-int" className="spicy-select" style={{ width: "100%" }} value={f.interval} onChange={set("interval")}><option value="month">Mensual</option><option value="year">Anual</option></select></div>
          <div><label style={lbl} htmlFor="m-st">Estado</label><select id="m-st" className="spicy-select" style={{ width: "100%" }} value={f.status} onChange={set("status")}><option value="active">Activa</option><option value="canceled">Cancelada</option></select></div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="spicy-btn-primary" type="submit" disabled={busy}>{busy ? "Guardando…" : f.subscriptionId ? "Guardar cambios" : "Crear suscripción"}</button>
          {(f.subscriptionId || f.customerName) && <button className="spicy-btn-secondary" type="button" onClick={() => { setF(EMPTY); setNotice(null); }}>Cancelar</button>}
        </div>
      </form>

      <div className="spicy-card" style={{ padding: "8px 24px" }}>
        <div style={{ fontWeight: 600, padding: "12px 0 4px" }}>Suscripciones manuales</div>
        {subs.length === 0 && <div style={{ padding: "12px 0", fontSize: 13, color: GRAY }}>Todavía no hay ninguna.</div>}
        {subs.map((s) => { const it = s.items[0] || {}; return (
          <div key={s.id} className="spicy-table-row">
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{names[s.customer_key] || s.customer_key}</div><div style={{ fontSize: 11, color: GRAY }}>{planName[it.priceId] || it.priceId}</div></div>
            <span className={s.status === "active" ? "spicy-badge-green" : "spicy-badge-gray"}>{s.status === "active" ? "Activa" : "Cancelada"}</span>
            <div style={{ width: 150, fontSize: 13, textAlign: "right" }}>{((it.unitAmount || 0) / 100).toLocaleString("es-AR")} {String(s.currency).toUpperCase()}/{it.interval === "year" ? "año" : "mes"}</div>
            <button className="spicy-btn-secondary" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => edit(s)}>Editar</button>
          </div>); })}
      </div>

      <div className="spicy-card" style={{ padding: "8px 24px" }}>
        <div style={{ fontWeight: 600, padding: "12px 0 4px" }}>Últimos cambios</div>
        {d.audit.length === 0 && <div style={{ padding: "12px 0", fontSize: 13, color: GRAY }}>Sin cambios registrados.</div>}
        {d.audit.map((a) => { const b = a.before && a.before.items && a.before.items[0], n = a.after && a.after.items && a.after.items[0]; return (
          <div key={a.id} className="spicy-table-row" style={{ fontSize: 12 }}>
            <span style={{ width: 110, color: GRAY }}>{fmtDateTime(a.at)}</span>
            <span style={{ flex: 1 }}>{names[a.after && a.after.customerKey] || (a.after && a.after.customerKey)}</span>
            <span>{b ? `${(b.unitAmount / 100).toLocaleString("es-AR")} → ` : "Alta: "}{n ? (n.unitAmount / 100).toLocaleString("es-AR") : "—"} · {a.after && a.after.status}</span>
          </div>); })}
      </div>
    </div>
  );
}

// ── Histórico ChartMogul ───────────────────────────────────────────────────────────────────────────────
function Historico({ d }) {
  const rows = [...d.history].sort((a, b) => (a.month < b.month ? 1 : -1));
  const cols = [["mrr_usd", "MRR"], ["clientes_pagos", "Clientes"], ["new_mrr", "Nuevo"], ["expansion_mrr", "Expansión"], ["contraction_mrr", "Contracción"], ["churn_mrr", "Churn"], ["net_mrr", "Neto"]];
  return (
    <div>
      <Title title="Histórico de ChartMogul" sub="Exportado el 10/11/2026. Incluye planes que no son SaaS (créditos de Google Ads, honorarios, landing). El mes parcial no se usa en el gráfico." />
      <div className="spicy-card" style={{ padding: "8px 24px", overflowX: "auto" }}>
        {rows.length === 0 ? <div style={{ padding: "20px 0", fontSize: 13, color: GRAY }}>El histórico todavía no está cargado (scripts/revenue-import.py).</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 640 }}>
            <thead><tr><th style={{ textAlign: "left", padding: "10px 6px", color: GRAY, fontWeight: 500 }}>Mes</th>{cols.map(([, l]) => <th key={l} style={{ textAlign: "right", padding: "10px 6px", color: GRAY, fontWeight: 500 }}>{l}</th>)}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.month} style={{ borderTop: "1px solid #F0F0F0" }}>
                <td style={{ padding: "8px 6px", fontWeight: 600 }}>{monthLabel(r.month)}{r.data.parcial === "si" && <span className="spicy-badge-amber" style={{ marginLeft: 6 }}>parcial</span>}</td>
                {cols.map(([k]) => <td key={k} style={{ padding: "8px 6px", textAlign: "right" }}>{k === "clientes_pagos" ? r.data[k] : usd(r.data[k])}</td>)}
              </tr>))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Contenedor ─────────────────────────────────────────────────────────────────────────────────────────

export default function RevenueApp({ sb, view, setView }) {
  const { data, error, reload } = useRevenueData(sb);
  const go = (tab) => setView(tab === "planes" ? "metrics_plans" : "metrics");
  if (error) return <div style={{ padding: "3rem 1rem", textAlign: "center", color: RED, fontSize: 14 }}>No se pudieron cargar las métricas: {error}. Si es la primera vez, falta aplicar supabase_revenue.sql en Supabase.</div>;
  if (!data) return <div style={{ padding: "3rem 1rem", textAlign: "center", color: GRAY, fontSize: 14 }}>Cargando métricas...</div>;
  return (
    <div>
      {view === "metrics" && <Resumen sb={sb} d={data} reload={reload} go={go} />}
      {view === "metrics_customers" && <Clientes sb={sb} d={data} />}
      {view === "metrics_plans" && <Planes sb={sb} d={data} reload={reload} />}
      {view === "metrics_manual" && <Manual sb={sb} d={data} reload={reload} />}
      {view === "metrics_history" && <Historico d={data} />}
    </div>
  );
}
