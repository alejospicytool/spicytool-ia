// Formularios de edición de "Admin Spicy": company, ficha de contacto y cambio de plan.
// Validan con adminLogic.js antes de enviar; el error del "servidor" se muestra dentro del diálogo.
import { useState } from "react";
import { Modal } from "../revenue/revenueUi.jsx";
import { validateCompanyEdit, validateContactEdit, PLAN_OPTIONS, currentPlanKey, planLabel } from "./adminLogic.js";

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

export function ChangePlanDialog({ user, onSubmit, onClose }) {
  const current = currentPlanKey(user);
  const [plan, setPlan] = useState(current || PLAN_OPTIONS[0].key);
  const { busy, error, submit } = useSubmit((k) => ({ ok: true, errors: {}, value: k }), onSubmit, onClose);
  return (
    <Modal title="Cambiar plan" onClose={onClose} footer={<><button className="btn-secondary" disabled={busy} onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy || plan === current} onClick={() => submit(plan)}>{busy ? "Guardando…" : "Cambiar plan"}</button></>}>
      <div className="confirm-text" style={{ marginBottom: 14 }}>Plan actual: <b>{planLabel(current)}</b></div>
      <Field label="Nuevo plan">
        <select className="inp" aria-label="Nuevo plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
          {PLAN_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </Field>
      {error && <div className="err" role="alert">{error}</div>}
    </Modal>
  );
}
