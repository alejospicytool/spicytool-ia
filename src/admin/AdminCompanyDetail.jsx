// Detalle de un usuario y su company: datos, usuarios de la company, contactos, campañas, landings, conversiones,
// WhatsApp, pipelines, formularios, workflows, créditos y registro de auditoría. Desde acá se ejecutan las acciones
// (editar, pausar/activar, cambiar plan, eliminar workflow), todas con confirmación o formulario y con auditoría.
import { useState } from "react";
import { Kpi, fmtDate, fmtDateTime } from "../revenue/revenueUi.jsx";
import { getUser, getCompanyBundle, getPipelineStages, getCredits, listAudit, updateCompany, updateUserContact, setCompanyStatus, changePlan, deleteWorkflow } from "./adminApi.js";
import { companyIdOf, userFullName, whatsappProvider, currentPlanKey, planLabel, sortByPosition } from "./adminLogic.js";
import { Tabs, DataTable, StatusBadge, ConfirmDialog, AuditList } from "./adminUi.jsx";
import { useAsync } from "./adminHooks.js";
import { EditCompanyDialog, EditContactDialog, ChangePlanDialog } from "./AdminDialogs.jsx";

const yesNo = (v) => (v ? "Sí" : "No");
const num = (v) => (v == null ? "—" : Number(v).toLocaleString("es-AR"));
const Card = ({ title, sub, children }) => <div className="card"><div className="card-title"><span>{title}{sub != null && <span className="card-sub">{sub}</span>}</span></div>{children}</div>;

function Summary({ b, user }) {
  const c = b.company, wa = whatsappProvider(user);
  const fields = [
    ["Estado", <StatusBadge key="s" status={c.status} />], ["Vertical", c.vertical], ["Tamaño del equipo", c.teamSize], ["Créditos", `${num(c.credits)} ${c.currency || ""}`],
    ["Teléfono", c.phoneNumber], ["Email del dueño", c.userEmail], ["Alta", fmtDate(c.creationDate)], ["Account ID", c.accountId], ["Conversaciones de WhatsApp activas", num(c.activeWhatsAppConversations)],
    ["Configurada", yesNo(c.isConfigured)], ["Onboarding terminado", yesNo(c.onboardingEnded)], ["Track ID", c.trackId], ["Última factura impaga", c.lastUnpaidBill ? fmtDate(c.lastUnpaidBill) : "—"],
  ];
  return (
    <>
      <Card title="Company">
        <dl className="kv">{fields.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v ?? "—"}</dd></div>)}</dl>
      </Card>
      <Card title="Usuario seleccionado">
        <dl className="kv">
          {[["Nombre", userFullName(user)], ["Email", user.email], ["Teléfono", user.phoneNumber], ["Plan", planLabel(currentPlanKey(user))], ["Tipo de suscripción", user.subscription?.subscriptionType], ["Tier", user.subscription?.tier],
            ["Cliente en Stripe", user.stripe?.customerId], ["Proveedor de WhatsApp", wa ? `${wa.provider} · ${wa.appId}` : "Sin configurar"]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}
        </dl>
      </Card>
      <Card title="Usuarios de la company" sub={b.users.length}>
        <DataTable rows={b.users} columns={[
          { key: "name", label: "Nombre", render: (u) => userFullName(u) }, { key: "email", label: "Email" }, { key: "phoneNumber", label: "Teléfono" },
          { key: "plan", label: "Plan", render: (u) => planLabel(currentPlanKey(u)) },
        ]} />
      </Card>
    </>
  );
}

function PipelinesTab({ pipelines }) {
  const [sel, setSel] = useState(pipelines[0]?._id || null);
  const st = useAsync(() => (sel ? getPipelineStages(sel) : Promise.resolve([])), "stages:" + sel);
  return (
    <>
      <Card title="Pipelines" sub={pipelines.length}>
        <DataTable rows={pipelines} selectedId={sel} onRowClick={(p) => setSel(p._id)} empty="Esta company no tiene pipelines." columns={[{ key: "name", label: "Nombre" }, { key: "description", label: "Descripción", muted: true }]} />
      </Card>
      {sel && (
        <Card title="Stages" sub={pipelines.find((p) => p._id === sel)?.name}>
          {st.loading ? <div className="empty">Cargando…</div> : st.error ? <div className="err">{st.error}</div> :
            <DataTable rows={sortByPosition(st.data)} empty="Este pipeline no tiene stages." columns={[{ key: "position", label: "#", num: true }, { key: "name", label: "Nombre" }, { key: "description", label: "Descripción", muted: true }]} />}
        </Card>
      )}
    </>
  );
}

function CreditsTab({ companyId, version }) {
  const r = useAsync(() => getCredits(companyId), `credits:${companyId}:${version}`);
  if (r.loading) return <div className="empty">Cargando créditos…</div>;
  if (r.error) return <div className="err">{r.error}</div>;
  const { balance, transactions } = r.data;
  return (
    <>
      <div className="kpi-grid">
        <Kpi color="blue" label="Créditos mensuales" value={balance ? num(balance.monthly_credits) : "—"} />
        <Kpi label="Créditos totales" value={balance ? num(balance.total_credits) : "—"} />
        <Kpi color="green" label="Créditos disponibles" value={balance ? num(balance.available_credits) : "—"} />
      </div>
      {!balance && <div className="notice" style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FCE4A0" }}>Esta company no tiene saldo en el billing.</div>}
      <Card title="Transacciones" sub={transactions.length}>
        <DataTable rowKey="id" rows={transactions} empty="Sin transacciones." columns={[
          { key: "created_at", label: "Fecha", render: (t) => fmtDateTime(t.created_at) }, { key: "type", label: "Tipo" }, { key: "description", label: "Detalle", muted: true },
          { key: "amount", label: "Créditos", num: true, render: (t) => <span className={t.amount < 0 ? "neg" : "pos"}>{t.amount > 0 ? "+" : ""}{num(t.amount)}</span> },
        ]} />
      </Card>
    </>
  );
}

function AuditTab({ companyId, version }) {
  const r = useAsync(() => listAudit({ companyId }), `audit:${companyId}:${version}`);
  return <Card title="Registro de auditoría" sub="acciones sobre esta company y sus usuarios">{r.loading ? <div className="empty">Cargando…</div> : <AuditList entries={r.data || []} />}</Card>;
}

export default function AdminCompanyDetail({ userId, actor, onBack, onChanged }) {
  const [version, setVersion] = useState(0), [tab, setTab] = useState("resumen"), [dialog, setDialog] = useState(null), [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false), [confirmError, setConfirmError] = useState("");
  const res = useAsync(async () => { const user = await getUser(userId); if (!user) throw new Error("No se encontró el usuario."); return { user, bundle: await getCompanyBundle(companyIdOf(user)) }; }, `detail:${userId}:${version}`);

  const refresh = () => { setVersion((v) => v + 1); onChanged(); };
  async function runConfirmed() {
    setConfirmBusy(true); setConfirmError("");
    try { await confirm.action(); setConfirm(null); refresh(); } catch (e) { setConfirmError(e.message || String(e)); }
    setConfirmBusy(false);
  }
  const ask = (c) => { setConfirmError(""); setConfirm(c); };
  const submitted = (fn) => async (v) => { await fn(v); refresh(); };

  if (res.loading) return <div className="empty">Cargando…</div>;
  if (res.error) return <div><button className="btn-secondary" onClick={onBack}>← Volver</button><div className="err" style={{ marginTop: 12 }}>{res.error}</div></div>;
  const { user, bundle: b } = res.data, co = b.company, paused = co.status === "paused";

  const tabs = [
    { key: "resumen", label: "Resumen" }, { key: "contactos", label: "Contactos", count: b.contacts.length }, { key: "campanas", label: "Campañas", count: b.campaigns.length },
    { key: "landings", label: "Landings", count: b.landings.length }, { key: "conversiones", label: "Conversiones", count: b.conversions.length }, { key: "whatsapp", label: "WhatsApp" },
    { key: "pipelines", label: "Pipelines", count: b.pipelines.length }, { key: "forms", label: "Formularios y listas" }, { key: "workflows", label: "Workflows", count: b.workflows.length },
    { key: "creditos", label: "Créditos" }, { key: "auditoria", label: "Auditoría" },
  ];

  return (
    <div>
      <button className="btn-secondary" style={{ marginBottom: 14 }} onClick={onBack}>← Volver a usuarios</button>
      <div className="detail-head">
        <div>
          <div className="page-title">{userFullName(user)} <StatusBadge status={co.status} /></div>
          <div className="page-sub">{user.email} · {co.name} · Plan: {planLabel(currentPlanKey(user))}</div>
        </div>
        <div className="detail-actions">
          <button className="btn-secondary" onClick={() => setDialog("company")}>Editar company</button>
          <button className="btn-secondary" onClick={() => setDialog("contact")}>Editar contacto</button>
          <button className="btn-secondary" onClick={() => setDialog("plan")}>Cambiar plan</button>
          {paused
            ? <button className="btn-primary" onClick={() => ask({ title: "Activar company", label: "Activar", text: <>Vas a <b>activar</b> la company <b>{co.name}</b>. Sus usuarios vuelven a poder usar la cuenta.</>, action: () => setCompanyStatus(co._id, "active", actor) })}>Activar company</button>
            : <button className="btn-warn" onClick={() => ask({ title: "Pausar company", label: "Pausar", danger: true, text: <>Vas a <b>pausar</b> la company <b>{co.name}</b>. Sus usuarios dejan de poder usar la cuenta hasta que la actives de nuevo.</>, action: () => setCompanyStatus(co._id, "paused", actor) })}>Pausar company</button>}
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "resumen" && <Summary b={b} user={user} />}
      {tab === "contactos" && <Card title="Contactos" sub={b.contacts.length}><DataTable rows={b.contacts} empty="Sin contactos." columns={[
        { key: "name", label: "Nombre", render: (c) => [c.name, c.surname].filter(Boolean).join(" ") }, { key: "email", label: "Email" }, { key: "phoneNumber", label: "Teléfono" },
        { key: "source", label: "Origen" }, { key: "keyword", label: "Keyword", muted: true }, { key: "createdFrom", label: "Creado desde", muted: true }, { key: "createdAt", label: "Alta", render: (c) => fmtDate(c.createdAt) },
      ]} /></Card>}
      {tab === "campanas" && <Card title="Campañas" sub={b.campaigns.length}><DataTable rows={b.campaigns} empty="Sin campañas." columns={[
        { key: "campaignName", label: "Campaña" }, { key: "campaignId", label: "ID", muted: true }, { key: "campaignStatus", label: "Estado", render: (c) => <span className={"badge " + (c.campaignStatus === "ENABLED" ? "badge-green" : "badge-muted")}>{c.campaignStatus}</span> },
        { key: "budgetPerDay", label: "Presupuesto/día", num: true }, { key: "investedPerDay", label: "Invertido/día", num: true }, { key: "accountId", label: "Account", muted: true },
      ]} /></Card>}
      {tab === "landings" && <Card title="Landings" sub={b.landings.length}><DataTable rows={b.landings} empty="Sin landings." columns={[
        { key: "name", label: "Nombre" }, { key: "keyword", label: "Keyword" }, { key: "phoneNumber", label: "Teléfono" }, { key: "source", label: "Origen", muted: true },
      ]} /></Card>}
      {tab === "conversiones" && <Card title="Conversiones" sub={b.conversions.length}><DataTable rows={b.conversions} empty="Sin conversiones configuradas." columns={[
        { key: "condition", label: "Condición" }, { key: "conversionCategory", label: "Categoría", render: (c) => <span className="badge badge-blue">{c.conversionCategory}</span> },
      ]} /></Card>}
      {tab === "whatsapp" && (<>
        <Card title="Conversaciones de WhatsApp" sub={b.whatsappConversions.length}><DataTable rows={b.whatsappConversions} empty="Sin conversiones de WhatsApp." columns={[
          { key: "date", label: "Fecha", render: (c) => fmtDate(c.date) }, { key: "behavior", label: "Comportamiento" }, { key: "checked", label: "Verificada", render: (c) => yesNo(c.checked) }, { key: "source", label: "Origen", muted: true }, { key: "trackId", label: "Track ID", muted: true },
        ]} /></Card>
        <Card title="Templates" sub={b.templates.length}><DataTable rows={b.templates} empty="Sin templates." columns={[
          { key: "name", label: "Nombre" }, { key: "category", label: "Categoría", render: (t) => <span className="badge badge-muted">{t.category}</span> }, { key: "header", label: "Encabezado", muted: true },
          { key: "message", label: "Mensaje" }, { key: "variables", label: "Variables", muted: true, render: (t) => (t.variables || []).join(", ") || "—" }, { key: "gupshup", label: "Gupshup", muted: true, render: (t) => t.gupshup?.status || "—" },
        ]} /></Card>
      </>)}
      {tab === "pipelines" && <PipelinesTab key={co._id} pipelines={b.pipelines} />}
      {tab === "forms" && (<>
        <Card title="Webforms" sub={b.webforms.length}><DataTable rows={b.webforms} empty="Sin webforms." columns={[{ key: "position", label: "#", num: true }, { key: "name", label: "Nombre" }, { key: "description", label: "Descripción", muted: true }]} /></Card>
        <Card title="Listas de contactos" sub={b.contactLists.length}><DataTable rows={b.contactLists} empty="Sin listas." columns={[{ key: "position", label: "#", num: true }, { key: "name", label: "Nombre" }]} /></Card>
      </>)}
      {tab === "workflows" && <Card title="Workflows" sub={b.workflows.length}><DataTable rows={b.workflows} empty="Sin workflows." columns={[
        { key: "name", label: "Nombre" }, { key: "description", label: "Descripción", muted: true }, { key: "triggerProperty", label: "Disparador", render: (w) => `${w.triggerProperty} = ${w.triggerValue}` },
        { key: "act", label: "", render: (w) => <button className="btn-sm danger" onClick={(e) => { e.stopPropagation(); ask({ title: "Eliminar workflow", label: "Eliminar", danger: true, text: <>Vas a <b>eliminar</b> el workflow <b>{w.name}</b>. Esta acción no se puede deshacer.</>, action: () => deleteWorkflow(w._id, actor) }); }}>Eliminar</button> },
      ]} /></Card>}
      {tab === "creditos" && <CreditsTab companyId={co._id} version={version} />}
      {tab === "auditoria" && <AuditTab companyId={co._id} version={version} />}

      {dialog === "company" && <EditCompanyDialog company={co} onClose={() => setDialog(null)} onSubmit={submitted((v) => updateCompany(co._id, v, actor))} />}
      {dialog === "contact" && <EditContactDialog user={user} onClose={() => setDialog(null)} onSubmit={submitted((v) => updateUserContact(user._id, v, actor))} />}
      {dialog === "plan" && <ChangePlanDialog user={user} onClose={() => setDialog(null)} onSubmit={submitted((k) => changePlan(user._id, k, actor))} />}
      {confirm && <ConfirmDialog title={confirm.title} confirmLabel={confirm.label} danger={confirm.danger} busy={confirmBusy} error={confirmError} onConfirm={runConfirmed} onCancel={() => setConfirm(null)}>{confirm.text}</ConfirmDialog>}
    </div>
  );
}
