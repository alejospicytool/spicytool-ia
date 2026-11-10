import { useEffect, useRef, useState } from "react";
import { callAi, AI_SUG } from "./crmAi.js";
import { md } from "./crmUi.jsx";

const KEY = "crm-ai";
const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || "null") || []; } catch { return []; } };

// Panel ✦ Asistente: chat con la IA sobre los datos del CRM (la respuesta llega completa, sin ir escribiéndose)
export default function CrmAssistant({ crm, sb, onClose }) {
  const [msgs, setMsgs] = useState(load);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const body = useRef(null);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(msgs)); } catch { /* sin storage */ } if (body.current) body.current.scrollTop = body.current.scrollHeight; }, [msgs, busy]);

  async function ask(q) {
    q = (q || "").trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user", content: q }];
    setMsgs(next); setText(""); setBusy(true);
    const turns = next.filter((m) => !m.err && m.content).map((m) => ({ role: m.role, content: m.content })).slice(-9);
    try {
      const r = await callAi(sb, { mode: "chat", data: crm.aiData(), messages: turns });
      setMsgs([...next, { role: "assistant", content: r.text }]);
    } catch (e) { setMsgs([...next, { role: "assistant", content: e.message, err: true }]); }
    setBusy(false);
  }
  return (
    <aside className="crm-drawer" aria-label="Asistente">
      <div className="crm-drawer-h"><h2>✦ Asistente</h2><span style={{ display: "flex", gap: 6 }}><button className="crm-btn sm" onClick={() => setMsgs([])}>Nueva charla</button><button className="crm-icon" aria-label="Cerrar" onClick={onClose}>✕</button></span></div>
      <div className="crm-drawer-b" ref={body} aria-live="polite">
        {msgs.length === 0 ? (
          <>
            <p className="crm-note" style={{ margin: 0 }}>Preguntale lo que quieras sobre tus deals, clientes, tareas y forecast. Lee los datos del CRM en el momento.</p>
            <div className="crm-sug">{AI_SUG.map((q) => <button key={q} onClick={() => ask(q)}>{q}</button>)}</div>
          </>
        ) : msgs.map((m, i) => (
          <div key={i} className={"crm-msg " + (m.role === "user" ? "u" : m.err ? "a err" : "a")}>
            {m.role === "user" ? <p>{m.content}</p> : <div dangerouslySetInnerHTML={{ __html: md(m.content || "…") }} />}
          </div>
        ))}
        {busy && <div className="crm-msg a"><p>Pensando…</p></div>}
      </div>
      <div className="crm-drawer-f">
        <textarea className="spicy-input" rows={1} placeholder="Preguntá algo sobre tu CRM" aria-label="Pregunta" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(text); } }} />
        <button className="crm-btn primary" onClick={() => ask(text)} disabled={busy}>Enviar</button>
      </div>
    </aside>
  );
}
