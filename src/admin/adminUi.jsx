// Piezas visuales propias de "Admin Spicy". Reutiliza el estilo `.rv` de Métricas (revenueUi.jsx) y suma lo que falta:
// pestañas, tablas de texto, diálogo de confirmación y la lista del registro de auditoría.
import { Modal, fmtDateTime } from "../revenue/revenueUi.jsx";
import { auditLabel } from "./adminLogic.js";

const ADMIN_CSS = `
.rv .tabs{display:flex;gap:2px;border-bottom:1px solid var(--border);margin-bottom:18px;overflow-x:auto}
.rv .tab{padding:9px 14px;background:none;border:none;border-bottom:2px solid transparent;color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;margin-bottom:-1px}
.rv .tab:hover{color:var(--text)}
.rv .tab.on{color:var(--accent);border-bottom-color:var(--accent)}
.rv .tab .count{margin-left:6px;font-size:10px;padding:1px 6px;border-radius:10px;background:var(--surface2);color:var(--muted);font-family:var(--mono)}
.rv .adm-table th,.rv .adm-table td{text-align:left;font-family:inherit}
.rv .adm-table td{white-space:normal;color:var(--text);vertical-align:top}
.rv .adm-table td:first-child{color:var(--text)}
.rv .adm-table .num{text-align:right;font-family:var(--mono)}
.rv .adm-table th.num{text-align:right}
.rv .adm-table tr.click{cursor:pointer}
.rv .adm-table tr.sel td{background:var(--accent-dim)}
.rv .adm-table td.muted{color:var(--muted)}
.rv .demo-banner{margin-bottom:16px;font-size:12px;padding:8px 14px;border-radius:10px;background:var(--blue-dim);color:var(--blue);border:1px solid #CFE0F3}
.rv .detail-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.rv .detail-actions{display:flex;gap:8px;flex-wrap:wrap}
.rv .btn-warn{padding:8px 16px;background:#fff;color:#C42F2F;border:1px solid #F8CACA;border-radius:8px;cursor:pointer;font-size:13px}
.rv .btn-warn:hover{background:var(--accent-dim)}.rv .btn-warn:disabled{opacity:.5;cursor:not-allowed}
.rv .kv{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px 22px}
.rv .kv dt{font-size:11px;color:var(--muted);margin-bottom:3px}.rv .kv dd{margin:0;font-size:13px;word-break:break-word}
.rv .pager{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px;font-size:12px;color:var(--muted);flex-wrap:wrap}
.rv .pager-btns{display:flex;gap:6px}
.rv .err{color:#C42F2F;font-size:12px;margin-top:4px}
.rv .confirm-text{font-size:13px;line-height:1.5}
@media (max-width:640px){.rv .detail-actions{width:100%}.rv .audit-row{flex-wrap:wrap}}
`;
export const AdminStyles = () => <style>{ADMIN_CSS}</style>;

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={active === t.key} className={"tab" + (active === t.key ? " on" : "")} onClick={() => onChange(t.key)}>
          {t.label}{t.count != null && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// columns: [{ key, label, render?(row), num?, muted? }]
export function DataTable({ columns, rows, empty = "Sin datos para mostrar.", onRowClick, selectedId, rowKey = "_id" }) {
  if (!rows.length) return <div className="empty">{empty}</div>;
  return (
    <div className="table-wrap">
      <table className="adm-table">
        <thead><tr>{columns.map((c) => <th key={c.key} className={c.num ? "num" : ""}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[rowKey]} className={(onRowClick ? "click " : "") + (selectedId === r[rowKey] ? "sel" : "")} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c) => <td key={c.key} className={(c.num ? "num " : "") + (c.muted ? "muted" : "")}>{c.render ? c.render(r) : (r[c.key] ?? "—")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const StatusBadge = ({ status }) => <span className={"badge " + (status === "paused" ? "badge-red" : "badge-green")}>{status === "paused" ? "Pausada" : "Activa"}</span>;

export function Pager({ page, pages, total, onChange, label = "resultados" }) {
  return (
    <div className="pager">
      <span>{total} {label} · página {page} de {pages}</span>
      <div className="pager-btns">
        <button className="btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Anterior</button>
        <button className="btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Siguiente →</button>
      </div>
    </div>
  );
}

// Confirmación antes de una acción que modifica datos.
export function ConfirmDialog({ title, children, confirmLabel = "Confirmar", danger = false, busy = false, error = "", onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={busy ? () => {} : onCancel}
      footer={<><button className="btn-secondary" disabled={busy} onClick={onCancel}>Cancelar</button>
        {danger ? <button className="btn-warn" style={{ background: "#EF3E3E", color: "#fff", borderColor: "#EF3E3E" }} disabled={busy} onClick={onConfirm}>{busy ? "Procesando…" : confirmLabel}</button>
          : <button className="btn-primary" disabled={busy} onClick={onConfirm}>{busy ? "Procesando…" : confirmLabel}</button>}</>}>
      <div className="confirm-text">{children}</div>
      {error && <div className="err" role="alert">{error}</div>}
    </Modal>
  );
}

const detailText = (a) => {
  const d = a.detail || {};
  if (Array.isArray(d.changes)) return d.changes.length ? d.changes.map((c) => `${c.key}: ${c.from ?? "—"} → ${c.to ?? "—"}`).join(" · ") : "Sin cambios de valores";
  if (a.action === "plan_assign_started") return `${d.plan} · ${d.stripePriceId}`;
  if (a.action === "plan_assign_unknown") return `${d.plan} · sin confirmar (${d.reason || "sin respuesta"}): revisar Stripe`;
  if (a.action === "plan_assign") return `${d.previousPlan || "Sin plan"} → ${d.plan} · ${d.stripePriceId}`;
  if (a.action === "plan_assign_failed") return `${d.plan || "—"} · no se cobró (${d.code})`;
  if (a.action === "company_edit_failed" || a.action === "contact_edit_failed") return "No se guardó en la base";
  if (a.action === "company_status_failed") return `${d.from ?? "—"} → ${d.to}: no se guardó en la base`;
  if (a.action === "card_link_created") return "Link de un solo uso";
  if (a.action === "support_link_created") return `Motivo: ${d.reason}`;
  if (a.action === "support_link_denied") return `Sin permiso · motivo: ${d.reason || "—"}`;
  if (d.from != null) return `${d.from} → ${d.to}`;
  if (d.name) return d.name;
  return "";
};

export function AuditList({ entries, empty = "Todavía no se registró ninguna acción." }) {
  if (!entries.length) return <div className="empty">{empty}</div>;
  return (
    <div>
      {entries.map((a) => (
        <div key={a.id} className="movement-row audit-row" style={{ fontSize: 12, gap: 12, alignItems: "flex-start" }}>
          <span style={{ width: 96, color: "var(--muted)", flexShrink: 0 }}>{fmtDateTime(a.at)}</span>
          <span style={{ flex: 1 }}><b>{auditLabel(a.action)}</b> · {a.targetLabel}<div style={{ color: "var(--muted)", marginTop: 2 }}>{detailText(a)}</div></span>
          <span style={{ color: "var(--muted)" }}>{a.actor}</span>
        </div>
      ))}
    </div>
  );
}

