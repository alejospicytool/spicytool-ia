// Dibuja el cartel de confirmación de confirmStore.js. Se monta una sola vez en App.jsx.
import { useEffect, useRef, useSyncExternalStore } from "react";
import { getConfirmState, settleConfirm, subscribeConfirm } from "./confirmStore.js";

export default function ConfirmHost() {
  const s = useSyncExternalStore(subscribeConfirm, getConfirmState);
  const cancelRef = useRef(null);
  useEffect(() => {
    if (!s) return;
    cancelRef.current && cancelRef.current.focus(); // el foco arranca en "Cancelar": un Enter sin querer no borra nada
    const k = (e) => { if (e.key === "Escape") settleConfirm(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [s]);
  if (!s) return null;
  return (
    <div onClick={() => settleConfirm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-msg" onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 420, padding: 22, boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>
        <div id="confirm-title" style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>{s.title}</div>
        {s.message && <div id="confirm-msg" style={{ fontSize: 13, color: "#555", marginTop: 8, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{s.message}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button ref={cancelRef} className="spicy-btn-secondary" onClick={() => settleConfirm(false)}>Cancelar</button>
          <button className="spicy-btn-primary" style={s.danger ? undefined : { background: "#111" }} onClick={() => settleConfirm(true)}>{s.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
