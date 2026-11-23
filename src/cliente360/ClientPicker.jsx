// Selector de cliente para tickets: se busca entre los clientes de la cartera de Seguimiento y, si el cliente no está (un prospecto, por ejemplo), se puede
// escribir el nombre a mano como antes. Elegir uno de la lista deja el ticket vinculado a la ficha 360 de ese cliente.
import { useRef, useState } from "react";
import { clientOptions } from "./cliente360Logic.js";

// value = texto del cliente · companyId = cuenta elegida de la lista (o null si es texto libre)
// onChange(name, companyId) en cada cambio · onCommit(name, companyId) al elegir de la lista o al salir del campo (para guardar en un ticket ya creado)
export default function ClientPicker({ value, companyId, followup, onChange, onCommit, autoFocus = false, placeholder = "Buscá un cliente o escribí un nombre" }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);
  const opts = clientOptions(followup, companyId ? "" : value);
  const text = String(value || "").trim();
  const exact = opts.some((o) => String(o.company_name).trim().toLowerCase() === text.toLowerCase());

  const pick = (o) => { setOpen(false); onChange(o.company_name, o.company_id); if (onCommit) onCommit(o.company_name, o.company_id); };
  const takeText = () => { setOpen(false); onChange(text, null); if (onCommit) onCommit(text, null); };
  const clear = () => { onChange("", null); setOpen(true); }; // solo suelta la selección: no guarda nada hasta que se elija otro cliente o se salga del campo

  if (companyId) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#111", background: "#EDFAF3", border: "1px solid #BFE9D2", borderRadius: 6, padding: "4px 10px" }}>✓ {value}</span>
        <span style={{ fontSize: 11, color: "#16A34A" }}>Cliente de la cartera: el ticket queda vinculado a su ficha</span>
        <button type="button" className="spicy-btn-secondary" style={{ padding: "2px 9px", fontSize: 11 }} onClick={clear}>Cambiar</button>
      </div>
    );
  }
  return (
    <div style={{ position: "relative", marginTop: 4 }}>
      <input className="spicy-input" autoFocus={autoFocus} aria-label="Cliente" aria-autocomplete="list" placeholder={placeholder} value={value || ""} style={{ width: "100%" }}
        onChange={(e) => { onChange(e.target.value, null); setOpen(true); }}
        onFocus={() => { clearTimeout(closeTimer.current); setOpen(true); }}
        onBlur={() => { closeTimer.current = setTimeout(() => { setOpen(false); if (onCommit) onCommit(text, null); }, 150); }} />
      {open && (opts.length > 0 || (text && !exact)) && (
        <div role="listbox" style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 30, marginTop: 2, background: "white", border: "1px solid #E0E0E0", borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.12)", maxHeight: 260, overflowY: "auto" }}>
          {opts.map((o) => (
            <button type="button" role="option" key={o.company_id} onMouseDown={(e) => { e.preventDefault(); pick(o); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: "none", borderBottom: "1px solid #F3F3F3", background: "white", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{o.company_name}</div>
              <div style={{ fontSize: 11, color: "#888" }}>{[o.contact_name, o.contact_email].filter(Boolean).join(" · ") || "cliente de la cartera"}</div>
            </button>
          ))}
          {text && !exact && (
            <button type="button" role="option" onMouseDown={(e) => { e.preventDefault(); takeText(); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: "none", background: "#FAFAFA", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: "#666" }}>
              Usar «<b>{text}</b>» (cliente que no está en la cartera)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
