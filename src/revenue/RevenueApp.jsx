// Sección "Métricas" (solo admins): MRR, clientes, movimientos, retención, pagos fallidos y proyección, calculados con
// Stripe + clientes que pagan por fuera, más el histórico de ChartMogul. Datos en las tablas rev_* de Supabase
// (supabase_revenue.sql y supabase_revenue_v2.sql); se escriben desde la Edge Function revenue-sync. Desde acá solo se
// leen, salvo clasificar planes, cargar tipos de cambio y asignar el segmento de cada cliente.
import { useCallback, useEffect, useMemo, useState } from "react";
import { monthlyRows, periodRows, healthAlerts, PERIODS, SEGMENTS } from "./revenueMetrics.js";
import { fetchAll } from "./revenueApi.js";
import { RvStyles } from "./revenueUi.jsx";
import { Overview, MrrPage, ChurnPage, RetentionPage, FailedPage, CustomersPage, ProjectionPage, PlansPage } from "./RevenuePages.jsx";

function useRevenueData(sb) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      // La parte 2 (segmento y pagos fallidos) puede no estar aplicada todavía: se carga con lo que haya
      let v2 = true;
      let customers;
      try { customers = await fetchAll((a, b) => sb.from("rev_customers").select("key,name,email,source,company_id,country,mrr,ever_paid,first_paid_at,segment").order("key").range(a, b)); }
      catch (e) { if (!/segment/i.test(e.message || "")) throw e; v2 = false; customers = await fetchAll((a, b) => sb.from("rev_customers").select("key,name,email,source,company_id,country,mrr,ever_paid,first_paid_at").order("key").range(a, b)); }
      let subs;
      try { subs = await fetchAll((a, b) => sb.from("rev_subscriptions").select("id,customer_key,source,status,currency,items,discount,cancel_reason").order("id").range(a, b)); }
      catch (e) { if (!/cancel_reason/i.test(e.message || "")) throw e; v2 = false; subs = await fetchAll((a, b) => sb.from("rev_subscriptions").select("id,customer_key,source,status,currency,items,discount").order("id").range(a, b)); }
      let failures = [];
      try { failures = await fetchAll((a, b) => sb.from("rev_payment_failures").select("*").order("invoice_id").range(a, b)); }
      catch (e) { if (!/rev_payment_failures/i.test(e.message || "")) throw e; v2 = false; }
      const [events, plans, runs, history, fx, audit] = await Promise.all([
        fetchAll((a, b) => sb.from("rev_mrr_events").select("id,customer_key,date,type,mrr_before,mrr_after,delta,baseline,cause").order("id").range(a, b)),
        fetchAll((a, b) => sb.from("rev_plans").select("price_id,name,category,counts_in_mrr").order("price_id").range(a, b)),
        sb.from("rev_sync_runs").select("id,at,kind,fixes,stale,unclassified,errors").order("at", { ascending: false }).limit(30).then((r) => { if (r.error) throw r.error; return r.data || []; }),
        fetchAll((a, b) => sb.from("rev_history_monthly").select("month,data").order("month").range(a, b)),
        sb.from("rev_fx_rates").select("currency,rate").then((r) => { if (r.error) throw r.error; return r.data || []; }),
        sb.from("rev_manual_audit").select("id,subscription_id,before,after,user_id,at").order("at", { ascending: false }).limit(15).then((r) => { if (r.error) throw r.error; return r.data || []; }),
      ]);
      // Clientes cuya suscripción se canceló por falta de pago (baja involuntaria)
      const involuntaryKeys = new Set(subs.filter((s) => s.cancel_reason === "payment_failed" && s.status === "canceled").map((s) => s.customer_key));
      setData({ customers, subs, failures, events, plans, runs, history, fx, audit, involuntaryKeys, v2 });
      setError("");
    } catch (e) { setError(e.message || String(e)); }
  }, [sb]);
  useEffect(() => { load(); }, [load]);
  return { data, error, reload: load };
}

const PAGES_WITH_FILTERS = ["metrics", "metrics_mrr", "metrics_churn", "metrics_retention", "metrics_customers"];

export default function RevenueApp({ sb, view, setView }) {
  const { data, error, reload } = useRevenueData(sb);
  const [period, setPeriod] = useState("year");
  const [seg, setSeg] = useState("todos");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  const allRows = useMemo(() => (data ? monthlyRows({ history: data.history, customers: data.customers, events: data.events, now }) : []), [data, now]);
  const rows = useMemo(() => periodRows(allRows, period, now), [allRows, period, now]);
  const alerts = useMemo(() => (data ? healthAlerts({ plans: data.plans, runs: data.runs, events: data.events, now }) : []), [data, now]);
  const go = (tab) => setView(tab === "planes" ? "metrics_plans" : "metrics");

  if (error) return <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#EF3E3E", fontSize: 14 }}>No se pudieron cargar las métricas: {error}. Si es la primera vez, falta aplicar supabase_revenue.sql en Supabase.</div>;
  if (!data) return <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#888", fontSize: 14 }}>Cargando métricas...</div>;

  const done = data.events.some((e) => e.baseline) || data.runs.some((r) => r.kind === "baseline");
  const common = { d: data, rows, allRows, seg, now, sb, reload, done, go };
  return (
    <div className="rv">
      <RvStyles />
      {!data.v2 && <div className="notice" style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FCE4A0" }}>Falta aplicar <b>supabase_revenue_v2.sql</b> en Supabase (segmento de clientes y pagos fallidos). Mientras tanto esas dos cosas no están disponibles.</div>}
      {PAGES_WITH_FILTERS.includes(view) && (
        <div className="filter-bar">
          <span className="filter-label">Período</span>
          <div className="filter-group">{PERIODS.map(([k, l]) => <button key={k} className={"pill" + (period === k ? " on" : "")} aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>)}</div>
          <div className="filter-sep" />
          <span className="filter-label">Segmento</span>
          <div className="filter-group">
            {[["todos", "Todos"], ...SEGMENTS, ["sin", "Sin segmento"]].map(([k, l]) => <button key={k} className={"pill seg" + (seg === k ? " on" : "")} aria-pressed={seg === k} onClick={() => setSeg(k)}>{l}</button>)}
          </div>
        </div>
      )}
      {view === "metrics" && <Overview {...common} alerts={alerts.filter((a) => a.code !== "sin_baseline")} />}
      {view === "metrics_mrr" && <MrrPage {...common} />}
      {view === "metrics_churn" && <ChurnPage {...common} />}
      {view === "metrics_retention" && <RetentionPage {...common} />}
      {view === "metrics_failed" && <FailedPage {...common} />}
      {view === "metrics_customers" && <CustomersPage {...common} />}
      {view === "metrics_projection" && <ProjectionPage {...common} />}
      {view === "metrics_plans" && <PlansPage {...common} />}
    </div>
  );
}
