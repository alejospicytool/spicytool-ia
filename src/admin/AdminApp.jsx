// Sección "Admin Spicy" (solo admins): reemplaza al Retool "Admin Dashboard For SpicyTool!" (ver PLAN.md).
// Etapa actual: SOLO FRONT con datos de ejemplo (adminMock.js / adminApi.js), sin conexión a Mongo, Postgres ni Stripe.
// Módulo 1: Usuarios + Company + Créditos de WhatsApp. Los módulos siguientes se suman como vistas "adm_*".
import { RvStyles } from "../revenue/revenueUi.jsx";
import { AdminStyles } from "./adminUi.jsx";
import AdminUsersPage from "./AdminUsersPage.jsx";

export default function AdminApp({ view, actor }) {
  return (
    <div className="rv">
      <RvStyles />
      <AdminStyles />
      <div className="demo-banner" role="status">Datos de ejemplo: esta sección todavía no está conectada a la base real. Los cambios que hagas se pierden al recargar.</div>
      {view === "adm_users" && <AdminUsersPage actor={actor} />}
    </div>
  );
}
