// "Conexiones de WhatsApp": todas las conexiones de Kapso (colección kapsoapps) de todas las companies. Por defecto muestra las PENDIENTES de
// conexión (se creó la conexión pero el cliente no terminó de conectar el número), las más antiguas primero, para poder seguirlas.
// Al elegir una fila se abre la ficha del usuario de esa conexión.
import { useState } from "react";
import { listKapsoApps, getMyPermissions } from "./adminApi.js";
import { kapsoStatusInfo } from "./adminLogic.js";
import { DataTable, StatusBadge, Pager, PhoneLink } from "./adminUi.jsx";
import { useAsync } from "./adminHooks.js";
import { fmtDate } from "../revenue/revenueUi.jsx";
import AdminCompanyDetail from "./AdminCompanyDetail.jsx";
import KapsoSetupLinkButton from "./KapsoSetupLinkButton.jsx";

const PAGE_SIZE = 10;
const TABS = [["pending", "Pendientes"], ["connected", "Conectadas"], ["all", "Todas"]];
const TONE = { green: "badge-green", amber: "badge-yellow", muted: "badge-muted" };

export default function AdminWhatsappPage({ actor, onOpenFicha = null }) {
  const [status, setStatus] = useState("pending"), [search, setSearch] = useState(""), [activeOnly, setActiveOnly] = useState(true), [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null), [version, setVersion] = useState(0);
  const perms = useAsync(() => getMyPermissions(), "wperms:" + actor);
  const list = useAsync(() => listKapsoApps({ status, search, activeOnly, page, pageSize: PAGE_SIZE }), `kapso:${status}:${search}:${activeOnly}:${page}:${version}`);

  if (selected) return <AdminCompanyDetail userId={selected} actor={actor} onOpenFicha={onOpenFicha} onBack={() => setSelected(null)} onChanged={() => setVersion((v) => v + 1)} />;

  const r = list.data;
  const change = (fn) => (v) => { fn(v); setPage(1); };
  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Conexiones de WhatsApp</div><div className="page-sub">Las conexiones por Kapso de todas las companies. Las pendientes son las que se crearon pero todavía no terminaron de conectar el número.</div></div>
      </div>
      <div className="card">
        <div style={{ marginBottom: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="filter-group" role="group" aria-label="Estado de la conexión">
            {TABS.map(([k, label]) => <button key={k} className={"pill" + (status === k ? " on" : "")} aria-pressed={status === k} onClick={() => change(setStatus)(k)}>{label}{r && r.counts ? ` · ${r.counts[k]}` : ""}</button>)}
          </div>
          <button className={"pill seg" + (activeOnly ? " on" : "")} aria-pressed={activeOnly} onClick={() => change(setActiveOnly)(!activeOnly)} title="Oculta las conexiones de companies pausadas">Solo companies activas</button>
          <input className="inp" style={{ maxWidth: 320 }} placeholder="Buscar por company, usuario, email o teléfono" aria-label="Buscar conexión" value={search} onChange={(e) => change(setSearch)(e.target.value)} />
        </div>
        {list.loading && !r ? <div className="empty">Cargando…</div> : list.error ? <div className="err">{list.error}</div> : (
          <>
            <DataTable rows={r?.items || []} empty={search ? "Ninguna conexión coincide con la búsqueda." : status === "pending" ? "No hay conexiones pendientes. 🎉" : "No hay conexiones para mostrar."} onRowClick={(a) => a.userId && setSelected(a.userId)} columns={[
              { key: "companyName", label: "Company", render: (a) => <><b>{a.companyName}</b>{a.companyStatus && <span style={{ marginLeft: 6 }}><StatusBadge status={a.companyStatus} /></span>}</> },
              { key: "alias", label: "Conexión", render: (a) => <>{a.alias || "Sin nombre"}{a.isDefault && <span className="badge badge-blue" style={{ marginLeft: 6 }}>Principal</span>}{a.displayPhoneNumber && <div style={{ color: "var(--muted)", fontSize: 11 }}>{a.displayPhoneNumber}</div>}</> },
              { key: "status", label: "Estado", render: (a) => { const i = kapsoStatusInfo(a.status); return <><span className={"badge " + (TONE[i.tone] || "badge-muted")}>{i.label}</span>{a.status !== "success" && a.setupLinkExpiresAt && <div style={{ color: "var(--muted)", fontSize: 11 }}>{new Date(a.setupLinkExpiresAt) < new Date() ? "El link de conexión venció" : "Link vigente hasta " + fmtDate(a.setupLinkExpiresAt)}</div>}<div style={{ marginTop: 4 }}><KapsoSetupLinkButton app={a} canAct={!!(perms.data && perms.data.canAct)} /></div></>; } },
              { key: "daysSinceCreated", label: status === "connected" ? "Creada hace" : "Pendiente hace", num: true, render: (a) => (a.daysSinceCreated == null ? "—" : <span style={a.status === "pending_setup" && a.daysSinceCreated >= 14 ? { color: "var(--accent)", fontWeight: 600 } : undefined}>{a.daysSinceCreated === 0 ? "hoy" : `${a.daysSinceCreated} d`}</span>) },
              { key: "userName", label: "Usuario", render: (a) => <><b>{a.userName}</b><div style={{ color: "var(--muted)", fontSize: 11 }}>{a.userEmail}</div></> },
              { key: "userPhone", label: "Teléfono del usuario", render: (a) => <PhoneLink phone={a.userPhone} /> },
              { key: "createdAt", label: "Creada", muted: true, render: (a) => (a.createdAt ? fmtDate(a.createdAt) : "—") },
            ]} />
            {r && <Pager page={r.page} pages={r.pages} total={r.total} label={r.total === 1 ? "conexión" : "conexiones"} onChange={setPage} />}
          </>
        )}
      </div>
    </div>
  );
}
