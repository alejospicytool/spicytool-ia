import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

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
  dashboard:"▦", accounts:"🏦", add:"+", history:"☰", runway:"📈",
  referrals:"🤝",
  services:"⚡", categories:"⊞"
};
const NAV_LABELS = {
  dashboard:"Resumen", accounts:"Cuentas", add:"Registrar", history:"Historial", runway:"Runway",
  referrals:"Referidos",
  services:"Servicios", categories:"Categorías"
};

const NAV_SECTIONS = [
  {
    label: "Finanzas",
    views: ["dashboard","accounts","add","history","runway"],
    adminOnly: false,
  },
  {
    label: "Referidos",
    views: ["referrals"],
    adminOnly: false,
    badge: { referrals: true },
  },
  {
    label: "Dashboard Producto",
    views: ["services"],
    adminOnly: false,
  },
  {
    label: "Configuración",
    views: ["categories"],
    adminOnly: false,
  },
];

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

// ── Referral Dashboard ─────────────────────────────────────────────────────
function ReferralDashboard({ txns, referrers, isAdmin, onRefresh }) {
  const [expanded,   setExpanded]   = useState(null);
  const [showAdd,    setShowAdd]    = useState(false);
  const [newRef,     setNewRef]     = useState({id:"",name:"",email:"",commission_rate:20});
  const [stripeData, setStripeData] = useState(null);
  const [syncing,    setSyncing]    = useState(false);
  const [syncMsg,    setSyncMsg]    = useState("");
  const [addTxnFor,  setAddTxnFor]  = useState(null); // referrer id for manual txn form
  const [txnForm,    setTxnForm]    = useState({amount:"", description:"", date:new Date().toISOString().split("T")[0]});
  const [savingTxn,  setSavingTxn]  = useState(false);

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

  // Pull referral data from Stripe via Worker
  async function syncFromStripe() {
    if (!WORKER_URL) { setSyncMsg("Configurá WORKER_URL primero."); return; }
    setSyncing(true); setSyncMsg("");
    try {
      const res = await fetch(WORKER_URL + "/referrals");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      setStripeData(data);
      // Import new transactions into Supabase
      if (data.referrers?.length) {
        const allTxns = data.referrers.flatMap(r =>
          r.transactions.map(t => ({
            ...t,
            type: "income",
            category: "SaaS MRR",
            account_id: "mercury",
            referrer_id: r.id,
            referrer_name: r.name,
          }))
        );
        const existingIds = new Set(txns.map(t => t.id));
        const newTxns = allTxns.filter(t => !existingIds.has(t.id));
        if (newTxns.length) {
          await sb.from("transactions").insert(newTxns);
          onRefresh();
          setSyncMsg(`${newTxns.length} transacciones importadas desde Stripe.`);
        } else {
          setSyncMsg("Todo al día — sin transacciones nuevas.");
        }
      }
    } catch(e) { setSyncMsg("Error: " + e.message); }
    setSyncing(false);
  }

  // Calculate commissions using per-referrer rate from Supabase
  const paidCommissions = txns.filter(t => t.category === "Comisiones referidos" && t.referrer_id);
  const referredIncome  = txns.filter(t => t.type === "income" && t.referrer_id);

  const stats = referrers.map(ref => {
    const rate = (ref.commission_rate || 20) / 100;
    const inc  = referredIncome.filter(t => t.referrer_id === ref.id);
    const paid = paidCommissions.filter(t => t.referrer_id === ref.id);
    const totalRevenue    = inc.reduce((s,t) => s + Number(t.amount), 0);
    const totalCommission = totalRevenue * rate;
    const totalPaid       = paid.reduce((s,t) => s + Number(t.amount), 0);
    const totalOwed       = Math.max(0, totalCommission - totalPaid);

    // Per-month breakdown
    const months = {};
    inc.forEach(t => {
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

    // Per-customer breakdown
    const customerMap = {};
    inc.forEach(t => {
      const key = t.description || t.id;
      if (!customerMap[key]) customerMap[key] = { name:key, revenue:0, commission:0, transactions:[] };
      customerMap[key].revenue    += Number(t.amount);
      customerMap[key].commission += Number(t.amount) * rate;
      customerMap[key].transactions.push(t);
    });
    const customers = Object.values(customerMap).sort((a,b) => b.commission - a.commission);

    const curRevenue = inc.filter(t => monthKey(t.date) === curMK).reduce((s,t) => s + Number(t.amount), 0);
    return { ...ref, totalRevenue, totalCommission, totalPaid, totalOwed, months, customers,
      curCommission: curRevenue * rate, activeBrokers: new Set(inc.map(t => t.description)).size };
  }).sort((a,b) => b.totalOwed - a.totalOwed);

  const totalOwedNow = stats.reduce((s,r) => s + r.curCommission, 0);
  const totalOwedAll = stats.reduce((s,r) => s + r.totalOwed, 0);
  const totalPaidAll = stats.reduce((s,r) => s + r.totalPaid, 0);

  async function markPaid(ref, mk, amount) {
    await sb.from("transactions").insert({
      id: "pay_"+ref.id+"_"+mk+"_"+Date.now(), type:"expense",
      category:"Comisiones referidos", amount: Math.round(amount*100)/100,
      description: `Comisión ${ref.name} — ${monthLabel(mk)}`,
      date: new Date().toISOString().split("T")[0],
      account_id:"mercury", referrer_id:ref.id, referrer_name:ref.name, paid:true,
    });
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
                  const owed = Math.max(0, m.commission - m.paid);
                  return (
                    <div key={mk} style={{ marginBottom:8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", background:"#F9F9F9", borderRadius:8 }}>
                        <div style={{ flex:1, fontSize:13, fontWeight:600 }}>{monthLabel(mk)}</div>
                        <div style={{ fontSize:12, color:"#888" }}>Rev {fmtDec(m.revenue)}</div>
                        <div style={{ fontSize:13, fontWeight:700 }}>{fmtDec(m.commission)}</div>
                        <div>
                          {owed < 0.01
                            ? <span className="spicy-badge-green">pagado ✓</span>
                            : isAdmin && <button onClick={()=>markPaid(ref,mk,owed)} style={{ fontSize:11, padding:"4px 12px", borderRadius:6, cursor:"pointer", background:"#FEF3C7", color:"#92400E", border:"1px solid #FCD34D", fontWeight:600 }}>marcar pagado {fmtDec(owed)}</button>
                          }
                        </div>
                      </div>
                      {/* Individual transactions in this month */}
                      {m.transactions?.map(t=>(
                        <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 12px 7px 24px", borderBottom:"1px solid #F3F3F3", fontSize:12 }}>
                          <div style={{ width:6, height:6, borderRadius:"50%", background:"#1D9E75", flexShrink:0 }}/>
                          <div style={{ flex:1, color:"#555" }}>{t.description||"—"}</div>
                          <div style={{ color:"#888" }}>{t.date}</div>
                          <div style={{ fontWeight:600, color:"#111" }}>{fmtDec(Number(t.amount))}</div>
                          <div style={{ color:"#aaa", minWidth:70, textAlign:"right" }}>com: {fmtDec(Number(t.amount)*(ref.commission_rate||20)/100)}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* Por cliente */}
                {ref.customers?.length > 0 && (
                  <>
                    <div style={{ fontSize:12, fontWeight:600, color:"#555", margin:"20px 0 10px", textTransform:"uppercase", letterSpacing:0.5 }}>Por cliente</div>
                    {ref.customers.map(c=>(
                      <div key={c.name} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", background:"#F9F9F9", borderRadius:8, marginBottom:6 }}>
                        <div style={{ flex:1, fontSize:13, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.name}</div>
                        <div style={{ fontSize:12, color:"#888" }}>{c.transactions.length} pago{c.transactions.length!==1?"s":""}</div>
                        <div style={{ fontSize:12, color:"#555" }}>Rev {fmtDec(c.revenue)}</div>
                        <div style={{ fontSize:13, fontWeight:700 }}>Com {fmtDec(c.commission)}</div>
                        <div style={{ fontSize:11, padding:"3px 8px", borderRadius:5,
                          background: c.commission <= ref.totalPaid ? "#EDFAF3" : "#FEF3C7",
                          color: c.commission <= ref.totalPaid ? "#16A34A" : "#92400E",
                          fontWeight:600 }}>
                          {c.commission <= ref.totalPaid ? "cubierto" : `falta ${fmtDec(c.commission)}`}
                        </div>
                      </div>
                    ))}
                  </>
                )}
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
        id: "imp_" + i + "_" + Date.now(),
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
        id: "imp_str_" + i + "_" + Date.now(),
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
  filterAcc, setFilterAcc, isAdmin, updateCategory, deleteTxn, deleteMany, sourceBadge }) {

  const [selected,    setSelected]    = useState({});
  const [deleting,    setDeleting]    = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterCat,   setFilterCat]   = useState("all");
  const [page,        setPage]        = useState(1);
  const PAGE_SIZE = 25;

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
                <div style={{ fontSize:13,fontWeight:600,color:"#111",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{t.description||t.category}{sourceBadge(t)}</div>
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
              {isAdmin && (
                <button onClick={()=>deleteTxn(t.id)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#ccc",padding:"0 4px",lineHeight:1 }}>×</button>
              )}
            </div>
          );
        })}
      </div>

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

// ── Main App ───────────────────────────────────────────────────────────────
export default function SpicyFinanzas() {
  const [session,  setSession]  = useState(null);
  const [role,     setRole]     = useState(null); // 'admin' | 'reader' | null
  const [authReady,setAuthReady]= useState(false);

  const [txns,      setTxns]      = useState([]);
  const [accounts,  setAccounts]  = useState([]);
  const [referrers, setReferrers] = useState([]);
  const [catsIncome,  setCatsIncome]  = useState([]);
  const [catsExpense, setCatsExpense] = useState([]);
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
    setDataLoaded(false);
    const [roleRes,txRes,accRes,refRes,catRes]=await Promise.all([
      sb.from("user_roles").select("role").eq("user_id",session.user.id).single(),
      sb.from("transactions").select("*").order("date",{ascending:false}),
      sb.from("accounts").select("*").order("created_at"),
      sb.from("referrers").select("*").order("name"),
      sb.from("categories").select("*").order("position"),
    ]);
    setRole(roleRes.data?.role||"reader");
    setTxns(txRes.data||[]);
    setAccounts(accRes.data||[]);
    setReferrers(refRes.data||[]);
    setCatsIncome((catRes.data||[]).filter(c=>c.type==="income"));
    setCatsExpense((catRes.data||[]).filter(c=>c.type==="expense"));
    setDataLoaded(true);
  }

  const isAdmin = role==="admin";

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
    await sb.from("transactions").delete().eq("id",id);
    setTxns(prev=>prev.filter(t=>t.id!==id));
  }

  async function handleSync() {
    if (!WORKER_URL){setSyncError("Configurá WORKER_URL.");return;}
    setSyncing(true); setSyncError("");
    try {
      const res=await fetch(WORKER_URL+"/sync"); if(!res.ok)throw new Error("HTTP "+res.status);
      const data=await res.json();
      if(data.transactions?.length){
        const existingIds=new Set(txns.map(t=>t.id));
        const newTxns=data.transactions.filter(t=>!existingIds.has(t.id));
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

  const sourceBadge=(t)=>{
    if(t.source)return <span style={{ fontSize:10,padding:"1px 5px",borderRadius:4,marginLeft:5,background:t.source==="mercury"?"var(--color-background-info)":"var(--color-background-success)",color:t.source==="mercury"?"var(--color-text-info)":"var(--color-text-success)" }}>{t.source}</span>;
    if(t.referrer_id)return <span style={{ fontSize:10,padding:"1px 5px",borderRadius:4,marginLeft:5,background:"var(--color-background-warning)",color:"var(--color-text-warning)" }}>ref</span>;
    return null;
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
          {NAV_SECTIONS.map(section=>{
            const visibleViews = section.views.filter(v =>
              v !== "add" || isAdmin
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
      {view==="referrals"&&<ReferralDashboard txns={txns} referrers={referrers} isAdmin={isAdmin} onRefresh={loadAll}/>}
      {view==="runway"&&<RunwayView txns={txns} accounts={accounts}/>}
      {view==="services"&&<ServicesView/>}
      {view==="categories"&&<CategoriesPanel catsIncome={catsIncome} catsExpense={catsExpense} isAdmin={isAdmin} onRefresh={loadAll}/>}

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
          sourceBadge={sourceBadge}
        />
      )}

      </div>{/* end spicy-main */}
    </div>
  );
}
