// Registro de sesiones de soporte ("entrar como usuario"): quién entró, a qué cuenta, por qué y cuándo. Solo lectura.
// Nunca muestra ni guarda los links: son una llave a la cuenta del cliente.
import { useState } from "react";
import { listSupportLog } from "./adminApi.js";
import { DataTable, Pager } from "./adminUi.jsx";
import { useAsync } from "./adminHooks.js";
import { fmtDateTime } from "../revenue/revenueUi.jsx";

export default function AdminSupportPage() {
  const [search, setSearch] = useState(""), [page, setPage] = useState(1);
  const r = useAsync(() => listSupportLog({ search, page, pageSize: 10 }), `support:${search}:${page}`);
  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Soporte</div><div className="page-sub">Registro de las sesiones de soporte generadas. Para entrar a una cuenta, abrí al usuario y usá “Entrar como usuario”.</div></div>
      </div>
      <div className="card">
        <div style={{ marginBottom: 14 }}>
          <input className="inp" style={{ maxWidth: 360 }} placeholder="Buscar por admin, usuario, company o motivo" aria-label="Buscar sesión" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {r.loading && !r.data ? <div className="empty">Cargando…</div> : r.error ? <div className="err">{r.error}</div> : (
          <>
            <DataTable rowKey="id" rows={r.data.items} empty={search ? "Ninguna sesión coincide con la búsqueda." : "Todavía no se generó ninguna sesión de soporte."} columns={[
              { key: "at", label: "Fecha", muted: true, render: (a) => fmtDateTime(a.at) },
              { key: "actor", label: "Admin" },
              { key: "targetLabel", label: "Usuario", render: (a) => <>{a.targetLabel}<div style={{ fontSize: 11, color: "var(--muted)" }}>{a.detail?.targetEmail}</div></> },
              { key: "company", label: "Company", muted: true, render: (a) => a.detail?.companyName || "—" },
              { key: "reason", label: "Motivo", render: (a) => a.detail?.reason || "—" },
              { key: "result", label: "Resultado", render: (a) => a.action === "support_link_created" ? <span className="badge badge-green">Link generado</span> : <span className="badge badge-red">Sin permiso</span> },
            ]} />
            <Pager page={r.data.page} pages={r.data.pages} total={r.data.total} label={r.data.total === 1 ? "sesión" : "sesiones"} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
