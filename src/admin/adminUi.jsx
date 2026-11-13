// Piezas visuales propias de "Admin Spicy". Reutiliza el estilo `.rv` de Métricas (revenueUi.jsx) y suma lo que falta:
// pestañas, tablas de texto, diálogo de confirmación y la lista del registro de auditoría.
import { useState } from "react";
import { Modal, fmtDateTime } from "../revenue/revenueUi.jsx";
import { auditLabel, waLink } from "./adminLogic.js";

const ADMIN_CSS = `
.rv .id-chip{background:transparent;border:1px dashed var(--border);border-radius:6px;padding:1px 6px;font-size:11px;color:var(--muted);cursor:pointer;white-space:nowrap}
.rv .id-chip:hover{color:var(--text);border-color:var(--muted)}
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
.rv .detail-actions{display:flex;gap:10px 22px;flex-wrap:wrap;align-items:flex-end}
.rv .act-group{display:flex;flex-direction:column;gap:5px}
.rv .act-group+.act-group{padding-left:22px;border-left:1px solid var(--border)}
.rv .act-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600}
.rv .act-btns{display:flex;gap:6px;flex-wrap:wrap}
.rv .btn-warn{padding:8px 16px;background:#fff;color:#C42F2F;border:1px solid #F8CACA;border-radius:8px;cursor:pointer;font-size:13px}
.rv .btn-warn:hover{background:var(--accent-dim)}.rv .btn-warn:disabled{opacity:.5;cursor:not-allowed}
.rv .btn-charge{padding:8px 16px;background:#FEF3C7;color:#92400E;border:1px solid #FCD34D;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600}
.rv .btn-charge:hover{background:#FDE9A6}.rv .btn-charge:disabled{opacity:.5;cursor:not-allowed}
.rv .btn-access{padding:8px 16px;background:#fff;color:var(--blue);border:1px solid #CFE0F3;border-radius:8px;cursor:pointer;font-size:13px}
.rv .btn-access:hover{background:var(--blue-dim)}.rv .btn-access:disabled{opacity:.5;cursor:not-allowed}
.rv .wa-link{display:inline-flex;align-items:center;gap:5px;color:#128C7E;text-decoration:none;white-space:nowrap}
.rv .wa-link:hover{text-decoration:underline}.rv .wa-link svg{flex:none}
.rv .adm-table tr.click:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.rv .adm-cards{display:none;list-style:none;margin:0;padding:0}
.rv .adm-card{border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:10px;background:var(--surface,#fff)}
.rv .adm-card.click{cursor:pointer}.rv .adm-card.sel{background:var(--accent-dim)}
.rv .adm-card-title{display:block;width:100%;text-align:left;background:none;border:none;padding:0;font:inherit;color:var(--text);cursor:inherit}
.rv .adm-card-title:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
.rv .adm-card dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:10px 0 0;font-size:13px}
.rv .adm-card dt{color:var(--muted);font-size:12px}.rv .adm-card dd{margin:0;min-width:0;word-break:break-word}
.rv .adm-card-foot{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}
.rv .kv{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px 22px}
.rv .kv dt{font-size:11px;color:var(--muted);margin-bottom:3px}.rv .kv dd{margin:0;font-size:13px;word-break:break-word}
.rv .pager{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px;font-size:12px;color:var(--muted);flex-wrap:wrap}
.rv .pager-btns{display:flex;gap:6px}
.rv .err{color:#C42F2F;font-size:12px;margin-top:4px}
.rv .confirm-text{font-size:13px;line-height:1.5}
@media (max-width:640px){
.rv .detail-actions{width:100%;flex-direction:column;align-items:stretch;gap:14px}
.rv .act-group+.act-group{padding-left:0;border-left:none;padding-top:12px;border-top:1px solid var(--border)}
.rv .act-btns button{flex:1 1 auto;min-height:44px}
.rv .tab{min-height:44px}
.rv .audit-row{flex-wrap:wrap}
.rv .table-wrap.has-cards{display:none}.rv .adm-cards{display:block}
.rv .adm-card-title{min-height:44px;display:flex;flex-direction:column;justify-content:center}
}
`;
export const AdminStyles = () => <style>{ADMIN_CSS}</style>;

// Id de Mongo completo, en monoespaciado. Un clic lo copia (y no dispara el clic de la fila).
export function IdCell({ id }) {
  const [copied, setCopied] = useState(false);
  if (!id) return <span style={{ color: "var(--muted)" }}>—</span>;
  async function copy(e) {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(String(id)); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* sin permiso para usar el portapapeles */ }
  }
  return <button type="button" className="mono id-chip" title="Clic para copiar" aria-label={`Copiar id ${id}`} onClick={copy}>{copied ? "Copiado ✓" : String(id)}</button>;
}

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
// En pantallas angostas (celular) la tabla se reemplaza por tarjetas: la primera columna es el título y el resto van como "campo: valor";
// las columnas sin título (botones de acción) quedan al pie. Con el teclado, cada fila se enfoca con Tab y se abre con Enter o Espacio.
export function DataTable({ columns, rows, empty = "Sin datos para mostrar.", onRowClick, selectedId, rowKey = "_id" }) {
  if (!rows.length) return <div className="empty">{empty}</div>;
  const cell = (c, r) => (c.render ? c.render(r) : (r[c.key] ?? "—"));
  const [head, ...rest] = columns, fields = rest.filter((c) => c.label), actions = rest.filter((c) => !c.label && c.render);
  const open = (r) => (onRowClick ? () => onRowClick(r) : undefined);
  const onKey = (r) => (e) => { if (onRowClick && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onRowClick(r); } };
  return (
    <>
      <div className="table-wrap has-cards">
        <table className="adm-table">
          <thead><tr>{columns.map((c) => <th key={c.key} className={c.num ? "num" : ""}>{c.label}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[rowKey]} className={(onRowClick ? "click " : "") + (selectedId === r[rowKey] ? "sel" : "")} onClick={open(r)} onKeyDown={onKey(r)} tabIndex={onRowClick ? 0 : undefined}>
                {columns.map((c) => <td key={c.key} className={(c.num ? "num " : "") + (c.muted ? "muted" : "")}>{cell(c, r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="adm-cards">
        {rows.map((r) => (
          <li key={r[rowKey]} className={"adm-card" + (onRowClick ? " click" : "") + (selectedId === r[rowKey] ? " sel" : "")} onClick={open(r)}>
            {onRowClick ? <button type="button" className="adm-card-title" onClick={(e) => { e.stopPropagation(); onRowClick(r); }}>{cell(head, r)}</button> : <div className="adm-card-title">{cell(head, r)}</div>}
            {fields.length > 0 && <dl>{fields.map((c) => <div key={c.key} style={{ display: "contents" }}><dt>{c.label}</dt><dd>{cell(c, r)}</dd></div>)}</dl>}
            {actions.length > 0 && <div className="adm-card-foot">{actions.map((c) => <span key={c.key}>{cell(c, r)}</span>)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}

// Grupo de acciones del encabezado del detalle: un título chico arriba y los botones abajo (separa lo que cobra o frena de lo inofensivo).
export const ActGroup = ({ label, children }) => <div className="act-group" role="group" aria-label={label}><span className="act-label">{label}</span><div className="act-btns">{children}</div></div>;

const WA_ICON = <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.5a9.5 9.5 0 0 0-8.1 14.4L2.5 21.5l4.7-1.2A9.5 9.5 0 1 0 12 2.500z" /><path d="M9 8.500c.3 2.800 2.700 5.200 5.500 5.500l1.300-1.400-2-.9-.9.800a5.200 5.200 0 0 1-2.400-2.400l.8-.9-.9-2z" fill="currentColor" stroke="none" /></svg>;

// Teléfono que abre la conversación de WhatsApp en otra pestaña. Si no hay un link confiable (sin código de país), se muestra solo el texto.
export function PhoneLink({ phone }) {
  const text = String(phone == null ? "" : phone).trim();
  if (!text) return <span style={{ color: "var(--muted)" }}>—</span>;
  const href = waLink(text);
  if (!href) return <span title="Sin código de país: no se puede abrir WhatsApp con este número">{text}</span>;
  return <a className="wa-link" href={href} target="_blank" rel="noopener noreferrer" title="Abrir la conversación en WhatsApp" aria-label={`Abrir WhatsApp con ${text}`} onClick={(e) => e.stopPropagation()}>{WA_ICON}{text}</a>;
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

