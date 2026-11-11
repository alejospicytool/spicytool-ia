// Sección "Admin Spicy" (solo admins): reemplaza al Retool "Admin Dashboard For SpicyTool!" (ver PLAN.md).
// Al abrirla se prueba el backend del servidor (/api/admin): si responde, muestra datos reales de Mongo en SOLO LECTURA; si no,
// sigue con los datos de ejemplo (adminMock.js). Las acciones que cambian datos todavía no están conectadas.
// Módulo 1: Usuarios + Company + Créditos. Módulo 2: Companies activas y pausadas. Módulo 3: asignar plan y link de tarjeta. Módulo 4: Soporte.
import { RvStyles } from "../revenue/revenueUi.jsx";
import { AdminStyles } from "./adminUi.jsx";
import { useAsync } from "./adminHooks.js";
import { probeAdminApi } from "./adminApi.js";
import AdminUsersPage from "./AdminUsersPage.jsx";
import AdminCompaniesPage from "./AdminCompaniesPage.jsx";
import AdminSupportPage from "./AdminSupportPage.jsx";

export default function AdminApp({ view, actor }) {
  const probe = useAsync(() => probeAdminApi(), "probe");
  const real = probe.data === "real";
  return (
    <div className="rv">
      <RvStyles />
      <AdminStyles />
      {probe.loading ? <div className="empty">Conectando…</div> : (
        <>
          <div className="demo-banner" role="status">
            {real ? "Datos reales. Entrar como usuario todavía no está conectado. Editar company, editar contacto y pausar/activar cambian la base real, y “Asignar plan” COBRA de verdad a la tarjeta del cliente."
              : "Datos de ejemplo: esta sección todavía no está conectada a la base real. Los cambios que hagas se pierden al recargar."}
          </div>
          {view === "adm_users" && <AdminUsersPage actor={actor} />}
          {view === "adm_companies" && <AdminCompaniesPage actor={actor} />}
          {view === "adm_support" && <AdminSupportPage />}
        </>
      )}
    </div>
  );
}
