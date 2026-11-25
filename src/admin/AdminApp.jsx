// Sección "Admin Spicy" (admins, o quien tenga la sección asignada en Configuración → Usuarios y permisos; para hacer cambios, además 'Admin Spicy: acciones'): reemplaza al Retool "Admin Dashboard For SpicyTool!" (ver PLAN.md).
// Al abrirla se prueba el backend del servidor (/api/admin): si responde, muestra los datos reales de Mongo; si no,
// muestra un aviso (nunca datos inventados).
// Módulo 1: Usuarios + Company + Créditos. Módulo 2: Companies activas y pausadas. Módulo 3: asignar plan y link de tarjeta. Módulo 4: Soporte.
import { RvStyles } from "../revenue/revenueUi.jsx";
import { AdminStyles } from "./adminUi.jsx";
import { useAsync } from "./adminHooks.js";
import { probeAdminApi, getMyPermissions } from "./adminApi.js";
import AdminUsersPage from "./AdminUsersPage.jsx";
import AdminCompaniesPage from "./AdminCompaniesPage.jsx";
import AdminSupportPage from "./AdminSupportPage.jsx";
import AdminWhatsappPage from "./AdminWhatsappPage.jsx";

export default function AdminApp({ view, actor, crmSb = null }) {
  const probe = useAsync(() => probeAdminApi(), "probe");
  const real = probe.data === "real";
  const perms = useAsync(() => (real ? getMyPermissions() : Promise.resolve({ canAct: false })), "appperms:" + actor + ":" + probe.data);
  const readOnly = real && !!perms.data && perms.data.canAct === false;
  return (
    <div className="rv">
      <RvStyles />
      <AdminStyles />
      {probe.loading ? <div className="empty">Conectando…</div> : !real ? (
        <div className="err" role="alert">
          No se pudo conectar con el servidor de Admin Spicy, así que no hay datos para mostrar. Probá recargar la página; si sigue igual, avisá a un desarrollador (puede estar caído el servicio <b>backoffice-api</b> o no responder la base de Spicytool).
        </div>
      ) : (
        <>
          <div className="demo-banner" role="status">
            {readOnly ? "Datos reales, en modo solo lectura: podés consultar usuarios, companies y auditoría, pero no hacer cambios. Si los necesitás, pedile a un admin que te habilite las acciones."
              : "Datos reales. Editar company, editar contacto y pausar/activar cambian la base real, y “Asignar plan” COBRA de verdad a la tarjeta del cliente."}
          </div>
          {view === "adm_users" && <AdminUsersPage actor={actor} crmSb={crmSb} />}
          {view === "adm_companies" && <AdminCompaniesPage actor={actor} crmSb={crmSb} />}
          {view === "adm_whatsapp" && <AdminWhatsappPage actor={actor} />}
          {view === "adm_support" && <AdminSupportPage />}
        </>
      )}
    </div>
  );
}
