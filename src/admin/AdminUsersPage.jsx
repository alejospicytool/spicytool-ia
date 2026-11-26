// Pantalla principal de "Admin Spicy": tabla de usuarios (más recientes primero) con buscador y paginación.
// Al elegir un usuario se abre su detalle (company, campañas, créditos, etc.).
import { useEffect, useState } from "react";
import { listUsers, listAudit } from "./adminApi.js";
import { userFullName, planOf, planLabel, planOptions, whatsappProvider, kapsoStatusInfo } from "./adminLogic.js";
import { DataTable, StatusBadge, Pager, AuditList, PhoneLink } from "./adminUi.jsx";
import { useAsync } from "./adminHooks.js";
import AdminCompanyDetail from "./AdminCompanyDetail.jsx";
import SendToCrmButton from "./SendToCrmDialog.jsx";
import { canSendToCrm, sentDealOf, loadCrmContext } from "./crmSend.js";

const PAGE_SIZE = 8;

export default function AdminUsersPage({ actor, crmSb = null, openUser = null, onOpenUserHandled = null }) {
  // openUser = { id, token }: pedido desde afuera (buscador global) para abrir el detalle de un usuario. Se atiende una sola vez por pedido.
  const [seenOpen, setSeenOpen] = useState(openUser);
  const [search, setSearch] = useState(""), [page, setPage] = useState(1), [selected, setSelected] = useState(openUser ? openUser.id : null), [version, setVersion] = useState(0);
  if (openUser && openUser !== seenOpen) { setSeenOpen(openUser); setSelected(openUser.id); }
  useEffect(() => { if (openUser && onOpenUserHandled) onOpenUserHandled(); }, [openUser]); // eslint-disable-line react-hooks/exhaustive-deps -- Avisa una vez por pedido que ya se atendió (el padre lo borra).
  const [owners, setOwners] = useState(false), [activeOnly, setActiveOnly] = useState(false), [plan, setPlan] = useState("");
  const users = useAsync(() => listUsers({ search, page, pageSize: PAGE_SIZE, owners, activeOnly, plan }), `users:${search}:${page}:${owners}:${activeOnly}:${plan}:${version}`);
  // Deals del CRM (solo si el usuario tiene acceso al CRM): para marcar a quién ya se envió.
  const crm = useAsync(() => (crmSb ? loadCrmContext(crmSb).catch(() => null) : Promise.resolve(null)), `crmdeals:${!!crmSb}:${version}`);
  const [toast, setToast] = useState("");
  const audit = useAsync(() => listAudit({ limit: 10 }), `audit:${version}`);

  const r = users.data;
  // Los conteos del selector se mantienen mientras se recarga la lista (si no, el selector parpadea).
  const [counts, setCounts] = useState(null);
  if (r && r.planCounts && r.planCounts !== counts) setCounts(r.planCounts);

  if (selected) return <AdminCompanyDetail userId={selected} actor={actor} crmSb={crmSb} onBack={() => setSelected(null)} onChanged={() => setVersion((v) => v + 1)} />;

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Usuarios y companies</div><div className="page-sub">Buscá un usuario para ver su company, campañas, créditos y más.</div></div>
      </div>
      {toast && <div className="notice" role="status" style={{ background: "#EDFAF3", color: "#16A34A", border: "1px solid #BFE9D2", display: "flex", justifyContent: "space-between", gap: 8 }}><span>{toast}</span><button className="btn-sm" onClick={() => setToast("")}>Cerrar</button></div>}
      <div className="card">
        <div style={{ marginBottom: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input className="inp" style={{ maxWidth: 360 }} placeholder="Buscar por email, teléfono, nombre o apellido" aria-label="Buscar usuario" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select className="inp" style={{ maxWidth: 220 }} aria-label="Filtrar por tipo de suscripción" value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }}>
            <option value="">Todas las suscripciones</option>
            {planOptions(counts, plan).map((o) => <option key={o.value} value={o.value}>{o.label} ({o.count})</option>)}
          </select>
          <div className="filter-group" role="group" aria-label="Filtros">
            <button className={"pill" + (owners ? " on" : "")} aria-pressed={owners} onClick={() => { setOwners(!owners); setPage(1); }}>Solo owners</button>
            <button className={"pill seg" + (activeOnly ? " on" : "")} aria-pressed={activeOnly} onClick={() => { setActiveOnly(!activeOnly); setPage(1); }}>Company activa</button>
            {(owners || activeOnly || plan) && <button className="btn-sm" onClick={() => { setOwners(false); setActiveOnly(false); setPlan(""); setPage(1); }}>Quitar filtros</button>}
          </div>
        </div>
        {users.loading && !r ? <div className="empty">Cargando…</div> : users.error ? <div className="err">{users.error}</div> : (
          <>
            <DataTable rows={r?.items || []} empty={search || owners || activeOnly || plan ? "Ningún usuario coincide con la búsqueda y los filtros." : "Todavía no hay usuarios."} onRowClick={(u) => setSelected(u._id)} columns={[
              { key: "name", label: "Usuario", render: (u) => <><b>{userFullName(u)}</b>{u.isOwner && <span className="badge badge-blue" style={{ marginLeft: 6 }}>Owner</span>}<div style={{ color: "var(--muted)", fontSize: 11 }}>{u.email}</div></> },
              { key: "phoneNumber", label: "Teléfono", render: (u) => <PhoneLink phone={u.phoneNumber} /> },
              { key: "companyName", label: "Company", render: (u) => <>{u.companyName}{u.isCollaborator && <span className="badge badge-muted" style={{ marginLeft: 6 }} title="Es colaborador de esta company: no es el dueño">Colaborador</span>}</> },
              { key: "companyStatus", label: "Estado", render: (u) => (u.companyStatus ? <StatusBadge status={u.companyStatus} /> : <span style={{ color: "var(--muted)" }}>Sin company</span>) },
              { key: "plan", label: "Plan", render: (u) => planLabel(planOf(u)) },
              { key: "wa", label: "WhatsApp", muted: true, render: (u) => <>{whatsappProvider(u)?.provider || "—"}{(u.kapsoApps || []).map((a) => { const i = kapsoStatusInfo(a.status); return <div key={a._id} style={{ fontSize: 11 }} title={`${a.alias || "Sin nombre"} · ${i.label}${a.connectionType ? " · " + a.connectionType : ""}`}><span className={"badge " + ({ green: "badge-green", amber: "badge-yellow", muted: "badge-muted" }[i.tone] || "badge-muted")}>{i.label}</span> {[a.alias, a.displayPhoneNumber].filter(Boolean).join(" · ")}</div>; })}</> },
              ...(crmSb ? [{ key: "crm", label: "", render: (u) => (canSendToCrm(u) ? (() => { const d = sentDealOf(crm.data && crm.data.deals, u); return <SendToCrmButton sb={crmSb} user={u} companyName={u.companyName} actor={actor} sent={d} stageLabel={d && crm.data.config ? ((crm.data.config.stages || []).find((s) => s.id === d.stage) || {}).name : ""} onSent={(deal, stage) => { setToast(`Enviado al CRM: ${deal.empresa} quedó en “${stage}”.`); setVersion((v) => v + 1); }} />; })() : null) }] : []),
            ]} />
            {r && <Pager page={r.page} pages={r.pages} total={r.total} label={r.total === 1 ? "usuario" : "usuarios"} onChange={setPage} />}
          </>
        )}
      </div>
      <div className="card">
        <div className="card-title"><span>Últimas acciones<span className="card-sub">registro de auditoría</span></span></div>
        <AuditList entries={audit.data || []} />
      </div>
    </div>
  );
}
