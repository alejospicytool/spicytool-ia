// Detalle de un usuario y su company: datos, usuarios de la company, campañas, landings, conversiones,
// WhatsApp, pipelines, formularios, workflows, créditos y registro de auditoría. Desde acá se ejecutan las acciones
// (editar, pausar/activar, cambiar plan, link de tarjeta), todas con confirmación o formulario y con auditoría.
import { useState } from "react";
import { Kpi, fmtDate, fmtDateTime } from "../revenue/revenueUi.jsx";
import { getUser, getCompanyBundle, getPipelineStages, getCredits, listAudit, updateCompany, updateUserContact, setCompanyStatus, assignPlan, getPaymentMethodUrl, createSupportLink, getMyPermissions, adminMode, setUserKapsoApp } from "./adminApi.js";
import { companyIdOf, isCollaboratorOf, userFullName, whatsappProvider, planOf, planLabel, sortByPosition, kapsoAppsOfUser, kapsoStatusInfo, kapsoQualityInfo, messagingTierLabel, incomingModeLabel } from "./adminLogic.js";
import { Tabs, DataTable, StatusBadge, ConfirmDialog, AuditList, IdCell, ActGroup, PhoneLink } from "./adminUi.jsx";
import { useAsync } from "./adminHooks.js";
import { EditCompanyDialog, EditContactDialog, AssignPlanDialog, CardLinkDialog, SupportSessionDialog } from "./AdminDialogs.jsx";

const yesNo = (v) => (v ? "Sí" : "No");
// Columna con el id de Mongo (copiable) para que se pueda buscar el documento en la base.
const ID_COL = { key: "_id", label: "ID de Mongo", render: (r) => <IdCell id={r._id} /> };
const NO_ACT_TITLE = "Tu usuario puede ver Admin Spicy pero no hacer cambios. Pedile a un admin que te habilite las acciones.";
// Mientras no se sabe qué permisos tiene (o si no puede hacer cambios) los botones de acciones quedan deshabilitados. La que manda es la API.
const cantAct = (perms) => !(perms.data && perms.data.canAct);
const num = (v) => (v == null ? "—" : Number(v).toLocaleString("es-AR"));
const TONE = { green: "badge-green", amber: "badge-yellow", red: "badge-red", muted: "badge-muted" };
const KapsoStatus = ({ status }) => { const i = kapsoStatusInfo(status); return <span className={"badge " + TONE[i.tone]}>{i.label}</span>; };

// Conexiones de WhatsApp por Kapso de la company (colección kapsoapps). Las del usuario que se está mirando quedan marcadas.
function KapsoAppsCard({ apps, users, user, canChange, onChange }) {
  const mine = new Set(kapsoAppsOfUser(apps, user).map((a) => a._id));
  const inUse = user.kapso && user.kapso.kapsoAppId, options = apps.filter((a) => a.status === "success");
  const [pick, setPick] = useState(inUse || "");
  const gupshup = String(user.activeWhatsAppProvider || "").toLowerCase() === "gupshup";
  const who = (id) => { const u = users.find((x) => x._id === id); return u ? userFullName(u) : id ? "Otro usuario" : "—"; };
  return (
    <Card title="Conexiones de WhatsApp (Kapso)" sub={apps.length}>
      {inUse && !gupshup && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "0 0 14px", padding: "10px 12px", background: "var(--surface2)", borderRadius: 8 }}>
          <span style={{ fontSize: 13 }}>Conexión que usa <b>{userFullName(user)}</b>:</span>
          <select className="inp" aria-label="Conexión de WhatsApp que usa este usuario" style={{ maxWidth: 320 }} value={pick} disabled={!canChange || options.length < 2} onChange={(e) => setPick(e.target.value)}>
            {!options.some((a) => a._id === inUse) && <option value={inUse}>Una conexión de otra company o sin datos</option>}
            {options.map((a) => <option key={a._id} value={a._id}>{[a.alias || "Sin nombre", a.displayPhoneNumber].filter(Boolean).join(" · ")}</option>)}
          </select>
          <button className="btn-primary" disabled={!canChange || pick === inUse || !pick} onClick={() => onChange(pick)}>Usar esta conexión</button>
          {options.length < 2 && <span style={{ fontSize: 11, color: "var(--muted)" }}>La company tiene una sola conexión conectada: no hay otra para elegir.</span>}
          {!canChange && options.length >= 2 && <span style={{ fontSize: 11, color: "var(--muted)" }}>Tu usuario no puede hacer cambios.</span>}
        </div>
      )}
      <DataTable rows={apps} empty="Esta company no tiene conexiones de WhatsApp por Kapso." columns={[
        { key: "alias", label: "Conexión", render: (a) => <><b>{a.alias || "Sin nombre"}</b>{a.isDefault && <span className="badge badge-blue" style={{ marginLeft: 6 }}>Principal</span>}{a._id === inUse && <span className="badge badge-green" style={{ marginLeft: 6 }} title="Es la conexión que tiene asignada este usuario">En uso</span>}{mine.has(a._id) && a._id !== inUse && <span className="badge badge-muted" style={{ marginLeft: 6 }}>Creada por este usuario</span>}{a.connectionType && a.connectionType !== "coexistence" && <span className="badge badge-muted" style={{ marginLeft: 6 }} title="Tipo de conexión (lo habitual es coexistencia)">{a.connectionType}</span>}</> },
        { key: "displayPhoneNumber", label: "Número", render: (a) => a.displayPhoneNumber ? <><PhoneLink phone={a.displayPhoneNumber} />{a.verifiedName && <div style={{ color: "var(--muted)", fontSize: 11 }}>{a.verifiedName}</div>}</> : <span style={{ color: "var(--muted)" }}>Sin número</span> },
        { key: "status", label: "Estado", render: (a) => <><KapsoStatus status={a.status} />{a.status !== "success" && a.setupLinkExpiresAt && <div style={{ color: "var(--muted)", fontSize: 11 }}>{new Date(a.setupLinkExpiresAt) < new Date() ? "El link de conexión venció" : "Link de conexión vigente hasta " + fmtDate(a.setupLinkExpiresAt)}</div>}</> },
        { key: "qualityRating", label: "Calidad del número", render: (a) => { const q = kapsoQualityInfo(a.qualityRating); return q ? <span className={"badge " + TONE[q.tone]}>{q.label}</span> : "—"; } },
        { key: "messagingLimitTier", label: "Límite de envío (24 h)", muted: true, render: (a) => messagingTierLabel(a.messagingLimitTier) },
        { key: "incomingMessageMode", label: "Mensajes entrantes", muted: true, render: (a) => incomingModeLabel(a.incomingMessageMode) },
        { key: "userId", label: "Usuario", render: (a) => who(a.userId) },
        { key: "connectedAt", label: "Conectada", muted: true, render: (a) => (a.connectedAt ? fmtDate(a.connectedAt) : "—") },
        { key: "lastTemplatesSyncAt", label: "Templates sincronizados", muted: true, render: (a) => (a.lastTemplatesSyncAt ? fmtDate(a.lastTemplatesSyncAt) : "—") },
        { key: "businessAccountId", label: "WABA", muted: true, render: (a) => (a.businessAccountId ? <IdCell id={a.businessAccountId} /> : "—") },
        { key: "phoneNumberId", label: "ID del número", muted: true, render: (a) => (a.phoneNumberId ? <IdCell id={a.phoneNumberId} /> : "—") },
        ID_COL]} />
    </Card>
  );
}

const Card = ({ title, sub, children }) => <div className="card"><div className="card-title"><span>{title}{sub != null && <span className="card-sub">{sub}</span>}</span></div>{children}</div>;

function Summary({ b, user }) {
  const c = b.company, wa = whatsappProvider(user), kapsoMine = kapsoAppsOfUser(b.kapsoApps, user), kapsoInUse = (b.kapsoApps || []).find((a) => user.kapso && a._id === user.kapso.kapsoAppId);
  const fields = [
    ["Estado", <StatusBadge key="s" status={c.status} />], ["Vertical", c.vertical], ["Tamaño del equipo", c.teamSize], ["Créditos", `${num(c.credits)} ${c.currency || ""}`],
    ["Teléfono", <PhoneLink key="ph" phone={c.phoneNumber} />], ["Email del dueño", c.userEmail], ["Alta", fmtDate(c.creationDate)], ["Account ID", c.accountId], ["Conversaciones de WhatsApp activas", num(c.activeWhatsAppConversations)],
    ["ID de la company (Mongo)", <IdCell key="cid" id={c._id} />], ["Configurada", yesNo(c.isConfigured)], ["Onboarding terminado", yesNo(c.onboardingEnded)], ["Track ID", c.trackId], ["Última factura impaga", c.lastUnpaidBill ? fmtDate(c.lastUnpaidBill) : "—"],
  ];
  return (
    <>
      <Card title="Company">
        <dl className="kv">{fields.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v ?? "—"}</dd></div>)}</dl>
      </Card>
      <Card title="Usuario seleccionado">
        <dl className="kv">
          {[["Nombre", userFullName(user)], ["Email", user.email], ["Teléfono", <PhoneLink key="ph" phone={user.phoneNumber} />], ["Plan", planLabel(planOf(user))], ["ID del usuario (Mongo)", <IdCell key="uid" id={user._id} />],
            ["Proveedor de WhatsApp", wa ? `${wa.provider}${wa.appId ? " · " + wa.appId : ""}` : "Sin configurar"],
            ["Conexión de WhatsApp en uso", kapsoInUse ? <span key="kp"><KapsoStatus status={kapsoInUse.status} /> {kapsoInUse.alias || "Sin nombre"}{kapsoInUse.displayPhoneNumber ? " · " + kapsoInUse.displayPhoneNumber : ""}{kapsoMine.length > 1 || (b.kapsoApps || []).length > 1 ? <span style={{ color: "var(--muted)" }}> (la company tiene {(b.kapsoApps || []).length} conexiones)</span> : null}</span> : kapsoMine.length ? <span key="kp2">Sin una asignada · creó {kapsoMine.length}</span> : "Ninguna"]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}
        </dl>
      </Card>
      <Card title="Suscripción">
        <dl className="kv">
          {[["Plan", planLabel(planOf(user))], ["Precio (Stripe)", user.stripe?.priceId], ["Suscripción en Stripe", user.stripe?.subscriptionId || user.subscription?.subscriptionId], ["Cliente en Stripe", user.stripe?.customerId]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}
        </dl>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 12 }}>El plan solo se cambia con “Asignar plan”, que cobra la tarjeta del cliente.</div>
      </Card>
      <Card title="Usuarios de la company" sub={b.users.length}>
        <DataTable rows={b.users} columns={[
          { key: "name", label: "Nombre", render: (u) => userFullName(u) }, { key: "email", label: "Email" }, { key: "phoneNumber", label: "Teléfono", render: (u) => <PhoneLink phone={u.phoneNumber} /> },
          { key: "plan", label: "Plan", render: (u) => planLabel(planOf(u)) }, ID_COL,
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
        <DataTable rows={pipelines} selectedId={sel} onRowClick={(p) => setSel(p._id)} empty="Esta company no tiene pipelines." columns={[{ key: "name", label: "Nombre" }, { key: "description", label: "Descripción", muted: true }, ID_COL]} />
      </Card>
      {sel && (
        <Card title="Stages" sub={pipelines.find((p) => p._id === sel)?.name}>
          {st.loading ? <div className="empty">Cargando…</div> : st.error ? <div className="err">{st.error}</div> :
            <DataTable rows={sortByPosition(st.data)} empty="Este pipeline no tiene stages." columns={[{ key: "position", label: "#", num: true }, { key: "name", label: "Nombre" }, { key: "description", label: "Descripción", muted: true }, ID_COL]} />}
        </Card>
      )}
    </>
  );
}

function CreditsTab({ companyId, version }) {
  const r = useAsync(() => getCredits(companyId), `credits:${companyId}:${version}`);
  if (r.loading) return <div className="empty">Cargando créditos…</div>;
  if (r.error) return <div className="err">{r.error}</div>;
  const { balance, transactions, unavailable } = r.data;
  if (unavailable) return <div className="notice" style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FCE4A0" }}>El saldo y las transacciones de créditos de WhatsApp viven en la base de billing, que todavía no está conectada.</div>;
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

// Usuario que se registró pero no tiene company (en la base real es la mayoría): solo se ven sus datos y la suscripción.
function NoCompanyView({ user, actor, onBack, refresh, dialog, setDialog, acts }) {
  const wa = whatsappProvider(user), submitted = (fn) => async (v) => { await fn(v); refresh(); };
  return (
    <div>
      <button className="btn-secondary" style={{ marginBottom: 14 }} onClick={onBack}>← Volver a usuarios</button>
      <div className="detail-head">
        <div>
          <div className="page-title">{userFullName(user)} <span className="badge badge-muted">Sin company</span></div>
          <div className="page-sub">{user.email} · Plan: {planLabel(planOf(user))}</div>
        </div>
        <div className="detail-actions">
          <ActGroup label="Editar">
            <button className="btn-secondary" {...acts} onClick={() => setDialog("contact")}>Editar contacto</button>
          </ActGroup>
          <ActGroup label="Plan y cobro">
            <button className="btn-charge" {...acts} onClick={() => setDialog("plan")}>Asignar plan (cobra)</button>
            <button className="btn-secondary" {...acts} onClick={() => setDialog("card")}>Link de tarjeta</button>
          </ActGroup>
          <ActGroup label="Cuenta">
            <button className="btn-access" disabled title="Este usuario no tiene company: no hay cuenta para revisar.">Entrar como usuario</button>
          </ActGroup>
        </div>
      </div>
      <div className="notice" style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FCE4A0" }}>Este usuario todavía no tiene company (no terminó el alta). No hay contactos, campañas ni créditos para mostrar.</div>
      <Card title="Usuario">
        <dl className="kv">
          {[["Nombre", userFullName(user)], ["Email", user.email], ["Teléfono", <PhoneLink key="ph" phone={user.phoneNumber} />], ["Plan", planLabel(planOf(user))], ["ID del usuario (Mongo)", <IdCell key="uid" id={user._id} />],
            ["Proveedor de WhatsApp", wa ? `${wa.provider}${wa.appId ? " · " + wa.appId : ""}` : "Sin configurar"]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}
        </dl>
      </Card>
      <Card title="Suscripción">
        <dl className="kv">
          {[["Plan", planLabel(planOf(user))], ["Precio (Stripe)", user.stripe?.priceId], ["Suscripción en Stripe", user.stripe?.subscriptionId || user.subscription?.subscriptionId], ["Cliente en Stripe", user.stripe?.customerId]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}
        </dl>
      </Card>
      {dialog === "contact" && <EditContactDialog user={user} onClose={() => setDialog(null)} onSubmit={submitted((v) => updateUserContact(user._id, v, actor))} />}
      {dialog === "plan" && <AssignPlanDialog user={user} onClose={() => setDialog(null)} onDone={refresh} onSubmit={(v) => assignPlan(user._id, v, actor)} />}
      {dialog === "card" && <CardLinkDialog user={user} onClose={() => { setDialog(null); refresh(); }} onSubmit={() => getPaymentMethodUrl(user._id, actor)} />}
    </div>
  );
}

export default function AdminCompanyDetail({ userId, actor, onBack, onChanged }) {
  const [version, setVersion] = useState(0), [tab, setTab] = useState("resumen"), [dialog, setDialog] = useState(null), [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false), [confirmError, setConfirmError] = useState("");
  const perms = useAsync(() => getMyPermissions(actor), "perms:" + actor), cant = cantAct(perms);
  const acts = { disabled: cant, title: cant ? NO_ACT_TITLE : undefined };
  const res = useAsync(async () => { const user = await getUser(userId); if (!user) throw new Error("No se encontró el usuario."); const cid = companyIdOf(user); return { user, bundle: cid ? await getCompanyBundle(cid) : null }; }, `detail:${userId}:${version}`);

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
  const { user, bundle: b } = res.data;
  if (!b) return <NoCompanyView user={user} actor={actor} onBack={onBack} refresh={refresh} dialog={dialog} setDialog={setDialog} acts={acts} />;
  const co = b.company, paused = co.status === "paused";
  const changeKapso = (appId) => {
    const apps = b.kapsoApps || [], to = apps.find((a) => a._id === appId), from = apps.find((a) => a._id === (user.kapso && user.kapso.kapsoAppId));
    const nm = (a) => (a ? [a.alias || "Sin nombre", a.displayPhoneNumber].filter(Boolean).join(" · ") : "otra conexión");
    ask({ title: "Cambiar la conexión de WhatsApp", label: "Cambiar conexión", danger: true, text: <>Vas a cambiar la conexión de WhatsApp (Kapso) que tiene asignada <b>{userFullName(user)}</b>: de <b>{nm(from)}</b> a <b>{nm(to)}</b>. Es un cambio en la base real de Spicytool. Queda registrado con tu nombre y la conexión anterior, y podés volver a cambiarla cuando quieras.</>, action: () => setUserKapsoApp(user._id, appId, actor) });
  };
  // Colaborador: pertenece a la company de otra persona (el owner). El plan y el cobro son del owner, no de este usuario.
  const collab = isCollaboratorOf(user, co._id), collabTitle = "Este usuario es colaborador: el plan y el cobro son del owner de la company, no suyos.";
  const billActs = collab ? { disabled: true, title: collabTitle } : acts;

  const tabs = [
    { key: "resumen", label: "Resumen" }, { key: "campanas", label: "Campañas", count: b.campaigns.length },
    { key: "landings", label: "Landings", count: b.landings.length }, { key: "conversiones", label: "Conversiones", count: b.conversions.length }, { key: "whatsapp", label: "WhatsApp" },
    { key: "pipelines", label: "Pipelines", count: b.pipelines.length }, { key: "forms", label: "Formularios y listas" }, { key: "workflows", label: "Workflows", count: b.workflows.length },
    { key: "creditos", label: "Créditos" }, { key: "auditoria", label: "Auditoría" },
  ];

  return (
    <div>
      <button className="btn-secondary" style={{ marginBottom: 14 }} onClick={onBack}>← Volver a usuarios</button>
      <div className="detail-head">
        <div>
          <div className="page-title">{userFullName(user)} <StatusBadge status={co.status} />{collab && <span className="badge badge-muted" style={{ marginLeft: 6 }}>Colaborador</span>}</div>
          <div className="page-sub">{user.email} · {co.name} · {collab ? "Colaborador (el plan es del owner de la company)" : `Plan: ${planLabel(planOf(user))}`}</div>
        </div>
        <div className="detail-actions">
          <ActGroup label="Editar">
            <button className="btn-secondary" {...acts} onClick={() => setDialog("company")}>Editar company</button>
            <button className="btn-secondary" {...acts} onClick={() => setDialog("contact")}>Editar contacto</button>
          </ActGroup>
          <ActGroup label="Plan y cobro">
            <button className="btn-charge" {...billActs} onClick={() => setDialog("plan")}>Asignar plan (cobra)</button>
            <button className="btn-secondary" {...billActs} onClick={() => setDialog("card")}>Link de tarjeta</button>
          </ActGroup>
          <ActGroup label="Cuenta">
            <button className="btn-access" disabled={!perms.data || !perms.data.support} title={perms.data && !perms.data.support ? (perms.data.disabledReason || "Tu usuario no tiene permiso de soporte. Pedile a un admin que te habilite.") : "Generar un link para entrar a la cuenta de este usuario"} onClick={() => setDialog("support")}>Entrar como usuario</button>
            {paused
              ? <button className="btn-primary" {...acts} onClick={() => ask({ title: "Activar company", label: "Activar", text: <>Vas a <b>activar</b> la company <b>{co.name}</b>. Sus usuarios vuelven a poder usar la cuenta.</>, action: () => setCompanyStatus(co._id, "active", actor) })}>Activar company</button>
              : <button className="btn-warn" {...acts} onClick={() => ask({ title: "Pausar company", label: "Pausar", danger: true, text: <>Vas a <b>pausar</b> la company <b>{co.name}</b>. Sus usuarios dejan de poder usar la cuenta hasta que la actives de nuevo. No cancela la suscripción ni los cobros.</>, action: () => setCompanyStatus(co._id, "paused", actor) })}>Pausar company</button>}
          </ActGroup>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "resumen" && <Summary b={b} user={user} />}
      {tab === "campanas" && <Card title="Campañas" sub={b.campaigns.length}><DataTable rows={b.campaigns} empty="Sin campañas." columns={[
        { key: "campaignName", label: "Campaña" }, { key: "campaignId", label: "ID de Google Ads", muted: true }, { key: "campaignStatus", label: "Estado", render: (c) => <span className={"badge " + (c.campaignStatus === "ENABLED" ? "badge-green" : "badge-muted")}>{c.campaignStatus}</span> },
        { key: "budgetPerDay", label: "Presupuesto/día", num: true }, { key: "investedPerDay", label: "Invertido/día", num: true }, { key: "accountId", label: "Account", muted: true },
      ID_COL]} /></Card>}
      {tab === "landings" && <Card title="Landings" sub={b.landings.length}><DataTable rows={b.landings} empty="Sin landings." columns={[
        { key: "name", label: "Nombre" }, { key: "description", label: "Descripción", muted: true }, { key: "status", label: "Estado", render: (l) => <span className={"badge " + (l.status === "published" ? "badge-green" : "badge-muted")}>{l.status || "—"}</span> },
        { key: "createdWithIA", label: "Creada con IA", render: (l) => yesNo(l.createdWithIA) },
      ID_COL]} /></Card>}
      {tab === "conversiones" && <Card title="Conversiones" sub={b.conversions.length}><DataTable rows={b.conversions} empty="Sin conversiones configuradas." columns={[
        { key: "condition", label: "Condición" }, { key: "conversionCategory", label: "Categoría", render: (c) => <span className="badge badge-blue">{c.conversionCategory}</span> },
      ID_COL]} /></Card>}
      {tab === "whatsapp" && (<>
        <KapsoAppsCard key={user.kapso && user.kapso.kapsoAppId} apps={b.kapsoApps || []} users={b.users} user={user} canChange={!cant} onChange={changeKapso} />
        <Card title="Conversaciones de WhatsApp" sub={b.whatsappConversions.length}><DataTable rows={b.whatsappConversions} empty="Sin conversiones de WhatsApp." columns={[
          { key: "date", label: "Fecha", render: (c) => fmtDate(c.date) }, { key: "behavior", label: "Comportamiento" }, { key: "checked", label: "Verificada", render: (c) => yesNo(c.checked) }, { key: "source", label: "Origen", muted: true }, { key: "trackId", label: "Track ID", muted: true },
        ID_COL]} /></Card>
        <Card title="Templates" sub={b.templates.length}><DataTable rows={b.templates} empty="Sin templates." columns={[
          { key: "name", label: "Nombre" }, { key: "category", label: "Categoría", render: (t) => <span className="badge badge-muted">{t.category}</span> }, { key: "header", label: "Encabezado", muted: true },
          { key: "message", label: "Mensaje" }, { key: "variables", label: "Variables", muted: true, render: (t) => (t.variables || []).join(", ") || "—" }, { key: "gupshup", label: "Gupshup", muted: true, render: (t) => t.gupshup?.status || "—" },
        ID_COL]} /></Card>
      </>)}
      {tab === "pipelines" && <PipelinesTab key={co._id} pipelines={b.pipelines} />}
      {tab === "forms" && (<>
        <Card title="Webforms" sub={b.webforms.length}><DataTable rows={b.webforms} empty="Sin webforms." columns={[{ key: "position", label: "#", num: true }, { key: "name", label: "Nombre" }, { key: "description", label: "Descripción", muted: true }, ID_COL]} /></Card>
        <Card title="Listas de contactos" sub={b.contactLists.length}><DataTable rows={b.contactLists} empty="Sin listas." columns={[{ key: "position", label: "#", num: true }, { key: "name", label: "Nombre" }, ID_COL]} /></Card>
      </>)}
      {tab === "workflows" && <Card title="Workflows" sub={b.workflows.length}><DataTable rows={b.workflows} empty="Sin workflows." columns={[
        { key: "name", label: "Nombre" }, { key: "description", label: "Descripción", muted: true }, { key: "triggerProperty", label: "Disparador", render: (w) => `${w.triggerProperty} = ${w.triggerValue}` },
        ID_COL,
      ]} /></Card>}
      {tab === "creditos" && <CreditsTab companyId={co._id} version={version} />}
      {tab === "auditoria" && <AuditTab companyId={co._id} version={version} />}

      {dialog === "company" && <EditCompanyDialog company={co} onClose={() => setDialog(null)} onSubmit={submitted((v) => updateCompany(co._id, v, actor))} />}
      {dialog === "contact" && <EditContactDialog user={user} onClose={() => setDialog(null)} onSubmit={submitted((v) => updateUserContact(user._id, v, actor))} />}
      {dialog === "plan" && <AssignPlanDialog user={user} onClose={() => setDialog(null)} onDone={refresh} onSubmit={(v) => assignPlan(user._id, v, actor)} />}
      {dialog === "support" && <SupportSessionDialog user={user} onClose={() => setDialog(null)} onDone={refresh} needsCredentials={adminMode() === "real"} onSubmit={(reason, creds) => createSupportLink(user._id, reason, actor, new Date(), creds)} />}
      {dialog === "card" && <CardLinkDialog user={user} onClose={() => { setDialog(null); refresh(); }} onSubmit={() => getPaymentMethodUrl(user._id, actor)} />}
      {confirm && <ConfirmDialog title={confirm.title} confirmLabel={confirm.label} danger={confirm.danger} busy={confirmBusy} error={confirmError} onConfirm={runConfirmed} onCancel={() => setConfirm(null)}>{confirm.text}</ConfirmDialog>}
    </div>
  );
}
