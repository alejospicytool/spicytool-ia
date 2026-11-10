// Piezas visuales de la sección Métricas. Estética del "Revenue Dashboard" (tarjetas KPI con franja de color,
// números en tipografía monoespaciada, barras, tablas y filtros en píldoras) con la paleta clara del backoffice.
import { useEffect } from "react";

export const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const monthLabel = (m) => MESES[Number(m.slice(5, 7)) - 1] + " " + m.slice(0, 4);
export const monthShort = (m) => MESES[Number(m.slice(5, 7)) - 1];
export const money = (v) => "$" + Math.abs(Math.round(Number(v) || 0)).toLocaleString("es-AR");
export const signed = (v) => (Number(v) >= 0 ? "+" : "−") + money(v);
export const pct = (v) => (v == null ? "—" : Number(v).toFixed(1) + "%");
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }) : "—");
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }) : "—");
export const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

export const RV_CSS = `
.rv{--surface:#fff;--surface2:#F7F7F8;--border:#EBEBEB;--text:#111;--muted:#888;--accent:#EF3E3E;--accent-dim:#FEF0F0;--green:#16A34A;--green-dim:#EDFAF3;--yellow:#D99A00;--yellow-dim:#FEF6DA;--blue:#2F6FDE;--blue-dim:#EAF1FD;--mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--text);font-size:14px;line-height:1.5}
.rv *{box-sizing:border-box}
.rv .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;gap:12px;flex-wrap:wrap}
.rv .page-title{font-size:22px;font-weight:700}
.rv .page-sub{font-size:13px;color:var(--muted);margin-top:4px}
.rv .head-right{display:flex;align-items:center;gap:10px;font-size:11px;color:var(--muted)}
.rv .filter-bar{display:flex;align-items:center;gap:10px;padding:2px 0 18px;border-bottom:1px solid var(--border);margin-bottom:22px;flex-wrap:wrap}
.rv .filter-label{font-size:11px;color:var(--muted);font-weight:500}
.rv .filter-group{display:flex;gap:4px;flex-wrap:wrap}
.rv .pill{padding:5px 12px;border-radius:20px;border:1px solid var(--border);background:#fff;color:var(--muted);font-size:11px;font-weight:600;cursor:pointer;transition:all .15s}
.rv .pill:hover{color:var(--text);border-color:#ccc}
.rv .pill.on{background:var(--accent-dim);color:var(--accent);border-color:var(--accent)}
.rv .pill.seg.on{background:var(--green-dim);color:var(--green);border-color:var(--green)}
.rv .filter-sep{width:1px;height:20px;background:var(--border);margin:0 4px}
.rv .kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:14px;margin-bottom:20px}
.rv .kpi{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px;position:relative;overflow:hidden}
.rv .kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--border)}
.rv .kpi.green::before{background:var(--green)}.rv .kpi.red::before{background:var(--accent)}.rv .kpi.yellow::before{background:var(--yellow)}.rv .kpi.blue::before{background:var(--blue)}
.rv .kpi-label{font-size:11px;color:var(--muted);font-weight:500;margin-bottom:8px}
.rv .kpi-value{font-size:24px;font-weight:700;font-family:var(--mono);line-height:1;margin-bottom:6px}
.rv .kpi-sub{font-size:11px;color:var(--muted)}
.rv .card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px 22px;margin-bottom:18px}
.rv .card-title{font-size:13px;font-weight:600;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.rv .card-sub{font-size:11px;color:var(--muted);font-weight:400;margin-left:8px}
.rv .legend{display:flex;gap:14px;font-size:11px;color:var(--muted);font-weight:400}
.rv .legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px}
.rv .chart-wrap{display:flex;align-items:flex-end;gap:6px;height:150px;padding-top:8px}
.rv .bar-group{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;min-width:0}
.rv .bars{display:flex;align-items:flex-end;gap:2px;flex:1;width:100%}
.rv .bar{flex:1;border-radius:4px 4px 0 0;min-height:3px}
.rv .bar:hover{opacity:.8;cursor:pointer}
.rv .bar-mrr{background:var(--green)}.rv .bar-churn{background:var(--accent)}.rv .bar-new{background:var(--blue)}
.rv .bar-proj{background:repeating-linear-gradient(45deg,var(--blue),var(--blue) 4px,rgba(47,111,222,.45) 4px,rgba(47,111,222,.45) 8px)}
.rv .bar-label{font-size:10px;color:var(--muted);text-align:center;width:100%;white-space:nowrap}
.rv .table-wrap{overflow-x:auto}
.rv table{width:100%;border-collapse:collapse;font-size:12px}
.rv th{padding:9px 14px;text-align:right;color:var(--muted);font-weight:500;border-bottom:1px solid var(--border);white-space:nowrap}
.rv th:first-child{text-align:left}
.rv td{padding:10px 14px;text-align:right;border-bottom:1px solid var(--border);font-family:var(--mono);font-size:12px;white-space:nowrap}
.rv td:first-child{text-align:left;font-family:inherit;color:var(--muted)}
.rv tr:last-child td{border-bottom:none}
.rv tbody tr:hover td{background:var(--surface2)}
.rv .pos{color:var(--green)}.rv .neg{color:var(--accent)}.rv .bold{font-weight:700;color:var(--text)}
.rv .movement-row{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid var(--border)}
.rv .movement-row:last-child{border-bottom:none}
.rv .dot{width:8px;height:8px;border-radius:50%;margin-right:10px;flex-shrink:0}
.rv .mono{font-family:var(--mono)}
.rv .ret-meter{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.rv .ret-label{font-size:12px;color:var(--muted);width:110px;flex-shrink:0}
.rv .ret-bar-wrap{flex:1;height:6px;background:var(--surface2);border-radius:3px;overflow:hidden}
.rv .ret-bar{height:100%;border-radius:3px}
.rv .ret-value{font-family:var(--mono);font-size:12px;font-weight:600;width:56px;text-align:right}
.rv .customer-row{display:flex;flex-direction:column;padding:12px 0;border-bottom:1px solid var(--border)}
.rv .customer-row:last-child{border-bottom:none}
.rv .customer-top{display:flex;align-items:center;gap:12px;width:100%;flex-wrap:wrap}
.rv .avatar{width:34px;height:34px;border-radius:8px;background:var(--surface2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--muted);flex-shrink:0}
.rv .customer-info{flex:1;min-width:180px}
.rv .customer-name{font-size:13px;font-weight:500}
.rv .customer-plan{font-size:11px;color:var(--muted);margin-top:1px}
.rv .customer-mrr{font-family:var(--mono);font-size:13px;font-weight:600;color:var(--green);text-align:right;min-width:90px}
.rv .chips{margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;padding-left:46px}
.rv .chip{font-size:10px;padding:2px 7px;border-radius:5px;background:var(--surface2);color:var(--muted);font-family:var(--mono)}
.rv .chip b{color:var(--green)}
.rv .btn-sm{padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:#fff;color:var(--muted);font-size:11px;cursor:pointer}
.rv .btn-sm:hover{background:var(--surface2);color:var(--text)}
.rv .btn-sm.danger:hover{background:var(--accent-dim);color:var(--accent);border-color:var(--accent)}
.rv .btn-sm:disabled{opacity:.5;cursor:not-allowed}
.rv .badge{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:20px;font-size:10px;font-weight:600}
.rv .badge-green{background:var(--green-dim);color:var(--green)}.rv .badge-red{background:var(--accent-dim);color:var(--accent)}
.rv .badge-muted{background:var(--surface2);color:var(--muted)}.rv .badge-yellow{background:var(--yellow-dim);color:#8A6200}.rv .badge-blue{background:var(--blue-dim);color:var(--blue)}
.rv .inp{width:100%;padding:9px 12px;background:#fff;border:1px solid #E0E0E0;border-radius:8px;color:var(--text);font-size:13px;font-family:inherit}
.rv .inp:focus{outline:none;border-color:var(--accent)}
.rv .proj-inp{width:88px;padding:6px 8px;background:#fff;border:1px solid #E0E0E0;border-radius:7px;font-family:var(--mono);font-size:12px;text-align:right}
.rv .proj-inp:focus,.rv .proj-name:focus{outline:none;border-color:var(--accent)}
.rv .proj-name{width:100%;min-width:160px;padding:6px 8px;border:1px solid #E0E0E0;border-radius:7px;font-size:12px}
.rv .seg-select{padding:3px 6px;border:1px solid var(--border);border-radius:6px;font-size:11px;background:#fff;color:var(--muted);cursor:pointer}
.rv .btn-primary{padding:9px 18px;background:var(--accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600}
.rv .btn-primary:disabled{background:#FFAAAA;cursor:not-allowed}
.rv .btn-secondary{padding:8px 16px;background:#fff;color:#444;border:1px solid #E0E0E0;border-radius:8px;cursor:pointer;font-size:13px}
.rv .btn-secondary:hover{background:#fafafa}.rv .btn-secondary:disabled{opacity:.5;cursor:not-allowed}
.rv .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px}
.rv .modal{background:#fff;border-radius:16px;width:100%;max-width:560px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden}
.rv .modal-header{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
.rv .modal-title{font-size:15px;font-weight:700}
.rv .modal-close{background:none;border:none;cursor:pointer;font-size:22px;color:var(--muted);line-height:1}
.rv .modal-body{padding:20px 22px;overflow-y:auto}
.rv .modal-footer{padding:14px 22px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px}
.rv .field{margin-bottom:14px}.rv .field-label{font-size:11px;color:var(--muted);margin-bottom:5px;display:block}
.rv .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.rv .empty{padding:24px 0;text-align:center;color:var(--muted);font-size:13px}
.rv .notice{margin-bottom:14px;font-size:13px;padding:9px 14px;border-radius:10px}
.rv .alert{border-radius:10px;padding:10px 14px;font-size:13px;display:flex;gap:10px;align-items:center;margin-bottom:8px}
@media (max-width:640px){.rv .grid2{grid-template-columns:1fr}.rv .page-title{font-size:19px}.rv .kpi-value{font-size:20px}}
`;

export function RvStyles() {
  useEffect(() => {
    let link;
    try {
      if (!document.getElementById("rv-mono-font")) {
        link = document.createElement("link");
        link.id = "rv-mono-font"; link.rel = "stylesheet";
        link.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap";
        document.head.appendChild(link);
      }
    } catch { /* sin red: se usa la monoespaciada del sistema */ }
  }, []);
  return <style>{RV_CSS}</style>;
}

export const Kpi = ({ color = "", label, value, sub, valueColor }) => (
  <div className={"kpi " + color}><div className="kpi-label">{label}</div><div className="kpi-value" style={valueColor ? { color: valueColor } : undefined}>{value}</div>{sub != null && <div className="kpi-sub">{sub}</div>}</div>
);

export function PageHeader({ title, sub, live = true }) {
  const today = new Date().toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
  return (
    <div className="page-header">
      <div><div className="page-title">{title}</div>{sub && <div className="page-sub">{sub}</div>}</div>
      {live && <div className="head-right"><span>Valores en USD · datos al {today}</span><span className="badge badge-green">● Live</span></div>}
    </div>
  );
}

export const Notice = ({ n }) => !n ? null : <div role="status" className="notice" style={{ background: n.ok ? "#EDFAF3" : "#FEF0F0", color: n.ok ? "#15803D" : "#C42F2F", border: `1px solid ${n.ok ? "#BFE8D0" : "#F8CACA"}` }}>{n.text}</div>;

export function Alerts({ alerts, go }) {
  if (!alerts.length) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      {alerts.map((a) => {
        const c = a.level === "error" ? ["#FEF0F0", "#C42F2F", "#F8CACA"] : a.level === "warn" ? ["#FEF3C7", "#92400E", "#FCE4A0"] : ["#EEF4FB", "#185FA5", "#CFE0F3"];
        return (
          <div key={a.code} role="alert" className="alert" style={{ background: c[0], color: c[1], border: `1px solid ${c[2]}` }}>
            <span style={{ flex: 1 }}>{a.text}</span>
            {a.tab && <button className="btn-sm" onClick={() => go(a.tab)}>Ver</button>}
          </div>
        );
      })}
    </div>
  );
}

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header"><div className="modal-title">{title}</div><button className="modal-close" aria-label="Cerrar" onClick={onClose}>×</button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// Barras de MRR / new biz / churn por mes (como el prototipo)
export function MonthBars({ rows, height = 120 }) {
  const max = Math.max(...rows.map((r) => r.mrr), 1);
  return (
    <div className="chart-wrap">
      {rows.map((r) => (
        <div key={r.month} className="bar-group">
          <div className="bars">
            <div className="bar bar-mrr" style={{ height: Math.round((r.mrr / max) * height) }} title={`MRR ${money(r.mrr)}`} />
            <div className="bar bar-new" style={{ height: Math.round((r.newBiz / max) * height) }} title={`New biz ${money(r.newBiz)}`} />
            <div className="bar bar-churn" style={{ height: Math.round((r.churn / max) * height) }} title={`Churn ${money(r.churn)}`} />
          </div>
          <div className="bar-label" title={r.partial ? "Mes en curso" : monthLabel(r.month)}>{monthShort(r.month)}{r.partial ? "*" : ""}</div>
        </div>
      ))}
    </div>
  );
}
