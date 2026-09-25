import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { ONBOARDING_STAGES, ONBOARDING_LEAD_SOURCES, ONBOARDING_PAYMENT_STATUS, calcularEstado, calcularAvance, diasEntre, ESTADO_BADGE } from "./onboardingLogic.js";

// ── Supabase ───────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://khuavhbraikzreyhptog.supabase.co";
const SUPABASE_KEY = "sb_publishable_O8UPfP8BYLWhlIg0Fv45Gg_coidezqc";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── SpicyTool Brand ────────────────────────────────────────────────────────
const ST_RED    = "#EF3E3E";
const ST_RED_BG = "#FEF0F0";
const ST_RED_DARK = "#C42F2F";

function BrandStyles() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.textContent = `
      *, body { font-family: 'DM Sans', sans-serif !important; }
      body { background: #F7F7F8 !important; margin: 0; }
      .spicy-root { min-height: 100vh; background: #F7F7F8; }
      .spicy-sidebar {
        position: fixed; left: 0; top: 0; bottom: 0; width: 220px;
        background: #1A1A2E; display: flex; flex-direction: column;
        padding: 0; z-index: 100;
      }
      .spicy-logo {
        display: flex; align-items: center; gap: 10px;
        padding: 20px 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .spicy-logo-icon {
        width: 32px; height: 32px; background: ${ST_RED};
        border-radius: 8px; display: flex; align-items: center; justify-content: center;
        font-size: 16px; color: white; font-weight: 700; flex-shrink: 0;
      }
      .spicy-logo-text { font-size: 16px; font-weight: 600; color: white; }
      .spicy-nav { padding: 12px 10px; flex: 1; overflow-y: auto; }
      .spicy-nav-btn {
        display: flex; align-items: center; gap: 10px; width: 100%;
        padding: 9px 12px; border-radius: 8px; border: none; cursor: pointer;
        font-size: 13px; font-weight: 500; text-align: left; transition: all 0.15s;
        margin-bottom: 2px;
      }
      .spicy-nav-btn.active { background: ${ST_RED}; color: white; }
      .spicy-nav-btn:not(.active) { background: transparent; color: rgba(255,255,255,0.6); }
      .spicy-nav-btn:not(.active):hover { background: rgba(255,255,255,0.08); color: white; }
      .spicy-nav-badge {
        margin-left: auto; font-size: 10px; background: #F59E0B;
        color: white; border-radius: 10px; padding: 1px 6px; font-weight: 600;
      }
      .spicy-user {
        padding: 14px 16px; border-top: 1px solid rgba(255,255,255,0.08);
        display: flex; align-items: center; gap: 10px;
      }
      .spicy-avatar {
        width: 32px; height: 32px; border-radius: 50%; background: ${ST_RED};
        display: flex; align-items: center; justify-content: center;
        font-size: 13px; font-weight: 600; color: white; flex-shrink: 0;
      }
      .spicy-main { margin-left: 220px; padding: 28px 32px; max-width: 960px; }
      .spicy-page-title { font-size: 22px; font-weight: 600; color: #111; margin-bottom: 24px; }
      .spicy-card {
        background: white; border-radius: 12px; border: 1px solid #EBEBEB;
        padding: 20px 24px; margin-bottom: 16px;
      }
      .spicy-kpi {
        background: white; border-radius: 12px; border: 1px solid #EBEBEB; padding: 16px 20px;
      }
      .spicy-kpi-label { font-size: 12px; color: #888; margin-bottom: 6px; font-weight: 500; }
      .spicy-kpi-value { font-size: 22px; font-weight: 600; color: #111; }
      .spicy-kpi-sub { font-size: 11px; color: #aaa; margin-top: 4px; }
      .spicy-btn-primary {
        background: ${ST_RED}; color: white; border: none; border-radius: 8px;
        padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer;
        transition: background 0.15s;
      }
      .spicy-btn-primary:hover { background: ${ST_RED_DARK}; }
      .spicy-btn-primary:disabled { background: #FFAAAA; cursor: not-allowed; }
      .spicy-btn-secondary {
        background: white; color: #444; border: 1px solid #E0E0E0; border-radius: 8px;
        padding: 8px 16px; font-size: 13px; font-weight: 500; cursor: pointer;
        transition: all 0.15s;
      }
      .spicy-btn-secondary:hover { border-color: #ccc; background: #fafafa; }
      .spicy-input {
        width: 100%; padding: 9px 12px; border: 1px solid #E0E0E0; border-radius: 8px;
        font-size: 13px; font-family: 'DM Sans', sans-serif !important;
        outline: none; transition: border 0.15s; box-sizing: border-box;
        background: white; color: #111;
      }
      .spicy-input:focus { border-color: ${ST_RED}; }
      .spicy-select {
        padding: 8px 12px; border: 1px solid #E0E0E0; border-radius: 8px;
        font-size: 13px; font-family: 'DM Sans', sans-serif !important;
        outline: none; background: white; color: #111; cursor: pointer;
      }
      .spicy-table-row {
        display: flex; align-items: center; gap: 12px;
        padding: 12px 0; border-bottom: 1px solid #F0F0F0;
      }
      .spicy-table-row:last-child { border-bottom: none; }
      .spicy-badge-red { background: ${ST_RED_BG}; color: ${ST_RED}; font-size: 10px; padding: 2px 7px; border-radius: 5px; font-weight: 600; }
      .spicy-badge-green { background: #EDFAF3; color: #16A34A; font-size: 10px; padding: 2px 7px; border-radius: 5px; font-weight: 600; }
      .spicy-badge-gray { background: #F4F4F5; color: #666; font-size: 10px; padding: 2px 7px; border-radius: 5px; font-weight: 500; }
      .spicy-badge-amber { background: #FEF3C7; color: #D97706; font-size: 10px; padding: 2px 7px; border-radius: 5px; font-weight: 600; }
      input, select, textarea { font-family: 'DM Sans', sans-serif !important; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);
  return null;
}

// ── Nav icon map ───────────────────────────────────────────────────────────
const NAV_ICONS = {
  dashboard:"▦", accounts:"🏦", add:"+", history:"☰", runway:"📈", pnl:"📊",
  referrals:"🤝",
  services:"⚡", categories:"⊞",
  opsdash:"🧭", tickets:"🎫", tasks:"📋", onboarding:"🚀", usuarios:"👥",
  devdash:"📈", devtasks:"🛠️",
};
const NAV_LABELS = {
  dashboard:"Resumen", accounts:"Cuentas", add:"Registrar", history:"Historial", runway:"Runway", pnl:"P&L",
  referrals:"Referidos",
  services:"Servicios", categories:"Categorías",
  opsdash:"Resumen", tickets:"Tickets", tasks:"Tareas", onboarding:"Onboarding", usuarios:"Usuarios",
  devdash:"Resumen", devtasks:"Tareas",
};
const ADMIN_ONLY_VIEWS = ["add","usuarios"];

const NAV_SECTIONS = [
  {
    label: "Finanzas",
    views: ["dashboard","accounts","add","history","runway","pnl"],
    adminOnly: false,
  },
  {
    label: "Referidos",
    views: ["referrals"],
    adminOnly: false,
    badge: { referrals: true },
  },
  {
    label: "Operaciones",
    views: ["opsdash","tickets","tasks","onboarding"],
    adminOnly: false,
  },
  {
    label: "Devs",
    views: ["devdash","devtasks"],
    adminOnly: false,
  },
  {
    label: "Dashboard Producto",
    views: ["services"],
    adminOnly: false,
  },
  {
    label: "Configuración",
    views: ["categories","usuarios"],
    adminOnly: false,
  },
];

// ── Tickets (Operaciones) ───────────────────────────────────────────────────
const TICKET_CATEGORIES = [
  { key: "Bloqueante",  emoji: "🔴" },
  { key: "Funcional",   emoji: "🟠" },
  { key: "Duda de uso", emoji: "🔵" },
  { key: "Mejora",      emoji: "🟢" },
  { key: "Administrativo", emoji: "⚪" },
];
const TICKET_PRIORITIES = ["Alta","Media","Baja"];
const TICKET_CHANNELS   = ["WhatsApp","Email"];
const TICKET_STATUSES   = [
  "En Espera (Sin Solución)","Inicio por OPS","Inicio","Pausado",
  "En Curso","En DEV","Revision","Testeando (Prod)","Solucionado","Archivado",
];
const TICKET_STATUS_GROUPS = {
  "Sin empezar": ["Inicio por OPS","Inicio"],
  "En espera":   ["En Espera (Sin Solución)","Pausado"],
  "En curso":    ["En Curso","En DEV","Revision"],
  "Cerrados":    ["Testeando (Prod)","Solucionado","Archivado"],
};
const TICKET_STATUSES_EN_CURSO = TICKET_STATUS_GROUPS["En curso"];
function statusGroup(status) {
  return Object.keys(TICKET_STATUS_GROUPS).find(g => TICKET_STATUS_GROUPS[g].includes(status)) || null;
}
const TICKET_TEAM = ["Nico","Ticiana","Lucas"];

function userDisplayName(u) {
  return (u.first_name||u.last_name) ? `${u.first_name||""} ${u.last_name||""}`.trim() : u.email;
}

function initials(name) {
  return (name||"").trim().split(/\s+/).map(w=>w[0]).filter(Boolean).slice(0,2).join("").toUpperCase();
}

function Avatar({ name, size=26 }) {
  return (
    <div title={name} style={{ width:size,height:size,borderRadius:"50%",background:ST_RED_BG,display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.round(size*0.38),fontWeight:700,color:ST_RED,flexShrink:0 }}>
      {initials(name)}
    </div>
  );
}

const FIBONACCI_SCALE = [
  { value: 1,  label: "trivial",   help: "cambio de config, texto, DNS, tarea administrativa" },
  { value: 2,  label: "chico",     help: "cambio chico en un solo lugar, ajuste simple de UI, bug con causa conocida" },
  { value: 3,  label: "estándar",  help: "feature o bug estándar dentro de un módulo, con algo de investigación (la mayoría de los tickets)" },
  { value: 5,  label: "mediano",   help: "toca varios componentes o una integración; bug que cruza servicios" },
  { value: 8,  label: "grande",    help: "integración o servicio nuevo, migración de un subsistema" },
  { value: 13, label: "épico",     help: "épico (migración de plataforma, rediseño completo, capacidad nueva)" },
  { value: 21, label: "gigante",   help: "reservado para algo claramente más grande que un 13" },
];

// ── Tareas (Operaciones) ────────────────────────────────────────────────────
const TASK_STAGES = [
  { key: "Sin Empezar", emoji: "⚪" },
  { key: "Urgentes",    emoji: "🚨" },
  { key: "Stand By",    emoji: "⏸️" },
  { key: "En Curso",    emoji: "🔄" },
  { key: "Escalado",    emoji: "🧗" },
  { key: "Finalizado",  emoji: "✅" },
  { key: "Archivado",   emoji: "📁" },
];
const WEEKDAY_LABELS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

// ── Tareas de desarrollo de producto (Devs) ─────────────────────────────────
const DEV_TASK_STAGES = ["Backlog","In Progress","Testing","Done"];
const DEV_TASK_STAGES_CERRADOS = ["Testing","Done"];
const DEV_TASK_STAGE_EN_CURSO = "In Progress";

const WORKER_URL = "";
const COMMISSION_RATE = 0.20;
const MONTH_LABELS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const ACCOUNT_COLORS = ["#185FA5","#0F6E56","#533AB7","#3B6D11","#993C1D","#BA7517","#993556","#5F5E5A","#D85A30","#1D9E75"];

const fmt    = (n) => "$" + Math.round(n).toLocaleString("es-UY");
const fmtDec = (n) => "$" + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const monthKey = (d) => { const dt = new Date(d+"T00:00:00"); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`; };
const monthLabel = (mk) => { const [y,m]=mk.split("-"); return MONTH_LABELS[parseInt(m)-1]+" "+y; };

// ── Login Screen ───────────────────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail]     = useState("");
  const [pass,  setPass]      = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    if (!email || !pass) return;
    setLoading(true); setError("");
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) setError(error.message);
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#F7F7F8", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <BrandStyles/>
      <div style={{ width:"100%", maxWidth:380, padding:"0 20px" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:52, height:52, background:ST_RED, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", fontSize:24, color:"white", fontWeight:700 }}>S</div>
          <div style={{ fontSize:22, fontWeight:700, color:"#111", marginBottom:6 }}>Control financiero</div>
          <div style={{ fontSize:14, color:"#888" }}>Ingresá con tu cuenta de SpicyTool</div>
        </div>
        <div style={{ background:"white", borderRadius:14, border:"1px solid #EBEBEB", padding:"28px 28px" }}>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#555", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>Email</div>
            <input className="spicy-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="alejo@spicytool.net"/>
          </div>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#555", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>Contraseña</div>
            <input className="spicy-input" type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handleLogin(e)}/>
          </div>
          {error && <div style={{ fontSize:12, color:ST_RED, marginBottom:16, padding:"10px 12px", background:ST_RED_BG, borderRadius:8 }}>{error}</div>}
          <button className="spicy-btn-primary" onClick={handleLogin} disabled={loading||!email||!pass} style={{ width:"100%", padding:"11px" }}>
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </div>
        <div style={{ marginTop:16, fontSize:12, color:"#aaa", textAlign:"center" }}>
          ¿No tenés cuenta? Pedile a Alejo que te invite.
        </div>
      </div>
    </div>
  );
}

// ── Chart Bar ──────────────────────────────────────────────────────────────
function ChartBar({ label, income, expense, referralCost, maxVal }) {
  const [hovered, setHovered] = useState(false);
  const h=120, iH=maxVal>0?Math.round((income/maxVal)*h):0, eH=maxVal>0?Math.round((expense/maxVal)*h):0, rH=maxVal>0?Math.round((referralCost/maxVal)*h):0;
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4,flex:1,minWidth:0,position:"relative" }}
      onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}>
      {hovered&&(income>0||expense>0)&&(
        <div style={{ position:"absolute",bottom:h+14,left:"50%",transform:"translateX(-50%)",background:"#1A1A2E",color:"white",borderRadius:8,padding:"6px 10px",fontSize:11,whiteSpace:"nowrap",zIndex:10,pointerEvents:"none",lineHeight:1.7 }}>
          {income>0&&<div style={{ color:"#6EE7B7" }}>↑ {fmt(income)}</div>}
          {expense>0&&<div style={{ color:"#FCA5A5" }}>↓ {fmt(expense)}</div>}
          {referralCost>0&&<div style={{ color:"#FCD34D" }}>ref {fmt(referralCost)}</div>}
        </div>
      )}
      <div style={{ display:"flex",alignItems:"flex-end",gap:2,height:h }}>
        <div style={{ width:13,height:iH,background:"#1D9E75",borderRadius:"3px 3px 0 0",minHeight:income>0?3:0,transition:"opacity 0.1s",opacity:hovered?0.8:1 }}/>
        <div style={{ width:13,height:eH,background:ST_RED,borderRadius:"3px 3px 0 0",minHeight:expense>0?3:0,transition:"opacity 0.1s",opacity:hovered?0.8:1 }}/>
        {referralCost>0&&<div style={{ width:10,height:rH,background:"#F59E0B",borderRadius:"3px 3px 0 0",opacity:hovered?0.7:0.85 }}/>}
      </div>
      <span style={{ fontSize:11,color:"#aaa" }}>{label}</span>
    </div>
  );
}

// ── Accounts Panel ─────────────────────────────────────────────────────────
function AccountsPanel({ accounts, txns, isAdmin, onRefresh }) {
  const [importingId, setImportingId] = useState(null);
  const [showAdd,     setShowAdd]     = useState(false);
  const [newForm,     setNewForm]     = useState({ name:"", currency:"USD", balance:"" });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const total = accounts.reduce((s,a) => {
    // Calculate balance from transactions
    const accTxns = txns.filter(t => t.account_id === a.id);
    const calc = accTxns.reduce((b,t) => b + (t.type==="income" ? Number(t.amount) : -Number(t.amount)), 0);
    return s + calc;
  }, 0);
  const txnsByAccount = {};
  accounts.forEach(a=>{
    const at=txns.filter(t=>t.account_id===a.id);
    txnsByAccount[a.id]={ income:at.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0), expense:at.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0) };
  });

  async function addAccount() {
    if (!newForm.name.trim()) return;
    setSaving(true);
    const id="acc_"+newForm.name.toLowerCase().replace(/\s+/g,"_")+"_"+Date.now();
    const color=ACCOUNT_COLORS[accounts.length%ACCOUNT_COLORS.length];
    await sb.from("accounts").insert({id,name:newForm.name.trim(),currency:newForm.currency,balance:parseFloat(newForm.balance)||0,color,api:null});
    setNewForm({name:"",currency:"USD",balance:""}); setShowAdd(false); setSaving(false); onRefresh();
  }

  async function deleteAccount(id) {
    await sb.from("accounts").delete().eq("id",id);
    setConfirmDelete(null); onRefresh();
  }

  function handleFile(e, accountId) {
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=async(ev)=>{
      const rows=parseCSVRows(ev.target.result,accountId);
      if(!rows.length){alert("No se encontraron transacciones.");return;}
      const existingIds=new Set(txns.map(t=>t.id));
      const newRows=rows.filter(r=>!existingIds.has(r.id));
      if(!newRows.length){alert("Todas ya estaban cargadas.");return;}
      await sb.from("transactions").insert(newRows);
      alert(`${newRows.length} transacciones importadas.`); onRefresh();
    };
    reader.readAsText(file); e.target.value=""; setImportingId(null);
  }

  return (
    <div>
      <div style={{ background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)",padding:"1.25rem",marginBottom:"1.5rem",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:12,color:"var(--color-text-tertiary)",marginBottom:6 }}>Total consolidado</div>
          <div style={{ fontSize:28,fontWeight:500 }}>{fmt(total)}</div>
          <div style={{ fontSize:12,color:"var(--color-text-tertiary)",marginTop:4 }}>{accounts.length} cuentas</div>
        </div>
        <div style={{ display:"flex",alignItems:"flex-end",gap:4,height:48 }}>
          {accounts.map(a=>{const cb=txns.filter(t=>t.account_id===a.id).reduce((b,t)=>b+(t.type==="income"?Number(t.amount):-Number(t.amount)),0);const h=total>0&&cb>0?Math.max(4,Math.round((cb/total)*48)):0;return cb>0?<div key={a.id} title={`${a.name}: ${fmt(cb)}`} style={{ width:10,height:h,background:a.color,borderRadius:"2px 2px 0 0",opacity:0.85 }}/>:null;}) }
        </div>
      </div>

      <div style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",overflow:"hidden",marginBottom:10 }}>
        {accounts.map((a,i)=>{
          const accTxns = txns.filter(t => t.account_id === a.id);
          const calcBalance = accTxns.reduce((b,t) => b + (t.type==="income" ? Number(t.amount) : -Number(t.amount)), 0);
          return (<div key={a.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<accounts.length-1?"0.5px solid var(--color-border-tertiary)":"none" }}>
            <div style={{ width:10,height:10,borderRadius:"50%",background:a.color,flexShrink:0 }}/>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                <span style={{ fontSize:14,fontWeight:500 }}>{a.name}</span>
                {a.api&&<span style={{ fontSize:10,padding:"1px 6px",borderRadius:4,background:"var(--color-background-info)",color:"var(--color-text-info)" }}>API</span>}
                <span style={{ fontSize:11,color:"var(--color-text-tertiary)" }}>{a.currency}</span>
              </div>
              <div style={{ fontSize:11,color:"var(--color-text-tertiary)",marginTop:2 }}>{fmt(txnsByAccount[a.id]?.income||0)} ing · {fmt(txnsByAccount[a.id]?.expense||0)} egr</div>
            </div>

            <div style={{ fontSize:16,fontWeight:600,color:calcBalance>0?"#111":calcBalance<0?"#EF3E3E":"#bbb",minWidth:90,textAlign:"right" }}>
              {fmt(calcBalance)}
              <div style={{ fontSize:10,color:"#aaa",fontWeight:400,marginTop:1 }}>calculado</div>
            </div>

            {isAdmin&&(
              <div style={{ position:"relative" }}>
                <button onClick={()=>setImportingId(importingId===a.id?null:a.id)} style={{ fontSize:11,padding:"4px 9px",borderRadius:"var(--border-radius-md)",cursor:"pointer",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-tertiary)" }}>↑ CSV</button>
                {importingId===a.id&&(
                  <div style={{ position:"absolute",right:0,top:30,zIndex:10,background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",padding:"10px 12px",width:200,boxShadow:"0 4px 16px rgba(0,0,0,0.12)" }}>
                    <div style={{ fontSize:12,fontWeight:500,marginBottom:8 }}>Importar a {a.name}</div>
                    <input type="file" accept=".csv" ref={fileRef} style={{ display:"none" }} onChange={e=>handleFile(e,a.id)}/>
                    <button onClick={()=>fileRef.current.click()} style={{ width:"100%",padding:"7px",borderRadius:"var(--border-radius-md)",fontSize:12,cursor:"pointer",background:"var(--color-background-info)",color:"var(--color-text-info)",border:"0.5px solid var(--color-border-info)",fontWeight:500 }}>Seleccionar archivo</button>
                    <button onClick={()=>setImportingId(null)} style={{ width:"100%",marginTop:6,padding:"5px",borderRadius:"var(--border-radius-md)",fontSize:11,cursor:"pointer",background:"transparent",color:"var(--color-text-tertiary)",border:"none" }}>Cancelar</button>
                  </div>
                )}
              </div>
            )}

            {isAdmin&&(confirmDelete===a.id?(
              <div style={{ display:"flex",gap:6 }}>
                <button onClick={()=>deleteAccount(a.id)} style={{ fontSize:11,padding:"4px 8px",borderRadius:"var(--border-radius-md)",cursor:"pointer",background:"var(--color-background-danger)",color:"var(--color-text-danger)",border:"0.5px solid var(--color-border-danger)",fontWeight:500 }}>Sí</button>
                <button onClick={()=>setConfirmDelete(null)} style={{ fontSize:11,padding:"4px 8px",borderRadius:"var(--border-radius-md)",cursor:"pointer",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-tertiary)" }}>No</button>
              </div>
            ):(
              <button onClick={()=>setConfirmDelete(a.id)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:16,color:"var(--color-text-tertiary)",padding:"0 2px",lineHeight:1,opacity:0.5 }}>×</button>
            ))}
          </div>
          );
        })}
      </div>

      {isAdmin&&(showAdd?(
        <div style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem",marginBottom:10 }}>
          <div style={{ fontSize:14,fontWeight:500,marginBottom:12 }}>Nueva cuenta</div>
          <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:12 }}>
            <div style={{ flex:2,minWidth:140 }}>
              <div style={{ fontSize:12,color:"var(--color-text-tertiary)",marginBottom:5 }}>Nombre</div>
              <input autoFocus value={newForm.name} placeholder="ej: Lemon Cash" onChange={e=>setNewForm(f=>({...f,name:e.target.value}))} style={{ width:"100%",fontSize:13,boxSizing:"border-box" }}/>
            </div>
            <div style={{ flex:1,minWidth:80 }}>
              <div style={{ fontSize:12,color:"var(--color-text-tertiary)",marginBottom:5 }}>Moneda</div>
              <select value={newForm.currency} onChange={e=>setNewForm(f=>({...f,currency:e.target.value}))} style={{ width:"100%",fontSize:13 }}>
                <option>USD</option><option>ARS</option><option>UYU</option><option>CLP</option><option>USDT</option>
              </select>
            </div>
            <div style={{ flex:1,minWidth:100 }}>
              <div style={{ fontSize:12,color:"var(--color-text-tertiary)",marginBottom:5 }}>Saldo inicial</div>
              <input type="number" value={newForm.balance} placeholder="0" onChange={e=>setNewForm(f=>({...f,balance:e.target.value}))} style={{ width:"100%",fontSize:13,boxSizing:"border-box" }}/>
            </div>
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={()=>setShowAdd(false)} style={{ flex:1,padding:"7px",borderRadius:"var(--border-radius-md)",fontSize:13,cursor:"pointer",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-secondary)" }}>Cancelar</button>
            <button onClick={addAccount} disabled={!newForm.name.trim()||saving} style={{ flex:2,padding:"7px",borderRadius:"var(--border-radius-md)",fontSize:13,fontWeight:500,cursor:"pointer",background:"var(--color-background-info)",color:"var(--color-text-info)",border:"0.5px solid var(--color-border-info)" }}>{saving?"Guardando…":"Guardar cuenta"}</button>
          </div>
        </div>
      ):(
        <button onClick={()=>setShowAdd(true)} style={{ width:"100%",padding:"9px",borderRadius:"var(--border-radius-md)",fontSize:13,cursor:"pointer",border:"0.5px dashed var(--color-border-secondary)",background:"transparent",color:"var(--color-text-secondary)" }}>+ Agregar cuenta</button>
      ))}
    </div>
  );
}

// ── Categories Panel ───────────────────────────────────────────────────────
function CategoriesPanel({ catsIncome, catsExpense, isAdmin, onRefresh }) {
  const [editingId, setEditingId] = useState(null);
  const [editVal,   setEditVal]   = useState("");
  const [newVal,    setNewVal]    = useState("");
  const [adding,    setAdding]    = useState(null);

  async function saveEdit(cat) {
    if (!editVal.trim()){setEditingId(null);return;}
    await sb.from("categories").update({name:editVal.trim()}).eq("id",cat.id);
    setEditingId(null); onRefresh();
  }
  async function deleteCat(cat, allCats) {
    if (allCats.length<=1) return;
    await sb.from("categories").delete().eq("id",cat.id);
    onRefresh();
  }
  async function addCat(type) {
    if (!newVal.trim()) return;
    const cats=type==="income"?catsIncome:catsExpense;
    await sb.from("categories").insert({type,name:newVal.trim(),position:cats.length});
    setNewVal(""); setAdding(null); onRefresh();
  }
  async function move(cat, dir, cats) {
    const idx=cats.findIndex(c=>c.id===cat.id);
    const other=cats[idx+dir]; if(!other) return;
    await Promise.all([
      sb.from("categories").update({position:other.position}).eq("id",cat.id),
      sb.from("categories").update({position:cat.position}).eq("id",other.id),
    ]);
    onRefresh();
  }

  function Section({ type, cats, label, color }) {
    return (
      <div style={{ marginBottom:"1.5rem" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <div style={{ width:8,height:8,borderRadius:"50%",background:color }}/>
            <span style={{ fontSize:14,fontWeight:500 }}>{label}</span>
            <span style={{ fontSize:12,color:"var(--color-text-tertiary)" }}>{cats.length} categorías</span>
          </div>
          {isAdmin&&<button onClick={()=>{setAdding(type);setNewVal("");}} style={{ fontSize:12,padding:"4px 10px",borderRadius:"var(--border-radius-md)",cursor:"pointer",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-secondary)" }}>+ Nueva</button>}
        </div>
        <div style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",overflow:"hidden" }}>
          {cats.map((cat,i)=>(
            <div key={cat.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderBottom:i<cats.length-1?"0.5px solid var(--color-border-tertiary)":"none" }}>
              {isAdmin&&<div style={{ display:"flex",flexDirection:"column",gap:1,flexShrink:0 }}>
                <button onClick={()=>move(cat,-1,cats)} disabled={i===0} style={{ background:"none",border:"none",cursor:i===0?"default":"pointer",fontSize:10,color:i===0?"var(--color-text-tertiary)":"var(--color-text-secondary)",lineHeight:1,padding:"1px 2px" }}>▲</button>
                <button onClick={()=>move(cat,1,cats)} disabled={i===cats.length-1} style={{ background:"none",border:"none",cursor:i===cats.length-1?"default":"pointer",fontSize:10,color:i===cats.length-1?"var(--color-text-tertiary)":"var(--color-text-secondary)",lineHeight:1,padding:"1px 2px" }}>▼</button>
              </div>}
              {editingId===cat.id?(
                <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)}
                  onBlur={()=>saveEdit(cat)} onKeyDown={e=>{if(e.key==="Enter")saveEdit(cat);if(e.key==="Escape")setEditingId(null);}}
                  style={{ flex:1,fontSize:13,padding:"3px 6px" }}/>
              ):(
                <span style={{ flex:1,fontSize:13 }}>{cat.name}</span>
              )}
              {isAdmin&&editingId!==cat.id&&(
                <div style={{ display:"flex",gap:6,flexShrink:0 }}>
                  <button onClick={()=>{setEditingId(cat.id);setEditVal(cat.name);}} style={{ fontSize:11,padding:"3px 8px",borderRadius:"var(--border-radius-md)",cursor:"pointer",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-secondary)" }}>✎</button>
                  <button onClick={()=>deleteCat(cat,cats)} disabled={cats.length<=1} style={{ fontSize:11,padding:"3px 8px",borderRadius:"var(--border-radius-md)",cursor:cats.length<=1?"not-allowed":"pointer",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:cats.length<=1?"var(--color-text-tertiary)":"var(--color-text-danger)",opacity:cats.length<=1?0.4:1 }}>×</button>
                </div>
              )}
            </div>
          ))}
          {isAdmin&&adding===type&&(
            <div style={{ display:"flex",gap:8,padding:"10px 14px",borderTop:"0.5px solid var(--color-border-tertiary)",background:"var(--color-background-secondary)" }}>
              <input autoFocus value={newVal} placeholder="Nombre de la categoría" onChange={e=>setNewVal(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")addCat(type);if(e.key==="Escape"){setAdding(null);setNewVal("");}}}
                style={{ flex:1,fontSize:13,padding:"4px 8px" }}/>
              <button onClick={()=>addCat(type)} disabled={!newVal.trim()} style={{ fontSize:12,padding:"4px 12px",borderRadius:"var(--border-radius-md)",cursor:"pointer",background:"var(--color-background-info)",color:"var(--color-text-info)",border:"0.5px solid var(--color-border-info)",fontWeight:500 }}>Agregar</button>
              <button onClick={()=>{setAdding(null);setNewVal("");}} style={{ fontSize:12,padding:"4px 10px",borderRadius:"var(--border-radius-md)",cursor:"pointer",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-secondary)" }}>Cancelar</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Section type="income"  cats={catsIncome}  label="Categorías de ingreso" color="#1D9E75"/>
      <Section type="expense" cats={catsExpense} label="Categorías de egreso"  color="#D85A30"/>
      {!isAdmin&&<div style={{ fontSize:12,color:"var(--color-text-tertiary)",marginTop:8 }}>Solo los admins pueden editar categorías.</div>}
    </div>
  );
}

// ── User Permissions Panel ───────────────────────────────────────────────────
function UserPermissionsPanel({ users, allowedSections, onRefresh }) {
  const sections = NAV_SECTIONS.map(s=>s.label);
  const emptyForm = () => ({ email:"", first_name:"", last_name:"", role:"reader" });

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isAllowed = (userId, section) => allowedSections.some(a=>a.user_id===userId && a.section===section);
  const displayName = (u) => (u.first_name||u.last_name) ? `${u.first_name||""} ${u.last_name||""}`.trim() : u.email;

  async function toggle(userId, section, allow) {
    if (allow) await sb.from("allowed_sections").insert({ user_id:userId, section });
    else await sb.from("allowed_sections").delete().eq("user_id",userId).eq("section",section);
    onRefresh();
  }

  async function addUser(e) {
    e.preventDefault();
    setError(""); setSaving(true);
    const email = form.email.trim().toLowerCase();
    const { data: userId, error: rpcErr } = await sb.rpc("get_user_id_by_email", { lookup_email: email });
    if (rpcErr || !userId) {
      setSaving(false);
      setError("No se encontró ningún usuario con ese email. Primero creá el login en el dashboard de Supabase (Authentication → Users → Add user).");
      return;
    }
    await sb.from("user_roles").upsert({
      user_id: userId,
      email,
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      role: form.role,
    }, { onConflict: "user_id" });
    setSaving(false);
    setForm(emptyForm());
    setShowAdd(false);
    onRefresh();
  }

  return (
    <div className="spicy-card">
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
        <div>
          <div style={{ fontSize:16,fontWeight:700,color:"#111",marginBottom:4 }}>Usuarios y permisos</div>
          <div style={{ fontSize:13,color:"#888" }}>Tildá qué secciones puede ver cada usuario — arrancan sin ver ninguna. Los admins siempre ven todo.</div>
        </div>
        <button className="spicy-btn-primary" onClick={()=>{setError("");setForm(emptyForm());setShowAdd(true);}}>+ Agregar usuario</button>
      </div>

      <div style={{ overflowX:"auto" }}>
        <table style={{ borderCollapse:"collapse", width:"100%", minWidth:560 }}>
          <thead>
            <tr>
              <th style={{ textAlign:"left",fontSize:12,color:"#888",fontWeight:600,padding:"8px 12px",borderBottom:"1px solid #EBEBEB" }}>Usuario</th>
              {sections.map(s=><th key={s} style={{ textAlign:"center",fontSize:11,color:"#888",fontWeight:600,padding:"8px 8px",borderBottom:"1px solid #EBEBEB" }}>{s}</th>)}
            </tr>
          </thead>
          <tbody>
            {users.map(u=>(
              <tr key={u.user_id}>
                <td style={{ padding:"10px 12px",borderBottom:"1px solid #F5F5F5" }}>
                  <div style={{ fontSize:13,color:"#111",fontWeight:500 }}>{displayName(u)}</div>
                  {(u.first_name||u.last_name)&&<div style={{ fontSize:11,color:"#aaa" }}>{u.email}</div>}
                  <span className={u.role==="admin"?"spicy-badge-green":"spicy-badge-gray"}>{u.role}</span>
                </td>
                {sections.map(s=>(
                  <td key={s} style={{ textAlign:"center",padding:"10px 8px",borderBottom:"1px solid #F5F5F5" }}>
                    {u.role==="admin" ? (
                      <span style={{ fontSize:11,color:"#ccc" }}>—</span>
                    ) : (
                      <input type="checkbox" checked={isAllowed(u.user_id,s)} onChange={e=>toggle(u.user_id,s,e.target.checked)}/>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {users.length===0 && (
              <tr><td colSpan={sections.length+1} style={{ padding:"20px",textAlign:"center",color:"#ccc",fontSize:13 }}>No hay usuarios.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div onClick={()=>setShowAdd(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
          <form onClick={e=>e.stopPropagation()} onSubmit={addUser} style={{ background:"white",borderRadius:16,width:"100%",maxWidth:420,padding:24,display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ fontSize:16,fontWeight:700,color:"#111" }}>Agregar usuario</div>
            <div style={{ fontSize:12,color:"#888",marginTop:-8 }}>El login ya tiene que existir en Supabase (Authentication → Users). Acá solo cargás sus datos y rol dentro de la app.</div>

            <div style={{ display:"flex",gap:12 }}>
              <label style={{ fontSize:12,color:"#666",fontWeight:500,flex:1 }}>Nombre
                <input className="spicy-input" value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))} style={{ width:"100%",marginTop:4 }}/>
              </label>
              <label style={{ fontSize:12,color:"#666",fontWeight:500,flex:1 }}>Apellido
                <input className="spicy-input" value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))} style={{ width:"100%",marginTop:4 }}/>
              </label>
            </div>

            <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Email
              <input required type="email" autoFocus className="spicy-input" placeholder="nombre@spicytool.net" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={{ width:"100%",marginTop:4 }}/>
            </label>

            <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Rol
              <select className="spicy-select" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} style={{ width:"100%",marginTop:4 }}>
                <option value="reader">reader</option>
                <option value="dev">dev</option>
                <option value="admin">admin</option>
              </select>
            </label>

            {error && <div style={{ fontSize:12,color:ST_RED,background:ST_RED_BG,borderRadius:8,padding:"8px 10px" }}>{error}</div>}

            <div style={{ display:"flex",justifyContent:"flex-end",gap:8,marginTop:4 }}>
              <button type="button" className="spicy-btn-secondary" onClick={()=>setShowAdd(false)}>Cancelar</button>
              <button type="submit" className="spicy-btn-primary" disabled={saving||!form.email.trim()}>Agregar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Referral Dashboard ─────────────────────────────────────────────────────
function ReferralDashboard({ txns, referrers, referredClients, payments, isAdmin, onRefresh }) {
  const [expanded,   setExpanded]   = useState(null);
  const [showAdd,    setShowAdd]    = useState(false);
  const [newRef,     setNewRef]     = useState({id:"",name:"",email:"",commission_rate:20});
  const [syncing,    setSyncing]    = useState(false);
  const [syncMsg,    setSyncMsg]    = useState("");
  const [addTxnFor,  setAddTxnFor]  = useState(null); // referrer id for manual txn form
  const [txnForm,    setTxnForm]    = useState({amount:"", description:"", date:new Date().toISOString().split("T")[0]});
  const [savingTxn,  setSavingTxn]  = useState(false);
  const [addClientFor, setAddClientFor] = useState(null); // referrer id for new client form
  const [clientForm,   setClientForm]   = useState({name:"", email:""});
  const [savingClient, setSavingClient] = useState(false);

  async function saveClient(ref) {
    if (!clientForm.name.trim() || !clientForm.email.trim()) return;
    setSavingClient(true);
    await sb.from("referred_clients").insert({
      id: "client_" + Date.now(),
      referrer_id: ref.id,
      name: clientForm.name.trim(),
      email: clientForm.email.trim().toLowerCase(),
    });
    setClientForm({name:"", email:""});
    setAddClientFor(null);
    setSavingClient(false);
    onRefresh();
  }

  async function deleteClient(id) {
    await sb.from("referred_clients").delete().eq("id", id);
    onRefresh();
  }

  async function togglePaymentPaid(payment) {
    await sb.from("referred_client_payments").update({ paid: !payment.paid }).eq("id", payment.id);
    onRefresh();
  }

  async function deletePayment(id) {
    await sb.from("referred_client_payments").delete().eq("id", id);
    onRefresh();
  }

  async function saveManualTxn(ref) {
    if (!txnForm.amount || isNaN(Number(txnForm.amount)) || Number(txnForm.amount) <= 0) return;
    setSavingTxn(true);
    await sb.from("transactions").insert({
      id:           "manual_ref_" + ref.id + "_" + Date.now(),
      type:         "income",
      category:     "SaaS MRR",
      amount:       Number(txnForm.amount),
      description:  txnForm.description || ref.name,
      date:         txnForm.date,
      account_id:   "mercury",
      referrer_id:  ref.id,
      referrer_name:ref.name,
    });
    setTxnForm({amount:"", description:"", date:new Date().toISOString().split("T")[0]});
    setAddTxnFor(null);
    setSavingTxn(false);
    onRefresh();
  }

  const now=new Date(), curMK=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  // Trae los pagos de Stripe de los clientes ya registrados y los guarda en
  // referred_client_payments — completamente separado de la tabla financiera
  // (transactions). Esto es solo para calcular comisiones a pagar a los
  // referidores, no debe sumar a los números de la empresa.
  async function syncFromStripe() {
    if (!WORKER_URL) { setSyncMsg("Configurá WORKER_URL primero."); return; }
    if (referredClients.length === 0) { setSyncMsg("Registrá al menos un cliente referido primero."); return; }
    setSyncing(true); setSyncMsg("");
    try {
      const res = await fetch(WORKER_URL + "/stripe");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();

      const clientIdByEmail = {};
      referredClients.forEach(c => { clientIdByEmail[c.email.toLowerCase()] = c.id; });

      const incoming = (data.transactions || []).filter(t =>
        t.type === "income" && t.customer_email && clientIdByEmail[t.customer_email]
      );
      const existingIds = new Set(payments.map(p => p.id));
      const newPayments = incoming.filter(t => !existingIds.has(t.id)).map(t => ({
        id: t.id,
        referred_client_id: clientIdByEmail[t.customer_email],
        amount: t.amount,
        date: t.date,
        description: t.description,
      }));
      if (newPayments.length) {
        await sb.from("referred_client_payments").insert(newPayments);
        onRefresh();
        setSyncMsg(`${newPayments.length} pagos importados desde Stripe.`);
      } else {
        setSyncMsg("Todo al día — sin pagos nuevos.");
      }
    } catch(e) { setSyncMsg("Error: " + e.message); }
    setSyncing(false);
  }

  // Comisiones ya pagadas al referidor (registro manual vía "marcar pagado")
  const paidCommissions = txns.filter(t => t.category === "Comisiones referidos" && t.referrer_id);

  const stats = referrers.map(ref => {
    const rate = (ref.commission_rate || 20) / 100;
    const paid = paidCommissions.filter(t => t.referrer_id === ref.id);
    const totalPaid = paid.reduce((s,t) => s + Number(t.amount), 0);

    // Clientes registrados con sus pagos de Stripe (tabla separada
    // referred_client_payments, no la tabla financiera) — fuente real de los
    // totales del referidor, ya que no depende de la metadata de Stripe.
    const registeredClients = referredClients.filter(c => c.referrer_id === ref.id).map(c => {
      const clientTxns = payments.filter(p => p.referred_client_id === c.id).map(p => ({ ...p, clientName: c.name }));
      const total        = clientTxns.reduce((s,t) => s + Number(t.amount), 0);
      const clientPaid   = clientTxns.filter(t => t.paid).reduce((s,t) => s + Number(t.amount), 0);
      const totalPending = total - clientPaid;
      return {
        ...c,
        transactions: clientTxns.slice().sort((a,b) => b.date.localeCompare(a.date)),
        revenue: total,
        total, totalPaid: clientPaid, totalPending,
        commission: total * rate,
      };
    });

    const allClientPayments = registeredClients.flatMap(c => c.transactions);
    const totalRevenue    = allClientPayments.reduce((s,t) => s + Number(t.amount), 0);
    const totalCommission = totalRevenue * rate;
    const totalOwed       = Math.max(0, totalCommission - totalPaid);

    // Per-month breakdown, a partir de los pagos de los clientes registrados
    const months = {};
    allClientPayments.forEach(t => {
      const mk = monthKey(t.date);
      if (!months[mk]) months[mk] = { revenue:0, commission:0, paid:0, transactions:[] };
      months[mk].revenue    += Number(t.amount);
      months[mk].commission += Number(t.amount) * rate;
      months[mk].transactions.push(t);
    });
    paid.forEach(t => {
      const mk = monthKey(t.date);
      if (!months[mk]) months[mk] = { revenue:0, commission:0, paid:0, transactions:[] };
      months[mk].paid += Number(t.amount);
    });

    const curRevenue = allClientPayments.filter(t => monthKey(t.date) === curMK).reduce((s,t) => s + Number(t.amount), 0);
    return { ...ref, totalRevenue, totalCommission, totalPaid, totalOwed, months, registeredClients,
      curCommission: curRevenue * rate, activeBrokers: registeredClients.length };
  }).sort((a,b) => b.totalOwed - a.totalOwed);

  const totalOwedNow = stats.reduce((s,r) => s + r.curCommission, 0);
  const totalOwedAll = stats.reduce((s,r) => s + r.totalOwed, 0);
  const totalPaidAll = stats.reduce((s,r) => s + r.totalPaid, 0);

  async function markPaid(ref, mk, amount, paymentIds) {
    await sb.from("transactions").insert({
      id: "pay_"+ref.id+"_"+mk+"_"+Date.now(), type:"expense",
      category:"Comisiones referidos", amount: Math.round(amount*100)/100,
      description: `Comisión ${ref.name} — ${monthLabel(mk)}`,
      date: mk+"-01", // fecha dentro del mes que se marca, no la de hoy —
      // si no, el pago se contaba en el mes de hoy en vez del mes elegido
      account_id:"mercury", referrer_id:ref.id, referrer_name:ref.name, paid:true,
    });
    if (paymentIds?.length) {
      await sb.from("referred_client_payments").update({ paid: true }).in("id", paymentIds);
    }
    onRefresh();
  }

  async function saveReferrer() {
    if (!newRef.id.trim() || !newRef.name.trim()) return;
    await sb.from("referrers").insert({ id:newRef.id.trim(), name:newRef.name.trim(), email:newRef.email, commission_rate:newRef.commission_rate });
    setNewRef({id:"",name:"",email:"",commission_rate:20}); setShowAdd(false); onRefresh();
  }

  async function updateRate(id, rate) {
    await sb.from("referrers").update({ commission_rate: rate }).eq("id", id);
    onRefresh();
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div style={{ fontSize:20, fontWeight:700, color:"#111" }}>Referidos</div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {syncMsg && <span style={{ fontSize:12, color: syncMsg.startsWith("Error") ? ST_RED : "#16A34A", fontWeight:500 }}>{syncMsg}</span>}
          {WORKER_URL && <button onClick={syncFromStripe} disabled={syncing} className="spicy-btn-primary" style={{ fontSize:13, padding:"7px 16px" }}>
            {syncing ? "Sincronizando…" : "⟳ Sync desde Stripe"}
          </button>}
        </div>
      </div>

      {/* Info box: cómo configurar Stripe */}
      {referrers.length > 0 && (
        <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:10, padding:"12px 16px", marginBottom:20, fontSize:12, color:"#166534", lineHeight:1.7 }}>
          Para que un broker quede asociado a un referidor, editá el customer en Stripe → Metadata → agregar:<br/>
          <code style={{ fontFamily:"monospace" }}>referrer_id: socio_id</code> · <code style={{ fontFamily:"monospace" }}>referrer_name: Nombre del socio</code>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 }}>
        {[
          { label:"A pagar este mes", value:fmtDec(totalOwedNow), warn:totalOwedNow>0 },
          { label:"Deuda acumulada",  value:fmtDec(totalOwedAll),  warn:totalOwedAll>0 },
          { label:"Pagado historial", value:fmtDec(totalPaidAll) },
        ].map(k=>(
          <div key={k.label} className="spicy-kpi">
            <div className="spicy-kpi-label">{k.label}</div>
            <div className="spicy-kpi-value" style={{ color:k.warn?"#D97706":"#111" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Lista de socios */}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {stats.length === 0 && (
          <div className="spicy-card" style={{ textAlign:"center", padding:"2rem" }}>
            <div style={{ fontSize:13, color:"#aaa", marginBottom:12 }}>No hay socios registrados.</div>
            {isAdmin && <button className="spicy-btn-primary" onClick={()=>setShowAdd(true)}>+ Agregar socio</button>}
          </div>
        )}

        {stats.map(ref=>(
          <div key={ref.id} className="spicy-card" style={{ padding:0, overflow:"hidden" }}>
            <div onClick={()=>setExpanded(expanded===ref.id?null:ref.id)}
              style={{ display:"flex", alignItems:"center", gap:12, padding:"16px 20px", cursor:"pointer" }}>
              <div style={{ width:38,height:38,borderRadius:"50%",background:ST_RED_BG,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:ST_RED,flexShrink:0 }}>
                {ref.name.split(" ").map(w=>w[0]).slice(0,2).join("")}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600, color:"#111" }}>{ref.name}</div>
                <div style={{ fontSize:11, color:"#aaa", marginTop:2, display:"flex", alignItems:"center", gap:8 }}>
                  <span>{ref.email}</span>
                  {isAdmin ? (
                    <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                      · comisión:
                      <input type="number" value={ref.commission_rate} min="1" max="100"
                        onClick={e=>e.stopPropagation()}
                        onChange={e=>updateRate(ref.id, Number(e.target.value))}
                        style={{ width:44, fontSize:11, padding:"1px 4px", borderRadius:5, border:"1px solid #E0E0E0", textAlign:"center", fontFamily:"DM Sans,sans-serif" }}/>%
                    </span>
                  ) : <span>· {ref.commission_rate}%</span>}
                  <span>· {ref.activeBrokers} brokers</span>
                </div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:ref.totalOwed>0?"#D97706":"#16A34A" }}>
                  {ref.totalOwed>0 ? `Debo ${fmtDec(ref.totalOwed)}` : "Al día ✓"}
                </div>
                <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>este mes: {fmtDec(ref.curCommission)}</div>
              </div>
              <span style={{ fontSize:12, color:"#ccc" }}>{expanded===ref.id?"▲":"▼"}</span>
            </div>

            {expanded===ref.id&&(
              <div style={{ borderTop:"1px solid #F3F3F3", padding:"16px 20px" }}>

                {/* Summary KPIs */}
                <div style={{ display:"flex", gap:10, marginBottom:20 }}>
                  {[
                    {label:"Generado",  value:fmtDec(ref.totalRevenue)},
                    {label:"Comisión",  value:fmtDec(ref.totalCommission)},
                    {label:"Pagado",    value:fmtDec(ref.totalPaid)},
                    {label:"Pendiente", value:fmtDec(ref.totalOwed), warn:ref.totalOwed>0},
                  ].map(s=>(
                    <div key={s.label} className="spicy-kpi" style={{ flex:1, padding:"10px 12px" }}>
                      <div className="spicy-kpi-label">{s.label}</div>
                      <div style={{ fontSize:15, fontWeight:700, color:s.warn?"#D97706":"#111" }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Por mes */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#555", textTransform:"uppercase", letterSpacing:0.5 }}>Por mes</div>
                  {isAdmin && (
                    <button onClick={e=>{e.stopPropagation(); setAddTxnFor(addTxnFor===ref.id?null:ref.id); setTxnForm({amount:"",description:"",date:new Date().toISOString().split("T")[0]});}}
                      style={{ fontSize:12, padding:"4px 12px", borderRadius:7, cursor:"pointer", background:addTxnFor===ref.id?ST_RED_BG:"white", color:addTxnFor===ref.id?ST_RED:"#555", border:`1px solid ${addTxnFor===ref.id?ST_RED:"#E0E0E0"}`, fontWeight:600 }}>
                      {addTxnFor===ref.id ? "Cancelar" : "+ Agregar transacción"}
                    </button>
                  )}
                </div>

                {/* Form para transacción manual */}
                {isAdmin && addTxnFor===ref.id && (
                  <div style={{ background:"#F9F9F9", border:"1px solid #E8E8E8", borderRadius:10, padding:"14px 16px", marginBottom:16 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#111", marginBottom:12 }}>Nueva transacción para {ref.name}</div>
                    <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                      <div style={{ flex:1, minWidth:100 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:"#555", marginBottom:5, textTransform:"uppercase", letterSpacing:0.5 }}>Monto (USD)</div>
                        <input className="spicy-input" type="number" value={txnForm.amount} placeholder="0.00"
                          onChange={e=>setTxnForm(f=>({...f,amount:e.target.value}))} style={{ fontSize:13 }}/>
                      </div>
                      <div style={{ flex:2, minWidth:160 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:"#555", marginBottom:5, textTransform:"uppercase", letterSpacing:0.5 }}>Descripción</div>
                        <input className="spicy-input" value={txnForm.description} placeholder="Broker, empresa, etc."
                          onChange={e=>setTxnForm(f=>({...f,description:e.target.value}))} style={{ fontSize:13 }}/>
                      </div>
                      <div style={{ flex:1, minWidth:130 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:"#555", marginBottom:5, textTransform:"uppercase", letterSpacing:0.5 }}>Fecha</div>
                        <input className="spicy-input" type="date" value={txnForm.date}
                          onChange={e=>setTxnForm(f=>({...f,date:e.target.value}))} style={{ fontSize:13 }}/>
                      </div>
                      <div style={{ display:"flex", alignItems:"flex-end" }}>
                        <button onClick={()=>saveManualTxn(ref)} disabled={!txnForm.amount||savingTxn} className="spicy-btn-primary"
                          style={{ padding:"9px 18px", fontSize:13, whiteSpace:"nowrap" }}>
                          {savingTxn ? "Guardando…" : "Guardar"}
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize:11, color:"#aaa", marginTop:8 }}>
                      Se registra como ingreso SaaS MRR en Mercury, asociado a {ref.name}.
                    </div>
                  </div>
                )}

                {Object.keys(ref.months).length===0 && !addTxnFor && <div style={{ fontSize:13, color:"#bbb", marginBottom:16 }}>Sin transacciones. Sincronizá desde Stripe o agregá manualmente.</div>}
                {Object.entries(ref.months).sort(([a],[b])=>b.localeCompare(a)).map(([mk,m])=>{
                  const rate = (ref.commission_rate || 20) / 100;
                  const pendingTxns = (m.transactions||[]).filter(t => !t.paid);
                  const pendingAmount = pendingTxns.reduce((s,t) => s + Number(t.amount), 0) * rate;
                  const isMonthPaid = pendingTxns.length === 0;
                  return (
                    <div key={mk} style={{ marginBottom:8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", background:"#F9F9F9", borderRadius:8 }}>
                        <div style={{ flex:1, fontSize:13, fontWeight:600 }}>{monthLabel(mk)}</div>
                        <div style={{ fontSize:12, color:"#888" }}>Rev {fmtDec(m.revenue)}</div>
                        <div style={{ fontSize:13, fontWeight:700 }}>{fmtDec(m.commission)}</div>
                        <div>
                          {isMonthPaid
                            ? <span className="spicy-badge-green">pagado ✓</span>
                            : isAdmin && <button onClick={()=>markPaid(ref,mk,pendingAmount,pendingTxns.map(t=>t.id))} style={{ fontSize:11, padding:"4px 12px", borderRadius:6, cursor:"pointer", background:"#FEF3C7", color:"#92400E", border:"1px solid #FCD34D", fontWeight:600 }}>marcar pagado {fmtDec(pendingAmount)}</button>
                          }
                        </div>
                      </div>
                      {/* Individual transactions in this month */}
                      {m.transactions?.map(t=>(
                        <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 12px 7px 24px", borderBottom:"1px solid #F3F3F3", fontSize:12 }}>
                          <div style={{ width:6, height:6, borderRadius:"50%", background:"#1D9E75", flexShrink:0 }}/>
                          <div style={{ flex:1, color:"#555" }}>{t.description||"—"}{t.clientName&&<span style={{ color:"#aaa" }}> ({t.clientName})</span>}</div>
                          <div style={{ color:"#888" }}>{t.date}</div>
                          <div style={{ fontWeight:600, color:"#111" }}>{fmtDec(Number(t.amount))}</div>
                          <div style={{ color:"#aaa", minWidth:70, textAlign:"right" }}>com: {fmtDec(Number(t.amount)*(ref.commission_rate||20)/100)}</div>
                          {t.paid
                            ? <span className="spicy-badge-green">pagada ✓</span>
                            : <span style={{ fontSize:10,padding:"2px 7px",borderRadius:5,fontWeight:600,background:"#FEF3C7",color:"#92400E" }}>pendiente</span>}
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* Clientes referidos (registrados a mano, matcheados por email con Stripe) */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", margin:"20px 0 10px" }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#555", textTransform:"uppercase", letterSpacing:0.5 }}>Clientes referidos</div>
                  {isAdmin && (
                    <button onClick={e=>{e.stopPropagation(); setAddClientFor(addClientFor===ref.id?null:ref.id); setClientForm({name:"",email:""});}}
                      style={{ fontSize:12, padding:"4px 12px", borderRadius:7, cursor:"pointer", background:addClientFor===ref.id?ST_RED_BG:"white", color:addClientFor===ref.id?ST_RED:"#555", border:`1px solid ${addClientFor===ref.id?ST_RED:"#E0E0E0"}`, fontWeight:600 }}>
                      {addClientFor===ref.id ? "Cancelar" : "+ Agregar cliente"}
                    </button>
                  )}
                </div>

                {isAdmin && addClientFor===ref.id && (
                  <div style={{ background:"#F9F9F9", border:"1px solid #E8E8E8", borderRadius:10, padding:"14px 16px", marginBottom:16 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#111", marginBottom:12 }}>Nuevo cliente referido por {ref.name}</div>
                    <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                      <div style={{ flex:1, minWidth:140 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:"#555", marginBottom:5, textTransform:"uppercase", letterSpacing:0.5 }}>Nombre</div>
                        <input className="spicy-input" value={clientForm.name} placeholder="Nombre del cliente"
                          onChange={e=>setClientForm(f=>({...f,name:e.target.value}))} style={{ fontSize:13 }}/>
                      </div>
                      <div style={{ flex:1, minWidth:160 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:"#555", marginBottom:5, textTransform:"uppercase", letterSpacing:0.5 }}>Email (el que usa en Stripe)</div>
                        <input className="spicy-input" type="email" value={clientForm.email} placeholder="cliente@empresa.com"
                          onChange={e=>setClientForm(f=>({...f,email:e.target.value}))} style={{ fontSize:13 }}/>
                      </div>
                      <div style={{ display:"flex", alignItems:"flex-end" }}>
                        <button onClick={()=>saveClient(ref)} disabled={!clientForm.name||!clientForm.email||savingClient} className="spicy-btn-primary"
                          style={{ padding:"9px 18px", fontSize:13, whiteSpace:"nowrap" }}>
                          {savingClient ? "Guardando…" : "Guardar"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {ref.registeredClients?.length === 0 && !addClientFor && (
                  <div style={{ fontSize:13, color:"#bbb", marginBottom:8 }}>Sin clientes registrados todavía.</div>
                )}

                {ref.registeredClients?.map(c=>(
                  <div key={c.id} style={{ background:"#F9F9F9", border:"1px solid #F0F0F0", borderRadius:8, marginBottom:8, overflow:"hidden" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px" }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:"#111" }}>{c.name}</div>
                        <div style={{ fontSize:11, color:"#aaa" }}>{c.email}</div>
                      </div>
                      <div style={{ fontSize:12, color:"#888" }}>{c.transactions.length} pago{c.transactions.length!==1?"s":""}</div>
                      {isAdmin && (
                        <button onClick={()=>deleteClient(c.id)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#ccc",padding:"0 2px",lineHeight:1 }}>×</button>
                      )}
                    </div>

                    <div style={{ display:"flex", gap:8, padding:"0 12px 10px" }}>
                      {[
                        { label:"Total",    value:c.total },
                        { label:"Pagado",   value:c.totalPaid },
                        { label:"A pagar",  value:c.totalPending, warn:c.totalPending>0 },
                        { label:`Comisión ${ref.commission_rate||20}%`, value:c.commission },
                      ].map(s=>(
                        <div key={s.label} style={{ flex:1, background:"white", border:"1px solid #F0F0F0", borderRadius:6, padding:"6px 8px" }}>
                          <div style={{ fontSize:10, color:"#aaa", textTransform:"uppercase", letterSpacing:0.3 }}>{s.label}</div>
                          <div style={{ fontSize:13, fontWeight:700, color:s.warn?"#D97706":"#111" }}>{fmtDec(s.value)}</div>
                        </div>
                      ))}
                    </div>

                    {c.transactions.map(t=>(
                      <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 12px 7px 24px", borderTop:"1px solid #F0F0F0", fontSize:12 }}>
                        <div style={{ flex:1, color:"#555" }}>{t.description||"—"}</div>
                        <div style={{ color:"#888" }}>{t.date}</div>
                        <div style={{ fontWeight:600, color:"#111" }}>{fmtDec(Number(t.amount))}</div>
                        {isAdmin ? (
                          <button onClick={()=>togglePaymentPaid(t)}
                            className={t.paid ? "spicy-badge-green" : ""}
                            style={t.paid ? { border:"none",cursor:"pointer" } : { fontSize:10,padding:"2px 7px",borderRadius:5,fontWeight:600,cursor:"pointer",background:"#FEF3C7",color:"#92400E",border:"1px solid #FCD34D" }}>
                            {t.paid ? "pagada ✓" : "pendiente"}
                          </button>
                        ) : (
                          <span className={t.paid ? "spicy-badge-green" : ""} style={t.paid ? {} : { fontSize:10,padding:"2px 7px",borderRadius:5,fontWeight:600,background:"#FEF3C7",color:"#92400E" }}>
                            {t.paid ? "pagada ✓" : "pendiente"}
                          </span>
                        )}
                        {isAdmin && (
                          <button onClick={()=>deletePayment(t.id)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:15,color:"#ccc",padding:"0 2px",lineHeight:1 }}>×</button>
                        )}
                      </div>
                    ))}
                    {c.transactions.length === 0 && (
                      <div style={{ padding:"7px 12px 7px 24px", fontSize:12, color:"#bbb", borderTop:"1px solid #F0F0F0" }}>Sin pagos todavía.</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {isAdmin && (showAdd ? (
          <div className="spicy-card">
            <div style={{ fontSize:15, fontWeight:700, color:"#111", marginBottom:16 }}>Nuevo socio referidor</div>
            {[{label:"ID único",field:"id",placeholder:"socio_felipe"},{label:"Nombre",field:"name",placeholder:"Felipe"},{label:"Email",field:"email",placeholder:"felipe@stoke.agency"}].map(row=>(
              <div key={row.field} style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#555", marginBottom:6, textTransform:"uppercase", letterSpacing:0.5 }}>{row.label}</div>
                <input className="spicy-input" value={newRef[row.field]} placeholder={row.placeholder} onChange={e=>setNewRef(f=>({...f,[row.field]:e.target.value}))}/>
              </div>
            ))}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:600, color:"#555", marginBottom:6, textTransform:"uppercase", letterSpacing:0.5 }}>Comisión (%)</div>
              <input className="spicy-input" type="number" value={newRef.commission_rate} min="1" max="100" onChange={e=>setNewRef(f=>({...f,commission_rate:Number(e.target.value)}))}/>
            </div>
            <div style={{ background:"#F0FDF4", borderRadius:8, padding:"10px 12px", fontSize:12, color:"#166534", marginBottom:16, lineHeight:1.7 }}>
              En Stripe, al customer que refirió agregá:<br/>
              <code style={{ fontFamily:"monospace" }}>referrer_id: {newRef.id||"socio_id"}</code><br/>
              <code style={{ fontFamily:"monospace" }}>referrer_name: {newRef.name||"Nombre"}</code>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="spicy-btn-secondary" onClick={()=>setShowAdd(false)} style={{ flex:1 }}>Cancelar</button>
              <button className="spicy-btn-primary" onClick={saveReferrer} style={{ flex:2 }}>Guardar socio</button>
            </div>
          </div>
        ) : (
          <button onClick={()=>setShowAdd(true)} style={{ width:"100%", padding:"11px", borderRadius:10, fontSize:13, cursor:"pointer", border:"2px dashed #E0E0E0", background:"transparent", color:"#888", fontWeight:500, fontFamily:"DM Sans,sans-serif" }}>
            + Agregar socio referidor
          </button>
        ))}
      </div>
    </div>
  );
}

// ── CSV Parser (sin Supabase, solo parsea rows) ────────────────────────────
// ── Constante de movimiento de cuenta ─────────────────────────────────────
const MOVIMIENTO_CUENTA = "Movimiento Cuenta";

// Detecta si una fila de Mercury es un movimiento de cuenta (a omitir)
function isCuentaTransfer(desc, mercuryCat, category) {
  const d  = (desc||"").toLowerCase();
  const mc = (mercuryCat||"").toLowerCase();
  const c  = (category||"").toLowerCase();
  return mc === "transfer" || c === "transfer" ||
    d.includes("transfer between your mercury") ||
    d.includes("mercury savings") ||
    d.includes("mercury checking");
}

// Auto-categorización basada en datos reales del CSV de SpicyTool
function autoCategory(desc, type, mercuryCat="", mercuryManualCat="") {
  const d  = (desc||"").toLowerCase();
  const mc = (mercuryCat||"").toLowerCase();
  const c  = (mercuryManualCat||"").toLowerCase();

  if (type === "income") {
    if (c === "revenue" || d.includes("stripe") || d.includes("spicy house") || d.includes("spicytool")) return "SaaS MRR";
    if (d.includes("invest") || d.includes("capital") || d.includes("fund")) return "Inversión";
    return "Otro ingreso";
  }

  // Salarios
  if (mc === "payroll" || c === "payroll" || c === "employee benefits") return "Salarios";
  if (["franco cabrera","lucas escobedo","marcela c borner","payoneer"].some(n => d.includes(n))) return "Salarios";

  // SaaS Tools
  if (mc === "software" || c === "software & subscriptions") return "SaaS Tools";
  if (["github","notion","openai","mongodb","google cloud","nango","make","n8n","mailersend","gupshup",
       "brizy","asana","leomoves","paypro","cloudflare","vercel","aws","heroku","figma","linear",
       "slack","anthropic","kapso"].some(t => d.includes(t))) return "SaaS Tools";

  // Marketing
  if (mc === "advertising" || ["facebook","meta","cf*tks"].some(t => d.includes(t))) return "Marketing / Ads";

  // Legal / Admin
  if (mc === "financialinstitutionsandfees" || c === "bank fees" ||
      d.includes("intl. transaction fee") || d.includes("casa manantial")) return "Legal / Admin";

  // Viajes
  if (["othertravel","groundtransportation","fuelandgas"].includes(mc) || c === "travel & transportation" ||
      ["plataforma 10","axion","uber","lyft","airbnb","victorian govern"].some(t => d.includes(t))) return "Viajes";

  return "Otro gasto";
}

function parseCSVRows(text, defaultAccountId) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const rawCols = lines[0].split(",").map(c => c.trim().replace(/^"|"$/g,""));
  const cols = rawCols.map(c => c.toLowerCase());
  const isMercury = cols.some(c => c.includes("mercury category")) ||
    (cols.includes("amount") && cols.includes("status") && cols.includes("description"));
  const isStripe = cols.some(c => c.includes("created (utc)")) ||
    (cols.includes("net") && cols.includes("fee"));
  if (!isMercury && !isStripe) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { values.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    values.push(cur.trim());
    const get = (key) => {
      const idx = cols.findIndex(c => c.includes(key));
      return idx >= 0 ? (values[idx]||"").replace(/^"|"$/g,"").trim() : "";
    };

    if (isMercury) {
      const status = get("status").toLowerCase();
      if (status === "pending" || status === "failed") continue;

      const rawDate   = get("date");
      const rawAmount = parseFloat(get("amount").replace(/,/g,"")) || 0;
      if (!rawDate || rawAmount === 0) continue;

      const desc       = get("description") || get("bank description");
      const mercuryCat = get("mercury category");
      const manualCat  = get("category");

      // Omitir transferencias internas
      if (isCuentaTransfer(desc, mercuryCat, manualCat)) continue;

      const type = rawAmount > 0 ? "income" : "expense";
      rows.push({
        id: "merc_" + rawDate.split("T")[0] + "_" + Math.abs(rawAmount).toFixed(2) + "_" + desc.slice(0,30).toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,""),
        type,
        amount:      Math.abs(rawAmount),
        description: desc,
        category:    autoCategory(desc, type, mercuryCat, manualCat),
        date:        rawDate.split("T")[0],
        source:      "mercury",
        account_id:  "mercury",
      });
    } else {
      // Stripe
      const rawDate = get("created (utc)") || get("created");
      const rawNet  = parseFloat(get("net").replace(/,/g,"")) || 0;
      const txType  = get("type").toLowerCase();
      const desc    = get("description") || get("source");
      if (!rawDate || txType === "payout") continue;
      const type = rawNet < 0 ? "expense" : "income";
      rows.push({
        id: "str_" + rawDate.split(" ")[0] + "_" + Math.abs(rawNet).toFixed(2) + "_" + desc.slice(0,30).toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,""),
        type,
        amount:      Math.abs(rawNet),
        description: desc,
        category:    autoCategory(desc, type),
        date:        rawDate.split(" ")[0],
        source:      "stripe",
        account_id:  defaultAccountId || "mercury",
      });
    }
  }
  return rows;
}

// ── History View ───────────────────────────────────────────────────────────
function HistoryView({ txns, accounts, catsIncome, catsExpense, filterType, setFilterType,
  filterAcc, setFilterAcc, isAdmin, updateCategory, deleteTxn, deleteMany, sourceBadge,
  invoiceBadge, uploadInvoice, viewInvoice }) {

  const [selected,    setSelected]    = useState({});
  const [deleting,    setDeleting]    = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterCat,   setFilterCat]   = useState("all");
  const [page,        setPage]        = useState(1);
  const [uploadingId, setUploadingId] = useState(null);
  const invoiceInputRef = useRef(null);
  const uploadTargetId  = useRef(null);
  const PAGE_SIZE = 25;

  async function handleInvoiceFile(e) {
    const file = e.target.files[0];
    const txnId = uploadTargetId.current;
    e.target.value = "";
    if (!file || !txnId) return;
    if (file.type !== "application/pdf") { alert("Solo se permiten archivos PDF."); return; }
    setUploadingId(txnId);
    await uploadInvoice(txnId, file);
    setUploadingId(null);
  }

  const allCats = [...catsIncome, ...catsExpense];
  const availableMonths = [...new Set(txns.map(t => monthKey(t.date)))].sort((a,b) => b.localeCompare(a));

  const filtered = txns.filter(t =>
    (filterType  === "all" || t.type        === filterType)  &&
    (filterAcc   === "all" || t.account_id  === filterAcc)   &&
    (filterMonth === "all" || monthKey(t.date) === filterMonth) &&
    (filterCat   === "all" || t.category    === filterCat)
  );

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage    = Math.min(page, totalPages);
  const visibleTxns = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedIds = Object.entries(selected).filter(([,v])=>v).map(([id])=>id);
  const allSelected = visibleTxns.length > 0 && visibleTxns.every(t => selected[t.id]);

  function toggleAll() {
    if (allSelected) setSelected({});
    else { const s={}; visibleTxns.forEach(t=>s[t.id]=true); setSelected(s); }
  }

  async function handleDeleteSelected() {
    setDeleting(true);
    await deleteMany(selectedIds);
    setSelected({}); setConfirmBulk(false); setDeleting(false);
  }

  useEffect(() => { setPage(1); setSelected({}); }, [filterType, filterAcc, filterMonth, filterCat]);

  return (
    <>
      <div style={{ fontSize:20,fontWeight:700,color:"#111",marginBottom:20 }}>Historial</div>

      <div style={{ display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center" }}>
        {[["all","Todos"],["income","Ingresos"],["expense","Egresos"]].map(([f,l])=>(
          <button key={f} onClick={()=>setFilterType(f)} style={{ fontSize:12,padding:"6px 14px",borderRadius:8,fontWeight:600,cursor:"pointer",border:"2px solid",borderColor:filterType===f?ST_RED:"#E0E0E0",background:filterType===f?ST_RED_BG:"white",color:filterType===f?ST_RED:"#888" }}>{l}</button>
        ))}
        <select value={filterAcc} onChange={e=>setFilterAcc(e.target.value)} className="spicy-select">
          <option value="all">Todas las cuentas</option>
          {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="spicy-select">
          <option value="all">Todos los meses</option>
          {availableMonths.map(mk=><option key={mk} value={mk}>{monthLabel(mk)}</option>)}
        </select>
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} className="spicy-select">
          <option value="all">Todas las categorías</option>
          {allCats.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <span style={{ marginLeft:"auto",fontSize:12,color:"#aaa",fontWeight:500 }}>{filtered.length} registros</span>
      </div>

      {isAdmin && selectedIds.length > 0 && (
        <div style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 16px",background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:10,marginBottom:12 }}>
          <span style={{ fontSize:13,fontWeight:600,color:"#92400E" }}>{selectedIds.length} seleccionada{selectedIds.length!==1?"s":""}</span>
          <button onClick={()=>setSelected({})} style={{ fontSize:12,color:"#92400E",background:"none",border:"none",cursor:"pointer",textDecoration:"underline" }}>Deseleccionar</button>
          <div style={{ marginLeft:"auto" }}>
            {confirmBulk ? (
              <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                <span style={{ fontSize:12,color:"#92400E",fontWeight:500 }}>¿Eliminar {selectedIds.length}?</span>
                <button onClick={handleDeleteSelected} disabled={deleting} style={{ fontSize:12,padding:"5px 14px",borderRadius:7,cursor:"pointer",background:ST_RED,color:"white",border:"none",fontWeight:600 }}>{deleting?"Eliminando…":"Sí, eliminar"}</button>
                <button onClick={()=>setConfirmBulk(false)} style={{ fontSize:12,padding:"5px 12px",borderRadius:7,cursor:"pointer",background:"white",color:"#555",border:"1px solid #E0E0E0" }}>Cancelar</button>
              </div>
            ) : (
              <button onClick={()=>setConfirmBulk(true)} style={{ fontSize:12,padding:"6px 16px",borderRadius:7,cursor:"pointer",background:ST_RED,color:"white",border:"none",fontWeight:600 }}>Eliminar seleccionadas</button>
            )}
          </div>
        </div>
      )}

      <div className="spicy-card" style={{ padding:0,overflow:"hidden" }}>
        {isAdmin && visibleTxns.length > 0 && (
          <div style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 20px",borderBottom:"1px solid #F3F3F3",background:"#FAFAFA" }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor:"pointer",width:15,height:15,accentColor:ST_RED }}/>
            <span style={{ fontSize:11,color:"#aaa",fontWeight:500 }}>{allSelected?"Deseleccionar todas":"Seleccionar todas"}</span>
          </div>
        )}
        {visibleTxns.length===0 && <div style={{ padding:"2rem",textAlign:"center",fontSize:13,color:"#bbb" }}>Sin movimientos.</div>}
        {visibleTxns.map((t,i)=>{
          const acc  = accounts.find(a=>a.id===t.account_id);
          const cats = t.type==="income" ? catsIncome : catsExpense;
          const isChecked = !!selected[t.id];
          return (
            <div key={t.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 20px",borderBottom:i<visibleTxns.length-1?"1px solid #F3F3F3":"none",background:isChecked?"#FFF7ED":"transparent",transition:"background 0.1s" }}>
              {isAdmin && (
                <input type="checkbox" checked={isChecked}
                  onChange={e=>setSelected(s=>({...s,[t.id]:e.target.checked}))}
                  style={{ cursor:"pointer",width:15,height:15,accentColor:ST_RED,flexShrink:0 }}/>
              )}
              <div style={{ width:9,height:9,borderRadius:"50%",flexShrink:0,background:t.type==="income"?"#1D9E75":ST_RED }}/>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:13,fontWeight:600,color:"#111",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{t.description||t.category}{sourceBadge(t)}{invoiceBadge(t)}</div>
                <div style={{ fontSize:11,color:"#aaa",marginTop:3,display:"flex",alignItems:"center",gap:6 }}>
                  {isAdmin ? (
                    <select value={t.category} onChange={e=>updateCategory(t.id,e.target.value)}
                      style={{ fontSize:11,padding:"1px 6px",borderRadius:5,border:"1px solid #E0E0E0",background:"#F7F7F8",color:"#666",cursor:"pointer",fontFamily:"DM Sans,sans-serif" }}>
                      {cats.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  ) : <span>{t.category}</span>}
                  <span>· {t.date}</span>
                  {acc&&<span>· <span style={{ color:acc.color,fontWeight:600 }}>{acc.name}</span></span>}
                </div>
              </div>
              <div style={{ fontSize:14,fontWeight:700,color:t.type==="income"?"#16A34A":ST_RED,flexShrink:0 }}>{t.type==="income"?"+":"−"}{fmt(t.amount)}</div>
              {t.invoice_path && (
                <button onClick={()=>viewInvoice(t.invoice_path)} title="Ver / descargar factura" style={{ background:"none",border:"none",cursor:"pointer",fontSize:15,color:"#888",padding:"0 4px",lineHeight:1,flexShrink:0 }}>⬇</button>
              )}
              {isAdmin && (
                <button onClick={()=>{ uploadTargetId.current=t.id; invoiceInputRef.current.click(); }} disabled={uploadingId===t.id}
                  title={t.invoice_path?"Reemplazar factura":"Subir factura"} style={{ background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#ccc",padding:"0 4px",lineHeight:1,flexShrink:0 }}>{uploadingId===t.id?"…":"📎"}</button>
              )}
              {isAdmin && (
                <button onClick={()=>deleteTxn(t.id)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#ccc",padding:"0 4px",lineHeight:1 }}>×</button>
              )}
            </div>
          );
        })}
      </div>
      {isAdmin && (
        <input type="file" accept="application/pdf" ref={invoiceInputRef} style={{ display:"none" }} onChange={handleInvoiceFile}/>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:16 }}>
          <button onClick={()=>setPage(1)} disabled={safePage===1} className="spicy-btn-secondary" style={{ padding:"5px 10px",fontSize:12 }}>«</button>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={safePage===1} className="spicy-btn-secondary" style={{ padding:"5px 12px",fontSize:12 }}>‹ Ant</button>
          <span style={{ fontSize:13,color:"#555",fontWeight:500,padding:"0 8px" }}>
            Pág {safePage} de {totalPages}
          </span>
          <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={safePage===totalPages} className="spicy-btn-secondary" style={{ padding:"5px 12px",fontSize:12 }}>Sig ›</button>
          <button onClick={()=>setPage(totalPages)} disabled={safePage===totalPages} className="spicy-btn-secondary" style={{ padding:"5px 10px",fontSize:12 }}>»</button>
        </div>
      )}
    </>
  );
}

// ── Runway Projection ─────────────────────────────────────────────────────
function PnLView({ txns }) {
  const ST_ORANGE = "#FF6B35";
  const now = new Date();

  // Solo Mercury, sin movimientos entre cuentas — consistente con el resto del back office
  const mercuryTxns = txns.filter(t => t.account_id === "mercury" && t.category !== MOVIMIENTO_CUENTA);

  // Últimos 6 meses como columnas
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`, label: MONTH_LABELS[d.getMonth()], year: d.getFullYear() };
  });

  // Suma de un conjunto de categorías (gasto) para un mes
  const sumCats = (mk, cats) => mercuryTxns
    .filter(t => t.type === "expense" && cats.includes(t.category) && monthKey(t.date) === mk)
    .reduce((s, t) => s + Number(t.amount), 0);

  // Suma de ingresos de una categoría para un mes
  const sumIncome = (mk, cat) => mercuryTxns
    .filter(t => t.type === "income" && t.category === cat && monthKey(t.date) === mk)
    .reduce((s, t) => s + Number(t.amount), 0);

  // Definición de filas de gasto
  const expenseRows = [
    { label: "Personnel expenses",  cats: ["Salarios"] },
    { label: "Technical & platform", cats: ["SaaS Tools", "Infraestructura"] },
    { label: "Comercial",           cats: ["Marketing / Ads"] },
    { label: "Comisiones",          cats: ["Comisiones referidos", "Comisiones"] },
    { label: "Créditos",            cats: ["Créditos"] },
    { label: "Others",              cats: ["Legal / Admin", "Viajes", "Otro gasto"] },
  ];

  // Cálculo por mes
  const cols = months.map(m => {
    const revenue = sumIncome(m.key, "SaaS MRR");
    const expenses = expenseRows.map(r => sumCats(m.key, r.cats));
    const totalExpenses = expenses.reduce((s, v) => s + v, 0);
    const ebitda = revenue - totalExpenses;
    return { ...m, revenue, expenses, totalExpenses, ebitda };
  });

  const cell = { padding: "10px 14px", textAlign: "right", fontSize: 13, borderBottom: "1px solid #F0F0F0", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  const labelCell = { padding: "10px 16px", textAlign: "left", fontSize: 13, borderBottom: "1px solid #F0F0F0", color: "#333", position: "sticky", left: 0, background: "white" };
  const headCell = { padding: "12px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "white", whiteSpace: "nowrap" };

  return (
    <>
      <div style={{ fontSize:20,fontWeight:700,color:"#111",marginBottom:6 }}>P&amp;L mensual</div>
      <div style={{ fontSize:13,color:"#888",marginBottom:20 }}>
        Últimos 6 meses · calculado desde transacciones (solo Mercury, sin movimientos entre cuentas)
      </div>

      <div style={{ background:"white",borderRadius:12,border:"1px solid #EBEBEB",overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ borderCollapse:"collapse",width:"100%",minWidth:640 }}>
            <thead>
              <tr style={{ background:ST_ORANGE }}>
                <th style={{ ...headCell,textAlign:"left",position:"sticky",left:0,background:ST_ORANGE }}>Concepto</th>
                {cols.map(c => (
                  <th key={c.key} style={headCell}>{c.label} {String(c.year).slice(2)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Recurring revenue */}
              <tr style={{ background:"#FFF7F3" }}>
                <td style={{ ...labelCell,fontWeight:700,color:"#111",background:"#FFF7F3" }}>Recurring revenue</td>
                {cols.map(c => <td key={c.key} style={{ ...cell,fontWeight:700,color:"#0F6E56" }}>{fmt(c.revenue)}</td>)}
              </tr>

              {/* Gastos */}
              {expenseRows.map((r, ri) => (
                <tr key={r.label}>
                  <td style={labelCell}>{r.label}</td>
                  {cols.map(c => (
                    <td key={c.key} style={{ ...cell,color:c.expenses[ri]?"#993C1D":"#BBB" }}>
                      {c.expenses[ri] ? "-"+fmt(c.expenses[ri]) : "—"}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Total expenses */}
              <tr style={{ background:"#FAFAFA" }}>
                <td style={{ ...labelCell,fontWeight:700,color:"#111",background:"#FAFAFA" }}>Total expenses</td>
                {cols.map(c => <td key={c.key} style={{ ...cell,fontWeight:700,color:"#993C1D" }}>-{fmt(c.totalExpenses)}</td>)}
              </tr>

              {/* EBITDA */}
              <tr style={{ background:ST_ORANGE+"14",borderTop:`2px solid ${ST_ORANGE}` }}>
                <td style={{ ...labelCell,fontWeight:800,color:"#111",background:"transparent",borderBottom:"none" }}>EBITDA</td>
                {cols.map(c => (
                  <td key={c.key} style={{ ...cell,fontWeight:800,borderBottom:"none",color:c.ebitda>=0?"#0F6E56":ST_RED }}>
                    {c.ebitda<0?"-"+fmt(Math.abs(c.ebitda)):fmt(c.ebitda)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ fontSize:11,color:"#AAA",marginTop:12 }}>
        Recurring revenue = SaaS MRR · Technical &amp; platform = SaaS Tools + Infraestructura · Comisiones = Comisiones referidos + Comisiones · Others = Legal / Admin + Viajes + Otro gasto · EBITDA = Recurring revenue − Total expenses
      </div>
    </>
  );
}

function RunwayView({ txns, accounts }) {
  const now = new Date();

  const mercuryTxns = txns.filter(t => t.account_id === "mercury" && t.category !== MOVIMIENTO_CUENTA);

  // Avg expense last 3 months (fixed — no growth assumption)
  const last3 = [1,2,3].map(i => {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  });
  const avgExpense = last3.reduce((s,mk) =>
    s + mercuryTxns.filter(t=>t.type==="expense"&&monthKey(t.date)===mk).reduce((a,t)=>a+Number(t.amount),0), 0) / 3;

  // Current MRR (prev month)
  const prevMK = (() => { const d=new Date(now.getFullYear(),now.getMonth()-1,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })();
  const currentMRR = mercuryTxns.filter(t=>t.category==="SaaS MRR"&&monthKey(t.date)===prevMK).reduce((s,t)=>s+Number(t.amount),0);

  // Cash from all transactions
  const calcBalances = {};
  txns.forEach(t => {
    if (!calcBalances[t.account_id]) calcBalances[t.account_id] = 0;
    calcBalances[t.account_id] += t.type==="income" ? Number(t.amount) : -Number(t.amount);
  });
  const currentCash = Object.values(calcBalances).reduce((s,v)=>s+v,0);

  const [mrrGrowthBase,  setMrrGrowthBase]  = useState(10);
  const [mrrGrowthOpt,   setMrrGrowthOpt]   = useState(20);
  const [mrrGrowthPess,  setMrrGrowthPess]  = useState(3);
  const [fundraise,      setFundraise]      = useState(0);
  const [fundraiseMonth, setFundraiseMonth] = useState(1);

  const MONTHS = 6;

  function project(mrrGrowthPct) {
    const months = [];
    let cash = currentCash;
    let mrr  = currentMRR;
    const exp = avgExpense; // fixed

    for (let i = 0; i < MONTHS; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = MONTH_LABELS[d.getMonth()] + " " + d.getFullYear();
      const injection = (i + 1 === fundraiseMonth && fundraise > 0) ? fundraise : 0;
      const netFlow = mrr - exp + injection;
      cash += netFlow;
      months.push({ label, mrr: Math.round(mrr), expense: Math.round(exp), netFlow: Math.round(netFlow), cash: Math.round(cash), injection });
      mrr = mrr * (1 + mrrGrowthPct / 100);
    }
    return months;
  }

  const scenarios = [
    { key:"opt",  label:"Optimista",  color:"#16A34A", bg:"#EDFAF3", growth:mrrGrowthOpt,  data: project(mrrGrowthOpt)  },
    { key:"base", label:"Base",       color:"#185FA5", bg:"#E6F1FB", growth:mrrGrowthBase, data: project(mrrGrowthBase) },
    { key:"pess", label:"Pesimista",  color:ST_RED,    bg:ST_RED_BG, growth:mrrGrowthPess, data: project(mrrGrowthPess) },
  ];

  function runwayMonths(data) {
    const idx = data.findIndex(m => m.cash <= 0);
    return idx === -1 ? "+6 meses" : idx === 0 ? "Este mes" : `${idx} mes${idx!==1?"es":""}`;
  }

  const allCash = [currentCash, ...scenarios.flatMap(s => s.data.map(m => m.cash))];
  const maxCash = Math.max(...allCash, 1);
  const minCash = Math.min(...allCash, 0);
  const chartH  = 160;
  function cashToY(cash) {
    const range = maxCash - minCash;
    return range > 0 ? chartH - Math.round(((cash - minCash) / range) * chartH) : chartH / 2;
  }

  // MRR needed to break even
  const breakEvenMRR = Math.round(avgExpense);

  return (
    <div>
      <div style={{ fontSize:20,fontWeight:700,color:"#111",marginBottom:4 }}>Proyección de Runway</div>
      <div style={{ fontSize:13,color:"#888",marginBottom:24 }}>6 meses · egresos fijos (promedio real últimos 3 meses Mercury)</div>

      {/* Current state */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24 }}>
        {[
          { label:"Cash actual",     value:fmt(currentCash),         sub:"desde transacciones" },
          { label:"MRR base",        value:fmt(currentMRR),          sub:monthLabel(prevMK) },
          { label:"Egreso fijo/mes", value:fmt(Math.round(avgExpense)), sub:"prom. 3 meses reales" },
          { label:"Break-even MRR",  value:fmt(breakEvenMRR),        sub:"para cubrir egresos", warn:currentMRR < breakEvenMRR },
        ].map(k=>(
          <div key={k.label} className="spicy-kpi">
            <div className="spicy-kpi-label">{k.label}</div>
            <div className="spicy-kpi-value" style={{ color:k.warn?ST_RED:"#111" }}>{k.value}</div>
            <div className="spicy-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="spicy-card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:14,fontWeight:600,color:"#111",marginBottom:16 }}>Parámetros de crecimiento MRR</div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20,marginBottom:20 }}>
          {[
            { label:"Optimista",  val:mrrGrowthOpt,  set:setMrrGrowthOpt,  color:"#16A34A" },
            { label:"Base",       val:mrrGrowthBase, set:setMrrGrowthBase, color:"#185FA5" },
            { label:"Pesimista",  val:mrrGrowthPess, set:setMrrGrowthPess, color:ST_RED },
          ].map(c=>(
            <div key={c.label}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                <span style={{ fontSize:12,fontWeight:600,color:c.color }}>{c.label}</span>
                <span style={{ fontSize:14,fontWeight:700,color:c.color }}>{c.val}%/mes</span>
              </div>
              <input type="range" min="-10" max="50" step="1" value={c.val}
                onChange={e=>c.set(Number(e.target.value))}
                style={{ width:"100%",accentColor:c.color }}/>
              <div style={{ fontSize:11,color:"#aaa",marginTop:4 }}>
                MRR mes 6: {fmt(Math.round(currentMRR * Math.pow(1 + c.val/100, 6)))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ background:"#F9F9F9",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#555",marginBottom:20 }}>
          Egresos fijos en <strong>{fmt(Math.round(avgExpense))}/mes</strong> — promedio de {last3.map(mk=>monthLabel(mk)).join(", ")}
        </div>

        {/* Fundraise */}
        <div style={{ borderTop:"1px solid #F0F0F0",paddingTop:16 }}>
          <div style={{ fontSize:13,fontWeight:600,color:"#111",marginBottom:12 }}>💰 Inyección de capital (opcional)</div>
          <div style={{ display:"flex",gap:16,alignItems:"flex-end",flexWrap:"wrap" }}>
            <div style={{ flex:2,minWidth:140 }}>
              <div style={{ fontSize:12,color:"#888",marginBottom:6 }}>Monto (USD)</div>
              <input className="spicy-input" type="number" value={fundraise||""} placeholder="0"
                onChange={e=>setFundraise(Number(e.target.value))} style={{ fontSize:13 }}/>
            </div>
            <div style={{ flex:1,minWidth:100 }}>
              <div style={{ fontSize:12,color:"#888",marginBottom:6 }}>En el mes</div>
              <select className="spicy-select" value={fundraiseMonth} onChange={e=>setFundraiseMonth(Number(e.target.value))} style={{ width:"100%",fontSize:13 }}>
                {Array.from({length:6},(_,i)=>{
                  const d=new Date(now.getFullYear(),now.getMonth()+i,1);
                  return <option key={i+1} value={i+1}>{MONTH_LABELS[d.getMonth()]} {d.getFullYear()}</option>;
                })}
              </select>
            </div>
            {fundraise > 0 && (
              <button onClick={()=>setFundraise(0)} style={{ fontSize:12,padding:"8px 14px",borderRadius:8,cursor:"pointer",border:"1px solid #E0E0E0",background:"white",color:"#888" }}>Quitar</button>
            )}
          </div>
        </div>
      </div>

      {/* Scenario cards */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20 }}>
        {scenarios.map(s=>{
          const last = s.data[s.data.length-1];
          const runway = runwayMonths(s.data);
          const endsPositive = last.cash > 0;
          const breakEvenMonth = s.data.findIndex(m => m.mrr >= avgExpense);
          return (
            <div key={s.key} style={{ background:s.bg,borderRadius:12,padding:"16px 18px",border:`1px solid ${s.color}33` }}>
              <div style={{ fontSize:12,fontWeight:700,color:s.color,textTransform:"uppercase",letterSpacing:0.5,marginBottom:10 }}>{s.label}</div>
              <div style={{ fontSize:11,color:"#888",marginBottom:2 }}>MRR mes 6</div>
              <div style={{ fontSize:20,fontWeight:700,color:"#111",marginBottom:10 }}>{fmt(last.mrr)}</div>
              <div style={{ fontSize:11,color:"#888",marginBottom:2 }}>Cash mes 6</div>
              <div style={{ fontSize:16,fontWeight:700,color:endsPositive?"#111":ST_RED,marginBottom:10 }}>{fmt(last.cash)}</div>
              {breakEvenMonth >= 0 ? (
                <div style={{ fontSize:12,fontWeight:600,color:"#16A34A" }}>✓ Break-even en {s.data[breakEvenMonth].label}</div>
              ) : (
                <div style={{ fontSize:12,fontWeight:600,color:ST_RED }}>✗ No alcanza break-even</div>
              )}
              <div style={{ fontSize:12,fontWeight:600,color:endsPositive?"#16A34A":ST_RED,marginTop:4 }}>
                {endsPositive ? `Runway: ${runway}` : `⚠ Se acaba en ${runway}`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="spicy-card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:14,fontWeight:600,color:"#111",marginBottom:4 }}>Evolución de cash</div>
        <div style={{ fontSize:12,color:"#aaa",marginBottom:16 }}>Línea punteada = cero · Egresos fijos {fmt(Math.round(avgExpense))}/mes</div>
        <div style={{ position:"relative",height:chartH+40,overflowX:"auto" }}>
          <svg width="100%" height={chartH+40} viewBox={`0 0 ${MONTHS*100} ${chartH+40}`} preserveAspectRatio="none">
            <line x1="0" y1={cashToY(0)} x2={MONTHS*100} y2={cashToY(0)} stroke="#E0E0E0" strokeWidth="1.5" strokeDasharray="6,4"/>
            {scenarios.map(s=>{
              const points = [[0, cashToY(currentCash)], ...s.data.map((m,i) => [(i+1)*100, cashToY(m.cash)])];
              const d = points.map((p,i)=>(i===0?"M":"L")+p[0]+","+p[1]).join(" ");
              return <path key={s.key} d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round"/>;
            })}
            {scenarios.map(s=>
              s.data.map((m,i)=>(
                <g key={s.key+i}>
                  <circle cx={(i+1)*100} cy={cashToY(m.cash)} r="4" fill={s.color}/>
                  {i===MONTHS-1&&(
                    <text x={(i+1)*100-2} y={cashToY(m.cash)-10} fontSize="10" fill={s.color} textAnchor="middle" fontWeight="600">
                      {fmt(m.cash)}
                    </text>
                  )}
                  {m.injection>0&&(
                    <text x={(i+1)*100} y={cashToY(m.cash)-22} fontSize="10" fill="#059669" textAnchor="middle">+{fmt(m.injection)}</text>
                  )}
                </g>
              ))
            )}
            {scenarios[0].data.map((m,i)=>(
              <text key={i} x={(i+1)*100} y={chartH+32} fontSize="11" fill="#aaa" textAnchor="middle">{m.label.split(" ")[0]}</text>
            ))}
          </svg>
        </div>
        <div style={{ display:"flex",gap:16,marginTop:8,flexWrap:"wrap" }}>
          {scenarios.map(s=>(
            <span key={s.key} style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,color:s.color,fontWeight:600 }}>
              <span style={{ width:20,height:3,background:s.color,display:"inline-block",borderRadius:2 }}/>
              {s.label} ({s.growth}%/mes)
            </span>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="spicy-card" style={{ padding:0,overflow:"hidden" }}>
        <div style={{ padding:"14px 20px",borderBottom:"1px solid #F3F3F3",fontSize:14,fontWeight:600,color:"#111" }}>Detalle mes a mes</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
            <thead>
              <tr style={{ background:"#FAFAFA" }}>
                <th style={{ padding:"10px 16px",textAlign:"left",color:"#888",fontWeight:600,borderBottom:"1px solid #F3F3F3" }}>Mes</th>
                {scenarios.map(s=>(
                  <th key={s.key} colSpan={3} style={{ padding:"10px 8px",textAlign:"center",color:s.color,fontWeight:700,borderBottom:"1px solid #F3F3F3",borderLeft:"2px solid "+s.color+"33" }}>{s.label}</th>
                ))}
              </tr>
              <tr style={{ background:"#FAFAFA" }}>
                <th style={{ padding:"6px 16px",borderBottom:"1px solid #F0F0F0",fontSize:11 }}></th>
                {scenarios.map(s=>["MRR","Egreso","Cash"].map(h=>(
                  <th key={s.key+h} style={{ padding:"6px 8px",textAlign:"right",color:"#aaa",fontWeight:500,borderBottom:"1px solid #F0F0F0",fontSize:11,borderLeft:h==="MRR"?"2px solid "+s.color+"33":"none" }}>{h}</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {Array.from({length:MONTHS},(_,i)=>(
                <tr key={i} style={{ borderBottom:"1px solid #F3F3F3",background:i%2===0?"white":"#FAFAFA" }}>
                  <td style={{ padding:"10px 16px",fontWeight:600,color:"#111",fontSize:13 }}>{scenarios[0].data[i].label}</td>
                  {scenarios.map(s=>{
                    const m = s.data[i];
                    return ["mrr","expense","cash"].map(k=>(
                      <td key={s.key+k} style={{ padding:"10px 8px",textAlign:"right",fontWeight:k==="cash"?700:400,
                        color:k==="cash"?(m.cash<0?ST_RED:"#111"):"#555",
                        borderLeft:k==="mrr"?"2px solid "+s.color+"33":"none",
                        fontSize:k==="cash"?13:12 }}>
                        {k==="cash"&&m.injection>0&&<span style={{ fontSize:10,color:"#059669",marginRight:4 }}>+{fmt(m.injection)}</span>}
                        {fmt(m[k])}
                      </td>
                    ));
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Services View (Dashboard Producto) ────────────────────────────────────
function ServicesView() {
  const [azureData,    setAzureData]    = useState(null);
  const [mongoData,    setMongoData]    = useState(null);
  const [k8sData,      setK8sData]      = useState(null);
  const [azureLoading, setAzureLoading] = useState(false);
  const [mongoLoading, setMongoLoading] = useState(false);
  const [k8sLoading,   setK8sLoading]   = useState(false);
  const [azureError,   setAzureError]   = useState("");
  const [mongoError,   setMongoError]   = useState("");
  const [k8sError,     setK8sError]     = useState("");
  const [lastUpdated,  setLastUpdated]  = useState(null);

  async function fetchAll() {
    if (!WORKER_URL) { setAzureError("Configurá WORKER_URL en el código."); return; }
    setAzureLoading(true); setMongoLoading(true); setK8sLoading(true);
    setAzureError(""); setMongoError(""); setK8sError("");

    const [azureRes, mongoRes, k8sRes] = await Promise.allSettled([
      fetch(WORKER_URL + "/azure"),
      fetch(WORKER_URL + "/mongodb"),
      fetch(WORKER_URL + "/k8s"),
    ]);

    if (azureRes.status === "fulfilled" && azureRes.value.ok) {
      setAzureData(await azureRes.value.json());
    } else {
      const e = azureRes.status === "fulfilled" ? await azureRes.value.json().catch(()=>({})) : {};
      setAzureError(e.error || "Error conectando con Azure");
    }

    if (mongoRes.status === "fulfilled" && mongoRes.value.ok) {
      setMongoData(await mongoRes.value.json());
    } else {
      const e = mongoRes.status === "fulfilled" ? await mongoRes.value.json().catch(()=>({})) : {};
      setMongoError(e.error || "Error conectando con MongoDB");
    }

    if (k8sRes.status === "fulfilled" && k8sRes.value.ok) {
      setK8sData(await k8sRes.value.json());
    } else {
      const e = k8sRes.status === "fulfilled" ? await k8sRes.value.json().catch(()=>({})) : {};
      setK8sError(e.error || "");
    }

    setAzureLoading(false); setMongoLoading(false); setK8sLoading(false);
    setLastUpdated(new Date().toLocaleTimeString("es-UY"));
  }

  useEffect(() => { fetchAll(); }, []);

  const mongoAlerts = mongoData?.services?.filter(s=>s.alert).length || 0;

  // Mini sparkline component for CPU/memory history
  function Sparkline({ values, color, height=32 }) {
    if (!values || values.length < 2) return null;
    const max = Math.max(...values, 1);
    const w = 120, h = height;
    const pts = values.map((v,i) => `${Math.round((i/(values.length-1))*w)},${Math.round(h - (v/max)*h)}`).join(" ");
    return (
      <svg width={w} height={h} style={{ display:"block" }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx={Math.round(((values.length-1)/(values.length-1))*w)} cy={Math.round(h-(values[values.length-1]/max)*h)} r="3" fill={color}/>
      </svg>
    );
  }

  function ClusterCard({ cluster }) {
    const cpuAlert  = cluster.cpuPercent > 80;
    const memAlert  = cluster.memPercent > 85;
    const hasAlert  = cpuAlert || memAlert;
    return (
      <div className="spicy-card" style={{ border: hasAlert ? `1px solid ${ST_RED}44` : undefined }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:18 }}>☸️</span>
              <span style={{ fontSize:14, fontWeight:700, color:"#111" }}>{cluster.name}</span>
              {hasAlert && <span style={{ fontSize:10, padding:"2px 7px", borderRadius:5, background:ST_RED_BG, color:ST_RED, fontWeight:700 }}>⚠ ALERTA</span>}
            </div>
            <div style={{ fontSize:11, color:"#aaa", marginTop:3 }}>{cluster.resourceGroup} · {cluster.location}</div>
          </div>
          <span style={{ fontSize:11, padding:"3px 8px", borderRadius:5, background:"#EDFAF3", color:"#16A34A", fontWeight:600 }}>
            {cluster.status}
          </span>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {/* CPU */}
          <div style={{ background: cpuAlert?"#FEF0F0":"#F9F9F9", borderRadius:8, padding:"10px 12px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <span style={{ fontSize:12, fontWeight:600, color: cpuAlert?ST_RED:"#555" }}>CPU</span>
              <span style={{ fontSize:16, fontWeight:700, color: cpuAlert?ST_RED:"#111" }}>{cluster.cpuPercent?.toFixed(1)}%</span>
            </div>
            <div style={{ height:6, background:"#E0E0E0", borderRadius:3, overflow:"hidden", marginBottom:6 }}>
              <div style={{ height:"100%", width:`${Math.min(cluster.cpuPercent||0,100)}%`, background: cpuAlert?ST_RED:"#1D9E75", borderRadius:3, transition:"width 0.3s" }}/>
            </div>
            <Sparkline values={cluster.cpuHistory} color={cpuAlert?ST_RED:"#1D9E75"}/>
          </div>

          {/* Memory */}
          <div style={{ background: memAlert?"#FEF0F0":"#F9F9F9", borderRadius:8, padding:"10px 12px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <span style={{ fontSize:12, fontWeight:600, color: memAlert?ST_RED:"#555" }}>Memoria</span>
              <span style={{ fontSize:16, fontWeight:700, color: memAlert?ST_RED:"#111" }}>{cluster.memPercent?.toFixed(1)}%</span>
            </div>
            <div style={{ height:6, background:"#E0E0E0", borderRadius:3, overflow:"hidden", marginBottom:6 }}>
              <div style={{ height:"100%", width:`${Math.min(cluster.memPercent||0,100)}%`, background: memAlert?"#F59E0B":"#185FA5", borderRadius:3, transition:"width 0.3s" }}/>
            </div>
            <Sparkline values={cluster.memHistory} color={memAlert?"#F59E0B":"#185FA5"}/>
          </div>
        </div>

        <div style={{ display:"flex", gap:16, marginTop:12, fontSize:12, color:"#888" }}>
          <span>Nodes: <strong style={{ color:"#111" }}>{cluster.nodeCount}</strong></span>
          <span>Pods: <strong style={{ color:"#111" }}>{cluster.podCount}</strong></span>
          <span>Versión: <strong style={{ color:"#111" }}>{cluster.version}</strong></span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:"#111", marginBottom:4 }}>Dashboard Producto</div>
          <div style={{ fontSize:13, color:"#888" }}>Infraestructura Azure · Kubernetes · MongoDB Atlas</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {lastUpdated && <span style={{ fontSize:11, color:"#aaa" }}>Actualizado {lastUpdated}</span>}
          <button onClick={fetchAll} disabled={azureLoading||mongoLoading||k8sLoading} className="spicy-btn-secondary" style={{ fontSize:13, padding:"7px 16px" }}>
            {(azureLoading||mongoLoading||k8sLoading) ? "Cargando…" : "⟳ Actualizar"}
          </button>
        </div>
      </div>

      {/* Kubernetes clusters */}
      <div style={{ fontSize:14, fontWeight:600, color:"#111", marginBottom:12 }}>☸️ Kubernetes</div>
      {k8sError && (
        <div style={{ background:"#F9F9F9", border:"1px dashed #E0E0E0", borderRadius:10, padding:"14px 18px", marginBottom:16, fontSize:13, color:"#aaa" }}>
          Pendiente configurar Monitoring Reader en Azure → los clusters aparecerán acá automáticamente.
        </div>
      )}
      {k8sLoading && !k8sData && (
        <div style={{ textAlign:"center", padding:"2rem", color:"#aaa", fontSize:13, marginBottom:16 }}>Consultando Azure Monitor…</div>
      )}
      {k8sData?.clusters?.map(c => <ClusterCard key={c.name} cluster={c}/>)}
      {k8sData?.clusters?.length === 0 && <div style={{ fontSize:13, color:"#bbb", marginBottom:16 }}>Sin clusters encontrados.</div>}

      {/* MongoDB */}
      <div style={{ fontSize:14, fontWeight:600, color:"#111", margin:"20px 0 12px" }}>🍃 MongoDB Atlas</div>
      {mongoError && <div style={{ background:"#FEF0F0", border:"1px solid #FECACA", borderRadius:10, padding:"12px 16px", marginBottom:12, fontSize:13, color:ST_RED }}>{mongoError}</div>}
      {mongoLoading && !mongoData && <div style={{ textAlign:"center", padding:"2rem", color:"#aaa", fontSize:13 }}>Consultando MongoDB Atlas…</div>}
      {mongoData && (
        <div className="spicy-card" style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"14px 20px", borderBottom:"1px solid #F3F3F3", display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:13, fontWeight:600, color:"#111" }}>Facturación este mes</span>
            <span style={{ fontSize:14, fontWeight:700, color:"#111" }}>${mongoData.totalCurrent?.toFixed(2)}</span>
          </div>
          {mongoData.services?.map((s,i)=>(
            <div key={s.service} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 20px", borderBottom:i<mongoData.services.length-1?"1px solid #F5F5F5":"none", background:s.alert?"#FFFBEB":"white" }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:s.alert?ST_RED:"#1D9E75", flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#111" }}>{s.service}</div>
                {s.prev>0&&<div style={{ fontSize:11, color:"#aaa" }}>Mes anterior: ${s.prev.toFixed(2)}</div>}
              </div>
              {s.change!==null&&<span style={{ fontSize:11, padding:"2px 8px", borderRadius:5, fontWeight:600, background:s.alert?"#FEF0F0":s.change<0?"#EDFAF3":"#F3F3F3", color:s.alert?ST_RED:s.change<0?"#16A34A":"#888" }}>{s.change>0?"+":""}{s.change}%</span>}
              <div style={{ fontSize:14, fontWeight:700, color:s.alert?ST_RED:"#111", minWidth:70, textAlign:"right" }}>${s.current.toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Operations Summary (Resumen de Operaciones) ─────────────────────────────
function fmtDuration(ms) {
  if (ms==null) return "—";
  const hours = ms / 3600000;
  if (hours < 1) return Math.max(1,Math.round(ms/60000)) + "m";
  if (hours < 48) return Math.round(hours) + "h";
  return Math.round(hours/24) + "d";
}

function OperationsSummaryView({ tickets, tasks, statusHistory, assignees, allUsers, setView }) {
  const todayISO = new Date().toISOString().split("T")[0];
  const in7days = (() => { const d=new Date(); d.setDate(d.getDate()+7); return d.toISOString().split("T")[0]; })();

  const blockingTickets = tickets.filter(t=>t.category==="Bloqueante" && statusGroup(t.status)!=="Cerrados");
  const firstEntryTo = (ticketId, status) => statusHistory
    .filter(h=>h.ticket_id===ticketId && h.status===status)
    .sort((a,b)=>a.changed_at.localeCompare(b.changed_at))[0];
  const resolvedTickets = tickets
    .map(t=>({ t, h: firstEntryTo(t.id,"Solucionado") }))
    .filter(x=>x.h);
  const avgResolution = resolvedTickets.length
    ? resolvedTickets.reduce((s,x)=>s+(new Date(x.h.changed_at)-new Date(x.t.created_at)),0)/resolvedTickets.length
    : null;
  const unestimated = tickets.filter(t=>!t.fibonacci_score && statusGroup(t.status)!=="Sin empezar");

  const overdueTasks = tasks.filter(t=>t.end_date<todayISO && !["Finalizado","Archivado"].includes(t.stage));
  const dueSoonTasks  = tasks.filter(t=>t.end_date>=todayISO && t.end_date<=in7days && !["Finalizado","Archivado"].includes(t.stage));

  const ticketsByStatus = TICKET_STATUSES.map(s=>({ label:s, count: tickets.filter(t=>t.status===s).length }));
  const maxTicketsByStatus = Math.max(1, ...ticketsByStatus.map(x=>x.count));
  const tasksByStage = TASK_STAGES.map(s=>({ label:`${s.emoji} ${s.key}`, count: tasks.filter(t=>t.stage===s.key).length }));
  const maxTasksByStage = Math.max(1, ...tasksByStage.map(x=>x.count));

  const activeTickets = tickets.filter(t=>statusGroup(t.status)!=="Cerrados");
  const activeTasks   = tasks.filter(t=>!["Finalizado","Archivado"].includes(t.stage));
  const ticketAssigneeNames = (ticketId) => {
    const ids = assignees.filter(a=>a.entity_type==="ticket" && a.entity_id===ticketId).map(a=>a.user_id);
    const names = ids.map(id=>{ const u=allUsers.find(x=>x.user_id===id); return u?userDisplayName(u):null; }).filter(Boolean);
    return names.length ? names : [""];
  };
  const roster = [...new Set([...activeTickets.flatMap(t=>ticketAssigneeNames(t.id)),...activeTasks.map(t=>t.assigned_to||"")])];
  const workload = roster.map(name=>({
    name: name||"Sin asignar",
    tickets: activeTickets.filter(t=>ticketAssigneeNames(t.id).includes(name)).length,
    tasks:   activeTasks.filter(t=>(t.assigned_to||"")===name).length,
  })).filter(w=>w.tickets>0||w.tasks>0);

  const kpis = [
    { label:"Tickets bloqueantes", value:blockingTickets.length, warn:blockingTickets.length>0, onClick:()=>setView("tickets") },
    { label:"Resolución prom.", value:fmtDuration(avgResolution), sub:`${resolvedTickets.length} tickets resueltos` },
    { label:"Tickets sin estimar", value:unestimated.length, warn:unestimated.length>0, onClick:()=>setView("tickets") },
    { label:"Tareas vencidas", value:overdueTasks.length, warn:overdueTasks.length>0, onClick:()=>setView("tasks") },
  ];

  return (
    <>
      <div style={{ fontSize:20,fontWeight:700,color:"#111",marginBottom:20 }}>Resumen de Operaciones</div>

      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20 }}>
        {kpis.map(k=>(
          <div key={k.label} className="spicy-kpi" style={{ cursor:k.onClick?"pointer":"default" }} onClick={k.onClick}>
            <div className="spicy-kpi-label">{k.label}</div>
            <div className="spicy-kpi-value" style={{ color:k.warn?ST_RED:"#111" }}>{k.value}</div>
            {k.sub&&<div className="spicy-kpi-sub">{k.sub}</div>}
          </div>
        ))}
      </div>

      {dueSoonTasks.length>0&&(
        <div onClick={()=>setView("tasks")} style={{ background:"#FEF3C7",border:"1px solid #FCD34D",borderRadius:10,padding:"12px 16px",marginBottom:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ fontSize:13,color:"#92400E",fontWeight:600 }}>⚠ {dueSoonTasks.length} tarea{dueSoonTasks.length===1?"":"s"} vence{dueSoonTasks.length===1?"":"n"} en los próximos 7 días</div>
          <span style={{ fontSize:12,color:"#92400E",fontWeight:600 }}>Ver →</span>
        </div>
      )}

      <div style={{ display:"flex",gap:16,flexWrap:"wrap" }}>
        <div className="spicy-card" style={{ flex:"1 1 320px" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <span style={{ fontSize:14,fontWeight:600,color:"#111" }}>Tickets por estado</span>
            <button onClick={()=>setView("tickets")} style={{ fontSize:12,color:ST_RED,background:"none",border:"none",cursor:"pointer",fontWeight:600 }}>Ver todos →</button>
          </div>
          {ticketsByStatus.every(x=>x.count===0) && <div style={{ fontSize:13,color:"#bbb",textAlign:"center",padding:"1rem" }}>Sin tickets todavía.</div>}
          {ticketsByStatus.filter(x=>x.count>0).map(x=>(
            <div key={x.label} style={{ marginBottom:12 }}>
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6 }}>
                <span style={{ color:"#555" }}>{x.label}</span>
                <span style={{ fontWeight:600,color:"#111" }}>{x.count}</span>
              </div>
              <div style={{ height:6,background:"#F3F3F3",borderRadius:4,overflow:"hidden" }}>
                <div style={{ height:"100%",width:`${Math.round((x.count/maxTicketsByStatus)*100)}%`,background:ST_RED,borderRadius:4 }}/>
              </div>
            </div>
          ))}
        </div>

        <div className="spicy-card" style={{ flex:"1 1 320px" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <span style={{ fontSize:14,fontWeight:600,color:"#111" }}>Tareas por etapa</span>
            <button onClick={()=>setView("tasks")} style={{ fontSize:12,color:ST_RED,background:"none",border:"none",cursor:"pointer",fontWeight:600 }}>Ver todas →</button>
          </div>
          {tasksByStage.every(x=>x.count===0) && <div style={{ fontSize:13,color:"#bbb",textAlign:"center",padding:"1rem" }}>Sin tareas todavía.</div>}
          {tasksByStage.filter(x=>x.count>0).map(x=>(
            <div key={x.label} style={{ marginBottom:12 }}>
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6 }}>
                <span style={{ color:"#555" }}>{x.label}</span>
                <span style={{ fontWeight:600,color:"#111" }}>{x.count}</span>
              </div>
              <div style={{ height:6,background:"#F3F3F3",borderRadius:4,overflow:"hidden" }}>
                <div style={{ height:"100%",width:`${Math.round((x.count/maxTasksByStage)*100)}%`,background:"#533AB7",borderRadius:4 }}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="spicy-card">
        <div style={{ fontSize:14,fontWeight:600,color:"#111",marginBottom:14 }}>Carga por responsable <span style={{ fontSize:11,color:"#aaa",fontWeight:400 }}>— tickets y tareas activos (no resueltos/archivados)</span></div>
        {workload.length===0 && <div style={{ fontSize:13,color:"#bbb",textAlign:"center",padding:"1rem" }}>Nada asignado todavía.</div>}
        {workload.map(w=>(
          <div key={w.name} className="spicy-table-row">
            <span style={{ flex:1,fontSize:13,fontWeight:500,color:"#111" }}>{w.name}</span>
            <span className="spicy-badge-red" style={{ marginRight:6 }}>{w.tickets} ticket{w.tickets===1?"":"s"}</span>
            <span className="spicy-badge-gray">{w.tasks} tarea{w.tasks===1?"":"s"}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Tickets View (Kanban) ───────────────────────────────────────────────────
// ── Reusable: Assignees / Comments / Attachments / History ─────────────────
const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
const ATTACHMENT_MIME_TYPES = ["image/jpeg","image/png","image/gif","image/webp","application/pdf","video/mp4","video/webm","video/quicktime","text/plain"];

function AssigneesPicker({ entityType, entityId, assignees, allUsers, onChange }) {
  const mine = assignees.filter(a=>a.entity_type===entityType && a.entity_id===entityId);
  const assignedIds = new Set(mine.map(a=>a.user_id));
  const available = allUsers.filter(u=>!assignedIds.has(u.user_id));

  async function add(userId) {
    if (!userId) return;
    await sb.from("entity_assignees").insert({ id:"ea_"+Date.now()+"_"+Math.random().toString(36).slice(2,6), entity_type:entityType, entity_id:entityId, user_id:userId });
    onChange();
  }
  async function remove(userId) {
    await sb.from("entity_assignees").delete().match({ entity_type:entityType, entity_id:entityId, user_id:userId });
    onChange();
  }

  return (
    <div style={{ display:"flex",flexWrap:"wrap",gap:8,alignItems:"center" }}>
      {mine.map(a=>{
        const u = allUsers.find(x=>x.user_id===a.user_id);
        const name = u ? userDisplayName(u) : a.user_id;
        return (
          <div key={a.user_id} style={{ display:"flex",alignItems:"center",gap:5,background:"#F7F7F8",borderRadius:20,padding:"3px 8px 3px 3px" }}>
            <Avatar name={name} size={22}/>
            <span style={{ fontSize:12,color:"#333" }}>{name}</span>
            <button onClick={()=>remove(a.user_id)} style={{ background:"none",border:"none",cursor:"pointer",color:"#bbb",fontSize:14,lineHeight:1,padding:0 }}>×</button>
          </div>
        );
      })}
      {mine.length===0 && <span style={{ fontSize:12,color:"#aaa" }}>Sin asignar</span>}
      {available.length>0 && (
        <select value="" onChange={e=>add(e.target.value)} className="spicy-select" style={{ fontSize:12,padding:"3px 6px" }}>
          <option value="" disabled>+ agregar</option>
          {available.map(u=><option key={u.user_id} value={u.user_id}>{userDisplayName(u)}</option>)}
        </select>
      )}
    </div>
  );
}

// Misma UI que AssigneesPicker pero sobre estado local de un formulario (para
// poder elegir responsables al crear un ticket/tarea, antes de que exista la fila
// en la base con la que AssigneesPicker necesita trabajar).
function AssigneesPickerLocal({ selectedIds, allUsers, onChange }) {
  const available = allUsers.filter(u=>!selectedIds.includes(u.user_id));
  return (
    <div style={{ display:"flex",flexWrap:"wrap",gap:8,alignItems:"center" }}>
      {selectedIds.map(id=>{
        const u = allUsers.find(x=>x.user_id===id);
        if (!u) return null;
        const name = userDisplayName(u);
        return (
          <div key={id} style={{ display:"flex",alignItems:"center",gap:5,background:"#F7F7F8",borderRadius:20,padding:"3px 8px 3px 3px" }}>
            <Avatar name={name} size={22}/>
            <span style={{ fontSize:12,color:"#333" }}>{name}</span>
            <button type="button" onClick={()=>onChange(selectedIds.filter(x=>x!==id))} style={{ background:"none",border:"none",cursor:"pointer",color:"#bbb",fontSize:14,lineHeight:1,padding:0 }}>×</button>
          </div>
        );
      })}
      {selectedIds.length===0 && <span style={{ fontSize:12,color:"#aaa" }}>Sin asignar</span>}
      {available.length>0 && (
        <select value="" onChange={e=>onChange([...selectedIds, e.target.value])} className="spicy-select" style={{ fontSize:12,padding:"3px 6px" }}>
          <option value="" disabled>+ agregar</option>
          {available.map(u=><option key={u.user_id} value={u.user_id}>{userDisplayName(u)}</option>)}
        </select>
      )}
    </div>
  );
}

// Combobox con búsqueda: input de texto que filtra una lista de opciones al tipear.
function SearchSelect({ options, value, onChange, placeholder }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = options.find(o=>o.value===value);
  const filtered = query.trim()
    ? options.filter(o=>o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div style={{ position:"relative" }}>
      <input
        className="spicy-input"
        placeholder={placeholder}
        value={open ? query : (selected ? selected.label : "")}
        onFocus={()=>setQuery("")}
        onChange={e=>{ setOpen(true); setQuery(e.target.value); }}
        onClick={()=>setOpen(true)}
        onBlur={()=>setTimeout(()=>setOpen(false), 150)}
        style={{ width:"100%" }}
      />
      {open && (
        <div style={{ position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"white",border:"1px solid #EBEBEB",borderRadius:8,maxHeight:180,overflowY:"auto",zIndex:20,boxShadow:"0 4px 12px rgba(0,0,0,0.08)" }}>
          <div onMouseDown={()=>{ onChange(null); setOpen(false); }} style={{ padding:"7px 10px",fontSize:12,color:"#aaa",cursor:"pointer" }}>Ninguno</div>
          {filtered.map(o=>(
            <div key={o.value} onMouseDown={()=>{ onChange(o.value); setOpen(false); }} style={{ padding:"7px 10px",fontSize:13,color:"#333",cursor:"pointer" }}>{o.label}</div>
          ))}
          {filtered.length===0 && <div style={{ padding:"7px 10px",fontSize:12,color:"#ccc" }}>Sin resultados</div>}
        </div>
      )}
    </div>
  );
}

function CommentsThread({ entityType, entityId, comments, currentUserId, currentUserEmail, onChange }) {
  const [newBody, setNewBody] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState("");

  const mine = comments.filter(c=>c.entity_type===entityType && c.entity_id===entityId).sort((a,b)=>a.created_at.localeCompare(b.created_at));

  async function addComment() {
    if (!newBody.trim()) return;
    await sb.from("comments").insert({ id:"cm_"+Date.now()+"_"+Math.random().toString(36).slice(2,6), entity_type:entityType, entity_id:entityId, author_id:currentUserId, author_email:currentUserEmail, body:newBody.trim() });
    setNewBody("");
    onChange();
  }
  async function saveEdit(c) {
    if (!editBody.trim()) return;
    await sb.from("comments").update({ body:editBody.trim(), updated_at:new Date().toISOString() }).eq("id", c.id);
    setEditingId(null);
    onChange();
  }
  async function deleteComment(c) {
    await sb.from("comments").delete().eq("id", c.id);
    onChange();
  }

  return (
    <div>
      <div style={{ display:"flex",flexDirection:"column",gap:8,maxHeight:220,overflowY:"auto",marginBottom:8 }}>
        {mine.map(c=>(
          <div key={c.id} style={{ background:"#F7F7F8",borderRadius:10,padding:"8px 10px" }}>
            <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:"#aaa",marginBottom:3 }}>
              <span>{c.author_email} · {new Date(c.created_at).toLocaleString("es-UY")}{c.updated_at?" (editado)":""}</span>
              {c.author_id===currentUserId && editingId!==c.id && (
                <span style={{ display:"flex",gap:8 }}>
                  <button onClick={()=>{setEditingId(c.id);setEditBody(c.body);}} style={{ background:"none",border:"none",cursor:"pointer",color:"#888",fontSize:11 }}>Editar</button>
                  <button onClick={()=>deleteComment(c)} style={{ background:"none",border:"none",cursor:"pointer",color:ST_RED,fontSize:11 }}>Borrar</button>
                </span>
              )}
            </div>
            {editingId===c.id ? (
              <div style={{ display:"flex",gap:6 }}>
                <input className="spicy-input" value={editBody} onChange={e=>setEditBody(e.target.value)} style={{ flex:1 }}
                  onKeyDown={e=>{ if(e.key==="Enter") saveEdit(c); if(e.key==="Escape") setEditingId(null); }}/>
                <button className="spicy-btn-primary" onClick={()=>saveEdit(c)}>Guardar</button>
              </div>
            ) : (
              <div style={{ fontSize:13,color:"#333" }}>{c.body}</div>
            )}
          </div>
        ))}
        {mine.length===0 && <div style={{ fontSize:12,color:"#ccc" }}>Sin comentarios todavía.</div>}
      </div>
      <div style={{ display:"flex",gap:6 }}>
        <input className="spicy-input" placeholder="Agregar comentario..." value={newBody} onChange={e=>setNewBody(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addComment(); } }} style={{ flex:1 }}/>
        <button className="spicy-btn-primary" onClick={addComment} disabled={!newBody.trim()}>Enviar</button>
      </div>
    </div>
  );
}

function AttachmentThumb({ path, name }) {
  const [url, setUrl] = useState(null);
  useEffect(()=>{
    let alive = true;
    sb.storage.from("attachments").createSignedUrl(path, 300).then(({data})=>{ if(alive && data) setUrl(data.signedUrl); });
    return ()=>{ alive=false; };
  },[path]);
  if (!url) return <div style={{ width:56,height:56,borderRadius:8,background:"#EEE" }}/>;
  return <img src={url} alt={name} style={{ width:56,height:56,borderRadius:8,objectFit:"cover" }}/>;
}

function AttachmentsList({ entityType, entityId, attachments, currentUserEmail, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const mine = attachments.filter(a=>a.entity_type===entityType && a.entity_id===entityId).sort((a,b)=>a.created_at.localeCompare(b.created_at));

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    if (file.size > ATTACHMENT_MAX_BYTES) { setError("El archivo supera el límite de 20MB."); return; }
    if (!ATTACHMENT_MIME_TYPES.includes(file.type)) { setError("Tipo de archivo no permitido."); return; }
    setUploading(true);
    const path = `${entityType}/${entityId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await sb.storage.from("attachments").upload(path, file, { contentType:file.type });
    if (upErr) { setError(upErr.message); setUploading(false); return; }
    await sb.from("attachments").insert({ id:"att_"+Date.now(), entity_type:entityType, entity_id:entityId, file_name:file.name, storage_path:path, content_type:file.type, size_bytes:file.size, uploaded_by:currentUserEmail });
    setUploading(false);
    onChange();
  }

  async function download(a) {
    const { data, error } = await sb.storage.from("attachments").createSignedUrl(a.storage_path, 60);
    if (error) { alert("Error obteniendo el archivo: " + error.message); return; }
    window.open(data.signedUrl, "_blank");
  }
  async function remove(a) {
    await sb.storage.from("attachments").remove([a.storage_path]);
    await sb.from("attachments").delete().eq("id", a.id);
    onChange();
  }

  return (
    <div>
      <div style={{ display:"flex",flexWrap:"wrap",gap:10,marginBottom:8 }}>
        {mine.map(a=>(
          <div key={a.id} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4,width:64 }}>
            {a.content_type?.startsWith("image/")
              ? <div onClick={()=>download(a)} style={{ cursor:"pointer" }}><AttachmentThumb path={a.storage_path} name={a.file_name}/></div>
              : <div onClick={()=>download(a)} style={{ width:56,height:56,borderRadius:8,background:"#F3F3F3",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,cursor:"pointer" }}>📄</div>}
            <span title={a.file_name} style={{ fontSize:10,color:"#888",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%" }}>{a.file_name}</span>
            <button onClick={()=>remove(a)} style={{ background:"none",border:"none",cursor:"pointer",color:ST_RED,fontSize:10,padding:0 }}>Borrar</button>
          </div>
        ))}
        {mine.length===0 && <div style={{ fontSize:12,color:"#ccc" }}>Sin adjuntos todavía.</div>}
      </div>
      <label className="spicy-btn-secondary" style={{ display:"inline-block",cursor:"pointer",fontSize:12 }}>
        {uploading?"Subiendo...":"+ Adjuntar archivo"}
        <input type="file" onChange={handleFile} disabled={uploading} style={{ display:"none" }}/>
      </label>
      {error && <div style={{ fontSize:11,color:ST_RED,marginTop:4 }}>{error}</div>}
    </div>
  );
}

function HistoryList({ entries, labelKey }) {
  const sorted = [...entries].sort((a,b)=>a.changed_at.localeCompare(b.changed_at));
  return (
    <div style={{ fontSize:11,color:"#aaa",display:"flex",flexDirection:"column",gap:3,maxHeight:120,overflowY:"auto" }}>
      {sorted.map(h=>(
        <div key={h.id}>{new Date(h.changed_at).toLocaleString("es-UY")} — {h[labelKey]} {h.changed_by?`(${h.changed_by})`:""}</div>
      ))}
      {sorted.length===0 && <span>Sin historial todavía.</span>}
    </div>
  );
}

function TicketsView({ tickets, statusHistory, allUsers, currentUserEmail, currentUserId, canEditFibonacci, assignees, comments, attachments, devTasks, setView, onRefresh }) {
  const [showNew, setShowNew] = useState(false);
  const [detail,  setDetail]  = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [form, setForm] = useState({ client_name:"", category:"", priority:"Media", channel:"WhatsApp", message:"", assigneeIds:[] });
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState("");

  const catInfo = (key) => TICKET_CATEGORIES.find(c=>c.key===key);
  const visibleTickets = filterCategory ? tickets.filter(t=>t.category===filterCategory) : tickets;
  const assigneesFor = (ticketId) => assignees.filter(a=>a.entity_type==="ticket" && a.entity_id===ticketId).map(a=>allUsers.find(u=>u.user_id===a.user_id)).filter(Boolean);
  const commentsCount = (ticketId) => comments.filter(c=>c.entity_type==="ticket" && c.entity_id===ticketId).length;
  const attachmentsCount = (ticketId) => attachments.filter(a=>a.entity_type==="ticket" && a.entity_id===ticketId).length;

  async function createTicket(e) {
    e.preventDefault();
    if (!form.client_name.trim() || !form.category || !form.channel) return;
    setSaving(true);
    const id = "tk_"+Date.now();
    const status = "Inicio por OPS";
    await sb.from("tickets").insert({
      id,
      client_name: form.client_name.trim(),
      category: form.category,
      priority: form.priority,
      channel: form.channel,
      message: form.message.trim() || null,
      status,
    });
    await sb.from("ticket_status_history").insert({ id:"tsh_"+Date.now(), ticket_id:id, status, changed_by:currentUserEmail });
    if (form.assigneeIds.length) {
      await sb.from("entity_assignees").insert(form.assigneeIds.map(userId=>({ id:"ea_"+Date.now()+"_"+Math.random().toString(36).slice(2,6), entity_type:"ticket", entity_id:id, user_id:userId })));
    }
    setSaving(false);
    setForm({ client_name:"", category:"", priority:"Media", channel:"WhatsApp", message:"", assigneeIds:[] });
    setShowNew(false);
    onRefresh();
  }

  async function updateTicket(ticket, patch) {
    await sb.from("tickets").update(patch).eq("id", ticket.id);
    setDetail(d => d && d.id===ticket.id ? { ...d, ...patch } : d);
    onRefresh();
  }

  async function moveStatus(ticket, newStatus) {
    if (newStatus === ticket.status) return;
    if (TICKET_STATUSES_EN_CURSO.includes(newStatus) && !ticket.fibonacci_score) {
      setStatusError("Este ticket necesita un puntaje Fibonacci antes de pasar a \""+newStatus+"\".");
      return;
    }
    setStatusError("");
    await updateTicket(ticket, { status: newStatus });
    await sb.from("ticket_status_history").insert({ id:"tsh_"+Date.now()+"_"+Math.random().toString(36).slice(2,6), ticket_id:ticket.id, status:newStatus, changed_by:currentUserEmail });
    onRefresh();
  }

  async function deleteTicket(ticket) {
    await sb.from("tickets").delete().eq("id", ticket.id);
    setDetail(null);
    onRefresh();
  }

  const prioClass = (p) => p==="Alta" ? "spicy-badge-red" : p==="Media" ? "spicy-badge-amber" : "spicy-badge-gray";

  return (
    <>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,gap:12,flexWrap:"wrap" }}>
        <div>
          <div style={{ fontSize:20,fontWeight:700,color:"#111" }}>Tickets</div>
          <div style={{ fontSize:13,color:"#888",marginTop:4 }}>{visibleTickets.length} tickets · Operaciones</div>
        </div>
        <div style={{ display:"flex",gap:10,alignItems:"center" }}>
          <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)} className="spicy-select">
            <option value="">Todas las categorías</option>
            {TICKET_CATEGORIES.map(c=><option key={c.key} value={c.key}>{c.emoji} {c.key}</option>)}
          </select>
          <button className="spicy-btn-primary" onClick={()=>setShowNew(true)}>+ Nuevo ticket</button>
        </div>
      </div>

      {/* Kanban board */}
      <div style={{ overflowX:"auto", paddingBottom:8 }}>
        <div style={{ display:"flex", gap:14, minWidth: TICKET_STATUSES.length * 250 }}>
          {TICKET_STATUSES.map(status => {
            const col = visibleTickets.filter(t => t.status === status);
            return (
              <div key={status}
                onDragOver={e=>{ e.preventDefault(); setDragOverStatus(status); }}
                onDragLeave={()=>setDragOverStatus(s=>s===status?null:s)}
                onDrop={e=>{
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/ticket-id");
                  const t = tickets.find(x=>x.id===id);
                  setDragOverStatus(null);
                  if (t && t.status!==status) moveStatus(t, status);
                }}
                style={{
                  width:236, flexShrink:0, background: dragOverStatus===status?"#FFF3EE":"#F7F7F8",
                  border:"1px solid #EBEBEB", borderRadius:12, padding:10, minHeight:120,
                }}>
                <div style={{ fontSize:12,fontWeight:700,color:"#555",marginBottom:10,display:"flex",justifyContent:"space-between" }}>
                  <span>{status}</span>
                  <span style={{ color:"#bbb" }}>{col.length}</span>
                </div>
                {col.map(t => {
                  const c = catInfo(t.category);
                  const blocking = t.category === "Bloqueante";
                  return (
                    <div key={t.id} draggable
                      onDragStart={e=>e.dataTransfer.setData("text/ticket-id", t.id)}
                      onClick={()=>setDetail(t)}
                      style={{ background: blocking?"#FEF0F0":"white", border: blocking?"1px solid #F5B5AC":"1px solid #EBEBEB", borderRadius:10,padding:"10px 12px",marginBottom:8,cursor:"grab",boxShadow:"0 1px 2px rgba(0,0,0,0.03)" }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
                        <span style={{ fontSize:12, fontWeight:blocking?700:400, color:blocking?ST_RED:"#111" }}>{c?.emoji} {t.category}</span>
                        <span className={prioClass(t.priority)}>{t.priority}</span>
                      </div>
                      <div style={{ fontSize:13,fontWeight:600,color:"#111",marginBottom:4 }}>{t.client_name}</div>
                      {t.message && <div style={{ fontSize:12,color:"#888",overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" }}>{t.message}</div>}
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8 }}>
                        <div style={{ display:"flex",gap:4 }}>
                          {assigneesFor(t.id).map(u=><Avatar key={u.user_id} name={userDisplayName(u)} size={20}/>)}
                          {assigneesFor(t.id).length===0 && <span style={{ fontSize:11,color:"#ccc" }}>Sin asignar</span>}
                        </div>
                        <span style={{ display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#aaa" }}>
                          {t.fibonacci_score && <span className="spicy-badge-gray">{t.fibonacci_score}</span>}
                          {commentsCount(t.id)>0 && <span>💬{commentsCount(t.id)}</span>}
                          {attachmentsCount(t.id)>0 && <span>📎{attachmentsCount(t.id)}</span>}
                          {new Date(t.created_at).toLocaleDateString("es-UY",{day:"2-digit",month:"2-digit"})}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {col.length===0 && <div style={{ fontSize:11,color:"#ccc",textAlign:"center",padding:"12px 0" }}>Sin tickets</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* New ticket modal */}
      {showNew && (
        <div onClick={()=>setShowNew(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
          <form onClick={e=>e.stopPropagation()} onSubmit={createTicket} style={{ background:"white",borderRadius:16,width:"100%",maxWidth:480,padding:24,display:"flex",flexDirection:"column",gap:14,maxHeight:"85vh",overflowY:"auto" }}>
            <div style={{ fontSize:16,fontWeight:700,color:"#111" }}>Nuevo ticket</div>

            <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Cliente / Empresa
              <input required autoFocus className="spicy-input" placeholder="Nombre del cliente o empresa" value={form.client_name} onChange={e=>setForm(f=>({...f,client_name:e.target.value}))} style={{ width:"100%",marginTop:4 }}/>
            </label>

            <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Categoría
              <select required value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} className="spicy-select" style={{ width:"100%",marginTop:4 }}>
                <option value="" disabled>Seleccionar categoría...</option>
                {TICKET_CATEGORIES.map(c=><option key={c.key} value={c.key}>{c.emoji} {c.key}</option>)}
              </select>
            </label>

            <div style={{ display:"flex",gap:12 }}>
              <label style={{ fontSize:12,color:"#666",fontWeight:500,flex:1 }}>Prioridad
                <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} className="spicy-select" style={{ width:"100%",marginTop:4 }}>
                  {TICKET_PRIORITIES.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label style={{ fontSize:12,color:"#666",fontWeight:500,flex:1 }}>Canal
                <select required value={form.channel} onChange={e=>setForm(f=>({...f,channel:e.target.value}))} className="spicy-select" style={{ width:"100%",marginTop:4 }}>
                  {TICKET_CHANNELS.map(ch=><option key={ch} value={ch}>{ch}</option>)}
                </select>
              </label>
            </div>

            <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Mensaje original / descripción
              <textarea value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} className="spicy-input" rows={3} style={{ width:"100%",marginTop:4,resize:"vertical" }}/>
            </label>

            <div>
              <div style={{ fontSize:12,color:"#666",fontWeight:500,marginBottom:4 }}>Responsable</div>
              <AssigneesPickerLocal selectedIds={form.assigneeIds} allUsers={allUsers} onChange={ids=>setForm(f=>({...f,assigneeIds:ids}))}/>
            </div>

            <div style={{ display:"flex",justifyContent:"flex-end",gap:8,marginTop:4 }}>
              <button type="button" className="spicy-btn-secondary" onClick={()=>setShowNew(false)}>Cancelar</button>
              <button type="submit" className="spicy-btn-primary" disabled={saving||!form.client_name.trim()||!form.category}>Crear ticket</button>
            </div>
          </form>
        </div>
      )}

      {/* Ticket detail modal */}
      {detail && (()=>{
        return (
          <div onClick={()=>setDetail(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:"white",borderRadius:16,width:"100%",maxWidth:520,maxHeight:"85vh",overflowY:"auto",padding:24,display:"flex",flexDirection:"column",gap:12 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                <div style={{ flex:1 }}>
                  <input key={detail.id} defaultValue={detail.client_name}
                    onBlur={e=>updateTicket(detail,{client_name:e.target.value.trim()||detail.client_name})}
                    style={{ fontSize:16,fontWeight:700,color:"#111",border:"none",outline:"none",width:"100%",padding:0,fontFamily:"inherit",background:"transparent" }}/>
                  <div style={{ fontSize:12,color:"#aaa",marginTop:3 }}>creado {new Date(detail.created_at).toLocaleDateString("es-UY")}</div>
                </div>
                <button onClick={()=>setDetail(null)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#ccc",lineHeight:1 }}>×</button>
              </div>

              {detail.message && <div style={{ fontSize:13,color:"#444",background:"#F7F7F8",borderRadius:10,padding:12 }}>{detail.message}</div>}

              <div style={{ display:"flex",gap:12 }}>
                <label style={{ fontSize:12,color:"#666",fontWeight:500,flex:1 }}>Categoría
                  <select value={detail.category} onChange={e=>updateTicket(detail,{category:e.target.value})} className="spicy-select" style={{ width:"100%",marginTop:4 }}>
                    {TICKET_CATEGORIES.map(c=><option key={c.key} value={c.key}>{c.emoji} {c.key}</option>)}
                  </select>
                </label>
                <label style={{ fontSize:12,color:"#666",fontWeight:500,flex:1 }}>Prioridad
                  <select value={detail.priority} onChange={e=>updateTicket(detail,{priority:e.target.value})} className="spicy-select" style={{ width:"100%",marginTop:4 }}>
                    {TICKET_PRIORITIES.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
              </div>

              <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Estado
                <select value={detail.status} onChange={e=>moveStatus(detail, e.target.value)} className="spicy-select" style={{ width:"100%",marginTop:4 }}>
                  {TICKET_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              {statusError && <div style={{ fontSize:12,color:ST_RED,background:"#FEF0F0",borderRadius:8,padding:"6px 10px" }}>{statusError}</div>}

              <div>
                <div style={{ fontSize:12,color:"#666",fontWeight:500,marginBottom:6 }}>Asignados</div>
                <AssigneesPicker entityType="ticket" entityId={detail.id} assignees={assignees} allUsers={allUsers} onChange={onRefresh}/>
              </div>

              <div>
                <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Puntaje Fibonacci (esfuerzo)
                  <select value={detail.fibonacci_score||""} disabled={!canEditFibonacci}
                    onChange={e=>updateTicket(detail,{fibonacci_score:e.target.value?Number(e.target.value):null})}
                    className="spicy-select" style={{ width:"100%",marginTop:4 }}>
                    <option value="">Sin estimar</option>
                    {FIBONACCI_SCALE.map(f=><option key={f.value} value={f.value}>{f.value} — {f.label}</option>)}
                  </select>
                </label>
                {!canEditFibonacci && <div style={{ fontSize:11,color:"#aaa",marginTop:3 }}>Solo usuarios dev o admin pueden editar el puntaje.</div>}
                <div style={{ fontSize:11,color:"#aaa",marginTop:6,lineHeight:1.5 }}>
                  {FIBONACCI_SCALE.map(f=><div key={f.value}><b>{f.value}</b>: {f.help}</div>)}
                </div>
              </div>

              <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Nota de resolución
                <textarea key={detail.id} defaultValue={detail.resolution_note||""} onBlur={e=>updateTicket(detail,{resolution_note:e.target.value||null})} className="spicy-input" rows={2} style={{ width:"100%",marginTop:4,resize:"vertical" }}/>
              </label>

              {devTasks.filter(t=>t.ticket_id===detail.id).length>0 && (
                <div>
                  <div style={{ fontSize:12,color:"#666",fontWeight:500,marginBottom:6 }}>Tareas de dev vinculadas</div>
                  <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
                    {devTasks.filter(t=>t.ticket_id===detail.id).map(t=>(
                      <div key={t.id} onClick={()=>setView("devtasks")} style={{ fontSize:12,color:ST_RED,cursor:"pointer" }}>{t.title} →</div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize:12,color:"#666",fontWeight:500,marginBottom:6 }}>Comentarios</div>
                <CommentsThread entityType="ticket" entityId={detail.id} comments={comments} currentUserId={currentUserId} currentUserEmail={currentUserEmail} onChange={onRefresh}/>
              </div>

              <div>
                <div style={{ fontSize:12,color:"#666",fontWeight:500,marginBottom:6 }}>Adjuntos</div>
                <AttachmentsList entityType="ticket" entityId={detail.id} attachments={attachments} currentUserEmail={currentUserEmail} onChange={onRefresh}/>
              </div>

              <div>
                <div style={{ fontSize:12,color:"#666",fontWeight:500,marginBottom:6 }}>Historial de estados</div>
                <HistoryList entries={statusHistory.filter(h=>h.ticket_id===detail.id)} labelKey="status"/>
              </div>

              <div style={{ display:"flex",justifyContent:"space-between",marginTop:8 }}>
                <button className="spicy-btn-secondary" style={{ color:ST_RED,borderColor:ST_RED_BG }} onClick={()=>deleteTicket(detail)}>Eliminar ticket</button>
                <button className="spicy-btn-primary" onClick={()=>setDetail(null)}>Listo</button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

// ── Dev Tasks View (Kanban, tareas de desarrollo de producto) ──────────────
function DevTasksView({ devTasks, statusHistory, allUsers, currentUserEmail, currentUserId, canEditFibonacci, assignees, comments, attachments, tickets, onRefresh }) {
  const [showNew, setShowNew] = useState(false);
  const [detail,  setDetail]  = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [form, setForm] = useState({ title:"", description:"", assigneeIds:[] });
  const [saving, setSaving] = useState(false);
  const [stageError, setStageError] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterUnestimated, setFilterUnestimated] = useState(false);

  const assigneesFor = (taskId) => assignees.filter(a=>a.entity_type==="dev_task" && a.entity_id===taskId).map(a=>allUsers.find(u=>u.user_id===a.user_id)).filter(Boolean);
  const commentsCount = (taskId) => comments.filter(c=>c.entity_type==="dev_task" && c.entity_id===taskId).length;
  const attachmentsCount = (taskId) => attachments.filter(a=>a.entity_type==="dev_task" && a.entity_id===taskId).length;

  const visibleTasks = devTasks.filter(t => {
    if (filterAssignee && !assignees.some(a=>a.entity_type==="dev_task"&&a.entity_id===t.id&&a.user_id===filterAssignee)) return false;
    if (filterUnestimated && t.fibonacci_score) return false;
    return true;
  });

  async function createDevTask(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const id = "dt_"+Date.now();
    const stage = "Backlog";
    await sb.from("dev_tasks").insert({
      id, title: form.title.trim(), description: form.description.trim()||null, stage,
    });
    await sb.from("dev_task_status_history").insert({ id:"dth_"+Date.now(), dev_task_id:id, stage, changed_by:currentUserEmail });
    if (form.assigneeIds.length) {
      await sb.from("entity_assignees").insert(form.assigneeIds.map(userId=>({ id:"ea_"+Date.now()+"_"+Math.random().toString(36).slice(2,6), entity_type:"dev_task", entity_id:id, user_id:userId })));
    }
    setSaving(false);
    setForm({ title:"", description:"", assigneeIds:[] });
    setShowNew(false);
    onRefresh();
  }

  async function updateDevTask(task, patch) {
    await sb.from("dev_tasks").update(patch).eq("id", task.id);
    setDetail(d => d && d.id===task.id ? { ...d, ...patch } : d);
    onRefresh();
  }

  async function moveStage(task, newStage) {
    if (newStage === task.stage) return;
    if (newStage === DEV_TASK_STAGE_EN_CURSO && !task.fibonacci_score) {
      setStageError("Esta tarea necesita un puntaje Fibonacci antes de pasar a \"In Progress\".");
      return;
    }
    setStageError("");
    await updateDevTask(task, { stage: newStage });
    await sb.from("dev_task_status_history").insert({ id:"dth_"+Date.now()+"_"+Math.random().toString(36).slice(2,6), dev_task_id:task.id, stage:newStage, changed_by:currentUserEmail });
    onRefresh();
  }

  async function deleteDevTask(task) {
    await sb.from("dev_tasks").delete().eq("id", task.id);
    setDetail(null);
    onRefresh();
  }

  return (
    <>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,gap:12,flexWrap:"wrap" }}>
        <div>
          <div style={{ fontSize:20,fontWeight:700,color:"#111" }}>Tareas de desarrollo</div>
          <div style={{ fontSize:13,color:"#888",marginTop:4 }}>{visibleTasks.length} tareas · Devs</div>
        </div>
        <div style={{ display:"flex",gap:10,alignItems:"center",flexWrap:"wrap" }}>
          <select value={filterAssignee} onChange={e=>setFilterAssignee(e.target.value)} className="spicy-select">
            <option value="">Todos los asignados</option>
            {allUsers.map(u=><option key={u.user_id} value={u.user_id}>{userDisplayName(u)}</option>)}
          </select>
          <label style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#666" }}>
            <input type="checkbox" checked={filterUnestimated} onChange={e=>setFilterUnestimated(e.target.checked)}/> Sin estimar
          </label>
          <button className="spicy-btn-primary" onClick={()=>setShowNew(true)}>+ Nueva tarea</button>
        </div>
      </div>

      <div style={{ overflowX:"auto", paddingBottom:8 }}>
        <div style={{ display:"flex", gap:14, minWidth: DEV_TASK_STAGES.length * 250 }}>
          {DEV_TASK_STAGES.map(stage => {
            const col = visibleTasks.filter(t => t.stage === stage);
            return (
              <div key={stage}
                onDragOver={e=>{ e.preventDefault(); setDragOverStage(stage); }}
                onDragLeave={()=>setDragOverStage(s=>s===stage?null:s)}
                onDrop={e=>{
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/dev-task-id");
                  const t = devTasks.find(x=>x.id===id);
                  setDragOverStage(null);
                  if (t && t.stage!==stage) moveStage(t, stage);
                }}
                style={{
                  width:236, flexShrink:0, background: dragOverStage===stage?"#FFF3EE":"#F7F7F8",
                  border:"1px solid #EBEBEB", borderRadius:12, padding:10, minHeight:120,
                }}>
                <div style={{ fontSize:12,fontWeight:700,color:"#555",marginBottom:10,display:"flex",justifyContent:"space-between" }}>
                  <span>{stage}</span>
                  <span style={{ color:"#bbb" }}>{col.length}</span>
                </div>
                {col.map(t => (
                  <div key={t.id} draggable
                    onDragStart={e=>e.dataTransfer.setData("text/dev-task-id", t.id)}
                    onClick={()=>setDetail(t)}
                    style={{ background:"white",border:"1px solid #EBEBEB",borderRadius:10,padding:"10px 12px",marginBottom:8,cursor:"grab",boxShadow:"0 1px 2px rgba(0,0,0,0.03)" }}>
                    <div style={{ fontSize:13,fontWeight:600,color:"#111",marginBottom:4 }}>{t.title}</div>
                    {t.description && <div style={{ fontSize:12,color:"#888",overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" }}>{t.description}</div>}
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8 }}>
                      <div style={{ display:"flex",gap:4 }}>
                        {assigneesFor(t.id).map(u=><Avatar key={u.user_id} name={userDisplayName(u)} size={20}/>)}
                        {assigneesFor(t.id).length===0 && <span style={{ fontSize:11,color:"#ccc" }}>Sin asignar</span>}
                      </div>
                      <span style={{ display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#aaa" }}>
                        {t.fibonacci_score && <span className="spicy-badge-gray">{t.fibonacci_score}</span>}
                        {commentsCount(t.id)>0 && <span>💬{commentsCount(t.id)}</span>}
                        {attachmentsCount(t.id)>0 && <span>📎{attachmentsCount(t.id)}</span>}
                      </span>
                    </div>
                  </div>
                ))}
                {col.length===0 && <div style={{ fontSize:11,color:"#ccc",textAlign:"center",padding:"12px 0" }}>Sin tareas</div>}
              </div>
            );
          })}
        </div>
      </div>

      {showNew && (
        <div onClick={()=>setShowNew(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
          <form onClick={e=>e.stopPropagation()} onSubmit={createDevTask} style={{ background:"white",borderRadius:16,width:"100%",maxWidth:480,padding:24,display:"flex",flexDirection:"column",gap:14,maxHeight:"85vh",overflowY:"auto" }}>
            <div style={{ fontSize:16,fontWeight:700,color:"#111" }}>Nueva tarea de desarrollo</div>
            <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Título
              <input required autoFocus className="spicy-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={{ width:"100%",marginTop:4 }}/>
            </label>
            <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Descripción
              <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} className="spicy-input" rows={3} style={{ width:"100%",marginTop:4,resize:"vertical" }}/>
            </label>
            <div>
              <div style={{ fontSize:12,color:"#666",fontWeight:500,marginBottom:4 }}>Responsable</div>
              <AssigneesPickerLocal selectedIds={form.assigneeIds} allUsers={allUsers} onChange={ids=>setForm(f=>({...f,assigneeIds:ids}))}/>
            </div>
            <div style={{ display:"flex",justifyContent:"flex-end",gap:8,marginTop:4 }}>
              <button type="button" className="spicy-btn-secondary" onClick={()=>setShowNew(false)}>Cancelar</button>
              <button type="submit" className="spicy-btn-primary" disabled={saving||!form.title.trim()}>Crear tarea</button>
            </div>
          </form>
        </div>
      )}

      {detail && (
        <div onClick={()=>setDetail(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"white",borderRadius:16,width:"100%",maxWidth:520,maxHeight:"85vh",overflowY:"auto",padding:24,display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
              <input key={detail.id} defaultValue={detail.title}
                onBlur={e=>updateDevTask(detail,{title:e.target.value.trim()||detail.title})}
                style={{ fontSize:16,fontWeight:700,color:"#111",border:"none",outline:"none",width:"100%",padding:0,fontFamily:"inherit",background:"transparent" }}/>
              <button onClick={()=>setDetail(null)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#ccc",lineHeight:1 }}>×</button>
            </div>

            <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Descripción
              <textarea key={detail.id} defaultValue={detail.description||""} onBlur={e=>updateDevTask(detail,{description:e.target.value||null})} className="spicy-input" rows={3} style={{ width:"100%",marginTop:4,resize:"vertical" }}/>
            </label>

            <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Etapa
              <select value={detail.stage} onChange={e=>moveStage(detail, e.target.value)} className="spicy-select" style={{ width:"100%",marginTop:4 }}>
                {DEV_TASK_STAGES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            {stageError && <div style={{ fontSize:12,color:ST_RED,background:"#FEF0F0",borderRadius:8,padding:"6px 10px" }}>{stageError}</div>}

            <div>
              <div style={{ fontSize:12,color:"#666",fontWeight:500,marginBottom:6 }}>Asignados</div>
              <AssigneesPicker entityType="dev_task" entityId={detail.id} assignees={assignees} allUsers={allUsers} onChange={onRefresh}/>
            </div>

            <div>
              <div style={{ fontSize:12,color:"#666",fontWeight:500,marginBottom:4 }}>Ticket relacionado</div>
              <SearchSelect
                options={tickets.map(t=>({ value:t.id, label:`${t.client_name} — ${t.category}` }))}
                value={detail.ticket_id||null}
                onChange={id=>updateDevTask(detail,{ticket_id:id})}
                placeholder="Buscar ticket por cliente..."/>
            </div>

            <div>
              <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Puntaje Fibonacci (esfuerzo)
                <select value={detail.fibonacci_score||""} disabled={!canEditFibonacci}
                  onChange={e=>updateDevTask(detail,{fibonacci_score:e.target.value?Number(e.target.value):null})}
                  className="spicy-select" style={{ width:"100%",marginTop:4 }}>
                  <option value="">Sin estimar</option>
                  {FIBONACCI_SCALE.map(f=><option key={f.value} value={f.value}>{f.value} — {f.label}</option>)}
                </select>
              </label>
              {!canEditFibonacci && <div style={{ fontSize:11,color:"#aaa",marginTop:3 }}>Solo usuarios dev o admin pueden editar el puntaje.</div>}
              <div style={{ fontSize:11,color:"#aaa",marginTop:6,lineHeight:1.5 }}>
                {FIBONACCI_SCALE.map(f=><div key={f.value}><b>{f.value}</b>: {f.help}</div>)}
              </div>
            </div>

            <div>
              <div style={{ fontSize:12,color:"#666",fontWeight:500,marginBottom:6 }}>Comentarios</div>
              <CommentsThread entityType="dev_task" entityId={detail.id} comments={comments} currentUserId={currentUserId} currentUserEmail={currentUserEmail} onChange={onRefresh}/>
            </div>

            <div>
              <div style={{ fontSize:12,color:"#666",fontWeight:500,marginBottom:6 }}>Adjuntos</div>
              <AttachmentsList entityType="dev_task" entityId={detail.id} attachments={attachments} currentUserEmail={currentUserEmail} onChange={onRefresh}/>
            </div>

            <div>
              <div style={{ fontSize:12,color:"#666",fontWeight:500,marginBottom:6 }}>Historial de etapas</div>
              <HistoryList entries={statusHistory.filter(h=>h.dev_task_id===detail.id)} labelKey="stage"/>
            </div>

            <div style={{ display:"flex",justifyContent:"space-between",marginTop:8 }}>
              <button className="spicy-btn-secondary" style={{ color:ST_RED,borderColor:ST_RED_BG }} onClick={()=>deleteDevTask(detail)}>Eliminar tarea</button>
              <button className="spicy-btn-primary" onClick={()=>setDetail(null)}>Listo</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Devs Metrics View (dashboard) ───────────────────────────────────────────
function DevsMetricsView({ tickets, ticketHistory, devTasks, devTaskHistory, assignees, allUsers, setView }) {
  const [typeFilter, setTypeFilter] = useState("all"); // 'all' | 'tickets' | 'dev'
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const inRange = (iso) => (!fromDate || iso>=fromDate) && (!toDate || iso<=toDate);
  const weekOf = (iso) => {
    const d = new Date(iso);
    const day = (d.getDay()+6)%7; // lunes=0
    d.setDate(d.getDate()-day);
    return d.toISOString().split("T")[0];
  };
  const assigneeIdsFor = (entityType, entityId) => assignees.filter(a=>a.entity_type===entityType && a.entity_id===entityId).map(a=>a.user_id);

  const showTickets = typeFilter!=="dev";
  const showDev = typeFilter!=="tickets";

  const linkedDevTaskByTicket = {};
  devTasks.forEach(dt=>{ if (dt.ticket_id) linkedDevTaskByTicket[dt.ticket_id] = dt; });
  const devTaskClosed = (dtId) => devTaskHistory.some(h=>h.dev_task_id===dtId && DEV_TASK_STAGES_CERRADOS.includes(h.stage));

  // Items cerrados (con fecha de cierre + puntaje) para velocidad / puntos soporte vs producto.
  // Una tarea de dev vinculada a un ticket cuenta como "soporte" — si ambos cerraron, se
  // descarta el evento del ticket para no duplicar el puntaje (solo cuando se ven los dos
  // tipos juntos; filtrado a un solo tipo no hay riesgo de doble conteo).
  let closedTicketEvents = showTickets ? ticketHistory
    .filter(h=>TICKET_STATUS_GROUPS["Cerrados"].includes(h.status) && inRange(h.changed_at.split("T")[0]))
    .map(h=>{
      const t = tickets.find(x=>x.id===h.ticket_id);
      if (!t) return null;
      const linkedTask = linkedDevTaskByTicket[t.id];
      return { id:t.id, week:weekOf(h.changed_at), score:t.fibonacci_score||0, assigneeIds:assigneeIdsFor("ticket",t.id), category:"soporte", linkedTaskClosed: !!(linkedTask && devTaskClosed(linkedTask.id)) };
    })
    .filter(Boolean) : [];
  if (typeFilter==="all") closedTicketEvents = closedTicketEvents.filter(e=>!e.linkedTaskClosed);

  const closedDevEvents = showDev ? devTaskHistory
    .filter(h=>DEV_TASK_STAGES_CERRADOS.includes(h.stage) && inRange(h.changed_at.split("T")[0]))
    .map(h=>{ const t=devTasks.find(x=>x.id===h.dev_task_id); return t?{ id:t.id, week:weekOf(h.changed_at), score:t.fibonacci_score||0, assigneeIds:assigneeIdsFor("dev_task",t.id), category: t.ticket_id?"soporte":"producto" }:null; })
    .filter(Boolean) : [];

  const allClosedEvents = [...closedTicketEvents, ...closedDevEvents];
  const weeks = [...new Set(allClosedEvents.map(e=>e.week))].sort();

  const velocityByWeek = weeks.map(w=>({
    week: w,
    ticketPoints: allClosedEvents.filter(e=>e.week===w && e.category==="soporte").reduce((s,e)=>s+e.score,0),
    devPoints: allClosedEvents.filter(e=>e.week===w && e.category==="producto").reduce((s,e)=>s+e.score,0),
  }));
  const maxWeekly = Math.max(1, ...velocityByWeek.map(w=>w.ticketPoints+w.devPoints));

  const byPerson = {};
  allClosedEvents.forEach(e=>{
    const ids = e.assigneeIds.length ? e.assigneeIds : ["__unassigned__"];
    const share = e.score / ids.length;
    ids.forEach(id=>{ byPerson[id] = (byPerson[id]||0) + share; });
  });
  const workloadPoints = Object.entries(byPerson).map(([id,points])=>{
    const u = allUsers.find(x=>x.user_id===id);
    return { name: u ? userDisplayName(u) : "Sin asignar", points: Math.round(points*10)/10 };
  }).sort((a,b)=>b.points-a.points);
  const maxPersonPoints = Math.max(1, ...workloadPoints.map(w=>w.points));

  // Cycle time dev (creación → primera Testeando (Prod)) y tiempo de resolución (creación → primera Solucionado)
  const firstEntryTo = (hist, idField, id, status, statusField) => hist
    .filter(h=>h[idField]===id && h[statusField]===status)
    .sort((a,b)=>a.changed_at.localeCompare(b.changed_at))[0];
  const devCycleTimes = showTickets ? tickets
    .map(t=>({ t, h: firstEntryTo(ticketHistory,"ticket_id",t.id,"Testeando (Prod)","status") }))
    .filter(x=>x.h && inRange(x.h.changed_at.split("T")[0]))
    .map(x=>new Date(x.h.changed_at)-new Date(x.t.created_at)) : [];
  const resolutionTimes = showTickets ? tickets
    .map(t=>({ t, h: firstEntryTo(ticketHistory,"ticket_id",t.id,"Solucionado","status") }))
    .filter(x=>x.h && inRange(x.h.changed_at.split("T")[0]))
    .map(x=>new Date(x.h.changed_at)-new Date(x.t.created_at)) : [];
  const avg = (arr) => arr.length ? arr.reduce((s,x)=>s+x,0)/arr.length : null;

  // Tiempo promedio en cada estado (tickets)
  const avgTimeInStatus = TICKET_STATUSES.map(status=>{
    const durations = [];
    tickets.forEach(t=>{
      const h = ticketHistory.filter(x=>x.ticket_id===t.id).sort((a,b)=>a.changed_at.localeCompare(b.changed_at));
      h.forEach((entry,i)=>{
        if (entry.status!==status) return;
        const next = h[i+1];
        const end = next ? new Date(next.changed_at) : new Date();
        durations.push(end-new Date(entry.changed_at));
      });
    });
    return { status, avgMs: avg(durations) };
  }).filter(x=>x.avgMs!=null);

  const ticketsByCategory = TICKET_CATEGORIES.map(c=>({ label:c.key, emoji:c.emoji, count: tickets.filter(t=>t.category===c.key).length }));
  const maxByCategory = Math.max(1, ...ticketsByCategory.map(x=>x.count));

  const unestimated = [
    ...(showTickets ? tickets.filter(t=>!t.fibonacci_score && statusGroup(t.status)!=="Sin empezar").map(t=>({ id:t.id, label:t.client_name, kind:"ticket" })) : []),
    ...(showDev ? devTasks.filter(t=>!t.fibonacci_score && t.stage!=="Backlog").map(t=>({ id:t.id, label:t.title, kind:"dev" })) : []),
  ];

  return (
    <>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12 }}>
        <div style={{ fontSize:20,fontWeight:700,color:"#111" }}>Devs — Resumen</div>
        <div style={{ display:"flex",gap:10,alignItems:"center",flexWrap:"wrap" }}>
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="spicy-select">
            <option value="all">Tickets + Producto</option>
            <option value="tickets">Solo tickets</option>
            <option value="dev">Solo desarrollo de producto</option>
          </select>
          <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="spicy-input"/>
          <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="spicy-input"/>
        </div>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20 }}>
        <div className="spicy-kpi">
          <div className="spicy-kpi-label">Cycle time dev prom.</div>
          <div className="spicy-kpi-value">{fmtDuration(avg(devCycleTimes))}</div>
          <div className="spicy-kpi-sub">{devCycleTimes.length} tickets con dato</div>
        </div>
        <div className="spicy-kpi">
          <div className="spicy-kpi-label">Resolución prom.</div>
          <div className="spicy-kpi-value">{fmtDuration(avg(resolutionTimes))}</div>
          <div className="spicy-kpi-sub">{resolutionTimes.length} tickets resueltos</div>
        </div>
        <div className="spicy-kpi" style={{ cursor:"pointer" }} onClick={()=>setView("devtasks")}>
          <div className="spicy-kpi-label">Puntos esta semana</div>
          <div className="spicy-kpi-value">{velocityByWeek.length ? velocityByWeek[velocityByWeek.length-1].ticketPoints+velocityByWeek[velocityByWeek.length-1].devPoints : 0}</div>
        </div>
        <div className="spicy-kpi" style={{ cursor:unestimated.length?"pointer":"default" }}>
          <div className="spicy-kpi-label">Sin estimar</div>
          <div className="spicy-kpi-value" style={{ color:unestimated.length?ST_RED:"#111" }}>{unestimated.length}</div>
        </div>
      </div>

      <div style={{ display:"flex",gap:16,flexWrap:"wrap" }}>
        <div className="spicy-card" style={{ flex:"1 1 320px" }}>
          <div style={{ fontSize:14,fontWeight:600,color:"#111",marginBottom:14 }}>Velocidad — puntos cerrados por semana <span style={{ fontSize:11,color:"#aaa",fontWeight:400 }}>(soporte vs. producto)</span></div>
          {velocityByWeek.length===0 && <div style={{ fontSize:13,color:"#bbb",textAlign:"center",padding:"1rem" }}>Sin datos todavía.</div>}
          {velocityByWeek.map(w=>(
            <div key={w.week} style={{ marginBottom:12 }}>
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6 }}>
                <span style={{ color:"#555" }}>{w.week}</span>
                <span style={{ fontWeight:600,color:"#111" }}>{w.ticketPoints+w.devPoints} pts</span>
              </div>
              <div style={{ height:8,background:"#F3F3F3",borderRadius:4,overflow:"hidden",display:"flex" }}>
                <div style={{ height:"100%",width:`${Math.round((w.ticketPoints/maxWeekly)*100)}%`,background:ST_RED }}/>
                <div style={{ height:"100%",width:`${Math.round((w.devPoints/maxWeekly)*100)}%`,background:"#533AB7" }}/>
              </div>
            </div>
          ))}
        </div>

        <div className="spicy-card" style={{ flex:"1 1 320px" }}>
          <div style={{ fontSize:14,fontWeight:600,color:"#111",marginBottom:14 }}>Carga de trabajo <span style={{ fontSize:11,color:"#aaa",fontWeight:400 }}>— puntos cerrados por persona, no es un ranking</span></div>
          {workloadPoints.length===0 && <div style={{ fontSize:13,color:"#bbb",textAlign:"center",padding:"1rem" }}>Sin datos todavía.</div>}
          {workloadPoints.map(w=>(
            <div key={w.name} style={{ marginBottom:12 }}>
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6 }}>
                <span style={{ color:"#555" }}>{w.name}</span>
                <span style={{ fontWeight:600,color:"#111" }}>{w.points} pts</span>
              </div>
              <div style={{ height:6,background:"#F3F3F3",borderRadius:4,overflow:"hidden" }}>
                <div style={{ height:"100%",width:`${Math.round((w.points/maxPersonPoints)*100)}%`,background:"#533AB7",borderRadius:4 }}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:"flex",gap:16,flexWrap:"wrap",marginTop:16 }}>
        <div className="spicy-card" style={{ flex:"1 1 320px" }}>
          <div style={{ fontSize:14,fontWeight:600,color:"#111",marginBottom:14 }}>Tiempo promedio por estado (tickets)</div>
          {avgTimeInStatus.length===0 && <div style={{ fontSize:13,color:"#bbb",textAlign:"center",padding:"1rem" }}>Sin datos todavía.</div>}
          {avgTimeInStatus.map(x=>(
            <div key={x.status} className="spicy-table-row">
              <span style={{ flex:1,fontSize:13,color:"#555" }}>{x.status}</span>
              <span style={{ fontSize:13,fontWeight:600,color:"#111" }}>{fmtDuration(x.avgMs)}</span>
            </div>
          ))}
        </div>

        <div className="spicy-card" style={{ flex:"1 1 320px" }}>
          <div style={{ fontSize:14,fontWeight:600,color:"#111",marginBottom:14 }}>Tickets por categoría</div>
          {ticketsByCategory.every(x=>x.count===0) && <div style={{ fontSize:13,color:"#bbb",textAlign:"center",padding:"1rem" }}>Sin tickets todavía.</div>}
          {ticketsByCategory.filter(x=>x.count>0).map(x=>(
            <div key={x.label} style={{ marginBottom:12 }}>
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6 }}>
                <span style={{ color:"#555" }}>{x.emoji} {x.label}</span>
                <span style={{ fontWeight:600,color:"#111" }}>{x.count}</span>
              </div>
              <div style={{ height:6,background:"#F3F3F3",borderRadius:4,overflow:"hidden" }}>
                <div style={{ height:"100%",width:`${Math.round((x.count/maxByCategory)*100)}%`,background:ST_RED,borderRadius:4 }}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="spicy-card" style={{ marginTop:16 }}>
        <div style={{ fontSize:14,fontWeight:600,color:"#111",marginBottom:14 }}>Sin estimar <span style={{ fontSize:11,color:"#aaa",fontWeight:400 }}>— en curso o cerrados sin puntaje Fibonacci</span></div>
        {unestimated.length===0 && <div style={{ fontSize:13,color:"#bbb",textAlign:"center",padding:"1rem" }}>Nada sin estimar. 🎉</div>}
        {unestimated.map(u=>(
          <div key={u.kind+u.id} className="spicy-table-row" style={{ cursor:"pointer" }} onClick={()=>setView(u.kind==="ticket"?"tickets":"devtasks")}>
            <span style={{ flex:1,fontSize:13,color:"#111" }}>{u.label}</span>
            <span style={{ fontSize:12,color:ST_RED,fontWeight:600 }}>Ver →</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Tasks View (Kanban + Calendario) ────────────────────────────────────────
function TasksView({ tasks, comments, currentUserEmail, onRefresh }) {
  const todayISO = new Date().toISOString().split("T")[0];
  const emptyForm = () => ({ title:"", start_date:todayISO, end_date:todayISO, assigned_to:"", priority:"Media", description:"" });

  const [mode, setMode] = useState("kanban"); // 'kanban' | 'calendar'
  const [calMode, setCalMode] = useState("month"); // 'month' | 'week'
  const [calCursor, setCalCursor] = useState(new Date());
  const [filterAssigned, setFilterAssigned] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [newComment, setNewComment] = useState("");

  const visible = filterAssigned ? tasks.filter(t=>t.assigned_to===filterAssigned) : tasks;
  const prioClass = (p) => p==="Alta" ? "spicy-badge-red" : p==="Media" ? "spicy-badge-amber" : "spicy-badge-gray";
  const PRIO_COLOR = { Alta: ST_RED, Media: "#D97706", Baja: "#9CA3AF" };
  const getComments = (taskId) => comments.filter(c=>c.task_id===taskId).sort((a,b)=>a.created_at.localeCompare(b.created_at));
  const fmtRange = (t) => {
    const s = new Date(t.start_date+"T00:00:00"), e = new Date(t.end_date+"T00:00:00");
    const f = (d) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
    return t.start_date === t.end_date ? f(s) : `${f(s)} → ${f(e)}`;
  };

  async function createTask(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.start_date || !form.end_date || form.end_date < form.start_date) return;
    setSaving(true);
    await sb.from("tasks").insert({
      id: "task_"+Date.now(),
      title: form.title.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      assigned_to: form.assigned_to || null,
      priority: form.priority,
      stage: "Sin Empezar",
      description: form.description.trim() || null,
    });
    setSaving(false);
    setForm(emptyForm());
    setShowNew(false);
    onRefresh();
  }

  async function updateTask(task, patch) {
    await sb.from("tasks").update(patch).eq("id", task.id);
    setDetail(d => d && d.id===task.id ? { ...d, ...patch } : d);
    onRefresh();
  }

  async function deleteTask(task) {
    await sb.from("tasks").delete().eq("id", task.id);
    setDetail(null);
    onRefresh();
  }

  async function addComment(task) {
    if (!newComment.trim()) return;
    await sb.from("task_comments").insert({
      id: "cm_"+Date.now(),
      task_id: task.id,
      author: currentUserEmail,
      text: newComment.trim(),
    });
    setNewComment("");
    onRefresh();
  }

  function openDetail(task) {
    setDetail(task);
    setNewComment("");
  }

  // ── Calendar grid helpers ──────────────────────────────────────────────
  function isoOf(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
  function startOfWeek(d) { const dow=(d.getDay()+6)%7; const s=new Date(d); s.setDate(d.getDate()-dow); return s; }
  function buildGrid() {
    if (calMode === "week") return Array.from({length:7},(_,i)=>{ const d=new Date(startOfWeek(calCursor)); d.setDate(d.getDate()+i); return d; });
    const first = new Date(calCursor.getFullYear(), calCursor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    return Array.from({length:42},(_,i)=>{ const d=new Date(gridStart); d.setDate(gridStart.getDate()+i); return d; });
  }
  const gridDays = buildGrid();
  const calLabel = calMode === "month"
    ? `${MONTH_LABELS[calCursor.getMonth()]} ${calCursor.getFullYear()}`
    : (() => { const s=gridDays[0], e=gridDays[6]; const f=(d)=>`${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`; return `${f(s)} – ${f(e)}`; })();
  function shiftCursor(delta) {
    setCalCursor(c => { const d = new Date(c); if (calMode==="month") d.setMonth(d.getMonth()+delta); else d.setDate(d.getDate()+delta*7); return d; });
  }
  function tasksForDay(d) {
    const iso = isoOf(d);
    return visible.filter(t => t.start_date <= iso && iso <= t.end_date);
  }

  const toggleBtn = (active) => ({ padding:"7px 14px",fontSize:12,fontWeight:600,border:"none",cursor:"pointer",background:active?ST_RED:"white",color:active?"white":"#666" });

  return (
    <>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,gap:12,flexWrap:"wrap" }}>
        <div>
          <div style={{ fontSize:20,fontWeight:700,color:"#111" }}>Tareas</div>
          <div style={{ fontSize:13,color:"#888",marginTop:4 }}>{visible.length} tareas · Operaciones</div>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
          <select className="spicy-select" value={filterAssigned} onChange={e=>setFilterAssigned(e.target.value)}>
            <option value="">Todos los responsables</option>
            {TICKET_TEAM.map(n=><option key={n} value={n}>{n}</option>)}
          </select>
          <div style={{ display:"flex",border:"1px solid #E0E0E0",borderRadius:8,overflow:"hidden" }}>
            <button onClick={()=>setMode("kanban")} style={toggleBtn(mode==="kanban")}>Kanban</button>
            <button onClick={()=>setMode("calendar")} style={toggleBtn(mode==="calendar")}>Calendario</button>
          </div>
          <button className="spicy-btn-primary" onClick={()=>setShowNew(true)}>+ Nueva tarea</button>
        </div>
      </div>

      {mode==="calendar" && (
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <button className="spicy-btn-secondary" onClick={()=>shiftCursor(-1)}>‹</button>
            <div style={{ fontSize:14,fontWeight:600,color:"#111",minWidth:150,textAlign:"center" }}>{calLabel}</div>
            <button className="spicy-btn-secondary" onClick={()=>shiftCursor(1)}>›</button>
            <button className="spicy-btn-secondary" onClick={()=>setCalCursor(new Date())}>Hoy</button>
          </div>
          <div style={{ display:"flex",border:"1px solid #E0E0E0",borderRadius:8,overflow:"hidden" }}>
            <button onClick={()=>setCalMode("month")} style={toggleBtn(calMode==="month")}>Mes</button>
            <button onClick={()=>setCalMode("week")} style={toggleBtn(calMode==="week")}>Semana</button>
          </div>
        </div>
      )}

      {mode==="kanban" ? (
        <div style={{ overflowX:"auto", paddingBottom:8 }}>
          <div style={{ display:"flex", gap:14, minWidth: TASK_STAGES.length * 250 }}>
            {TASK_STAGES.map(stage => {
              const col = visible.filter(t => t.stage === stage.key);
              return (
                <div key={stage.key}
                  onDragOver={e=>{ e.preventDefault(); setDragOverStage(stage.key); }}
                  onDragLeave={()=>setDragOverStage(s=>s===stage.key?null:s)}
                  onDrop={e=>{
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/task-id");
                    const t = tasks.find(x=>x.id===id);
                    setDragOverStage(null);
                    if (t && t.stage!==stage.key) updateTask(t, {stage: stage.key});
                  }}
                  style={{
                    width:236, flexShrink:0, background: dragOverStage===stage.key?"#FFF3EE":"#F7F7F8",
                    border:"1px solid #EBEBEB", borderRadius:12, padding:10, minHeight:120,
                  }}>
                  <div style={{ fontSize:12,fontWeight:700,color:"#555",marginBottom:10,display:"flex",justifyContent:"space-between" }}>
                    <span>{stage.emoji} {stage.key}</span>
                    <span style={{ color:"#bbb" }}>{col.length}</span>
                  </div>
                  {col.map(t => (
                    <div key={t.id} draggable
                      onDragStart={e=>e.dataTransfer.setData("text/task-id", t.id)}
                      onClick={()=>openDetail(t)}
                      style={{ background:"white",border:"1px solid #EBEBEB",borderRadius:10,padding:"10px 12px",marginBottom:8,cursor:"grab",boxShadow:"0 1px 2px rgba(0,0,0,0.03)" }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,gap:6 }}>
                        <span style={{ fontSize:13,fontWeight:600,color:"#111",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{t.title}</span>
                        <span className={prioClass(t.priority)}>{t.priority}</span>
                      </div>
                      <div style={{ fontSize:11,color:"#999",marginBottom:4 }}>{fmtRange(t)}</div>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6,fontSize:11,color:"#aaa" }}>
                        <span>{t.assigned_to||"Sin asignar"}</span>
                      </div>
                    </div>
                  ))}
                  {col.length===0 && <div style={{ fontSize:11,color:"#ccc",textAlign:"center",padding:"12px 0" }}>Sin tareas</div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ background:"white",border:"1px solid #EBEBEB",borderRadius:12,overflow:"hidden" }}>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)" }}>
            {WEEKDAY_LABELS.map(w => (
              <div key={w} style={{ fontSize:11,fontWeight:700,color:"#999",textAlign:"center",padding:"8px 4px",borderBottom:"1px solid #F0F0F0" }}>{w}</div>
            ))}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)" }}>
            {gridDays.map((d,i) => {
              const iso = isoOf(d);
              const inMonth = calMode==="week" || d.getMonth()===calCursor.getMonth();
              const isToday = iso === todayISO;
              const dayTasks = tasksForDay(d);
              const maxChips = calMode==="week" ? 6 : 3;
              return (
                <div key={i} style={{
                  minHeight: calMode==="week" ? 220 : 92, padding:6,
                  borderRight:(i%7!==6)?"1px solid #F5F5F5":"none",
                  borderBottom:"1px solid #F5F5F5",
                  background: inMonth ? "white" : "#FAFAFA",
                }}>
                  <div style={{
                    fontSize:11,fontWeight:isToday?700:500,color:inMonth?(isToday?ST_RED:"#888"):"#ccc",
                    marginBottom:4,
                    width:isToday?18:"auto",height:isToday?18:"auto",
                    display:isToday?"flex":"block",alignItems:"center",justifyContent:"center",
                    background:isToday?ST_RED_BG:"transparent",borderRadius:isToday?"50%":0,
                  }}>{d.getDate()}</div>
                  {dayTasks.slice(0,maxChips).map(t => (
                    <div key={t.id} onClick={()=>openDetail(t)} title={t.title} style={{
                      fontSize:10,padding:"2px 5px 2px 6px",marginBottom:2,borderRadius:4,
                      background:"#F7F7F8",borderLeft:`3px solid ${PRIO_COLOR[t.priority]}`,
                      cursor:"pointer",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:"#333",
                    }}>{t.title}</div>
                  ))}
                  {dayTasks.length>maxChips && <div style={{ fontSize:10,color:"#aaa",paddingLeft:4 }}>+{dayTasks.length-maxChips} más</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New task modal */}
      {showNew && (
        <div onClick={()=>setShowNew(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
          <form onClick={e=>e.stopPropagation()} onSubmit={createTask} style={{ background:"white",borderRadius:16,width:"100%",maxWidth:480,padding:24,display:"flex",flexDirection:"column",gap:14,maxHeight:"85vh",overflowY:"auto" }}>
            <div style={{ fontSize:16,fontWeight:700,color:"#111" }}>Nueva tarea</div>

            <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Nombre de la tarea
              <input required autoFocus className="spicy-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={{ width:"100%",marginTop:4 }}/>
            </label>

            <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Fecha
              <div style={{ display:"flex",gap:8,alignItems:"center",marginTop:4 }}>
                <input required type="date" className="spicy-input" value={form.start_date} onChange={e=>{ const v=e.target.value; setForm(f=>({...f,start_date:v,end_date: f.end_date<v?v:f.end_date})); }} style={{ flex:1 }}/>
                <span style={{ color:"#bbb" }}>→</span>
                <input required type="date" className="spicy-input" min={form.start_date} value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))} style={{ flex:1 }}/>
              </div>
            </label>

            <div style={{ display:"flex",gap:12 }}>
              <label style={{ fontSize:12,color:"#666",fontWeight:500,flex:1 }}>Responsable
                <select className="spicy-select" value={form.assigned_to} onChange={e=>setForm(f=>({...f,assigned_to:e.target.value}))} style={{ width:"100%",marginTop:4 }}>
                  <option value="">Sin asignar</option>
                  {TICKET_TEAM.map(n=><option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label style={{ fontSize:12,color:"#666",fontWeight:500,flex:1 }}>Prioridad
                <select className="spicy-select" value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={{ width:"100%",marginTop:4 }}>
                  {TICKET_PRIORITIES.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            </div>

            <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Descripción
              <textarea className="spicy-input" rows={3} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{ width:"100%",marginTop:4,resize:"vertical" }}/>
            </label>

            <div style={{ display:"flex",justifyContent:"flex-end",gap:8,marginTop:4 }}>
              <button type="button" className="spicy-btn-secondary" onClick={()=>setShowNew(false)}>Cancelar</button>
              <button type="submit" className="spicy-btn-primary" disabled={saving||!form.title.trim()||form.end_date<form.start_date}>Crear tarea</button>
            </div>
          </form>
        </div>
      )}

      {/* Task detail modal */}
      {detail && (
        <div onClick={()=>setDetail(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"white",borderRadius:16,width:"100%",maxWidth:520,maxHeight:"85vh",overflowY:"auto",padding:24,display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
              <input key={detail.id} defaultValue={detail.title}
                onBlur={e=>updateTask(detail,{title:e.target.value.trim()||detail.title})}
                style={{ fontSize:16,fontWeight:700,color:"#111",border:"none",outline:"none",flex:1,padding:0,fontFamily:"inherit",background:"transparent" }}/>
              <button onClick={()=>setDetail(null)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#ccc",lineHeight:1 }}>×</button>
            </div>

            <div style={{ display:"flex",gap:12 }}>
              <label style={{ fontSize:12,color:"#666",fontWeight:500,flex:1 }}>Inicio
                <input type="date" className="spicy-input" value={detail.start_date} onChange={e=>{ const v=e.target.value; updateTask(detail, { start_date:v, end_date: detail.end_date<v?v:detail.end_date }); }} style={{ width:"100%",marginTop:4 }}/>
              </label>
              <label style={{ fontSize:12,color:"#666",fontWeight:500,flex:1 }}>Fin
                <input type="date" className="spicy-input" min={detail.start_date} value={detail.end_date} onChange={e=>updateTask(detail,{end_date:e.target.value})} style={{ width:"100%",marginTop:4 }}/>
              </label>
            </div>

            <div style={{ display:"flex",gap:12 }}>
              <label style={{ fontSize:12,color:"#666",fontWeight:500,flex:1 }}>Etapa
                <select className="spicy-select" value={detail.stage} onChange={e=>updateTask(detail,{stage:e.target.value})} style={{ width:"100%",marginTop:4 }}>
                  {TASK_STAGES.map(s=><option key={s.key} value={s.key}>{s.emoji} {s.key}</option>)}
                </select>
              </label>
              <label style={{ fontSize:12,color:"#666",fontWeight:500,flex:1 }}>Prioridad
                <select className="spicy-select" value={detail.priority} onChange={e=>updateTask(detail,{priority:e.target.value})} style={{ width:"100%",marginTop:4 }}>
                  {TICKET_PRIORITIES.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            </div>

            <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Responsable
              <select className="spicy-select" value={detail.assigned_to||""} onChange={e=>updateTask(detail,{assigned_to:e.target.value||null})} style={{ width:"100%",marginTop:4 }}>
                <option value="">Sin asignar</option>
                {TICKET_TEAM.map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </label>

            <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Descripción
              <textarea key={detail.id} defaultValue={detail.description||""} onBlur={e=>updateTask(detail,{description:e.target.value||null})} className="spicy-input" rows={3} style={{ width:"100%",marginTop:4,resize:"vertical" }}/>
            </label>

            <div>
              <div style={{ fontSize:12,color:"#666",fontWeight:500,marginBottom:6 }}>Comentarios</div>
              <div style={{ display:"flex",flexDirection:"column",gap:6,maxHeight:180,overflowY:"auto",marginBottom:8 }}>
                {getComments(detail.id).map(c=>(
                  <div key={c.id} style={{ background:"#F7F7F8",borderRadius:8,padding:"7px 10px" }}>
                    <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:"#999",marginBottom:2 }}>
                      <span style={{ fontWeight:600,color:"#666" }}>{c.author}</span>
                      <span>{new Date(c.created_at).toLocaleString("es-UY",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
                    </div>
                    <div style={{ fontSize:13,color:"#333" }}>{c.text}</div>
                  </div>
                ))}
                {getComments(detail.id).length===0 && <div style={{ fontSize:12,color:"#ccc" }}>Sin comentarios todavía.</div>}
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <input className="spicy-input" placeholder="Agregar comentario..." value={newComment}
                  onChange={e=>setNewComment(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addComment(detail); } }}
                  style={{ flex:1 }}/>
                <button className="spicy-btn-primary" onClick={()=>addComment(detail)} disabled={!newComment.trim()}>Enviar</button>
              </div>
            </div>

            <div style={{ display:"flex",justifyContent:"space-between",marginTop:4 }}>
              <button className="spicy-btn-secondary" style={{ color:ST_RED,borderColor:ST_RED_BG }} onClick={()=>deleteTask(detail)}>Eliminar tarea</button>
              <button className="spicy-btn-primary" onClick={()=>setDetail(null)}>Listo</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Onboarding View (Kanban + Tabla) ─────────────────────────────────────────
function OnboardingView({ onboarding, history, onRefresh }) {
  const todayISO = new Date().toISOString().split("T")[0];
  const emptyForm = () => ({ client_name:"", fecha_registro:todayISO, responsable:"", fuente_de_leads:[], bloqueado:false });

  const [mode, setMode] = useState("kanban"); // 'kanban' | 'tabla'
  const [filterEtapa, setFilterEtapa] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [filterResponsable, setFilterResponsable] = useState("");
  const [filterBloqueado, setFilterBloqueado] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState(null);
  const [dragOverEtapa, setDragOverEtapa] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const withEstado = onboarding.map(r => ({ ...r, _estado: calcularEstado(r, new Date()) }));
  const visible = withEstado.filter(r =>
    (!filterEtapa || r.etapa_actual===filterEtapa) &&
    (!filterEstado || r._estado===filterEstado) &&
    (!filterResponsable || r.responsable===filterResponsable) &&
    (!filterBloqueado || r.bloqueado)
  );
  const responsables = [...new Set(onboarding.map(r=>r.responsable).filter(Boolean))];

  const getHistory = (id) => history.filter(h=>h.onboarding_id===id).sort((a,b)=>a.fecha_entrada.localeCompare(b.fecha_entrada));

  async function createRecord(e) {
    e.preventDefault();
    if (!form.client_name.trim()) return;
    setSaving(true);
    const id = "ob_"+Date.now();
    await sb.from("onboarding").insert({
      id,
      client_name: form.client_name.trim(),
      etapa_actual: ONBOARDING_STAGES[0].key,
      fecha_registro: form.fecha_registro,
      fecha_entrada_etapa_actual: form.fecha_registro,
      responsable: form.responsable || null,
      bloqueado: form.bloqueado,
      fuente_de_leads: form.fuente_de_leads,
      estado_de_pago: "No Cobrado",
    });
    await sb.from("onboarding_stage_history").insert({
      id: "oh_"+Date.now(), onboarding_id:id, etapa:ONBOARDING_STAGES[0].key, fecha_entrada: form.fecha_registro,
    });
    setSaving(false);
    setForm(emptyForm());
    setShowNew(false);
    onRefresh();
  }

  async function updateRecord(record, patch) {
    await sb.from("onboarding").update(patch).eq("id", record.id);
    setDetail(d => d && d.id===record.id ? { ...d, ...patch } : d);
    onRefresh();
  }

  async function moveEtapa(record, newEtapa) {
    if (record.etapa_actual === newEtapa) return;
    const patch = { etapa_actual: newEtapa, fecha_entrada_etapa_actual: todayISO };
    await sb.from("onboarding").update(patch).eq("id", record.id);
    await sb.from("onboarding_stage_history").insert({ id:"oh_"+Date.now(), onboarding_id:record.id, etapa:newEtapa, fecha_entrada:todayISO });
    setDetail(d => d && d.id===record.id ? { ...d, ...patch } : d);
    onRefresh();
  }

  async function toggleLeadSource(record, source, checked) {
    const current = record.fuente_de_leads || [];
    const next = checked ? [...current, source] : current.filter(s=>s!==source);
    await updateRecord(record, { fuente_de_leads: next });
  }

  async function toggleIntegracion(record, source, checked) {
    const current = record.integraciones_pendientes || [];
    const next = checked ? [...current, source] : current.filter(s=>s!==source);
    await updateRecord(record, { integraciones_pendientes: next });
  }

  async function deleteRecord(record) {
    await sb.from("onboarding").delete().eq("id", record.id);
    setDetail(null);
    onRefresh();
  }

  const toggleBtn = (active) => ({ padding:"7px 14px",fontSize:12,fontWeight:600,border:"none",cursor:"pointer",background:active?ST_RED:"white",color:active?"white":"#666" });

  return (
    <>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,gap:12,flexWrap:"wrap" }}>
        <div>
          <div style={{ fontSize:20,fontWeight:700,color:"#111" }}>Onboarding</div>
          <div style={{ fontSize:13,color:"#888",marginTop:4 }}>{visible.length} de {onboarding.length} clientes · Operaciones</div>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
          <div style={{ display:"flex",border:"1px solid #E0E0E0",borderRadius:8,overflow:"hidden" }}>
            <button onClick={()=>setMode("kanban")} style={toggleBtn(mode==="kanban")}>Kanban</button>
            <button onClick={()=>setMode("tabla")} style={toggleBtn(mode==="tabla")}>Tabla</button>
          </div>
          <button className="spicy-btn-primary" onClick={()=>setShowNew(true)}>+ Nuevo cliente</button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:16,alignItems:"center" }}>
        <select className="spicy-select" value={filterEtapa} onChange={e=>setFilterEtapa(e.target.value)}>
          <option value="">Todas las etapas</option>
          {ONBOARDING_STAGES.map(s=><option key={s.key} value={s.key}>{s.key}</option>)}
        </select>
        <select className="spicy-select" value={filterEstado} onChange={e=>setFilterEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.keys(ESTADO_BADGE).map(k=><option key={k} value={k}>{ESTADO_BADGE[k].label}</option>)}
        </select>
        <select className="spicy-select" value={filterResponsable} onChange={e=>setFilterResponsable(e.target.value)}>
          <option value="">Todos los responsables</option>
          {responsables.map(r=><option key={r} value={r}>{r}</option>)}
        </select>
        <label style={{ display:"flex",alignItems:"center",gap:6,fontSize:13,color:"#666" }}>
          <input type="checkbox" checked={filterBloqueado} onChange={e=>setFilterBloqueado(e.target.checked)}/> Solo bloqueados
        </label>
      </div>

      {mode==="kanban" ? (
        <div style={{ overflowX:"auto", paddingBottom:8 }}>
          <div style={{ display:"flex", gap:14, minWidth: ONBOARDING_STAGES.length * 240 }}>
            {ONBOARDING_STAGES.map(stage => {
              const col = visible.filter(r=>r.etapa_actual===stage.key);
              return (
                <div key={stage.key}
                  onDragOver={e=>{ e.preventDefault(); setDragOverEtapa(stage.key); }}
                  onDragLeave={()=>setDragOverEtapa(s=>s===stage.key?null:s)}
                  onDrop={e=>{
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/onboarding-id");
                    const r = onboarding.find(x=>x.id===id);
                    setDragOverEtapa(null);
                    if (r) moveEtapa(r, stage.key);
                  }}
                  style={{
                    width:224, flexShrink:0, background: dragOverEtapa===stage.key?"#FFF3EE":"#F7F7F8",
                    border:"1px solid #EBEBEB", borderRadius:12, padding:10, minHeight:120,
                  }}>
                  <div style={{ fontSize:12,fontWeight:700,color:"#555",marginBottom:10,display:"flex",justifyContent:"space-between" }}>
                    <span>{stage.key}</span>
                    <span style={{ color:"#bbb" }}>{col.length}</span>
                  </div>
                  {col.map(r => {
                    const badge = ESTADO_BADGE[r._estado] || ESTADO_BADGE["sin fecha"];
                    return (
                      <div key={r.id} draggable
                        onDragStart={e=>e.dataTransfer.setData("text/onboarding-id", r.id)}
                        onClick={()=>setDetail(r)}
                        style={{ background:"white",border:"1px solid #EBEBEB",borderRadius:10,padding:"10px 12px",marginBottom:8,cursor:"grab",boxShadow:"0 1px 2px rgba(0,0,0,0.03)" }}>
                        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,gap:6 }}>
                          <span style={{ fontSize:13,fontWeight:600,color:"#111",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{r.client_name}</span>
                          <span style={{ fontSize:10,padding:"2px 7px",borderRadius:5,fontWeight:600,background:badge.bg,color:badge.color,flexShrink:0 }}>{badge.label}</span>
                        </div>
                        <div style={{ height:4,background:"#F3F3F3",borderRadius:2,overflow:"hidden",marginBottom:6 }}>
                          <div style={{ height:"100%",width:`${Math.round(calcularAvance(r.etapa_actual)*100)}%`,background:"#533AB7",borderRadius:2 }}/>
                        </div>
                        <div style={{ fontSize:11,color:"#aaa" }}>{r.responsable||"Sin asignar"}</div>
                      </div>
                    );
                  })}
                  {col.length===0 && <div style={{ fontSize:11,color:"#ccc",textAlign:"center",padding:"12px 0" }}>Sin clientes</div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="spicy-card" style={{ padding:0,overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ borderCollapse:"collapse",width:"100%",minWidth:820 }}>
              <thead>
                <tr style={{ background:"#FAFAFA" }}>
                  {["Cliente","Etapa","Responsable","Estado","Avance","Días registro","Días etapa","Pago","Bloq."].map(h=>(
                    <th key={h} style={{ textAlign:"left",fontSize:11,color:"#888",fontWeight:600,padding:"10px 12px",borderBottom:"1px solid #EBEBEB",whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(r=>{
                  const badge = ESTADO_BADGE[r._estado] || ESTADO_BADGE["sin fecha"];
                  return (
                    <tr key={r.id} onClick={()=>setDetail(r)} style={{ cursor:"pointer" }}>
                      <td style={{ padding:"10px 12px",borderBottom:"1px solid #F5F5F5",fontSize:13,fontWeight:500,color:"#111" }}>{r.client_name}</td>
                      <td style={{ padding:"10px 12px",borderBottom:"1px solid #F5F5F5",fontSize:12,color:"#555" }}>{r.etapa_actual}</td>
                      <td style={{ padding:"10px 12px",borderBottom:"1px solid #F5F5F5",fontSize:12,color:"#555" }}>{r.responsable||"—"}</td>
                      <td style={{ padding:"10px 12px",borderBottom:"1px solid #F5F5F5" }}>
                        <span style={{ fontSize:10,padding:"2px 7px",borderRadius:5,fontWeight:600,background:badge.bg,color:badge.color }}>{badge.label}</span>
                      </td>
                      <td style={{ padding:"10px 12px",borderBottom:"1px solid #F5F5F5",fontSize:12,color:"#555",minWidth:80 }}>
                        <div style={{ height:5,background:"#F3F3F3",borderRadius:3,overflow:"hidden" }}>
                          <div style={{ height:"100%",width:`${Math.round(calcularAvance(r.etapa_actual)*100)}%`,background:"#533AB7" }}/>
                        </div>
                      </td>
                      <td style={{ padding:"10px 12px",borderBottom:"1px solid #F5F5F5",fontSize:12,color:"#555" }}>{diasEntre(r.fecha_registro)}</td>
                      <td style={{ padding:"10px 12px",borderBottom:"1px solid #F5F5F5",fontSize:12,color:"#555" }}>{diasEntre(r.fecha_entrada_etapa_actual)}</td>
                      <td style={{ padding:"10px 12px",borderBottom:"1px solid #F5F5F5",fontSize:12,color:"#555" }}>{r.estado_de_pago}</td>
                      <td style={{ padding:"10px 12px",borderBottom:"1px solid #F5F5F5",fontSize:12 }}>{r.bloqueado?"🔒":""}</td>
                    </tr>
                  );
                })}
                {visible.length===0 && (
                  <tr><td colSpan={9} style={{ padding:"20px",textAlign:"center",color:"#ccc",fontSize:13 }}>Sin resultados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Nuevo cliente modal */}
      {showNew && (
        <div onClick={()=>setShowNew(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
          <form onClick={e=>e.stopPropagation()} onSubmit={createRecord} style={{ background:"white",borderRadius:16,width:"100%",maxWidth:420,padding:24,display:"flex",flexDirection:"column",gap:14,maxHeight:"85vh",overflowY:"auto" }}>
            <div style={{ fontSize:16,fontWeight:700,color:"#111" }}>Nuevo cliente en onboarding</div>

            <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Cliente / Empresa
              <input required autoFocus className="spicy-input" value={form.client_name} onChange={e=>setForm(f=>({...f,client_name:e.target.value}))} style={{ width:"100%",marginTop:4 }}/>
            </label>

            <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Fecha de registro
              <input type="date" className="spicy-input" value={form.fecha_registro} onChange={e=>setForm(f=>({...f,fecha_registro:e.target.value}))} style={{ width:"100%",marginTop:4 }}/>
            </label>

            <label style={{ fontSize:12,color:"#666",fontWeight:500 }}>Responsable
              <select className="spicy-select" value={form.responsable} onChange={e=>setForm(f=>({...f,responsable:e.target.value}))} style={{ width:"100%",marginTop:4 }}>
                <option value="">Sin asignar</option>
                {TICKET_TEAM.map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </label>

            <div style={{ fontSize:12,color:"#666",fontWeight:500 }}>Fuente de leads
              <div style={{ display:"flex",flexWrap:"wrap",gap:10,marginTop:6 }}>
                {ONBOARDING_LEAD_SOURCES.map(s=>(
                  <label key={s} style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#555",fontWeight:400 }}>
                    <input type="checkbox" checked={form.fuente_de_leads.includes(s)} onChange={e=>{
                      setForm(f=>({ ...f, fuente_de_leads: e.target.checked ? [...f.fuente_de_leads, s] : f.fuente_de_leads.filter(x=>x!==s) }));
                    }}/> {s}
                  </label>
                ))}
              </div>
            </div>

            <label style={{ display:"flex",alignItems:"center",gap:6,fontSize:13,color:"#666" }}>
              <input type="checkbox" checked={form.bloqueado} onChange={e=>setForm(f=>({...f,bloqueado:e.target.checked}))}/> Bloqueado
            </label>

            <div style={{ display:"flex",justifyContent:"flex-end",gap:8,marginTop:4 }}>
              <button type="button" className="spicy-btn-secondary" onClick={()=>setShowNew(false)}>Cancelar</button>
              <button type="submit" className="spicy-btn-primary" disabled={saving||!form.client_name.trim()}>Crear</button>
            </div>
          </form>
        </div>
      )}

      {/* Detalle */}
      {detail && (()=>{
        const badge = ESTADO_BADGE[calcularEstado(detail, new Date())] || ESTADO_BADGE["sin fecha"];
        return (
          <div onClick={()=>setDetail(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:"white",borderRadius:16,width:"100%",maxWidth:540,maxHeight:"85vh",overflowY:"auto",padding:24,display:"flex",flexDirection:"column",gap:12 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                <div style={{ flex:1 }}>
                  <input key={detail.id} defaultValue={detail.client_name}
                    onBlur={e=>updateRecord(detail,{client_name:e.target.value.trim()||detail.client_name})}
                    style={{ fontSize:16,fontWeight:700,color:"#111",border:"none",outline:"none",width:"100%",padding:0,fontFamily:"inherit",background:"transparent" }}/>
                  <span style={{ fontSize:10,padding:"2px 7px",borderRadius:5,fontWeight:600,background:badge.bg,color:badge.color,marginTop:4,display:"inline-block" }}>{badge.label}</span>
                </div>
                <button onClick={()=>setDetail(null)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#ccc",lineHeight:1 }}>×</button>
              </div>

              <div style={{ height:6,background:"#F3F3F3",borderRadius:3,overflow:"hidden" }}>
                <div style={{ height:"100%",width:`${Math.round(calcularAvance(detail.etapa_actual)*100)}%`,background:"#533AB7" }}/>
              </div>

              <div style={{ display:"flex",gap:12 }}>
                <label style={{ fontSize:12,color:"#666",fontWeight:500,flex:1 }}>Etapa
                  <select className="spicy-select" value={detail.etapa_actual} onChange={e=>moveEtapa(detail, e.target.value)} style={{ width:"100%",marginTop:4 }}>
                    {ONBOARDING_STAGES.map(s=><option key={s.key} value={s.key}>{s.key}</option>)}
                  </select>
                </label>
                <label style={{ fontSize:12,color:"#666",fontWeight:500,flex:1 }}>Responsable
                  <select className="spicy-select" value={detail.responsable||""} onChange={e=>updateRecord(detail,{responsable:e.target.value||null})} style={{ width:"100%",marginTop:4 }}>
                    <option value="">Sin asignar</option>
                    {TICKET_TEAM.map(n=><option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>

              <div style={{ display:"flex",gap:12 }}>
                <label style={{ fontSize:12,color:"#666",fontWeight:500,flex:1 }}>Fecha de registro
                  <input type="date" className="spicy-input" value={detail.fecha_registro} onChange={e=>updateRecord(detail,{fecha_registro:e.target.value})} style={{ width:"100%",marginTop:4 }}/>
                </label>
                <label style={{ fontSize:12,color:"#666",fontWeight:500,flex:1 }}>Estado de pago
                  <select className="spicy-select" value={detail.estado_de_pago} onChange={e=>updateRecord(detail,{estado_de_pago:e.target.value})} style={{ width:"100%",marginTop:4 }}>
                    {ONBOARDING_PAYMENT_STATUS.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
              </div>

              <label style={{ display:"flex",alignItems:"center",gap:6,fontSize:13,color:"#666" }}>
                <input type="checkbox" checked={detail.bloqueado} onChange={e=>updateRecord(detail,{bloqueado:e.target.checked})}/> Bloqueado
              </label>

              <div style={{ fontSize:12,color:"#666",fontWeight:500 }}>Fuente de leads
                <div style={{ display:"flex",flexWrap:"wrap",gap:10,marginTop:6 }}>
                  {ONBOARDING_LEAD_SOURCES.map(s=>(
                    <label key={s} style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#555",fontWeight:400 }}>
                      <input type="checkbox" checked={(detail.fuente_de_leads||[]).includes(s)} onChange={e=>toggleLeadSource(detail,s,e.target.checked)}/> {s}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ fontSize:12,color:"#666",fontWeight:500 }}>Integraciones pendientes
                <div style={{ display:"flex",flexWrap:"wrap",gap:10,marginTop:6 }}>
                  {ONBOARDING_LEAD_SOURCES.map(s=>(
                    <label key={s} style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#555",fontWeight:400 }}>
                      <input type="checkbox" checked={(detail.integraciones_pendientes||[]).includes(s)} onChange={e=>toggleIntegracion(detail,s,e.target.checked)}/> {s}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ fontSize:11,color:"#aaa" }}>
                {diasEntre(detail.fecha_registro)} días desde registro · {diasEntre(detail.fecha_entrada_etapa_actual)} días en esta etapa
              </div>

              <div>
                <div style={{ fontSize:12,color:"#666",fontWeight:500,marginBottom:6 }}>Historial de etapas</div>
                <div style={{ display:"flex",flexDirection:"column",gap:4,maxHeight:140,overflowY:"auto" }}>
                  {getHistory(detail.id).map(h=>(
                    <div key={h.id} style={{ display:"flex",justifyContent:"space-between",fontSize:12,color:"#555",background:"#F7F7F8",borderRadius:6,padding:"5px 8px" }}>
                      <span>{h.etapa}</span>
                      <span style={{ color:"#aaa" }}>{h.fecha_entrada}</span>
                    </div>
                  ))}
                  {getHistory(detail.id).length===0 && <div style={{ fontSize:12,color:"#ccc" }}>Sin historial.</div>}
                </div>
              </div>

              <div style={{ display:"flex",justifyContent:"space-between",marginTop:4 }}>
                <button className="spicy-btn-secondary" style={{ color:ST_RED,borderColor:ST_RED_BG }} onClick={()=>deleteRecord(detail)}>Eliminar</button>
                <button className="spicy-btn-primary" onClick={()=>setDetail(null)}>Listo</button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function SpicyFinanzas() {
  const [session,  setSession]  = useState(null);
  const [role,     setRole]     = useState(null); // 'admin' | 'reader' | 'dev' | null
  const [authReady,setAuthReady]= useState(false);

  const [txns,      setTxns]      = useState([]);
  const [accounts,  setAccounts]  = useState([]);
  const [referrers, setReferrers] = useState([]);
  const [referredClients, setReferredClients] = useState([]);
  const [referredClientPayments, setReferredClientPayments] = useState([]);
  const [catsIncome,  setCatsIncome]  = useState([]);
  const [catsExpense, setCatsExpense] = useState([]);
  const [tickets,     setTickets]     = useState([]);
  const [ticketStatusHistory, setTicketStatusHistory] = useState([]);
  const [tasks,       setTasks]       = useState([]);
  const [taskComments,setTaskComments]= useState([]);
  const [allUsers,        setAllUsers]        = useState([]);
  const [allowedSections, setAllowedSections] = useState([]);
  const [onboarding,        setOnboarding]        = useState([]);
  const [onboardingHistory, setOnboardingHistory] = useState([]);
  const [devTasks,            setDevTasks]            = useState([]);
  const [devTaskStatusHistory,setDevTaskStatusHistory]= useState([]);
  const [entityAssignees, setEntityAssignees] = useState([]);
  const [comments,        setComments]        = useState([]);
  const [attachments,     setAttachments]     = useState([]);
  const [dataLoaded, setDataLoaded]   = useState(false);

  const [view,      setView]      = useState("dashboard");
  const [filterType,setFilterType]= useState("all");
  const [filterAcc, setFilterAcc] = useState("all");
  const [syncing,   setSyncing]   = useState(false);
  const [syncError, setSyncError] = useState("");
  const [form, setForm] = useState({type:"income",category:"SaaS MRR",amount:"",description:"",date:new Date().toISOString().split("T")[0],account_id:"mercury"});
  const [saved, setSaved] = useState(false);

  // ── Auth listener ────────────────────────────────────────────────────────
  useEffect(()=>{
    sb.auth.getSession().then(({data:{session}})=>{
      setSession(session); setAuthReady(true);
    });
    const {data:{subscription}}=sb.auth.onAuthStateChange((_,session)=>{
      setSession(session); if(!session){setRole(null);setDataLoaded(false);}
    });
    return ()=>subscription.unsubscribe();
  },[]);

  // ── Load role + data when session available ──────────────────────────────
  useEffect(()=>{
    if (!session) return;
    loadAll();
  },[session]);

  async function loadAll() {
    // No reseteamos dataLoaded a false acá: este refresh se llama después de
    // cada acción chica (agregar un asignado, comentar, etc.) y si tira abajo
    // dataLoaded, el gate de "Cargando datos..." desmonta toda la vista actual
    // (y con ella, el modal de detalle abierto) en cada una de esas acciones.
    const [roleRes,txRes,accRes,refRes,catRes,refClientsRes,paymentsRes,ticketsRes,ticketHistoryRes,tasksRes,taskCommentsRes,usersRes,allowedRes,onboardingRes,onboardingHistoryRes,devTasksRes,devTaskHistoryRes,assigneesRes,commentsRes,attachmentsRes]=await Promise.all([
      sb.from("user_roles").select("role").eq("user_id",session.user.id).single(),
      sb.from("transactions").select("*").order("date",{ascending:false}),
      sb.from("accounts").select("*").order("created_at"),
      sb.from("referrers").select("*").order("name"),
      sb.from("categories").select("*").order("position"),
      sb.from("referred_clients").select("*").order("name"),
      sb.from("referred_client_payments").select("*").order("date",{ascending:false}),
      sb.from("tickets").select("*").order("created_at",{ascending:false}),
      sb.from("ticket_status_history").select("*"),
      sb.from("tasks").select("*").order("start_date"),
      sb.from("task_comments").select("*").order("created_at"),
      sb.from("user_roles").select("user_id,email,role,first_name,last_name").order("email"),
      sb.from("allowed_sections").select("*"),
      sb.from("onboarding").select("*").order("created_at",{ascending:false}),
      sb.from("onboarding_stage_history").select("*"),
      sb.from("dev_tasks").select("*").order("created_at",{ascending:false}),
      sb.from("dev_task_status_history").select("*"),
      sb.from("entity_assignees").select("*"),
      sb.from("comments").select("*"),
      sb.from("attachments").select("*"),
    ]);
    setRole(roleRes.data?.role||"reader");
    setTxns(txRes.data||[]);
    setAccounts(accRes.data||[]);
    setReferrers(refRes.data||[]);
    setReferredClients(refClientsRes.data||[]);
    setReferredClientPayments(paymentsRes.data||[]);
    setCatsIncome((catRes.data||[]).filter(c=>c.type==="income"));
    setCatsExpense((catRes.data||[]).filter(c=>c.type==="expense"));
    setTickets(ticketsRes.data||[]);
    setTicketStatusHistory(ticketHistoryRes.data||[]);
    setTasks(tasksRes.data||[]);
    setTaskComments(taskCommentsRes.data||[]);
    setAllUsers(usersRes.data||[]);
    setAllowedSections(allowedRes.data||[]);
    setOnboarding(onboardingRes.data||[]);
    setOnboardingHistory(onboardingHistoryRes.data||[]);
    setDevTasks(devTasksRes.data||[]);
    setDevTaskStatusHistory(devTaskHistoryRes.data||[]);
    setEntityAssignees(assigneesRes.data||[]);
    setComments(commentsRes.data||[]);
    setAttachments(attachmentsRes.data||[]);
    setDataLoaded(true);
  }

  const isAdmin = role==="admin";
  const isDev = role==="dev";
  const canEditFibonacci = isAdmin || isDev;
  const myAllowedSections = new Set(session ? allowedSections.filter(a=>a.user_id===session.user.id).map(a=>a.section) : []);
  const canSeeSection = (label) => isAdmin || myAllowedSections.has(label);
  const currentSection = NAV_SECTIONS.find(s=>s.views.includes(view));
  const currentViewBlocked = (currentSection && !canSeeSection(currentSection.label)) || (ADMIN_ONLY_VIEWS.includes(view) && !isAdmin);

  // ── Si la vista actual quedó fuera de lo permitido (o dejó de ser admin), redirigir ──
  useEffect(()=>{
    if (!session || !dataLoaded || !currentViewBlocked) return;
    const fallback = NAV_SECTIONS
      .filter(s => canSeeSection(s.label))
      .flatMap(s => s.views.filter(v => !ADMIN_ONLY_VIEWS.includes(v) || isAdmin))[0];
    setView(fallback || "dashboard");
  },[session, dataLoaded, isAdmin, view, allowedSections]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.amount||isNaN(Number(form.amount))||Number(form.amount)<=0) return;
    await sb.from("transactions").insert({id:"t"+Date.now(),...form,amount:Number(form.amount)});
    setForm({type:"income",category:catsIncome[0]?.name||"SaaS MRR",amount:"",description:"",date:new Date().toISOString().split("T")[0],account_id:"mercury"});
    setSaved(true); setTimeout(()=>setSaved(false),2000); setView("dashboard"); loadAll();
  }

  async function updateCategory(id, category) {
    await sb.from("transactions").update({ category }).eq("id", id);
    setTxns(prev => prev.map(t => t.id === id ? { ...t, category } : t));
  }
  async function deleteTxn(id) {
    await sb.from("transactions").delete().eq("id",id);
    setTxns(prev=>prev.filter(t=>t.id!==id));
  }

  async function uploadInvoice(txnId, file) {
    const path = `${txnId}-${Date.now()}.pdf`;
    const { error: upErr } = await sb.storage.from("invoices").upload(path, file, { upsert: true, contentType: "application/pdf" });
    if (upErr) { alert("Error subiendo la factura: " + upErr.message); return; }
    await sb.from("transactions").update({ invoice_path: path }).eq("id", txnId);
    setTxns(prev => prev.map(t => t.id === txnId ? { ...t, invoice_path: path } : t));
  }

  async function viewInvoice(path) {
    const { data, error } = await sb.storage.from("invoices").createSignedUrl(path, 60);
    if (error) { alert("Error obteniendo la factura: " + error.message); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function handleSync() {
    if (!WORKER_URL){setSyncError("Configurá WORKER_URL.");return;}
    setSyncing(true); setSyncError("");
    try {
      const res=await fetch(WORKER_URL+"/sync"); if(!res.ok)throw new Error("HTTP "+res.status);
      const data=await res.json();
      if(data.transactions?.length){
        const existingIds=new Set(txns.map(t=>t.id));
        const newTxns=data.transactions.filter(t=>!existingIds.has(t.id)).map(t=>({
          id:t.id, type:t.type, category:t.category||(t.type==="income"?"SaaS MRR":"Otro gasto"),
          amount:t.amount, description:t.description, date:t.date, account_id:"mercury",
          source:t.source, referrer_id:t.referrer_id||null, referrer_name:t.referrer_name||null,
        }));
        if(newTxns.length)await sb.from("transactions").insert(newTxns);
      }
      if(data.errors?.length)setSyncError("Advertencias: "+data.errors.join(", "));
      loadAll();
    }catch(e){setSyncError("Error: "+e.message);}
    setSyncing(false);
  }

  const [expCatMonth, setExpCatMonth] = useState("all"); // month filter for egresos chart
  const [catDrilldown, setCatDrilldown] = useState(null); // { cat, month } for popup

  // ── Métricas ─────────────────────────────────────────────────────────────
  const now=new Date();
  const income=txns.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount),0);
  const expenses=txns.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount),0);

  // MRR: suma de SaaS MRR del último mes calendario con al menos una txn de ese tipo
  // Solo Mercury, sin Movimiento Cuenta — para gráfico y métricas
  const mercuryTxns = txns.filter(t =>
    t.account_id === "mercury" && t.category !== MOVIMIENTO_CUENTA
  );

  const months6=Array.from({length:6},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-(5-i),1);return{key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,label:MONTH_LABELS[d.getMonth()]};});

  // Mes anterior
  const prevMonth = (() => { const d=new Date(now.getFullYear(),now.getMonth()-1,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })();

  // MRR = suma SaaS MRR del mes anterior
  const mrr = mercuryTxns.filter(t=>t.category==="SaaS MRR"&&monthKey(t.date)===prevMonth).reduce((s,t)=>s+Number(t.amount),0);
  const mrrMonthLabel = monthLabel(prevMonth);

  // Burn = ingreso - egreso del mes anterior (Mercury, sin Movimiento Cuenta)
  const prevIncome  = mercuryTxns.filter(t=>t.type==="income" &&monthKey(t.date)===prevMonth).reduce((s,t)=>s+Number(t.amount),0);
  const prevExpense = mercuryTxns.filter(t=>t.type==="expense"&&monthKey(t.date)===prevMonth).reduce((s,t)=>s+Number(t.amount),0);
  const monthlyBurn = prevIncome - prevExpense; // positivo = superávit, negativo = déficit

  // Cash total = saldo calculado desde transacciones por cuenta (desde cero)
  const calcBalances = {};
  txns.forEach(t => {
    if (!calcBalances[t.account_id]) calcBalances[t.account_id] = 0;
    calcBalances[t.account_id] += t.type==="income" ? Number(t.amount) : -Number(t.amount);
  });
  const totalCash = Object.values(calcBalances).reduce((s,v)=>s+v,0);
  const runway = prevExpense>0 ? Math.round(totalCash/prevExpense) : 0;

  const chartData = months6.map(m => ({
    label:        m.label,
    income:       mercuryTxns.filter(t=>t.type==="income" &&monthKey(t.date)===m.key).reduce((s,t)=>s+Number(t.amount),0),
    expense:      mercuryTxns.filter(t=>t.type==="expense"&&monthKey(t.date)===m.key).reduce((s,t)=>s+Number(t.amount),0),
    referralCost: mercuryTxns.filter(t=>t.category==="Comisiones referidos"&&monthKey(t.date)===m.key).reduce((s,t)=>s+Number(t.amount),0),
  }));
  const maxVal = Math.max(...chartData.map(d=>Math.max(d.income,d.expense)),1);

  const expByCat = catsExpense.map(cat => ({
    cat: cat.name,
    total: mercuryTxns.filter(t=>
      t.type==="expense" && t.category===cat.name &&
      (expCatMonth==="all" || monthKey(t.date)===expCatMonth)
    ).reduce((s,t)=>s+Number(t.amount),0),
  })).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const totalExpAll = expByCat.reduce((s,x)=>s+x.total,1);

  const expMonths = [...new Set(
    mercuryTxns.filter(t=>t.type==="expense").map(t=>monthKey(t.date))
  )].sort((a,b)=>b.localeCompare(a));
  const curMK=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const referralOwed=txns.filter(t=>t.type==="income"&&t.referrer_id&&monthKey(t.date)===curMK).reduce((s,t)=>s+Number(t.amount),0)*COMMISSION_RATE;

  const urgentTicketsCount = tickets.filter(t=>t.category==="Bloqueante" && statusGroup(t.status)!=="Cerrados").length;
  const todayISOForTasks = new Date().toISOString().split("T")[0];
  const overdueTasksCount = tasks.filter(t=>t.end_date<todayISOForTasks && !["Finalizado","Archivado"].includes(t.stage)).length;

  const sourceBadge=(t)=>{
    if(t.source)return <span style={{ fontSize:10,padding:"1px 5px",borderRadius:4,marginLeft:5,background:t.source==="mercury"?"var(--color-background-info)":"var(--color-background-success)",color:t.source==="mercury"?"var(--color-text-info)":"var(--color-text-success)" }}>{t.source}</span>;
    if(t.referrer_id)return <span style={{ fontSize:10,padding:"1px 5px",borderRadius:4,marginLeft:5,background:"var(--color-background-warning)",color:"var(--color-text-warning)" }}>ref</span>;
    return null;
  };

  const invoiceBadge=(t)=>{
    if(!t.invoice_path)return null;
    return <span style={{ fontSize:10,padding:"1px 5px",borderRadius:4,marginLeft:5,background:"var(--color-background-success)",color:"var(--color-text-success)" }}>📎 factura</span>;
  };

  if (!authReady) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#F7F7F8",fontSize:14,color:"#888" }}>Cargando...</div>;
  if (!session)   return <LoginScreen/>;
  if (!dataLoaded)return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#F7F7F8",fontSize:14,color:"#888" }}>Cargando datos...</div>;

  const userInitials = session.user.email.slice(0,2).toUpperCase();

  return (
    <div className="spicy-root">
      <BrandStyles/>

      {/* Sidebar */}
      <div className="spicy-sidebar">
        <div className="spicy-logo">
          <div className="spicy-logo-icon">S</div>
          <div className="spicy-logo-text">SpicyTool</div>
        </div>

        <nav className="spicy-nav">
          {NAV_SECTIONS.filter(section => canSeeSection(section.label)).map(section=>{
            const visibleViews = section.views.filter(v =>
              !ADMIN_ONLY_VIEWS.includes(v) || isAdmin
            );
            if (visibleViews.length === 0) return null;
            return (
              <div key={section.label} style={{ marginBottom:4 }}>
                <div style={{ fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:1,padding:"10px 12px 5px" }}>
                  {section.label}
                </div>
                {visibleViews.map(v=>(
                  <button key={v} onClick={()=>setView(v)} className={`spicy-nav-btn${view===v?" active":""}`}>
                    <span style={{ fontSize:14 }}>{NAV_ICONS[v]}</span>
                    {NAV_LABELS[v]}
                    {v==="referrals"&&referralOwed>0&&<span className="spicy-nav-badge">{fmt(referralOwed)}</span>}
                    {v==="tickets"&&urgentTicketsCount>0&&<span className="spicy-nav-badge">{urgentTicketsCount}</span>}
                    {v==="tasks"&&overdueTasksCount>0&&<span className="spicy-nav-badge">{overdueTasksCount}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="spicy-user">
          <div className="spicy-avatar">{userInitials}</div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:12,fontWeight:600,color:"white",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{session.user.email}</div>
            <span className="spicy-badge-gray" style={{ background:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)" }}>{role}</span>
          </div>
          <button onClick={()=>sb.auth.signOut()} title="Cerrar sesión" style={{ background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.4)",fontSize:16,padding:"4px",lineHeight:1,flexShrink:0 }}>→</button>
        </div>
      </div>

      {/* Main content */}
      <div className="spicy-main">
        {syncError&&<div style={{ fontSize:13,color:ST_RED,marginBottom:16,padding:"10px 14px",background:ST_RED_BG,borderRadius:10,border:`1px solid ${ST_RED}22` }}>{syncError}</div>}

      {currentViewBlocked ? (
        <div style={{ fontSize:13,color:"#999",textAlign:"center",padding:"4rem 1rem" }}>Todavía no tenés acceso a ninguna sección. Pedile a un admin que te habilite el acceso.</div>
      ) : (
      <>
      {/* DASHBOARD */}
      {view==="dashboard"&&(
        <>
          <div style={{ fontSize:20,fontWeight:700,color:"#111",marginBottom:20 }}>Resumen financiero</div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20 }}>
            {[
              { label:"MRR", value:fmt(mrr), sub:mrrMonthLabel, tooltip:`Suma SaaS MRR de ${mrrMonthLabel}` },
              { label:"ARR", value:fmt(mrr*12), sub:"proyectado" },
              { label:"Cash total", value:fmt(totalCash), sub:`${accounts.length} cuentas`, tooltip:"Calculado desde transacciones" },
              { label:"Burn " + mrrMonthLabel,
                value: monthlyBurn >= 0 ? `+${fmt(monthlyBurn)}` : fmt(monthlyBurn),
                sub: monthlyBurn >= 0 ? "superávit" : "déficit",
                neg: monthlyBurn < 0,
                tooltip:`Ingreso ${fmt(prevIncome)} − Egreso ${fmt(prevExpense)}` },
            ].map(k=>(
              <div key={k.label} className="spicy-kpi" style={{ position:"relative" }}
                title={k.tooltip||""}>
                <div className="spicy-kpi-label">{k.label}{k.tooltip&&<span style={{ marginLeft:4,fontSize:10,color:"#ccc",cursor:"help" }}>ⓘ</span>}</div>
                <div className="spicy-kpi-value" style={{ color:k.neg?"#EF3E3E":"#111" }}>{k.value}</div>
                <div className="spicy-kpi-sub">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Saldos por banco */}
          <div className="spicy-card">
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
              <span style={{ fontSize:14,fontWeight:600,color:"#111" }}>Saldos por banco</span>
              <button onClick={()=>setView("accounts")} style={{ fontSize:12,color:ST_RED,background:"none",border:"none",cursor:"pointer",fontWeight:600 }}>Ver todas →</button>
            </div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
              {accounts.map(a=>(
                <div key={a.id} onClick={()=>setView("accounts")} style={{ display:"flex",alignItems:"center",gap:6,padding:"7px 12px",background:"#F7F7F8",borderRadius:8,cursor:"pointer",border:"1px solid #EBEBEB" }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:a.color }}/>
                  <span style={{ fontSize:12,color:"#666",fontWeight:500 }}>{a.name}</span>
                  {(() => { const cb=txns.filter(t=>t.account_id===a.id).reduce((b,t)=>b+(t.type==="income"?Number(t.amount):-Number(t.amount)),0); return <span style={{ fontSize:13,fontWeight:600,color:cb>0?"#111":"#bbb" }}>{fmt(cb)}</span>; })()}
                </div>
              ))}
            </div>
          </div>

          {referralOwed>0&&<div onClick={()=>setView("referrals")} style={{ background:"#FEF3C7",border:"1px solid #FCD34D",borderRadius:10,padding:"12px 16px",marginBottom:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div style={{ fontSize:13,color:"#92400E",fontWeight:600 }}>⚠ Comisiones a pagar este mes: {fmtDec(referralOwed)}</div>
            <span style={{ fontSize:12,color:"#92400E",fontWeight:600 }}>Ver →</span>
          </div>}

          {/* Chart */}
          <div className="spicy-card">
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
              <span style={{ fontSize:14,fontWeight:600,color:"#111" }}>Ingresos vs egresos — 6 meses</span>
              <div style={{ display:"flex",gap:12,fontSize:12,color:"#888" }}>
                <span style={{ display:"flex",alignItems:"center",gap:4 }}><span style={{ width:10,height:10,borderRadius:2,background:"#1D9E75",display:"inline-block" }}/> Ing.</span>
                <span style={{ display:"flex",alignItems:"center",gap:4 }}><span style={{ width:10,height:10,borderRadius:2,background:ST_RED,display:"inline-block" }}/> Egr.</span>
                <span style={{ display:"flex",alignItems:"center",gap:4 }}><span style={{ width:10,height:10,borderRadius:2,background:"#F59E0B",display:"inline-block" }}/> Ref.</span>
              </div>
            </div>
            <div style={{ display:"flex",alignItems:"flex-end",gap:8,paddingTop:4 }}>
              {chartData.map(d=><ChartBar key={d.label} {...d} maxVal={maxVal}/>)}
            </div>
          </div>

          {/* Egresos por cat */}
          <div className="spicy-card">
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
              <div style={{ fontSize:14,fontWeight:600,color:"#111" }}>Egresos por categoría <span style={{ fontSize:11,color:"#aaa",fontWeight:400 }}>— click para ver detalle</span></div>
              <select value={expCatMonth} onChange={e=>setExpCatMonth(e.target.value)} className="spicy-select" style={{ fontSize:12 }}>
                <option value="all">Todo el período</option>
                {expMonths.map(mk=><option key={mk} value={mk}>{monthLabel(mk)}</option>)}
              </select>
            </div>
            {expByCat.length===0&&<div style={{ fontSize:13,color:"#bbb",textAlign:"center",padding:"1rem" }}>Sin egresos en este período.</div>}
            {expByCat.map(x=>(
              <div key={x.cat} style={{ marginBottom:14,cursor:"pointer" }}
                onClick={()=>setCatDrilldown({ cat:x.cat, month:expCatMonth })}>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6 }}>
                  <span style={{ color:x.cat==="Comisiones referidos"?"#D97706":"#555",fontWeight:500 }}>{x.cat}</span>
                  <span style={{ fontWeight:600,color:"#111" }}>{fmt(x.total)}</span>
                </div>
                <div style={{ height:6,background:"#F3F3F3",borderRadius:4,overflow:"hidden" }}>
                  <div style={{ height:"100%",width:`${Math.round((x.total/totalExpAll)*100)}%`,background:x.cat==="Comisiones referidos"?"#F59E0B":ST_RED,borderRadius:4,transition:"width 0.3s" }}/>
                </div>
              </div>
            ))}
          </div>

          {/* Drilldown popup */}
          {catDrilldown&&(()=>{
            const drillTxns = mercuryTxns.filter(t =>
              t.type==="expense" &&
              t.category===catDrilldown.cat &&
              (catDrilldown.month==="all" || monthKey(t.date)===catDrilldown.month)
            ).sort((a,b)=>b.date.localeCompare(a.date));
            const total = drillTxns.reduce((s,t)=>s+Number(t.amount),0);
            const allCats = [...catsIncome,...catsExpense];
            return (
              <div onClick={()=>setCatDrilldown(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
                <div onClick={e=>e.stopPropagation()} style={{ background:"white",borderRadius:16,width:"100%",maxWidth:560,maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden" }}>
                  {/* Header */}
                  <div style={{ padding:"18px 20px",borderBottom:"1px solid #F0F0F0",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                    <div>
                      <div style={{ fontSize:16,fontWeight:700,color:"#111" }}>{catDrilldown.cat}</div>
                      <div style={{ fontSize:12,color:"#aaa",marginTop:3 }}>
                        {catDrilldown.month==="all" ? "Todo el período" : monthLabel(catDrilldown.month)} · {drillTxns.length} transacciones · {fmt(total)}
                      </div>
                    </div>
                    <button onClick={()=>setCatDrilldown(null)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#ccc",lineHeight:1,padding:"4px 8px" }}>×</button>
                  </div>

                  {/* Transaction list */}
                  <div style={{ overflowY:"auto",flex:1 }}>
                    {drillTxns.length===0&&<div style={{ padding:"2rem",textAlign:"center",fontSize:13,color:"#bbb" }}>Sin transacciones.</div>}
                    {drillTxns.map((t,i)=>(
                      <div key={t.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"11px 20px",borderBottom:i<drillTxns.length-1?"1px solid #F5F5F5":"none" }}>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ fontSize:13,fontWeight:500,color:"#111",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{t.description||"—"}</div>
                          <div style={{ fontSize:11,color:"#aaa",marginTop:2 }}>{t.date}</div>
                        </div>
                        {/* Inline category selector */}
                        {isAdmin ? (
                          <select value={t.category}
                            onChange={async e=>{
                              await updateCategory(t.id, e.target.value);
                              setCatDrilldown(prev=>({...prev})); // force re-render
                            }}
                            style={{ fontSize:11,padding:"3px 6px",borderRadius:6,border:"1px solid #E0E0E0",background:"#F7F7F8",color:"#555",cursor:"pointer",fontFamily:"DM Sans,sans-serif",maxWidth:150 }}>
                            {allCats.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                        ) : (
                          <span style={{ fontSize:11,color:"#888" }}>{t.category}</span>
                        )}
                        <div style={{ fontSize:13,fontWeight:700,color:ST_RED,flexShrink:0,minWidth:70,textAlign:"right" }}>−{fmt(t.amount)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Footer total */}
                  <div style={{ padding:"14px 20px",borderTop:"1px solid #F0F0F0",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#FAFAFA" }}>
                    <span style={{ fontSize:13,color:"#888" }}>Total {catDrilldown.cat}</span>
                    <span style={{ fontSize:16,fontWeight:700,color:ST_RED }}>{fmt(total)}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {view==="accounts"&&<AccountsPanel accounts={accounts} txns={txns} isAdmin={isAdmin} onRefresh={loadAll}/>}
      {view==="referrals"&&<ReferralDashboard txns={txns} referrers={referrers} referredClients={referredClients} payments={referredClientPayments} isAdmin={isAdmin} onRefresh={loadAll}/>}
      {view==="runway"&&<RunwayView txns={txns} accounts={accounts}/>}
      {view==="pnl"&&<PnLView txns={txns}/>}
      {view==="opsdash"&&<OperationsSummaryView tickets={tickets} tasks={tasks} statusHistory={ticketStatusHistory} assignees={entityAssignees} allUsers={allUsers} setView={setView}/>}
      {view==="tickets"&&<TicketsView tickets={tickets} statusHistory={ticketStatusHistory} allUsers={allUsers} currentUserEmail={session.user.email} currentUserId={session.user.id} canEditFibonacci={canEditFibonacci} assignees={entityAssignees} comments={comments} attachments={attachments} devTasks={devTasks} setView={setView} onRefresh={loadAll}/>}
      {view==="tasks"&&<TasksView tasks={tasks} comments={taskComments} currentUserEmail={session.user.email} onRefresh={loadAll}/>}
      {view==="onboarding"&&<OnboardingView onboarding={onboarding} history={onboardingHistory} onRefresh={loadAll}/>}
      {view==="devdash"&&<DevsMetricsView tickets={tickets} ticketHistory={ticketStatusHistory} devTasks={devTasks} devTaskHistory={devTaskStatusHistory} assignees={entityAssignees} allUsers={allUsers} setView={setView}/>}
      {view==="devtasks"&&<DevTasksView devTasks={devTasks} statusHistory={devTaskStatusHistory} allUsers={allUsers} currentUserEmail={session.user.email} currentUserId={session.user.id} canEditFibonacci={canEditFibonacci} assignees={entityAssignees} comments={comments} attachments={attachments} tickets={tickets} onRefresh={loadAll}/>}
      {view==="services"&&<ServicesView/>}
      {view==="categories"&&<CategoriesPanel catsIncome={catsIncome} catsExpense={catsExpense} isAdmin={isAdmin} onRefresh={loadAll}/>}
      {view==="usuarios"&&isAdmin&&<UserPermissionsPanel users={allUsers} allowedSections={allowedSections} onRefresh={loadAll}/>}

      {/* ADD */}
      {view==="add"&&isAdmin&&(
        <div className="spicy-card" style={{ maxWidth:480 }}>
          <div style={{ fontSize:18,fontWeight:700,color:"#111",marginBottom:20 }}>Registrar movimiento</div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12,fontWeight:600,color:"#555",marginBottom:8,textTransform:"uppercase",letterSpacing:0.5 }}>Tipo</div>
            <div style={{ display:"flex",gap:8 }}>
              {["income","expense"].map(t=>(
                <button key={t} onClick={()=>setForm(f=>({...f,type:t,category:t==="income"?(catsIncome[0]?.name||"SaaS MRR"):(catsExpense[0]?.name||"Salarios")}))} style={{ flex:1,padding:"9px",borderRadius:8,fontSize:13,cursor:"pointer",fontWeight:600,border:"2px solid",borderColor:form.type===t?(t==="income"?"#1D9E75":ST_RED):"#E0E0E0",background:form.type===t?(t==="income"?"#EDFAF3":ST_RED_BG):"white",color:form.type===t?(t==="income"?"#16A34A":ST_RED):"#888",transition:"all 0.15s" }}>
                  {t==="income"?"↑ Ingreso":"↓ Egreso"}
                </button>
              ))}
            </div>
          </div>
          {[
            {label:"Cuenta",field:"account_id",type:"select",options:accounts.map(a=>({value:a.id,label:a.name}))},
            {label:"Categoría",field:"category",type:"select",options:(form.type==="income"?catsIncome:catsExpense).map(c=>({value:c.name,label:c.name}))},
            {label:"Monto (USD)",field:"amount",type:"number",placeholder:"0.00"},
            {label:"Descripción",field:"description",type:"text",placeholder:"Concepto del movimiento"},
            {label:"Fecha",field:"date",type:"date"},
          ].map(row=>(
            <div key={row.field} style={{ marginBottom:14 }}>
              <div style={{ fontSize:12,fontWeight:600,color:"#555",marginBottom:7,textTransform:"uppercase",letterSpacing:0.5 }}>{row.label}</div>
              {row.type==="select"
                ?<select className="spicy-select" value={form[row.field]} onChange={e=>setForm(f=>({...f,[row.field]:e.target.value}))} style={{ width:"100%" }}>{row.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
                :<input className="spicy-input" type={row.type} value={form[row.field]} placeholder={row.placeholder} onChange={e=>setForm(f=>({...f,[row.field]:e.target.value}))}/>
              }
            </div>
          ))}
          <button className="spicy-btn-primary" onClick={handleAdd} style={{ width:"100%",padding:"12px",marginTop:8,fontSize:14 }}>
            {saved?"Guardado ✓":"Guardar movimiento"}
          </button>
        </div>
      )}

      {/* HISTORY */}
      {view==="history"&&(
        <HistoryView
          txns={txns} accounts={accounts} catsIncome={catsIncome} catsExpense={catsExpense}
          filterType={filterType} setFilterType={setFilterType}
          filterAcc={filterAcc} setFilterAcc={setFilterAcc}
          isAdmin={isAdmin} updateCategory={updateCategory} deleteTxn={deleteTxn}
          deleteMany={async (ids)=>{ await Promise.all(ids.map(id=>sb.from("transactions").delete().eq("id",id))); setTxns(prev=>prev.filter(t=>!ids.includes(t.id))); }}
          sourceBadge={sourceBadge} invoiceBadge={invoiceBadge}
          uploadInvoice={uploadInvoice} viewInvoice={viewInvoice}
        />
      )}
      </>
      )}

      </div>{/* end spicy-main */}
    </div>
  );
}
