// "Enviar al CRM" para usuarios Freemium: botón + formulario (etapa del pipeline, vendedor, primer paso y nota).
// Crea el deal en el CRM comercial (ver crmSend.js). Se usa en la lista de usuarios y en el detalle del usuario.
import { useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "../revenue/revenueUi.jsx";
import { useAsync } from "./adminHooks.js";
import { userFullName } from "./adminLogic.js";
import { loadCrmContext, insertDeal, openStages, findExistingDeals, defaultSendForm, buildFreemiumDeal } from "./crmSend.js";
import { baDateISO } from "../timeTracking.js";

const Field = ({ label, children }) => <div className="field"><label className="field-label">{label}</label>{children}</div>;
const stageName = (config, id) => ((config.stages || []).find((s) => s.id === id) || {}).name || id || "—";

function Form({ ctx, user, companyName, actor, onSent, onClose }) {
  const { config, deals } = ctx;
  const [f, setF] = useState(() => defaultSendForm(config, baDateISO(new Date())));
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [sure, setSure] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const stages = openStages(config), existing = findExistingDeals(deals, user, companyName);
  const strong = existing.find((x) => x.strong), weak = existing.filter((x) => !x.strong);

  if (!config) return <div className="err" role="alert">El CRM todavía no está configurado: abrí la sección CRM una vez para crearlo.</div>;
  if (strong) {
    return (
      <>
        <div className="notice" role="status">
          <b>{userFullName(user)}</b> ya está en el CRM: <b>{strong.deal.empresa}</b> · etapa <b>{stageName(config, strong.deal.stage)}</b> ({strong.reason.toLowerCase()}). No se crea otro deal para no duplicarlo.
        </div>
        <div style={{ textAlign: "right", marginTop: 12 }}><button className="btn-secondary" onClick={onClose}>Cerrar</button></div>
      </>
    );
  }
  async function send() {
    setError("");
    const r = buildFreemiumDeal(config, user, { companyName, form: f, actor });
    if (r.error) { setError(r.error); return; }
    setBusy(true);
    try { await insertDeal(ctx.sb, r.deal); onSent(r.deal, stageName(config, r.deal.stage)); onClose(); } catch (e) { setError(e.message || String(e)); setBusy(false); }
  }
  const needSure = weak.length > 0 && !sure;
  return (
    <>
      <div style={{ fontSize: 13, marginBottom: 12 }}>
        Se crea un deal en el CRM comercial con los datos de <b>{userFullName(user)}</b>{user.email ? <> ({user.email})</> : null}{companyName && companyName !== "—" ? <> · {companyName}</> : null}, para que Comercial lo convierta a plan pago.
      </div>
      {weak.length > 0 && (
        <div className="notice" style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FCE4A0", marginBottom: 12 }} role="status">
          Ya hay un deal con el mismo nombre de empresa: <b>{weak[0].deal.empresa}</b> (etapa {stageName(config, weak[0].deal.stage)}). Puede ser otra persona de esa empresa.
          <label style={{ display: "block", marginTop: 6 }}><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} /> Crear un deal nuevo igual</label>
        </div>
      )}
      <div className="grid2">
        <Field label="Etapa del pipeline">
          <select className="inp" value={f.stage} onChange={set("stage")} aria-label="Etapa del pipeline">
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Vendedor">
          <select className="inp" value={f.vendedor} onChange={set("vendedor")} aria-label="Vendedor">
            {(config.sellers || []).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid2">
        <Field label="Primer paso">
          <select className="inp" value={f.proxima} onChange={set("proxima")} aria-label="Primer paso">
            <option value="">Sin primer paso</option>
            {(config.acciones || []).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Para el día">
          <input className="inp" type="date" value={f.proximaFecha} disabled={!f.proxima} onChange={set("proximaFecha")} aria-label="Fecha del primer paso" />
        </Field>
      </div>
      <Field label="Nota para Comercial (opcional)">
        <textarea className="inp" rows={3} value={f.nota} onChange={set("nota")} placeholder="Qué usa, qué le interesa, por qué conviene contactarlo…" />
      </Field>
      {error && <div className="err" role="alert">{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <button className="btn-secondary" disabled={busy} onClick={onClose}>Cancelar</button>
        <button className="btn-primary" disabled={busy || needSure || !f.stage} onClick={send}>{busy ? "Enviando…" : "Enviar al CRM"}</button>
      </div>
    </>
  );
}

export function SendToCrmDialog({ sb, user, companyName, actor, onSent, onClose }) {
  const ctx = useAsync(() => loadCrmContext(sb), "crmctx:" + user._id);
  return (
    <Modal title="Enviar al CRM comercial" onClose={onClose}>
      {ctx.loading ? <div className="empty">Cargando el CRM…</div> : ctx.error ? <><div className="err" role="alert">{ctx.error}</div><div style={{ textAlign: "right", marginTop: 12 }}><button className="btn-secondary" onClick={onClose}>Cerrar</button></div></>
        : <Form ctx={{ ...ctx.data, sb }} user={user} companyName={companyName} actor={actor} onSent={onSent} onClose={onClose} />}
    </Modal>
  );
}

// Botón (o la marca "En el CRM" si ya se envió) con su diálogo. `sent` = deal ya enviado para este usuario (si se sabe).
export default function SendToCrmButton({ sb, user, companyName, actor, sent = null, stageLabel = "", onSent, className = "btn-sm" }) {
  const [open, setOpen] = useState(false);
  if (sent) return <span className="badge badge-green" title={`Ya está en el CRM: ${sent.empresa}`}>En el CRM{stageLabel ? " · " + stageLabel : ""}</span>;
  return (
    <>
      <button type="button" className={className} style={{ whiteSpace: "nowrap" }} onClick={(e) => { e.stopPropagation(); setOpen(true); }} title="Crear un deal en el CRM comercial para convertirlo a plan pago">Enviar al CRM</button>
      {open && createPortal(<div onClick={(e) => e.stopPropagation()}><SendToCrmDialog sb={sb} user={user} companyName={companyName} actor={actor} onSent={(deal, stage) => onSent && onSent(deal, stage)} onClose={() => setOpen(false)} /></div>, document.querySelector(".rv") || document.body)}
    </>
  );
}
