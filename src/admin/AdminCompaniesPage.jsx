// Companies activas y pausadas: dos listas (pestañas) y, al elegir una company, sus usuarios. Desde un usuario se abre su
// detalle completo (el mismo de "Usuarios y companies").
import { useState } from "react";
import { listCompanies, listCompanyUsers } from "./adminApi.js";
import { userFullName } from "./adminLogic.js";
import { Tabs, DataTable, StatusBadge, Pager } from "./adminUi.jsx";
import { useAsync } from "./adminHooks.js";
import { fmtDate } from "../revenue/revenueUi.jsx";
import AdminCompanyDetail from "./AdminCompanyDetail.jsx";

const PAGE_SIZE = 8;

export default function AdminCompaniesPage({ actor }) {
  const [status, setStatus] = useState("active"), [search, setSearch] = useState(""), [page, setPage] = useState(1), [company, setCompany] = useState(null), [userId, setUserId] = useState(null), [version, setVersion] = useState(0);
  const list = useAsync(() => listCompanies({ status, search, page, pageSize: PAGE_SIZE }), `companies:${status}:${search}:${page}:${version}`);
  const users = useAsync(() => (company ? listCompanyUsers(company._id) : Promise.resolve([])), `cusers:${company?._id}:${version}`);

  if (userId) return <AdminCompanyDetail userId={userId} actor={actor} onBack={() => setUserId(null)} onChanged={() => setVersion((v) => v + 1)} />;

  const r = list.data, counts = r?.counts || { active: 0, paused: 0 };
  const change = (fn) => (...a) => { fn(...a); setPage(1); setCompany(null); };
  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Companies</div><div className="page-sub">Listas de companies activas y pausadas. Elegí una para ver sus usuarios.</div></div>
      </div>
      <div className="card">
        <Tabs active={status} onChange={change(setStatus)} tabs={[{ key: "active", label: "Activas", count: counts.active }, { key: "paused", label: "Pausadas", count: counts.paused }]} />
        <div style={{ marginBottom: 14 }}>
          <input className="inp" style={{ maxWidth: 360 }} placeholder="Buscar por nombre o email del owner" aria-label="Buscar company" value={search} onChange={(e) => change(setSearch)(e.target.value)} />
        </div>
        {list.loading && !r ? <div className="empty">Cargando…</div> : list.error ? <div className="err">{list.error}</div> : (
          <>
            <DataTable rows={r?.items || []} selectedId={company?._id} onRowClick={setCompany}
              empty={search ? "Ninguna company coincide con la búsqueda." : status === "paused" ? "No hay companies pausadas." : "No hay companies activas."} columns={[
                { key: "name", label: "Company", render: (c) => <b>{c.name}</b> }, { key: "userEmail", label: "Owner", muted: true },
                { key: "status", label: "Estado", render: (c) => <StatusBadge status={c.status} /> }, { key: "userCount", label: "Usuarios", num: true },
                { key: "credits", label: "Créditos", num: true, render: (c) => Number(c.credits || 0).toLocaleString("es-AR") }, { key: "creationDate", label: "Alta", muted: true, render: (c) => fmtDate(c.creationDate) },
              ]} />
            {r && <Pager page={r.page} pages={r.pages} total={r.total} label={r.total === 1 ? "company" : "companies"} onChange={(p) => { setPage(p); setCompany(null); }} />}
          </>
        )}
      </div>
      {company && (
        <div className="card">
          <div className="card-title"><span>Usuarios de {company.name}<span className="card-sub">{users.data ? users.data.length : ""}</span></span></div>
          {users.loading ? <div className="empty">Cargando…</div> : users.error ? <div className="err">{users.error}</div> : (
            <DataTable rows={users.data} onRowClick={(u) => setUserId(u._id)} empty="Esta company no tiene usuarios." columns={[
              { key: "name", label: "Nombre", render: (u) => <>{u.name || "—"}{u.isOwner && <span className="badge badge-blue" style={{ marginLeft: 6 }}>Owner</span>}</> },
              { key: "surname", label: "Apellido" }, { key: "email", label: "Email" }, { key: "phoneNumber", label: "Teléfono" },
              { key: "open", label: "", muted: true, render: (u) => <span title={userFullName(u)}>Ver detalle →</span> },
            ]} />
          )}
        </div>
      )}
    </div>
  );
}
