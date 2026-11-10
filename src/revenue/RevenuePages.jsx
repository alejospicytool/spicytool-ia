// Páginas de la sección Métricas: Overview, MRR & ARR, Churn, Retención, Pagos fallidos, Clientes, Proyección y Planes.
import { useMemo, useState } from "react";
import { periodKpis, customerMonthly, segmentSummary, matchSegment, projectionMonths, projectionDefaults, computeProjection, failuresSummary, liveCustomerKeys, planUsage, movementsFor } from "./revenueMetrics.js";
import { Kpi, PageHeader, Notice, Alerts, Modal, MonthBars, money, signed, pct, monthLabel, monthShort, fmtDate, fmtDateTime, initials } from "./revenueUi.jsx";
import { callFn } from "./revenueApi.js";

const SEG_LABEL = { inmobiliaria: "🏠 Inmobiliaria", otro: "◎ Otro" };
const CATEGORIES = [["sin_clasificar", "Sin clasificar"], ["saas", "SaaS (suma al MRR)"], ["pass_through", "Pass-through (créditos Ads)"], ["servicio", "Servicio (honorarios, landing, web)"], ["test", "Test (planes de 1 dólar)"]];
const DEFAULT_COUNTS = { saas: true, pass_through: false, servicio: false, test: false, sin_clasificar: false };
const REASONS = { card_declined: "Tarjeta rechazada", insufficient_funds: "Fondos insuficientes", expired_card: "Tarjeta vencida", incorrect_cvc: "CVC incorrecto", processing_error: "Error de procesamiento", authentication_required: "Requiere autenticación", do_not_honor: "El banco no autorizó", lost_card: "Tarjeta reportada", stolen_card: "Tarjeta reportada", generic_decline: "Rechazo genérico", fraudulent: "Marcada como fraude" };
const reasonText = (f) => (f.failure_code ? REASONS[f.failure_code] || f.failure_code : f.failure_message || "Motivo no informado");

// ── Overview ─────────────────────────────────────────────────────────────────────────────────────────
export function Overview({ d, rows, seg, done, alerts, go, sb, reload }) {
  const k = useMemo(() => periodKpis(rows), [rows]);
  const customers = useMemo(() => d.customers.filter((c) => Number(c.mrr) > 0 && matchSegment(c, seg)), [d.customers, seg]);
  const [busy, setBusy] = useState(""), [notice, setNotice] = useState(null);
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
  const last = k && k.last;
  const lastMov = last && last.source === "nuevo" ? movementsFor(d.events, last.month) : null;
  const net = last ? last.net : 0;

  return (
    <div>
      <PageHeader title="Overview" sub={rows.length ? `${monthLabel(rows[0].month)} → ${monthLabel(rows[rows.length - 1].month)}${seg !== "todos" ? " · segmento: " + (seg === "sin" ? "sin segmento" : SEG_LABEL[seg]) : ""}` : ""} />
      <Alerts alerts={alerts} go={go} />
      <Notice n={notice} />
      {!done && (
        <div className="card" style={{ borderColor: "#CFE0F3" }}>
          <div className="card-title">Puesta en marcha</div>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 14 }}>Tres pasos, en este orden (así la carga inicial no cuenta toda la base como "nuevos").</div>
          <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
            <li>Traer las suscripciones de Stripe. {d.plans.length > 0 && <span style={{ color: "#16A34A" }}>Hecho ({d.plans.length} planes).</span>}<div><button className="btn-secondary" style={{ marginTop: 6 }} disabled={!!busy} onClick={() => run("pull")}>{busy === "pull" ? "Trayendo…" : "Traer de Stripe"}</button></div></li>
            <li>Clasificar los planes (SaaS, pass-through, servicio, test) y cargar tipos de cambio si hay cobros que no son en USD. {d.plans.length > 0 && (unclassified ? <span style={{ color: "#D97706" }}>Faltan {unclassified}.</span> : <span style={{ color: "#16A34A" }}>Todos clasificados.</span>)}<div><button className="btn-secondary" style={{ marginTop: 6 }} onClick={() => go("planes")}>Ir a Planes</button></div></li>
            <li>Carga inicial: registra el MRR actual de cada cliente como punto de partida.<div><button className="btn-primary" style={{ marginTop: 6 }} disabled={!!busy || !d.plans.length || unclassified > 0} onClick={() => run("baseline")}>{busy === "baseline" ? "Cargando…" : "Hacer carga inicial"}</button></div></li>
          </ol>
        </div>
      )}
      {!k ? <div className="card"><div className="empty">Todavía no hay meses para mostrar. Cargá el histórico (scripts/revenue-import.py) o hacé la carga inicial.</div></div> : (
        <>
          <div className="kpi-grid">
            <Kpi color="green" label={`MRR (${monthLabel(last.month)})`} value={money(last.mrr)} sub={`ARR: ${money(last.mrr * 12)}${last.partial ? " · mes en curso" : ""}`} />
            <Kpi color="blue" label="Clientes activos" value={done ? customers.length : last.customers} sub={done ? `Segmento: ${seg === "todos" ? "todos" : seg === "sin" ? "sin segmento" : seg}` : "según ChartMogul"} />
            <Kpi color="red" label="Churn acumulado" value={money(k.churnTotal)} valueColor="var(--accent)" sub={`${rows.length} ${rows.length === 1 ? "mes" : "meses"}`} />
            <Kpi color="yellow" label="New biz acumulado" value={money(k.newTotal)} valueColor="var(--yellow)" sub="en el período" />
          </div>
          <div className="card">
            <div className="card-title">MRR mensual
              <div className="legend"><span><i style={{ background: "var(--green)" }} />MRR</span><span><i style={{ background: "var(--blue)" }} />New biz</span><span><i style={{ background: "var(--accent)" }} />Churn</span></div>
            </div>
            <MonthBars rows={rows} />
            {rows.some((r) => r.partial) && <div style={{ fontSize: 11, color: "#888", marginTop: 8 }}>* Mes en curso. Hasta octubre de 2026 la historia es de ChartMogul (incluye planes que no son SaaS); desde la carga inicial, del sistema nuevo.</div>}
          </div>
          <div className="card">
            <div className="card-title">Movimientos · {monthLabel(last.month)}</div>
            {[["new", "New business", last.newBiz, "var(--blue)", "+", lastMov && lastMov.new.count], ["expansion", "Expansion", last.expansion, "var(--green)", "+"], ["contraction", "Contraction", last.contraction, "var(--yellow)", "-"], ["churn", "Churn", last.churn, "var(--accent)", "-", lastMov && lastMov.churn.count], ["reactivation", "Reactivación", last.reactivation, "var(--green)", "+"]].map(([key, label, v, color, sign, n]) => (
              <div key={key} className="movement-row">
                <div style={{ display: "flex", alignItems: "center", flex: 1 }}><span className="dot" style={{ background: color }} /><div><div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>{n != null && <div style={{ fontSize: 11, color: "#888" }}>{n} {n === 1 ? "cliente" : "clientes"}</div>}</div></div>
                <div className="mono" style={{ color, fontWeight: 600, fontSize: 13 }}>{sign}{money(v)}</div>
              </div>
            ))}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "#888" }}>Net movement</span>
              <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: net >= 0 ? "var(--green)" : "var(--accent)" }}>{signed(net)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── MRR & ARR ────────────────────────────────────────────────────────────────────────────────────────
export function MrrPage({ rows }) {
  const k = useMemo(() => periodKpis(rows), [rows]);
  if (!k) return <div><PageHeader title="MRR & ARR" /><div className="card"><div className="empty">Sin datos en este período.</div></div></div>;
  return (
    <div>
      <PageHeader title="MRR & ARR" sub={`${monthLabel(rows[0].month)} → ${monthLabel(rows[rows.length - 1].month)}`} />
      <div className="kpi-grid">
        <Kpi color="green" label="MRR al cierre" value={money(k.last.mrr)} sub={monthLabel(k.last.month)} />
        <Kpi color="blue" label="Crecimiento" value={k.growthPct == null ? "—" : (k.growthPct >= 0 ? "+" : "") + k.growthPct + "%"} sub={`${monthLabel(k.first.month)} → ${monthLabel(k.last.month)}`} />
        <Kpi color="yellow" label="Mejor new biz" value={money(k.bestNew.newBiz)} valueColor="var(--yellow)" sub={monthLabel(k.bestNew.month)} />
      </div>
      {rows.some((r) => r.source === "chartmogul") && rows.some((r) => r.source === "nuevo") && <div className="notice" style={{ background: "#EEF4FB", color: "#185FA5", border: "1px solid #CFE0F3" }}>Este período cruza de ChartMogul (incluye planes que no son SaaS) al sistema nuevo (solo planes que suman al MRR): el crecimiento y la comparación entre esos meses pueden mostrar un salto que no es real.</div>}
      <div className="card"><div className="card-title">Tabla mensual</div><div className="table-wrap"><table>
        <thead><tr><th>Mes</th><th>MRR</th><th>New biz</th><th>Expansion</th><th>Contraction</th><th>Churn</th><th>Net</th><th>ARR</th><th>Fuente</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.month}>
            <td>{monthLabel(r.month)}{r.partial && <span className="badge badge-yellow" style={{ marginLeft: 6 }}>en curso</span>}</td>
            <td>{money(r.mrr)}</td><td className="pos">+{money(r.newBiz)}</td><td className={r.expansion > 0 ? "pos" : ""}>+{money(r.expansion)}</td>
            <td className={r.contraction > 0 ? "neg" : ""}>-{money(r.contraction)}</td><td className="neg">-{money(r.churn)}</td>
            <td className={"bold " + (r.net >= 0 ? "pos" : "neg")}>{signed(r.net)}</td><td>{money(r.mrr * 12)}</td>
            <td><span className={"badge " + (r.source === "nuevo" ? "badge-red" : "badge-muted")}>{r.source === "nuevo" ? "Nuevo" : "ChartMogul"}</span></td>
          </tr>))}</tbody></table></div></div>
      <div className="card"><div className="card-title">ARPA mensual</div><div className="table-wrap"><table>
        <thead><tr><th>Mes</th><th>ARPA</th><th>Variación</th></tr></thead>
        <tbody>{rows.map((r, i) => { const p = rows[i - 1]; const v = p && p.arpa ? ((r.arpa - p.arpa) / p.arpa) * 100 : null; return (
          <tr key={r.month}><td>{monthLabel(r.month)}</td><td>{money(r.arpa)}</td><td className={v == null ? "" : v >= 0 ? "pos" : "neg"}>{v == null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(1) + "%"}</td></tr>); })}</tbody></table></div></div>
    </div>
  );
}

// ── Churn ────────────────────────────────────────────────────────────────────────────────────────────
export function ChurnPage({ rows, d, now }) {
  const k = useMemo(() => periodKpis(rows), [rows]);
  const fs = useMemo(() => failuresSummary({ failures: d.failures, customers: d.customers, liveKeys: liveCustomerKeys(d.subs), involuntaryKeys: d.involuntaryKeys, events: d.events, now }), [d, now]);
  if (!k) return <div><PageHeader title="Churn" /><div className="card"><div className="empty">Sin datos en este período.</div></div></div>;
  return (
    <div>
      <PageHeader title="Churn" sub={`${monthLabel(rows[0].month)} → ${monthLabel(rows[rows.length - 1].month)}`} />
      {k.churnMax ? (
        <div className="kpi-grid">
          <Kpi color="red" label="Churn máximo" value={pct(k.churnMax.churnPct)} valueColor="var(--accent)" sub={`${monthLabel(k.churnMax.month)} · ${k.churnMax.churnClients} clientes`} />
          <Kpi color="green" label="Mejor mes" value={pct(k.churnMin.churnPct)} sub={monthLabel(k.churnMin.month)} />
          <Kpi color="yellow" label="Promedio" value={pct(k.churnAvg)} valueColor="var(--yellow)" sub="mensual en el período" />
        </div>
      ) : <div className="card"><div className="empty">Sin base de comparación para calcular el churn % en este período.</div></div>}
      <div className="card"><div className="card-title">Churn mensual</div><div className="table-wrap"><table>
        <thead><tr><th>Mes</th><th>Churn %</th><th>Clientes</th><th>MRR perdido</th><th>Inicio</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.month}><td>{monthLabel(r.month)}</td><td className={r.churnPct > 10 ? "neg bold" : "neg"}>{pct(r.churnPct)}</td><td>{r.churnClients}</td><td className="neg">-{money(r.churn)}</td><td>{r.startCustomers == null ? "—" : r.startCustomers}</td></tr>))}</tbody></table></div></div>
      {d.v2 && (
        <div className="card">
          <div className="card-title">Churn involuntario · {monthLabel(rows[rows.length - 1].month)}</div>
          <div style={{ fontSize: 13 }}>
            {fs.involuntary.of === 0 ? "Este mes no hubo bajas." : <><b className="mono">{fs.involuntary.count}</b> de <b className="mono">{fs.involuntary.of}</b> {fs.involuntary.of === 1 ? "baja fue" : "bajas fueron"} por falta de pago (<span className="mono neg">-{money(fs.involuntary.mrr)}</span> de MRR). Esas son recuperables mejorando el cobro.</>}
          </div>
        </div>
      )}
      <div className="card"><div className="card-title">Registrar una baja</div><div style={{ fontSize: 13, color: "#666" }}>Los clientes de Stripe se dan de baja solos cuando se cancela la suscripción. Para un cliente que paga por fuera, usá <b>Clientes → Dar de baja</b>: queda registrado como churn en el mes y auditado.</div></div>
    </div>
  );
}

// ── Retención ────────────────────────────────────────────────────────────────────────────────────────
export function RetentionPage({ rows }) {
  const k = useMemo(() => periodKpis(rows), [rows]);
  const withNrr = rows.filter((r) => r.nrr != null);
  if (!k || !withNrr.length) return <div><PageHeader title="Retención" /><div className="card"><div className="empty">Sin base de comparación para calcular la retención en este período.</div></div></div>;
  const color = (v) => (v >= 100 ? "var(--green)" : v >= 97 ? "var(--blue)" : "var(--accent)");
  return (
    <div>
      <PageHeader title="Retención" sub={`${monthLabel(rows[0].month)} → ${monthLabel(rows[rows.length - 1].month)}`} />
      <div className="kpi-grid">
        <Kpi color="green" label="Mejor net retention" value={pct(k.nrrBest.nrr)} sub={monthLabel(k.nrrBest.month)} />
        <Kpi color="blue" label="Promedio período" value={pct(k.nrrAvg)} sub="net MRR retention" />
      </div>
      <div className="card"><div className="card-title">Net MRR Retention mensual <span className="card-sub">(MRR de inicio + expansión − contracción − churn) / MRR de inicio</span></div>
        {withNrr.map((r) => (
          <div key={r.month} className="ret-meter"><div className="ret-label">{monthLabel(r.month)}</div><div className="ret-bar-wrap"><div className="ret-bar" style={{ width: (Math.min(r.nrr, 105) / 105) * 100 + "%", background: color(r.nrr) }} /></div><div className="ret-value" style={{ color: color(r.nrr) }}>{pct(r.nrr)}</div></div>))}
      </div>
      <div className="card"><div className="card-title">Tabla completa</div><div className="table-wrap"><table>
        <thead><tr><th>Mes</th><th>MRR inicio</th><th>Expansión neta</th><th>Churn MRR</th><th>Net ret.</th></tr></thead>
        <tbody>{withNrr.map((r) => (
          <tr key={r.month}><td>{monthLabel(r.month)}</td><td>{money(r.startMrr)}</td><td className={r.expansion - r.contraction > 0 ? "pos" : ""}>{signed(r.expansion - r.contraction)}</td><td className="neg">-{money(r.churn)}</td><td className={r.nrr >= 100 ? "pos bold" : r.nrr < 95 ? "neg bold" : ""}>{pct(r.nrr)}</td></tr>))}</tbody></table></div></div>
    </div>
  );
}

// ── Pagos fallidos ───────────────────────────────────────────────────────────────────────────────────
export function FailedPage({ d, now }) {
  const fs = useMemo(() => failuresSummary({ failures: d.failures, customers: d.customers, liveKeys: liveCustomerKeys(d.subs), involuntaryKeys: d.involuntaryKeys, events: d.events, now }), [d, now]);
  const resolved = useMemo(() => d.failures.filter((f) => f.status !== "open" && f.resolved_at && now - new Date(f.resolved_at) < 30 * 864e5).sort((a, b) => (a.resolved_at < b.resolved_at ? 1 : -1)), [d.failures, now]);
  const [showResolved, setShowResolved] = useState(false), [showLegacy, setShowLegacy] = useState(false);
  const names = useMemo(() => Object.fromEntries(d.customers.map((c) => [c.key, c])), [d.customers]);
  if (!d.v2) return <div><PageHeader title="Pagos fallidos" /><div className="card"><div className="empty">Falta aplicar <b>supabase_revenue_v2.sql</b> en Supabase para registrar los pagos fallidos.</div></div></div>;
  const STATUS = { recovered: ["badge-green", "Recuperado"], void: ["badge-muted", "Anulada"], uncollectible: ["badge-red", "Incobrable"] };
  return (
    <div>
      <PageHeader title="Pagos fallidos" sub="Facturas de Stripe con intentos de cobro rechazados. Stripe reintenta solo; si se agotan los reintentos, la suscripción se cancela." />
      <div className="kpi-grid">
        <Kpi color="red" label="MRR en riesgo" value={money(fs.mrrAtRisk)} valueColor={fs.mrrAtRisk ? "var(--accent)" : undefined} sub={`${fs.customersAtRisk} ${fs.customersAtRisk === 1 ? "cliente" : "clientes"} con una factura impaga`} />
        <Kpi color="yellow" label="Facturas abiertas" value={fs.openCount} sub={fs.openCount ? `${money(fs.openAmount)} por cobrar · clientes con suscripción activa` : "nada pendiente"} />
        <Kpi color="green" label="Recuperados este mes" value={fs.recoveredCount} sub={fs.recoveredCount ? `${money(fs.recoveredAmount)} cobrados` : "—"} />
        <Kpi color="blue" label="Tasa de recuperación" value={fs.recoveryRate == null ? "—" : pct(fs.recoveryRate)} sub="recuperadas / cerradas del mes" />
      </div>
      <div className="card">
        <div className="card-title">Para cobrar <span className="card-sub">{fs.openCount} {fs.openCount === 1 ? "factura" : "facturas"}</span></div>
        {fs.open.length === 0 && <div className="empty">No hay pagos fallidos abiertos de clientes con suscripción activa. 🎉</div>}
        {fs.open.map((f) => {
          const c = f.customer, hot = f.attempt_count >= 3 || !f.next_attempt_at;
          return (
            <div key={f.invoice_id} className="customer-row">
              <div className="customer-top">
                <div className="avatar" style={{ borderColor: hot ? "var(--accent)" : "var(--yellow)" }}>{initials(c && (c.name || c.email))}</div>
                <div className="customer-info">
                  <div className="customer-name">{(c && (c.name || c.email)) || f.customer_key}
                    <span className={"badge " + (hot ? "badge-red" : "badge-yellow")} style={{ marginLeft: 8 }}>Intento {f.attempt_count}</span></div>
                  <div className="customer-plan">{reasonText(f)} · hace {f.daysOpen} {f.daysOpen === 1 ? "día" : "días"} · {f.next_attempt_at ? "reintenta el " + fmtDate(f.next_attempt_at) : <span style={{ color: "var(--accent)" }}>sin más reintentos</span>}</div>
                </div>
                <div style={{ textAlign: "right" }}><div className="customer-mrr" style={{ color: "var(--accent)" }}>{Number(f.amount_due).toLocaleString("es-AR", { maximumFractionDigits: 2 })} <span style={{ fontSize: 10, color: "#888", fontWeight: 400 }}>{String(f.currency).toUpperCase()}</span></div></div>
                {f.hosted_invoice_url && <a className="btn-sm" href={f.hosted_invoice_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>Ver factura</a>}
              </div>
              {c && c.email && <div style={{ fontSize: 11, color: "#888", paddingLeft: 46, marginTop: 4 }}>{c.email}</div>}
            </div>
          );
        })}
      </div>
      {fs.legacyCount > 0 && (
        <div className="card">
          <div className="card-title">Deuda histórica <span className="card-sub">{fs.legacyCount} {fs.legacyCount === 1 ? "factura" : "facturas"} · {money(fs.legacyAmount)} · de clientes sin suscripción activa</span>
            <button className="btn-sm" onClick={() => setShowLegacy(!showLegacy)}>{showLegacy ? "Ocultar" : "Ver"}</button></div>
          <div style={{ fontSize: 12, color: "#888" }}>Facturas que quedaron abiertas en Stripe de clientes que ya no tienen suscripción. No cuentan en el MRR en riesgo ni en la tasa de cobro. Si ya no se van a cobrar, conviene anularlas o marcarlas incobrables en Stripe.</div>
          {showLegacy && (
            <div className="table-wrap" style={{ marginTop: 12 }}><table><thead><tr><th>Cliente</th><th>Monto</th><th>Intentos</th><th>Desde</th><th></th></tr></thead>
              <tbody>{[...fs.legacy].reverse().map((f) => (
                <tr key={f.invoice_id}><td>{(f.customer && (f.customer.name || f.customer.email)) || f.customer_key}</td><td>{Number(f.amount_due).toLocaleString("es-AR", { maximumFractionDigits: 2 })} {String(f.currency).toUpperCase()}</td><td>{f.attempt_count}</td><td>{fmtDate(f.first_failed_at)}</td>
                  <td>{f.hosted_invoice_url && <a className="btn-sm" href={f.hosted_invoice_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>Ver factura</a>}</td></tr>))}</tbody></table></div>)}
        </div>
      )}
      <div className="card">
        <div className="card-title">Resueltos en los últimos 30 días <button className="btn-sm" onClick={() => setShowResolved(!showResolved)}>{showResolved ? "Ocultar" : `Ver (${resolved.length})`}</button></div>
        {showResolved && (resolved.length === 0 ? <div className="empty">Nada resuelto en el último mes.</div> : (
          <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Monto</th><th>Intentos</th><th>Resultado</th><th>Fecha</th></tr></thead>
            <tbody>{resolved.map((f) => { const c = names[f.customer_key]; const [cls, label] = STATUS[f.status] || ["badge-muted", f.status]; return (
              <tr key={f.invoice_id}><td>{(c && (c.name || c.email)) || f.customer_key}</td><td>{Number(f.amount_due).toLocaleString("es-AR")} {String(f.currency).toUpperCase()}</td><td>{f.attempt_count}</td><td><span className={"badge " + cls}>{label}</span></td><td>{fmtDateTime(f.resolved_at)}</td></tr>); })}</tbody></table></div>))}
      </div>
    </div>
  );
}

// ── Clientes ─────────────────────────────────────────────────────────────────────────────────────────
const EMPTY = { customerKey: "", customerName: "", email: "", planPriceId: "", newPlanName: "", amount: "", currency: "usd", interval: "month", status: "active", subscriptionId: "", segment: "" };
export function CustomersPage({ d, rows, seg, now, sb, reload }) {
  const [q, setQ] = useState(""), [onlyActive, setOnlyActive] = useState(true), [form, setForm] = useState(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState(null);
  const customers = useMemo(() => d.customers.filter((c) => matchSegment(c, seg) && (!onlyActive || Number(c.mrr) > 0) && (!q || ((c.name || "") + " " + (c.email || "") + " " + c.key).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => Number(b.mrr) - Number(a.mrr) || String(a.name).localeCompare(String(b.name))), [d.customers, seg, onlyActive, q]);
  const summary = useMemo(() => segmentSummary(d.customers), [d.customers]);
  const liveMonths = useMemo(() => rows.filter((r) => r.source === "nuevo").map((r) => r.month), [rows]);
  const monthly = useMemo(() => customerMonthly(d.customers, d.events, liveMonths, now), [d.customers, d.events, liveMonths, now]);
  const planName = useMemo(() => Object.fromEntries(d.plans.map((p) => [p.price_id, p.name || p.price_id])), [d.plans]);
  const subOf = useMemo(() => { const m = {}; for (const s of d.subs) { const cur = m[s.customer_key]; const live = ["active", "past_due", "trialing"].includes(s.status); if (!cur || (live && !cur.live)) m[s.customer_key] = { ...s, live }; } return m; }, [d.subs]);
  const counted = d.plans.filter((p) => p.counts_in_mrr);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function setSegment(c, segment) {
    setNotice(null);
    const { error } = await sb.from("rev_customers").update({ segment: segment || null }).eq("key", c.key);
    if (error) { setNotice({ ok: false, text: "No se pudo guardar el segmento: " + error.message }); return; }
    await reload();
  }
  function edit(c) {
    const s = subOf[c.key], it = (s && s.items[0]) || {};
    setNotice(null);
    setForm({ customerKey: c.key, customerName: c.name || "", email: c.email || "", planPriceId: it.priceId || "", newPlanName: "", amount: s ? String((it.unitAmount || 0) / 100) : "", currency: s ? s.currency : "usd", interval: it.interval || "month", status: s ? s.status : "active", subscriptionId: s ? s.id : "", segment: c.segment || "" });
  }
  async function save(override) {
    const f = override || form;
    setBusy(true); setNotice(null);
    try {
      const body = { customerKey: f.customerKey || undefined, customerName: f.customerName, email: f.email || undefined, amount: Number(f.amount), currency: f.currency, interval: f.interval, status: f.status, subscriptionId: f.subscriptionId || undefined };
      if (f.planPriceId) body.planPriceId = f.planPriceId; else if (String(f.newPlanName).trim()) body.newPlan = { name: String(f.newPlanName).trim(), category: "saas", countsInMrr: true };
      const r = await callFn(sb, "manual", body);
      if (d.v2 && f.segment !== undefined && r && r.customerKey) await sb.from("rev_customers").update({ segment: f.segment || null }).eq("key", r.customerKey);
      setNotice({ ok: true, text: f.subscriptionId ? "Cliente actualizado." : "Cliente creado." });
      setForm(null); await reload();
    } catch (err) { setNotice({ ok: false, text: err.message }); }
    setBusy(false);
  }
  function toggleStatus(c, status) {
    const s = subOf[c.key]; if (!s) return;
    if (status === "canceled" && !window.confirm("¿Dar de baja a " + (c.name || c.key) + "? Queda registrado como churn.")) return;
    const it = s.items[0] || {};
    save({ customerKey: c.key, customerName: c.name || "", email: c.email || "", planPriceId: it.priceId, amount: (it.unitAmount || 0) / 100, currency: s.currency, interval: it.interval || "month", status, subscriptionId: s.id, segment: undefined });
  }

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Clientes</div><div className="page-sub">{customers.length} {customers.length === 1 ? "cliente" : "clientes"} · filtro: {seg === "todos" ? "todos" : seg === "sin" ? "sin segmento" : seg}</div></div>
        <button className="btn-primary" onClick={() => { setNotice(null); setForm({ ...EMPTY }); }}>+ Agregar cliente</button>
      </div>
      <Notice n={notice} />
      <div className="kpi-grid">
        {[["inmobiliaria", "🏠 Inmobiliarias", "var(--green)"], ["otro", "◎ Otros", "var(--blue)"], ["sin", "Sin segmento", "var(--muted)"]].filter(([k]) => k !== "sin" || summary.sin.customers > 0).map(([k, l, c]) => (
          <div key={k} className="kpi" style={{ borderTop: `2px solid ${c}` }}><div className="kpi-label">{l}</div><div className="kpi-value" style={{ fontSize: 22, color: c }}>{money(summary[k].mrr)}</div><div className="kpi-sub">{summary[k].customers} {summary[k].customers === 1 ? "cliente activo" : "clientes activos"} · MRR hoy</div></div>))}
      </div>
      {!d.v2 && <div className="notice" style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FCE4A0" }}>Para asignar segmento falta aplicar <b>supabase_revenue_v2.sql</b> en Supabase.</div>}
      <div className="card">
        <div className="card-title">Lista <span className="card-sub">{customers.length} encontrados</span></div>
        <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input className="inp" style={{ maxWidth: 280 }} placeholder="Buscar por nombre o email" aria-label="Buscar cliente" value={q} onChange={(e) => setQ(e.target.value)} />
          <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />Solo los que pagan hoy</label>
        </div>
        {customers.length === 0 && <div className="empty">Sin clientes para mostrar.</div>}
        {customers.map((c) => {
          const s = subOf[c.key], it = (s && s.items[0]) || {}, active = Number(c.mrr) > 0, m = monthly[c.key] || {};
          const chips = liveMonths.filter((k) => m[k]);
          return (
            <div key={c.key} className="customer-row">
              <div className="customer-top">
                <div className="avatar" style={{ borderColor: c.segment === "inmobiliaria" ? "var(--green)" : c.segment === "otro" ? "var(--blue)" : "var(--border)" }}>{initials(c.name || c.email)}</div>
                <div className="customer-info">
                  <div className="customer-name">{c.name || c.email || c.key} <span className={"badge " + (active ? "badge-green" : "badge-red")} style={{ marginLeft: 6 }}>{active ? "Activo" : "Churneado"}</span></div>
                  <div className="customer-plan">{(it.priceId && planName[it.priceId]) || "—"} · <span style={{ color: c.source === "stripe" ? "var(--blue)" : "var(--yellow)" }}>{c.source === "stripe" ? "Stripe" : "Por fuera"}</span>{c.email && c.name ? " · " + c.email : ""}</div>
                </div>
                {d.v2 && <select className="seg-select" aria-label={"Segmento de " + (c.name || c.key)} value={c.segment || ""} onChange={(e) => setSegment(c, e.target.value)}><option value="">Sin segmento</option><option value="inmobiliaria">🏠 Inmobiliaria</option><option value="otro">◎ Otro</option></select>}
                <div className="customer-mrr">{money(c.mrr)}<span style={{ fontSize: 10, color: "#888", fontWeight: 400 }}>/mes</span></div>
                <div style={{ display: "flex", gap: 6 }}>
                  {c.source === "manual" ? (<>
                    <button className="btn-sm" onClick={() => edit(c)}>Editar</button>
                    {active ? <button className="btn-sm danger" disabled={busy} onClick={() => toggleStatus(c, "canceled")}>Dar de baja</button> : <button className="btn-sm" disabled={busy} onClick={() => toggleStatus(c, "active")}>Reactivar</button>}
                  </>) : <span style={{ fontSize: 11, color: "#aaa" }}>se gestiona en Stripe</span>}
                </div>
              </div>
              {chips.length > 1 && <div className="chips">{chips.map((k) => <span key={k} className="chip">{monthShort(k)}: <b>{money(m[k])}</b></span>)}</div>}
            </div>
          );
        })}
      </div>
      <div className="card"><div className="card-title">Últimos cambios en clientes por fuera</div>
        {d.audit.length === 0 && <div className="empty">Sin cambios registrados.</div>}
        {d.audit.map((a) => { const b = a.before && a.before.items && a.before.items[0], n = a.after && a.after.items && a.after.items[0], c = a.after && d.customers.find((x) => x.key === a.after.customerKey); return (
          <div key={a.id} className="movement-row" style={{ fontSize: 12 }}><span style={{ width: 110, color: "#888" }}>{fmtDateTime(a.at)}</span><span style={{ flex: 1 }}>{(c && (c.name || c.email)) || (a.after && a.after.customerKey)}</span><span className="mono">{b ? `${(b.unitAmount / 100).toLocaleString("es-AR")} → ` : "Alta: "}{n ? (n.unitAmount / 100).toLocaleString("es-AR") : "—"} · {a.after && a.after.status}</span></div>); })}
      </div>

      {form && (
        <Modal title={form.subscriptionId ? "Editar: " + (form.customerName || "cliente") : "Nuevo cliente por fuera"} onClose={() => setForm(null)}
          footer={<><button className="btn-secondary" onClick={() => setForm(null)}>Cancelar</button><button className="btn-primary" disabled={busy} onClick={() => save()}>{busy ? "Guardando…" : "Guardar"}</button></>}>
          <div className="grid2">
            <div className="field"><label className="field-label" htmlFor="f-name">Nombre</label><input id="f-name" className="inp" value={form.customerName} onChange={set("customerName")} disabled={!!form.customerKey} placeholder="Inmobiliaria..." /></div>
            <div className="field"><label className="field-label" htmlFor="f-email">Email (opcional)</label><input id="f-email" className="inp" type="email" value={form.email} onChange={set("email")} /></div>
            <div className="field"><label className="field-label" htmlFor="f-plan">Plan</label>
              <select id="f-plan" className="inp" value={form.planPriceId} onChange={set("planPriceId")}><option value="">Crear un plan nuevo…</option>{counted.map((p) => <option key={p.price_id} value={p.price_id}>{p.name || p.price_id}</option>)}</select></div>
            {!form.planPriceId && <div className="field"><label className="field-label" htmlFor="f-newplan">Nombre del plan nuevo</label><input id="f-newplan" className="inp" value={form.newPlanName} onChange={set("newPlanName")} placeholder="Ej: Plan Pro (directo)" /></div>}
            {d.v2 && <div className="field"><label className="field-label" htmlFor="f-seg">Segmento</label><select id="f-seg" className="inp" value={form.segment} onChange={set("segment")}><option value="">Sin segmento</option><option value="inmobiliaria">🏠 Inmobiliaria</option><option value="otro">◎ Otro</option></select></div>}
            <div className="field"><label className="field-label" htmlFor="f-amount">Monto</label><input id="f-amount" className="inp" inputMode="decimal" value={form.amount} onChange={set("amount")} placeholder="250" /></div>
            <div className="field"><label className="field-label" htmlFor="f-cur">Moneda</label><input id="f-cur" className="inp" maxLength={3} value={form.currency} onChange={set("currency")} /></div>
            <div className="field"><label className="field-label" htmlFor="f-int">Cobro</label><select id="f-int" className="inp" value={form.interval} onChange={set("interval")}><option value="month">Mensual</option><option value="year">Anual</option></select></div>
            <div className="field"><label className="field-label" htmlFor="f-st">Estado</label><select id="f-st" className="inp" value={form.status} onChange={set("status")}><option value="active">Activo</option><option value="canceled">Dado de baja</option></select></div>
          </div>
          <div style={{ fontSize: 11, color: "#888" }}>El MRR se registra desde hoy: cada cambio queda como alta, expansión, contracción o baja del mes y se audita.</div>
        </Modal>
      )}
    </div>
  );
}

// ── Proyección ───────────────────────────────────────────────────────────────────────────────────────
const toNum = (x) => parseFloat(x) || 0;
export function ProjectionPage({ d, allRows, now }) {
  const keys = useMemo(() => projectionMonths(now), [now]);
  const init = () => {
    const dft = projectionDefaults(allRows);
    return { dft, churnPct: keys.map(() => String(dft.churnPct)), newBiz: keys.map(() => String(dft.newBiz)), expansion: keys.map(() => String(dft.expansion)),
      extra: d.customers.filter((c) => c.source === "manual" && Number(c.mrr) > 0).map((c) => ({ name: c.name || c.key, base: Number(c.mrr), projected: false, mrr: keys.map(() => String(Number(c.mrr))) })) };
  };
  const [proj, setProj] = useState(init);
  const baseTotal = allRows.length ? allRows[allRows.length - 1].mrr : 0;
  const calc = useMemo(() => computeProjection(baseTotal, { churnPct: proj.churnPct.map(toNum), newBiz: proj.newBiz.map(toNum), expansion: proj.expansion.map(toNum), extra: proj.extra.map((c) => ({ base: c.base, mrr: c.mrr.map(toNum) })) }, keys), [proj, baseTotal, keys]);
  const setArr = (kind, i, v) => setProj({ ...proj, [kind]: proj[kind].map((x, j) => (j === i ? v : x)) });
  const setClient = (idx, i, v) => setProj({ ...proj, extra: proj.extra.map((c, j) => (j === idx ? { ...c, mrr: c.mrr.map((x, n) => (n === i ? v : x)) } : c)) });
  const last = calc.rows[calc.rows.length - 1];
  const growth = baseTotal > 0 ? ((last.total - baseTotal) / baseTotal) * 100 : 0;
  const real = allRows.slice(-4).map((r) => ({ key: r.month, v: r.mrr, proj: false }));
  const all = [...real, ...calc.rows.map((r) => ({ key: r.key, v: r.total, proj: true }))];
  const max = Math.max(...all.map((x) => x.v), 1);
  const head = keys.map((k) => <th key={k}>{monthLabel(k)}</th>);
  const baseLabel = allRows.length ? monthLabel(allRows[allRows.length - 1].month) : "";

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Proyección</div><div className="page-sub">Próximos 4 meses · base: MRR de {baseLabel}{allRows.length && allRows[allRows.length - 1].partial ? " (a hoy)" : ""}</div></div>
        <button className="btn-secondary" onClick={() => setProj(init())}>Resetear supuestos</button>
      </div>
      <div className="kpi-grid">
        <Kpi color="blue" label={`MRR proyectado (${monthLabel(last.key)})`} value={money(last.total)} sub={`${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% vs hoy (${money(baseTotal)})`} />
        <Kpi color="green" label="ARR proyectado" value={money(last.total * 12)} sub={`hoy ${money(baseTotal * 12)}`} />
        <Kpi color="yellow" label="Net new MRR (4 meses)" value={signed(last.total - baseTotal)} valueColor="var(--yellow)" sub="acumulado" />
        <Kpi color="green" label={`Por fuera (${monthLabel(last.key)})`} value={money(last.manual)} sub={`hoy ${money(calc.manualBase)}`} />
      </div>
      <div className="card">
        <div className="card-title">MRR real y proyectado<div className="legend"><span><i style={{ background: "var(--green)" }} />Real</span><span><i className="bar-proj" />Proyectado</span></div></div>
        <div className="chart-wrap">{all.map((x) => (<div key={x.key} className="bar-group"><div className="bars"><div className={"bar " + (x.proj ? "bar-proj" : "bar-mrr")} style={{ height: Math.round((x.v / max) * 120) }} title={`${monthLabel(x.key)}: ${money(x.v)}`} /></div><div className="bar-label">{monthShort(x.key)}</div></div>))}</div>
      </div>
      <div className="card">
        <div className="card-title">Supuestos <span className="card-sub">editá cualquier celda y se recalcula al instante</span></div>
        <div className="table-wrap"><table>
          <thead><tr><th></th>{head}</tr></thead>
          <tbody>
            {[["churnPct", "Churn mensual (% del MRR sin \"por fuera\")", "0.1"], ["newBiz", "New biz (USD)", "10"], ["expansion", "Expansion (USD)", "10"]].map(([kind, label, step]) => (
              <tr key={kind}><td>{label}</td>{proj[kind].map((v, i) => <td key={i}><input type="number" step={step} className="proj-inp" aria-label={`${label} ${monthLabel(keys[i])}`} value={v} onChange={(e) => setArr(kind, i, e.target.value)} /></td>)}</tr>))}
          </tbody></table></div>
        <div style={{ fontSize: 11, color: "#888", marginTop: 10 }}>Valores iniciales = promedio de los últimos 6 meses reales (churn {proj.dft.churnPct}%, new biz {money(proj.dft.newBiz)}, expansion {money(proj.dft.expansion)}).</div>
      </div>
      <div className="card">
        <div className="card-title">Clientes por fuera <button className="btn-sm" onClick={() => setProj({ ...proj, extra: [...proj.extra, { name: "Cliente nuevo", base: 0, projected: true, mrr: keys.map(() => "0") }] })}>+ Cliente proyectado</button></div>
        {proj.extra.length === 0 ? <div className="empty">No hay clientes por fuera. Agregá uno proyectado con el botón de arriba.</div> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Cliente</th><th>Hoy</th>{head}<th></th></tr></thead>
            <tbody>{proj.extra.map((c, idx) => (
              <tr key={idx}>
                <td>{c.projected ? <input className="proj-name" aria-label="Nombre del cliente proyectado" value={c.name} onChange={(e) => setProj({ ...proj, extra: proj.extra.map((x, j) => (j === idx ? { ...x, name: e.target.value } : x)) })} /> : <><span style={{ color: "var(--text)" }}>{c.name}</span> <span className="badge badge-muted" style={{ marginLeft: 6 }}>en la base</span></>}</td>
                <td>{c.projected ? "-" : money(c.base)}</td>
                {c.mrr.map((v, i) => <td key={i}><input type="number" className="proj-inp" aria-label={`${c.name} ${monthLabel(keys[i])}`} value={v} onChange={(e) => setClient(idx, i, e.target.value)} /></td>)}
                <td>{c.projected && <button className="btn-sm danger" onClick={() => setProj({ ...proj, extra: proj.extra.filter((_, j) => j !== idx) })}>Quitar</button>}</td>
              </tr>))}</tbody></table></div>)}
        <div style={{ fontSize: 11, color: "#888", marginTop: 10 }}>Los clientes "en la base" ya están sumados en el MRR de hoy. Poné 0 para simular una baja o subí el monto para simular un upgrade. Los proyectados suman MRR nuevo.</div>
      </div>
      <div className="card"><div className="card-title">Detalle mes a mes</div><div className="table-wrap"><table>
        <thead><tr><th>Mes</th><th>MRR inicio</th><th>New biz</th><th>Expansion</th><th>Churn</th><th>Por fuera (var.)</th><th>MRR cierre</th><th>ARR</th></tr></thead>
        <tbody>{calc.rows.map((r) => (
          <tr key={r.key}><td>{monthLabel(r.key)}</td><td>{money(r.start)}</td><td className="pos">+{money(r.nb)}</td><td className="pos">+{money(r.ex)}</td><td className="neg">-{money(r.churn)}</td><td className={r.dManual >= 0 ? "pos" : "neg"}>{signed(r.dManual)}</td><td className="bold">{money(r.total)}</td><td>{money(r.total * 12)}</td></tr>))}</tbody></table></div></div>
    </div>
  );
}

// ── Planes y tipos de cambio ─────────────────────────────────────────────────────────────────────────
export function PlansPage({ d, done, sb, reload }) {
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState(null);
  const [fxForm, setFxForm] = useState({ currency: "", rate: "" });
  const usage = useMemo(() => planUsage(d.subs), [d.subs]);
  const sorted = useMemo(() => [...d.plans].sort((a, b) => (a.category === "sin_clasificar" ? 0 : 1) - (b.category === "sin_clasificar" ? 0 : 1) || ((usage[b.price_id] || {}).live || 0) - ((usage[a.price_id] || {}).live || 0) || String(a.name || a.price_id).localeCompare(String(b.name || b.price_id))), [d.plans, usage]);
  const usageText = (id) => {
    const u = usage[id];
    if (!u) return "sin suscripciones activas";
    const price = u.min === u.max ? Number(u.min).toLocaleString("es-AR") : `${Number(u.min).toLocaleString("es-AR")}–${Number(u.max).toLocaleString("es-AR")}`;
    const every = u.intervals.length === 1 && u.intervals[0] === "year" ? "año" : "mes";
    const n = [u.live ? `${u.live} ${u.live === 1 ? "activa" : "activas"}` : "", u.trial ? `${u.trial} en prueba` : ""].filter(Boolean).join(" · ");
    return `${u.currencies.join("/")} ${price}/${every} · ${n}`;
  };

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
      <PageHeader title="Planes" sub="Los planes nuevos de Stripe entran sin clasificar y no suman al MRR hasta que los clasifiques." live={false} />
      <Notice n={notice} />
      {dirty && done && (
        <div className="alert" style={{ background: "#FEF3C7", border: "1px solid #FCE4A0", color: "#92400E" }}>
          <span style={{ flex: 1 }}>Hiciste cambios: hay que recalcular el MRR para que se apliquen.</span>
          <button className="btn-primary" disabled={busy} onClick={recompute}>{busy ? "Recalculando…" : "Aplicar y recalcular"}</button>
        </div>
      )}
      <div className="card" style={{ padding: "8px 22px" }}>
        {sorted.length === 0 && <div className="empty">Todavía no hay planes. Se cargan al traer los datos de Stripe (Overview → Puesta en marcha).</div>}
        {sorted.map((p) => (
          <div key={p.price_id} className="movement-row" style={{ gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{p.name || "(sin nombre)"}</div><div style={{ fontSize: 12, color: "#555" }}>{usageText(p.price_id)}</div><div className="mono" style={{ fontSize: 10, color: "#aaa" }}>{p.price_id}</div></div>
            <select className="inp" style={{ width: 240 }} aria-label={"Categoría de " + (p.name || p.price_id)} value={p.category} onChange={(e) => update(p, { category: e.target.value, counts_in_mrr: DEFAULT_COUNTS[e.target.value] })}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center", width: 120 }}><input type="checkbox" checked={p.counts_in_mrr} disabled={p.category === "sin_clasificar"} onChange={(e) => update(p, { counts_in_mrr: e.target.checked })} />Suma al MRR</label>
          </div>))}
      </div>
      <div className="card">
        <div className="card-title">Tipos de cambio</div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>Solo hace falta si algún cobro no es en USD. Sin tasa cargada el cálculo da error en vez de inventar un número.</div>
        {d.fx.map((f) => (<div key={f.currency} className="movement-row"><div style={{ flex: 1, fontSize: 13 }}>1 {String(f.currency).toUpperCase()} = {Number(f.rate)} USD</div><button className="btn-sm" onClick={() => delFx(f.currency)}>Quitar</button></div>))}
        <form onSubmit={saveFx} style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input className="inp" style={{ width: 90 }} placeholder="ARS" aria-label="Moneda" maxLength={3} value={fxForm.currency} onChange={(e) => setFxForm({ ...fxForm, currency: e.target.value })} />
          <input className="inp" style={{ width: 140 }} placeholder="0.0009" aria-label="USD por unidad" inputMode="decimal" value={fxForm.rate} onChange={(e) => setFxForm({ ...fxForm, rate: e.target.value })} />
          <button className="btn-secondary" type="submit">Guardar tasa</button>
        </form>
      </div>
    </div>
  );
}

