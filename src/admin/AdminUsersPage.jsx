// Pantalla principal de "Admin Spicy": tabla de usuarios (más recientes primero) con buscador y paginación.
// Al elegir un usuario se abre su detalle (company, campañas, créditos, etc.).
import { useState } from "react";
import { listUsers, listAudit } from "./adminApi.js";
import { userFullName, planOf, planLabel, whatsappProvider } from "./adminLogic.js";
import { DataTable, StatusBadge, Pager, AuditList, PhoneLink } from "./adminUi.jsx";
import { useAsync } from "./adminHooks.js";
import AdminCompanyDetail from "./AdminCompanyDetail.jsx";

const PAGE_SIZE = 8;

export default function AdminUsersPage({ actor }) {
  const [search, setSearch] = useState(""), [page, setPage] = useState(1), [selected, setSelected] = useState(null), [version, setVersion] = useState(0);
  const [owners, setOwners] = useState(false), [activeOnly, setActiveOnly] = useState(false);
  const users = useAsync(() => listUsers({ search, page, pageSize: PAGE_SIZE, owners, activeOnly }), `users:${search}:${page}:${owners}:${activeOnly}:${version}`);
  const audit = useAsync(() => listAudit({ limit: 10 }), `audit:${version}`);

  if (selected) return <AdminCompanyDetail userId={selected} actor={actor} onBack={() => setSelected(null)} onChanged={() => setVersion((v) => v + 1)} />;

  const r = users.data;
  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Usuarios y companies</div><div className="page-sub">Buscá un usuario para ver su company, campañas, créditos y más.</div></div>
      </div>
      <div className="card">
        <div style={{ marginBottom: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input className="inp" style={{ maxWidth: 360 }} placeholder="Buscar por email, teléfono, nombre o apellido" aria-label="Buscar usuario" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <div className="filter-group" role="group" aria-label="Filtros">
            <button className={"pill" + (owners ? " on" : "")} aria-pressed={owners} onClick={() => { setOwners(!owners); setPage(1); }}>Solo owners</button>
            <button className={"pill seg" + (activeOnly ? " on" : "")} aria-pressed={activeOnly} onClick={() => { setActiveOnly(!activeOnly); setPage(1); }}>Company activa</button>
            {(owners || activeOnly) && <button className="btn-sm" onClick={() => { setOwners(false); setActiveOnly(false); setPage(1); }}>Quitar filtros</button>}
          </div>
        </div>
        {users.loading && !r ? <div className="empty">Cargando…</div> : users.error ? <div className="err">{users.error}</div> : (
          <>
            <DataTable rows={r?.items || []} empty={search || owners || activeOnly ? "Ningún usuario coincide con la búsqueda y los filtros." : "Todavía no hay usuarios."} onRowClick={(u) => setSelected(u._id)} columns={[
              { key: "name", label: "Usuario", render: (u) => <><b>{userFullName(u)}</b>{u.isOwner && <span className="badge badge-blue" style={{ marginLeft: 6 }}>Owner</span>}<div style={{ color: "var(--muted)", fontSize: 11 }}>{u.email}</div></> },
              { key: "phoneNumber", label: "Teléfono", render: (u) => <PhoneLink phone={u.phoneNumber} /> },
              { key: "companyName", label: "Company" },
              { key: "companyStatus", label: "Estado", render: (u) => (u.companyStatus ? <StatusBadge status={u.companyStatus} /> : <span style={{ color: "var(--muted)" }}>Sin company</span>) },
              { key: "plan", label: "Plan", render: (u) => planLabel(planOf(u)) },
              { key: "wa", label: "WhatsApp", muted: true, render: (u) => whatsappProvider(u)?.provider || "—" },
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
