// Ficha 360 del cliente: todo lo que sabemos de una cuenta de Spicytool en un solo panel.
// Resumen (cuenta y WhatsApp, en vivo desde Spicytool), Seguimiento, Pagos (Métricas), Comercial (CRM y onboarding) y Tickets.
// El eje es el id de la cuenta de Spicytool. Lo que no se une solo (pagos, deals, tickets) se sugiere y una persona lo confirma una vez (client_links).
import { useEffect, useMemo, useState } from "react";
import { askConfirm } from "../confirmStore.js";
import { probeAdminApi, getCompanyBundle } from "../admin/adminApi.js";
import { useAsync } from "../admin/adminHooks.js";
import { planOf, planLabel, isOwner, userFullName, kapsoStatusInfo } from "../admin/adminLogic.js";
import { ToqueDialog } from "../seguimiento/SeguimientoApp.jsx";
import { semaforoInfo, proximoToque, estadoToque, fmtFecha, resultadoInfo, canalLabel, whatsappLink, diasDesde } from "../seguimiento/seguimientoLogic.js";
import { baDateISO } from "../timeTracking.js";
import { suggestRevCustomers, autoRevCustomers, suggestDeals, suggestTicketClients, refsOf, linkOf, dealIdsOfCompany, ticketsOfCompany, ticketsOpen, totalMrr, subStatusInfo, subLine, stageName } from "./cliente360Logic.js";

const RED = "#EF3E3E";
const rid = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const TONE = { green: ["#16A34A", "#EDFAF3"], amber: ["#B45309", "#FEF3C7"], red: ["#C42F2F", "#FEF0F0"], muted: ["#666", "#F4F4F5"] };
const Chip = ({ children, tone = "muted", title }) => <span title={title} style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5, color: TONE[tone][0], background: TONE[tone][1], whiteSpace: "nowrap" }}>{children}</span>;
const Err = ({ children }) => (children ? <div role="alert" style={{ fontSize: 12, color: "#C42F2F", background: "#FEF0F0", borderRadius: 6, padding: "6px 9px" }}>{children}</div> : null);
const Section = ({ title, sub, children }) => (
  <div style={{ border: "1px solid #EEE", borderRadius: 10, padding: "12px 14px" }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 8 }}>{title}{sub != null && <span style={{ fontWeight: 400, color: "#aaa", marginLeft: 8 }}>{sub}</span>}</div>
    {children}
  </div>
);
const Kv = ({ rows }) => (
  <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px 16px", margin: 0 }}>
    {rows.map(([k, v]) => <div key={k}><dt style={{ fontSize: 11, color: "#999" }}>{k}</dt><dd style={{ margin: 0, fontSize: 13, color: "#222", overflowWrap: "anywhere" }}>{v ?? "—"}</dd></div>)}
  </dl>
);
const Empty = ({ children }) => <div style={{ fontSize: 13, color: "#aaa", padding: "6px 0" }}>{children}</div>;
const SUGGEST_TITLE = { rev_customer: "Posibles pagos de este cliente", crm_deal: "Posibles deals del CRM de este cliente", ticket_client: "Posibles nombres de tickets de este cliente" };
const money = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-AR");

// Carga asíncrona atada a una clave (useAsync de Admin Spicy) con recarga manual y con la opción de no cargar hasta que haga falta.
function useLoad(fn, keyParts, enabled = true) {
  const [n, setN] = useState(0);
  const key = enabled ? [...keyParts, n].join("|") : "off";
  const r = useAsync(() => (enabled ? fn() : Promise.resolve(null)), key);
  return { loading: enabled && r.loading, data: r.data ?? null, error: r.error || "", reload: () => setN((x) => x + 1) };
}

// Sugerencias y vínculos confirmados de un tipo (pagos, deals o tickets): muestra lo vinculado, lo sugerido y permite confirmar o quitar.
function LinkBox({ kind, linked, suggestions, canWrite, busy, onLink, onUnlink, renderLinked, renderSuggestion, emptyText }) {
  return (
    <>
      {linked.length === 0 ? <Empty>{emptyText}</Empty> : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{linked.map((x) => (
        <div key={x.id || x.key || x.name} style={{ display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "space-between", background: "#F7F7F8", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>{renderLinked(x)}</div>
          {canWrite && x._linkable !== false && <button className="spicy-btn-secondary" disabled={busy} style={{ padding: "3px 9px", fontSize: 11 }} onClick={() => onUnlink(x)}>Desvincular</button>}
        </div>
      ))}</div>}
      {suggestions.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#92400E", marginBottom: 6 }}>{SUGGEST_TITLE[kind]} (confirmá cuáles son):</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{suggestions.map((s) => (
            <div key={s.ref} style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", border: "1px dashed #FCE4A0", background: "#FFFBEB", borderRadius: 8, padding: "7px 10px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>{renderSuggestion(s.item)}<div style={{ fontSize: 11, color: s.strong ? "#16A34A" : "#B45309" }}>{s.reason}</div></div>
              {canWrite ? <button className="spicy-btn-primary" disabled={busy} style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => onLink(s.ref)}>Vincular</button> : <span style={{ fontSize: 11, color: "#aaa" }}>Sin permiso</span>}
            </div>
          ))}</div>
        </div>
      )}
    </>
  );
}

export default function Cliente360({ sb, companyId, followup, onboarding, tickets, allUsers, me, canWrite, canSearchSpicy, canSeeMetrics, onClose, onRefresh, onGoSeguimiento, onGoOnboarding }) {
  const today = baDateISO();
  const [tab, setTab] = useState("resumen");
  const [toque, setToque] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const row = followup.find((r) => r.company_id === companyId) || null;

  useEffect(() => {
    const k = (e) => { if (e.key === "Escape" && !toque) onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, toque]);

  // Datos: vínculos, cuenta en vivo de Spicytool, últimos contactos; y por pestaña, pagos y CRM.
  const links = useLoad(async () => { const { data, error } = await sb.from("client_links").select("*"); if (error) throw error; return data || []; }, []);
  const bundle = useLoad(async () => { if ((await probeAdminApi()) !== "real") return null; return getCompanyBundle(companyId); }, [companyId], !!canSearchSpicy);
  const touches = useLoad(async () => { const { data } = await sb.from("client_touches").select("*").eq("company_id", companyId).order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(8); return data || []; }, ["touches", companyId, row && row.ultimo_toque, row && row.sin_respuesta]);
  const rev = useLoad(async () => {
    const { data: customers } = await sb.from("rev_customers").select("key,name,email,mrr,segment,ever_paid,first_paid_at");
    return customers || [];
  }, [], tab === "pagos" && !!canSeeMetrics);
  const crm = useLoad(async () => {
    const [{ data: deals, error }, { data: cfg }] = await Promise.all([sb.from("crm_deals").select("id,data"), sb.from("crm_config").select("data").eq("id", 1).maybeSingle()]);
    if (error) throw error;
    return { deals: deals || [], stages: (cfg && cfg.data && cfg.data.stages) || [] };
  }, [], tab === "comercial");

  const L = useMemo(() => links.data || [], [links.data]);
  const company = bundle.data && bundle.data.company;
  const spicyUsers = (bundle.data && bundle.data.users) || [];
  const owner = company ? spicyUsers.find((u) => isOwner(u, company)) : null;
  const name = (row && row.company_name) || (company && company.name) || (onboarding.find((o) => o.spicy_company_id === companyId) || {}).spicy_company_name || "Cuenta de Spicytool";
  const plan = (owner && planOf(owner)) || (row && row.plan) || null;
  // "Fila" para sugerir vínculos: lo que sabemos del contacto, venga de la cartera o de Spicytool.
  const ctx = { company_name: name, contact_name: (row && row.contact_name) || (owner && userFullName(owner)) || "", contact_email: (row && row.contact_email) || (company && company.userEmail) || "", contact_phone: (row && row.contact_phone) || (company && company.phoneNumber) || "" };
  const ownerEmails = [owner && owner.email, company && company.userEmail].filter(Boolean);
  const ownerPhones = [owner && owner.phoneNumber, company && company.phoneNumber].filter(Boolean);

  const myOnb = onboarding.filter((o) => o.spicy_company_id === companyId);
  const myTickets = useMemo(() => ticketsOfCompany(tickets, L, companyId), [tickets, L, companyId]);
  const openTickets = ticketsOpen(myTickets);
  // Pagos: los que se unen solos por el cliente de Stripe de la cuenta (necesita los datos de Spicytool) + los vinculados a mano.
  const autoRev = autoRevCustomers(spicyUsers, companyId, rev.data);
  const autoKeys = autoRev.map((x) => x.customer.key);
  const manualRev = (rev.data || []).filter((c) => refsOf(L, companyId, "rev_customer").includes(c.key) && !autoKeys.includes(c.key));
  const linkedCustomers = [...autoRev.map((x) => ({ ...x.customer, _auto: true, _via: x.via, _linkable: false })), ...manualRev];
  const subs = useLoad(async () => {
    if (!linkedCustomers.length) return [];
    const { data } = await sb.from("rev_subscriptions").select("id,customer_key,status,currency,items,canceled_at").in("customer_key", linkedCustomers.map((c) => c.key));
    return data || [];
  }, [linkedCustomers.map((c) => c.key).join("|")], tab === "pagos" && !!canSeeMetrics && rev.data !== null);
  const dealIds = dealIdsOfCompany(L, onboarding, companyId);
  const linkedDeals = ((crm.data && crm.data.deals) || []).filter((d) => dealIds.includes(d.id));

  const link = async (kind, ref) => {
    setBusy(true); setMsg("");
    const { error } = await sb.from("client_links").insert({ id: rid("lk"), company_id: companyId, kind, ref, created_by: me.id });
    setBusy(false);
    if (error) { setMsg(error.code === "23505" ? "Eso ya está vinculado a otra cuenta." : "No se pudo vincular: " + error.message); return; }
    links.reload();
  };
  const unlink = async (kind, ref, label) => {
    if (!(await askConfirm({ title: "Desvincular", message: `Se va a desvincular "${label}" de ${name}. No se borra nada del otro lado: solo deja de mostrarse acá.`, confirmLabel: "Desvincular", danger: false }))) return;
    const l = linkOf(L, companyId, kind, ref);
    if (!l) return;
    setBusy(true); setMsg("");
    const { data, error } = await sb.from("client_links").delete().eq("id", l.id).select("id");
    setBusy(false);
    if (error || !data || !data.length) { setMsg("No se pudo desvincular" + (error ? ": " + error.message : ": tu usuario no tiene permiso")); return; }
    links.reload();
  };

  const sem = row ? semaforoInfo(row.semaforo) : null;
  const prox = row ? proximoToque(row) : null, est = row ? estadoToque(row, today) : null;
  const wa = whatsappLink((row && row.contact_phone) || (company && company.phoneNumber));
  const tabs = [["resumen", "Resumen"], ["seguimiento", "Seguimiento"], ["pagos", "Pagos"], ["comercial", "Comercial"], ["tickets", `Tickets${openTickets.length ? ` · ${openTickets.length}` : ""}`]];
  const tile = (label, value, sub) => <div style={{ flex: "1 1 130px", background: "#F7F7F8", borderRadius: 10, padding: "10px 12px" }}><div style={{ fontSize: 11, color: "#999" }}>{label}</div><div style={{ fontSize: 16, fontWeight: 700, color: "#111", marginTop: 2 }}>{value}</div>{sub && <div style={{ fontSize: 11, color: "#aaa" }}>{sub}</div>}</div>;
  const mrrLinked = totalMrr(linkedCustomers);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 190, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Ficha de ${name}`} style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 920, maxHeight: "92vh", overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#111", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {sem && <span title={`Semáforo ${sem.label.toLowerCase()}`} style={{ width: 12, height: 12, borderRadius: "50%", background: sem.color, display: "inline-block" }} />}{name}
              {company && <Chip tone={company.status === "paused" ? "red" : "green"}>{company.status === "paused" ? "Pausada" : "Activa"}</Chip>}
              {plan && <Chip>{planLabel(plan)}</Chip>}
            </div>
            <div style={{ fontSize: 12, color: "#999", marginTop: 3 }}>Ficha 360 · todo lo que sabemos de este cliente{row && row.baja_en ? " · de baja de la cartera" : ""}</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: "#ccc", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", borderBottom: "1px solid #EEE" }}>
          {tabs.map(([k, label]) => <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} style={{ padding: "7px 14px", border: "none", borderBottom: `2px solid ${tab === k ? RED : "transparent"}`, background: "none", fontSize: 13, fontWeight: 600, color: tab === k ? RED : "#888", cursor: "pointer" }}>{label}</button>)}
        </div>
        <Err>{msg}</Err>

        {tab === "resumen" && (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {tile("Último contacto", row && row.ultimo_toque ? (diasDesde(row.ultimo_toque, today) === 0 ? "Hoy" : `Hace ${diasDesde(row.ultimo_toque, today)} d`) : "Sin contactos", row && row.sin_respuesta >= 1 ? `${row.sin_respuesta} sin respuesta` : null)}
              {tile("Próximo contacto", est === "baja" ? "De baja" : prox ? fmtFecha(prox) : "—", est === "vencido" ? "Atrasado" : null)}
              {tile("Tickets abiertos", openTickets.length, `${myTickets.length} en total`)}
              {tile("Pagos vinculados (MRR)", linkedCustomers.length ? money(mrrLinked) : "—", rev.data ? `${linkedCustomers.length} cliente${linkedCustomers.length === 1 ? "" : "s"}` : "ver pestaña Pagos")}
              {tile("Onboarding", myOnb[0] ? myOnb[0].etapa_actual : "—", myOnb[0] ? myOnb[0].estado_de_pago : "sin vincular")}
            </div>
            <Section title="Cuenta de Spicytool">
              {!canSearchSpicy ? <Empty>Para ver los datos de la cuenta hace falta el permiso de Admin Spicy.</Empty>
                : bundle.loading ? <Empty>Leyendo Spicytool…</Empty>
                : !company ? <Empty>{bundle.error ? "No se pudo leer la cuenta: " + bundle.error : "El buscador de cuentas de Spicytool no está conectado en este momento."}</Empty>
                : <Kv rows={[["Estado", company.status === "paused" ? "Pausada" : "Activa"], ["Plan", planLabel(plan)], ["Créditos", company.credits == null ? "—" : `${Number(company.credits).toLocaleString("es-AR")} ${company.currency || ""}`], ["Vertical", company.vertical], ["Equipo", company.teamSize], ["Alta", company.creationDate ? fmtFecha(String(company.creationDate).slice(0, 10)) : "—"], ["Onboarding terminado", company.onboardingEnded ? "Sí" : "No"], ["Conversaciones de WhatsApp activas", company.activeWhatsAppConversations],
                  ["Dueño", owner ? userFullName(owner) : company.userEmail], ["Email del dueño", company.userEmail], ["Teléfono del dueño", company.phoneNumber ? (whatsappLink(company.phoneNumber) ? <a href={whatsappLink(company.phoneNumber)} target="_blank" rel="noopener noreferrer" style={{ color: "#16A34A", fontWeight: 600, textDecoration: "none" }}>💬 {company.phoneNumber}</a> : company.phoneNumber) : "—"], ["Usuarios en la cuenta", spicyUsers.length]]} />}
            </Section>
            {bundle.data && (
              <Section title="Conexiones de WhatsApp (Kapso)" sub={(bundle.data.kapsoApps || []).length}>
                {(bundle.data.kapsoApps || []).length === 0 ? <Empty>No tiene conexiones por Kapso.</Empty> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{bundle.data.kapsoApps.map((a) => { const i = kapsoStatusInfo(a.status); return <div key={a._id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}><Chip tone={i.tone}>{i.label}</Chip><b>{a.alias || "Sin nombre"}</b>{a.isDefault && <Chip tone="muted">Principal</Chip>}<span style={{ color: "#666" }}>{a.displayPhoneNumber || "sin número"}</span></div>; })}</div>
                )}
              </Section>
            )}
          </>
        )}

        {tab === "seguimiento" && (
          <>
            {!row ? <Section title="Seguimiento"><Empty>Este cliente todavía no está en la cartera de Seguimiento.</Empty>{onGoSeguimiento && <button className="spicy-btn-secondary" onClick={onGoSeguimiento}>Ir a Seguimiento →</button>}</Section> : (
              <>
                <Section title="Cómo viene la relación">
                  <Kv rows={[["Semáforo", <span key="s" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: sem.color, display: "inline-block" }} />{sem.label}{row.semaforo_motivo ? ` · ${row.semaforo_motivo}` : ""}</span>], ["Responsable", (allUsers.find((u) => u.user_id === row.responsable_id) || {}).first_name || "Sin asignar"], ["Frecuencia", row.frecuencia_dias ? `Cada ${row.frecuencia_dias} días` : "Sin rutina"], ["Próximo contacto", prox ? fmtFecha(prox) : "—"],
                    ["Dueño de la cuenta", row.contact_name], ["Teléfono", row.contact_phone ? (wa ? <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color: "#16A34A", fontWeight: 600, textDecoration: "none" }}>💬 {row.contact_phone}</a> : row.contact_phone) : "—"], ["Email", row.contact_email], ["Intentos seguidos sin respuesta", row.sin_respuesta]]} />
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {canWrite && !row.baja_en && <button className="spicy-btn-primary" onClick={() => setToque(true)}>+ Registrar contacto</button>}
                    {onGoSeguimiento && <button className="spicy-btn-secondary" onClick={onGoSeguimiento}>Ir a la lista de Seguimiento →</button>}
                  </div>
                </Section>
                <Section title="Últimos contactos" sub={touches.data ? touches.data.length : ""}>
                  {touches.loading ? <Empty>Cargando…</Empty> : (touches.data || []).length === 0 ? <Empty>Todavía no se registró ningún contacto.</Empty> : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{touches.data.map((t) => { const r = resultadoInfo(t.resultado); return (
                      <div key={t.id} style={{ background: "#F7F7F8", borderRadius: 8, padding: "7px 10px" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}><b>{fmtFecha(t.fecha)}</b><span style={{ color: "#666" }}>{canalLabel(t.canal)}</span><span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5, color: r.color, background: r.bg }}>{r.short}</span><span style={{ color: "#aaa", marginLeft: "auto" }}>{String(t.author_email).split("@")[0]}</span></div>
                        {t.nota && <div style={{ fontSize: 13, color: "#333", marginTop: 4, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{t.nota}</div>}
                      </div>); })}</div>
                  )}
                </Section>
              </>
            )}
          </>
        )}

        {tab === "pagos" && (
          <Section title="Pagos y suscripción (Métricas)" sub={linkedCustomers.length ? `MRR ${money(mrrLinked)}` : ""}>
            {!canSeeMetrics ? <Empty>Para ver los pagos hace falta el permiso de la sección Métricas.</Empty> : rev.loading ? <Empty>Cargando…</Empty> : (
              <LinkBox kind="rev_customer" busy={busy} canWrite={canWrite}
                linked={linkedCustomers.map((c) => ({ ...c, id: c.key }))}
                suggestions={suggestRevCustomers(ctx, rev.data || [], L, ownerEmails).filter((s) => !autoKeys.includes(s.item.key)).map((s) => ({ ...s, ref: s.item.key }))}
                emptyText="Todavía no hay pagos vinculados a este cliente."
                onLink={(ref) => link("rev_customer", ref)} onUnlink={(c) => unlink("rev_customer", c.key, c.name || c.email)}
                renderLinked={(c) => (
                  <>
                    <div style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}><b>{c.name || c.email}</b> <span style={{ color: "#888" }}>· {c.email}</span>{c._auto && <Chip tone="green" title={`Es el mismo cliente de Stripe que usa esta cuenta de Spicytool${c._via ? " (usuario " + c._via + ")" : ""}`}>Automático</Chip>}</div>
                    <div style={{ fontSize: 12, color: "#555", margin: "3px 0" }}>MRR {money(c.mrr)}{c.segment ? ` · ${c.segment}` : ""}{c.first_paid_at ? ` · primer pago ${fmtFecha(String(c.first_paid_at).slice(0, 10))}` : ""}</div>
                    {(subs.data || []).filter((s) => s.customer_key === c.key).map((s) => { const i = subStatusInfo(s.status); return <div key={s.id} style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}><Chip tone={i.tone}>{i.label}</Chip><span>{subLine(s)}</span></div>; })}
                  </>
                )}
                renderSuggestion={(c) => <div style={{ fontSize: 13 }}><b>{c.name || c.email}</b> <span style={{ color: "#888" }}>· {c.email} · MRR {money(c.mrr)}</span></div>} />
            )}
          </Section>
        )}

        {tab === "comercial" && (
          <>
            <Section title="Onboarding" sub={myOnb.length}>
              {myOnb.length === 0 ? <Empty>No hay un onboarding vinculado a esta cuenta. Se vincula desde la ficha del onboarding (“Buscar y vincular la cuenta”).</Empty> : myOnb.map((o) => (
                <div key={o.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13, background: "#F7F7F8", borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
                  <b>{o.client_name}</b><Chip tone="muted">{o.etapa_actual}</Chip><Chip tone={o.estado_de_pago === "Cobrado" ? "green" : "amber"}>{o.estado_de_pago}</Chip>{o.bloqueado && <Chip tone="red">🔒 Bloqueado</Chip>}<span style={{ color: "#888" }}>{o.responsable || "Sin asignar"} · registrado {fmtFecha(o.fecha_registro)}</span>
                  {onGoOnboarding && <button className="spicy-btn-secondary" style={{ marginLeft: "auto", padding: "3px 9px", fontSize: 11 }} onClick={onGoOnboarding}>Ver onboarding →</button>}
                </div>
              ))}
            </Section>
            <Section title="Deal del CRM" sub={linkedDeals.length}>
              {crm.loading ? <Empty>Cargando…</Empty> : crm.error ? <Empty>No se pudo leer el CRM: {crm.error}</Empty> : (
                <LinkBox kind="crm_deal" busy={busy} canWrite={canWrite}
                  linked={linkedDeals.map((d) => ({ ...d, _linkable: refsOf(L, companyId, "crm_deal").includes(d.id) }))}
                  suggestions={suggestDeals(ctx, (crm.data && crm.data.deals) || [], L, ownerPhones).filter((s) => !dealIds.includes(s.item.id)).map((s) => ({ ...s, ref: s.item.id }))}
                  emptyText="Todavía no hay un deal del CRM vinculado a este cliente."
                  onLink={(ref) => link("crm_deal", ref)} onUnlink={(d) => unlink("crm_deal", d.id, d.data.empresa)}
                  renderLinked={(d) => { const x = d.data || {}; return (<><div style={{ fontSize: 13 }}><b>{x.empresa}</b> <span style={{ color: "#888" }}>· {x.contacto}</span></div><div style={{ fontSize: 12, color: "#555" }}>{stageName(crm.data.stages, x.stage)}{x.estado ? ` · ${x.estado}` : ""}{x.mrr ? ` · MRR ${money(x.mrr)}` : ""}{x.vendedor ? ` · vendedor ${x.vendedor}` : ""}{x.cerradoEn ? ` · cerrado ${fmtFecha(x.cerradoEn)}` : ""}{!d._linkable ? " · viene del onboarding" : ""}</div></>); }}
                  renderSuggestion={(d) => { const x = d.data || {}; return <div style={{ fontSize: 13 }}><b>{x.empresa}</b> <span style={{ color: "#888" }}>· {x.contacto} · {stageName(crm.data.stages, x.stage)}</span></div>; }} />
              )}
            </Section>
          </>
        )}

        {tab === "tickets" && (
          <Section title="Tickets de este cliente" sub={`${openTickets.length} abiertos · ${myTickets.length} en total`}>
            <LinkBox kind="ticket_client" busy={busy} canWrite={canWrite}
              linked={myTickets.length === 0 ? [] : [...new Set(refsOf(L, companyId, "ticket_client"))].map((n) => ({ name: n, id: n }))}
              suggestions={suggestTicketClients(ctx, tickets, L).map((s) => ({ ...s, ref: s.item.name }))}
              emptyText="Todavía no hay tickets vinculados. Los tickets se escriben con el nombre del cliente a mano: vinculá los nombres que corresponden."
              onLink={(ref) => link("ticket_client", ref)} onUnlink={(x) => unlink("ticket_client", x.name, x.name)}
              renderLinked={(x) => <span style={{ fontSize: 13 }}>Nombre en los tickets: <b>{x.name}</b></span>}
              renderSuggestion={(x) => <div style={{ fontSize: 13 }}>Tickets a nombre de <b>{x.name}</b> <span style={{ color: "#888" }}>· {x.count} ticket{x.count === 1 ? "" : "s"}</span></div>} />
            {myTickets.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>{myTickets.slice(0, 15).map((t) => (
                <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13, borderBottom: "1px solid #F3F3F3", padding: "6px 0" }}>
                  <Chip tone={ticketsOpen([t]).length ? "amber" : "green"}>{t.status}</Chip><b style={{ overflowWrap: "anywhere" }}>{t.title || String(t.message || "").slice(0, 70) || "Sin título"}</b><span style={{ color: "#999" }}>{t.category}{t.priority ? ` · ${t.priority}` : ""} · {fmtFecha(String(t.created_at).slice(0, 10))}</span>
                </div>))}
                {myTickets.length > 15 && <Empty>… y {myTickets.length - 15} más.</Empty>}
              </div>
            )}
          </Section>
        )}
      </div>
      {toque && row && <ToqueDialog sb={sb} row={row} today={today} me={me} onClose={() => setToque(false)} onSaved={() => { setToque(false); onRefresh(); }} />}
    </div>
  );
}
