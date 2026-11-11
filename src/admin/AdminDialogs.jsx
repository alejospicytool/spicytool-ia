// Formularios de edición de "Admin Spicy": company, ficha de contacto y cambio de plan.
// Validan con adminLogic.js antes de enviar; el error del "servidor" se muestra dentro del diálogo.
import { useRef, useState } from "react";
import { Modal } from "../revenue/revenueUi.jsx";
import { validateCompanyEdit, validateContactEdit, validatePlanAssignment, PAID_PLANS, planOf, planLabel, newIdempotencyKey, formatPrice, explainWebhookError } from "./adminLogic.js";
import { useAsync } from "./adminHooks.js";
import { listPrices } from "./adminApi.js";

function useSubmit(validate, onSubmit, onClose) {
  const [errors, setErrors] = useState({}), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(form) {
    const v = validate(form);
    if (!v.ok) { setErrors(v.errors); return; }
    setErrors({}); setBusy(true); setError("");
    try { await onSubmit(v.value); onClose(); } catch (e) { setError(e.message || String(e)); setBusy(false); }
  }
  return { errors, busy, error, submit };
}

const Field = ({ label, error, children }) => <div className="field"><label className="field-label">{label}</label>{children}{error && <div className="err" role="alert">{error}</div>}</div>;

export function EditCompanyDialog({ company, onSubmit, onClose }) {
  const [f, setF] = useState({ name: company.name || "", phoneNumber: company.phoneNumber || "", credits: String(company.credits ?? 0) });
  const { errors, busy, error, submit } = useSubmit(validateCompanyEdit, onSubmit, onClose);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Editar company" onClose={onClose} footer={<><button className="btn-secondary" disabled={busy} onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy} onClick={() => submit(f)}>{busy ? "Guardando…" : "Guardar"}</button></>}>
      <Field label="Nombre de la company" error={errors.name}><input className="inp" value={f.name} onChange={set("name")} /></Field>
      <div className="grid2">
        <Field label="Teléfono" error={errors.phoneNumber}><input className="inp" value={f.phoneNumber} onChange={set("phoneNumber")} /></Field>
        <Field label="Créditos" error={errors.credits}><input className="inp" inputMode="decimal" value={f.credits} onChange={set("credits")} /></Field>
      </div>
      {error && <div className="err" role="alert">{error}</div>}
    </Modal>
  );
}

export function EditContactDialog({ user, onSubmit, onClose }) {
  const [f, setF] = useState({ name: user.name || "", surname: user.surname || "", email: user.email || "", phoneNumber: user.phoneNumber || "" });
  const { errors, busy, error, submit } = useSubmit(validateContactEdit, onSubmit, onClose);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Editar ficha de contacto" onClose={onClose} footer={<><button className="btn-secondary" disabled={busy} onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy} onClick={() => submit(f)}>{busy ? "Guardando…" : "Guardar"}</button></>}>
      <div className="grid2">
        <Field label="Nombre" error={errors.name}><input className="inp" value={f.name} onChange={set("name")} /></Field>
        <Field label="Apellido" error={errors.surname}><input className="inp" value={f.surname} onChange={set("surname")} /></Field>
      </div>
      <Field label="Email" error={errors.email}><input className="inp" type="email" value={f.email} onChange={set("email")} /></Field>
      <Field label="Teléfono" error={errors.phoneNumber}><input className="inp" value={f.phoneNumber} onChange={set("phoneNumber")} /></Field>
      {error && <div className="err" role="alert">{error}</div>}
    </Modal>
  );
}

// Copia al portapapeles; si el navegador no deja, avisa para que se copie a mano.
function CopyButton({ text }) {
  const [state, setState] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(text); setState("ok"); } catch { setState("fail"); }
  }
  return <button className="btn-sm" onClick={copy}>{state === "ok" ? "¡Copiado!" : state === "fail" ? "Copialo a mano" : "Copiar"}</button>;
}

const LinkBox = ({ url }) => (
  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
    <input className="inp" readOnly aria-label="Link para cambiar la tarjeta" value={url} onFocus={(e) => e.target.select()} />
    <CopyButton text={url} />
  </div>
);

// Asignar o cambiar plan: el webhook COBRA la tarjeta al instante. Tres pasos: formulario → confirmación → resultado.
export function AssignPlanDialog({ user, onSubmit, onClose, onDone }) {
  const prices = useAsync(() => listPrices(), "prices");
  const current = planOf(user);
  const [step, setStep] = useState("form"), [plan, setPlan] = useState(PAID_PLANS.includes(current) ? current : "SpicyStart"), [priceId, setPriceId] = useState(""), [custom, setCustom] = useState(false), [manualPrice, setManualPrice] = useState("");
  const [ack, setAck] = useState(false), [busy, setBusy] = useState(false), [errors, setErrors] = useState({}), [result, setResult] = useState(null);
  const keys = useRef({}); // una clave por combinación plan+precio: reintentar la MISMA operación no cobra dos veces
  const list = prices.data || [];
  const forPlan = list.filter((p) => p.plan === plan);
  const effectivePrice = custom ? manualPrice.trim() : (priceId || (forPlan[0] && forPlan[0].id) || "");
  const known = list.find((p) => p.id === effectivePrice);

  const finish = () => { if (result) onDone(); onClose(); }; // tras un intento (cobrado o no) se refresca el detalle y la auditoría
  function toConfirm() {
    const v = validatePlanAssignment({ email: user.email, plan, stripePriceId: effectivePrice });
    const errs = { ...v.errors };
    // el webhook lo rechazaría igual (YA_SUSCRIPTO): se avisa antes de llegar a la confirmación
    if (v.ok && user.subscription && user.subscription.priceId === v.value.stripePriceId) errs.stripePriceId = "El cliente ya tiene este precio. Elegí otro (otro plan, u otro precio del mismo plan).";
    setErrors(errs);
    if (Object.keys(errs).length === 0) { setAck(false); setStep("confirm"); }
  }
  async function charge() {
    const sig = plan + "|" + effectivePrice;
    if (!keys.current[sig]) keys.current[sig] = newIdempotencyKey();
    setBusy(true);
    try { setResult({ ok: true, data: await onSubmit({ plan, stripePriceId: effectivePrice, idempotencyKey: keys.current[sig] }) }); }
    catch (e) { setResult({ ok: false, code: e.code || "ERROR", message: e.message, extra: e.extra || {} }); }
    setBusy(false); setStep("result");
  }

  let body, footer;
  if (step === "form") {
    body = (<>
      <div className="confirm-text" style={{ marginBottom: 14 }}>Cliente: <b>{user.email}</b> · Plan actual: <b>{planLabel(current)}</b></div>
      <div className="field"><label className="field-label">Plan nuevo</label>
        <select className="inp" aria-label="Plan nuevo" value={plan} onChange={(e) => { setPlan(e.target.value); setPriceId(""); setCustom(false); }}>{PAID_PLANS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
        {errors.plan && <div className="err" role="alert">{errors.plan}</div>}
      </div>
      <div className="field"><label className="field-label">Precio de Stripe (decide el monto que se cobra)</label>
        <select className="inp" aria-label="Precio de Stripe" disabled={prices.loading} value={custom ? "__otro" : effectivePrice} onChange={(e) => { if (e.target.value === "__otro") setCustom(true); else { setCustom(false); setPriceId(e.target.value); } }}>
          {forPlan.map((p) => <option key={p.id} value={p.id}>{formatPrice(p.amount, p.currency)}/mes · {p.nickname}</option>)}
          <option value="__otro">Otro precio (pegar el id de Stripe)…</option>
        </select>
        {custom && <input className="inp" style={{ marginTop: 8 }} aria-label="Id del precio" placeholder="price_…" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} />}
        {errors.stripePriceId && <div className="err" role="alert">{errors.stripePriceId}</div>}
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>El mismo plan se puede vender a distintos precios (estándar, negociado, promoción).</div>
      </div>
    </>);
    footer = <><button className="btn-secondary" onClick={finish}>Cancelar</button><button className="btn-primary" disabled={prices.loading} onClick={toConfirm}>Continuar</button></>;
  } else if (step === "confirm") {
    body = (<>
      <dl className="kv" style={{ marginBottom: 14 }}>
        <div><dt>Cliente</dt><dd>{user.email}</dd></div><div><dt>Plan</dt><dd>{planLabel(current)} → <b>{plan}</b></dd></div>
        <div><dt>Precio</dt><dd>{known ? <><b>{formatPrice(known.amount, known.currency)}/mes</b> · {known.nickname}</> : "Monto según Stripe"}<div style={{ fontSize: 11, color: "var(--muted)" }}>{effectivePrice}</div></dd></div>
      </dl>
      <div className="alert" style={{ background: "#FEF0F0", color: "#C42F2F", border: "1px solid #F8CACA" }}>Se cobra <b>ahora</b> a la tarjeta que el cliente ya tiene guardada en Stripe. Esto no se puede deshacer desde el backoffice.</div>
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, marginTop: 10 }}><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />Entiendo que se le cobra al cliente en este momento.</label>
    </>);
    footer = <><button className="btn-secondary" disabled={busy} onClick={() => setStep("form")}>Volver</button><button className="btn-primary" disabled={!ack || busy} onClick={charge}>{busy ? "Cobrando…" : "Cobrar y asignar plan"}</button></>;
  } else if (result.ok) {
    const d = result.data, warn = !d.oldSubscriptionCancelled || (d.billingFailures || []).length > 0;
    body = (<>
      <div className="alert" style={{ background: "#EDFAF3", color: "#15803D", border: "1px solid #BFE8D0" }}>Listo: se cobró y <b>{d.userEmail}</b> pasó de {planLabel(d.previousPlan)} a <b>{d.plan}</b>.</div>
      <dl className="kv"><div><dt>Suscripción nueva</dt><dd>{d.stripeSubscriptionId}</dd></div><div><dt>Precio</dt><dd>{d.stripePriceId}</dd></div></dl>
      {!d.oldSubscriptionCancelled && <div className="alert" style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FCE4A0", marginTop: 12 }}>La suscripción anterior <b>no se pudo cancelar</b>: cancelala a mano en Stripe.</div>}
      {(d.billingFailures || []).length > 0 && <div className="alert" style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FCE4A0", marginTop: 12 }}>No se pudieron actualizar los créditos de {d.billingFailures.length} company(s).</div>}
      {!warn && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 12 }}>El equipo recibe el aviso en Discord automáticamente.</div>}
    </>);
    footer = <button className="btn-primary" onClick={finish}>Cerrar</button>;
  } else {
    const ex = explainWebhookError(result.code);
    body = (<>
      <div className="alert" style={{ background: "#FEF0F0", color: "#C42F2F", border: "1px solid #F8CACA", alignItems: "flex-start", flexDirection: "column", gap: 4 }}>
        <b>{ex.title}</b><span>{ex.action}</span>
        <span style={{ fontSize: 11 }}>{result.code}{result.extra.decline_code ? ` · ${result.extra.decline_code}` : ""}{result.message ? ` · ${result.message}` : ""}</span>
      </div>
      {result.extra.paymentMethodUpdateUrl && <div style={{ marginTop: 12 }}><div className="field-label">Link para que el cliente cargue o cambie la tarjeta</div><LinkBox url={result.extra.paymentMethodUpdateUrl} /></div>}
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 12 }}>No se cobró nada y el plan del cliente no cambió.</div>
    </>);
    footer = <><button className="btn-secondary" onClick={finish}>Cerrar</button><button className="btn-primary" onClick={() => setStep("confirm")}>Reintentar</button></>;
  }
  return <Modal title="Asignar plan (cobra la tarjeta)" onClose={busy ? () => {} : finish} footer={footer}>{body}</Modal>;
}

// Link de Stripe para que el cliente agregue o cambie su tarjeta. Se genera a pedido (cada uno es de un solo uso).
export function CardLinkDialog({ user, onSubmit, onClose }) {
  const [state, setState] = useState({ busy: false, data: null, error: "" });
  async function generate() {
    setState({ busy: true, data: null, error: "" });
    try { setState({ busy: false, data: await onSubmit(), error: "" }); }
    catch (e) { const ex = explainWebhookError(e.code); setState({ busy: false, data: null, error: `${ex.title}. ${ex.action}` }); }
  }
  return (
    <Modal title="Link para cambiar la tarjeta" onClose={state.busy ? () => {} : onClose} footer={<><button className="btn-secondary" onClick={onClose}>Cerrar</button><button className="btn-primary" disabled={state.busy} onClick={generate}>{state.busy ? "Generando…" : state.data ? "Generar otro" : "Generar link"}</button></>}>
      <div className="confirm-text">Cliente: <b>{user.email}</b></div>
      <div style={{ fontSize: 12, color: "var(--muted)", margin: "8px 0" }}>No cobra nada ni cambia la suscripción. El link es de un solo uso y vence a los pocos minutos: generá uno nuevo cada vez, no lo guardes.</div>
      {state.data && <LinkBox url={state.data.paymentMethodUpdateUrl} />}
      {state.error && <div className="err" role="alert">{state.error}</div>}
    </Modal>
  );
}
