import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Supabase ───────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://khuavhbraikzreyhptog.supabase.co";
const SUPABASE_KEY = "sb_publishable_O8UPfP8BYLWhlIg0Fv45Gg_coidezqc";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const WORKER_URL = "";
const COMMISSION_RATE = 0.20;
const MONTH_LABELS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const ACCOUNT_COLORS = ["#185FA5","#0F6E56","#533AB7","#3B6D11","#993C1D","#BA7517","#993556","#5F5E5A","#D85A30","#1D9E75"];

const fmt    = (n) => "$" + Math.round(n).toLocaleString("es-UY");
const fmtDec = (n) => "$" + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const monthKey = (d) => { const dt = new Date(d+"T00:00:00"); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`; };
const monthLabel = (mk) => { const [y,m]=mk.split("-"); return MONTH_LABELS[parseInt(m)-1]+" "+y; };

// ── Login Screen ───────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
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
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:400, fontFamily:"var(--font-sans)" }}>
      <div style={{ width:"100%", maxWidth:360 }}>
        <div style={{ marginBottom:"2rem" }}>
          <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-tertiary)", letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>SpicyTool</div>
          <div style={{ fontSize:24, fontWeight:500 }}>Control financiero</div>
          <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginTop:6 }}>Ingresá con tu cuenta del equipo.</div>
        </div>

        <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"1.5rem" }}>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, color:"var(--color-text-tertiary)", marginBottom:6 }}>Email</div>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="alejo@spicytool.com"
              style={{ width:"100%", fontSize:13, boxSizing:"border-box" }}/>
          </div>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, color:"var(--color-text-tertiary)", marginBottom:6 }}>Contraseña</div>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••"
              onKeyDown={e=>e.key==="Enter"&&handleLogin(e)}
              style={{ width:"100%", fontSize:13, boxSizing:"border-box" }}/>
          </div>
          {error && <div style={{ fontSize:12, color:"var(--color-text-danger)", marginBottom:14, padding:"8px 10px", background:"var(--color-background-danger)", borderRadius:"var(--border-radius-md)" }}>{error}</div>}
          <button onClick={handleLogin} disabled={loading||!email||!pass} style={{ width:"100%", padding:"10px", borderRadius:"var(--border-radius-md)", fontSize:14, fontWeight:500, cursor:"pointer", background:"var(--color-background-info)", color:"var(--color-text-info)", border:"0.5px solid var(--color-border-info)", opacity:loading?0.7:1 }}>
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </div>
        <div style={{ marginTop:12, fontSize:12, color:"var(--color-text-tertiary)", textAlign:"center" }}>
          ¿No tenés cuenta? Pedile a Alejo que te invite desde Supabase → Authentication → Invite user.
        </div>
      </div>
    </div>
  );
}

// ── Chart Bar ──────────────────────────────────────────────────────────────
function ChartBar({ label, income, expense, referralCost, maxVal }) {
  const h=110, iH=maxVal>0?Math.round((income/maxVal)*h):0, eH=maxVal>0?Math.round((expense/maxVal)*h):0, rH=maxVal>0?Math.round((referralCost/maxVal)*h):0;
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4,flex:1,minWidth:0 }}>
      <div style={{ display:"flex",alignItems:"flex-end",gap:2,height:h }}>
        <div style={{ width:13,height:iH,background:"#1D9E75",borderRadius:"3px 3px 0 0",minHeight:income>0?3:0 }}/>
        <div style={{ width:13,height:eH,background:"#D85A30",borderRadius:"3px 3px 0 0",minHeight:expense>0?3:0 }}/>
        {referralCost>0&&<div style={{ width:10,height:rH,background:"#BA7517",borderRadius:"3px 3px 0 0",opacity:0.85 }}/>}
      </div>
      <span style={{ fontSize:11,color:"var(--color-text-tertiary)" }}>{label}</span>
    </div>
  );
}

// ── Accounts Panel ─────────────────────────────────────────────────────────
function AccountsPanel({ accounts, txns, isAdmin, onRefresh }) {
  const [editingId, setEditingId] = useState(null);
  const [editVal,   setEditVal]   = useState("");
  const [importingId, setImportingId] = useState(null);
  const [showAdd,   setShowAdd]   = useState(false);
  const [newForm,   setNewForm]   = useState({ name:"", currency:"USD", balance:"" });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const total = accounts.reduce((s,a)=>s+Number(a.balance),0);
  const txnsByAccount = {};
  accounts.forEach(a=>{
    const at=txns.filter(t=>t.account_id===a.id);
    txnsByAccount[a.id]={ income:at.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0), expense:at.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0) };
  });

  async function saveBalance(id) {
    const val=parseFloat(editVal); if(isNaN(val)){setEditingId(null);return;}
    await sb.from("accounts").update({balance:val}).eq("id",id);
    setEditingId(null); onRefresh();
  }

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
          {accounts.filter(a=>a.balance>0).map(a=>{const h=total>0?Math.max(4,Math.round((a.balance/total)*48)):4;return <div key={a.id} title={`${a.name}: ${fmt(a.balance)}`} style={{ width:10,height:h,background:a.color,borderRadius:"2px 2px 0 0",opacity:0.85 }}/>;}) }
        </div>
      </div>

      <div style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",overflow:"hidden",marginBottom:10 }}>
        {accounts.map((a,i)=>(
          <div key={a.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<accounts.length-1?"0.5px solid var(--color-border-tertiary)":"none" }}>
            <div style={{ width:10,height:10,borderRadius:"50%",background:a.color,flexShrink:0 }}/>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                <span style={{ fontSize:14,fontWeight:500 }}>{a.name}</span>
                {a.api&&<span style={{ fontSize:10,padding:"1px 6px",borderRadius:4,background:"var(--color-background-info)",color:"var(--color-text-info)" }}>API</span>}
                <span style={{ fontSize:11,color:"var(--color-text-tertiary)" }}>{a.currency}</span>
              </div>
              <div style={{ fontSize:11,color:"var(--color-text-tertiary)",marginTop:2 }}>{fmt(txnsByAccount[a.id]?.income||0)} ing · {fmt(txnsByAccount[a.id]?.expense||0)} egr</div>
            </div>

            {isAdmin&&editingId===a.id?(
              <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                <span style={{ fontSize:13,color:"var(--color-text-secondary)" }}>$</span>
                <input autoFocus type="number" value={editVal} onChange={e=>setEditVal(e.target.value)}
                  onBlur={()=>saveBalance(a.id)} onKeyDown={e=>{if(e.key==="Enter")saveBalance(a.id);if(e.key==="Escape")setEditingId(null);}}
                  style={{ width:100,fontSize:14,fontWeight:500,textAlign:"right",padding:"3px 6px" }}/>
              </div>
            ):(
              <div onClick={()=>isAdmin&&(setEditingId(a.id),setEditVal(String(a.balance)))}
                title={isAdmin?"Click para editar":""}
                style={{ fontSize:16,fontWeight:500,cursor:isAdmin?"pointer":"default",color:a.balance>0?"var(--color-text-primary)":"var(--color-text-tertiary)",minWidth:90,textAlign:"right" }}>
                {fmt(a.balance)}{isAdmin&&<span style={{ fontSize:11,color:"var(--color-text-tertiary)",marginLeft:4 }}>✎</span>}
              </div>
            )}

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
        ))}
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
  const [expanded, setExpanded] = useState(null);
  const [showAdd,  setShowAdd]  = useState(false);
  const [newRef,   setNewRef]   = useState({id:"",name:"",email:"",commission_rate:20});
  const now=new Date(), curMK=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const referredIncome=txns.filter(t=>t.type==="income"&&t.referrer_id);
  const paidCommissions=txns.filter(t=>t.category==="Comisiones referidos"&&t.referrer_id);
  const stats=referrers.map(ref=>{
    const rate=(ref.commission_rate||20)/100;
    const inc=referredIncome.filter(t=>t.referrer_id===ref.id);
    const paid=paidCommissions.filter(t=>t.referrer_id===ref.id);
    const totalRevenue=inc.reduce((s,t)=>s+t.amount,0);
    const totalCommission=totalRevenue*rate;
    const totalPaid=paid.reduce((s,t)=>s+t.amount,0);
    const totalOwed=Math.max(0,totalCommission-totalPaid);
    const months={};
    inc.forEach(t=>{const mk=monthKey(t.date);if(!months[mk])months[mk]={revenue:0,commission:0,paid:0};months[mk].revenue+=t.amount;months[mk].commission+=t.amount*rate;});
    paid.forEach(t=>{const mk=monthKey(t.date);if(!months[mk])months[mk]={revenue:0,commission:0,paid:0};months[mk].paid+=t.amount;});
    return {...ref,totalRevenue,totalCommission,totalPaid,totalOwed,months,curCommission:inc.filter(t=>monthKey(t.date)===curMK).reduce((s,t)=>s+t.amount,0)*rate,activeBrokers:new Set(inc.map(t=>t.description)).size};
  }).sort((a,b)=>b.totalOwed-a.totalOwed);

  async function markPaid(ref,mk,amount) {
    await sb.from("transactions").insert({id:"pay_"+ref.id+"_"+mk+"_"+Date.now(),type:"expense",category:"Comisiones referidos",amount:Math.round(amount*100)/100,description:`Comisión ${ref.name} — ${monthLabel(mk)}`,date:new Date().toISOString().split("T")[0],account_id:"mercury",referrer_id:ref.id,referrer_name:ref.name,paid:true});
    onRefresh();
  }
  async function saveReferrer() {
    if (!newRef.id.trim()||!newRef.name.trim()) return;
    await sb.from("referrers").insert({id:newRef.id.trim(),name:newRef.name.trim(),email:newRef.email,commission_rate:newRef.commission_rate});
    setNewRef({id:"",name:"",email:"",commission_rate:20}); setShowAdd(false); onRefresh();
  }

  const totalOwedNow=stats.reduce((s,r)=>s+r.curCommission,0);
  const totalOwedAll=stats.reduce((s,r)=>s+r.totalOwed,0);
  const totalPaidAll=stats.reduce((s,r)=>s+r.totalPaid,0);

  return (
    <div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12,marginBottom:"1.5rem" }}>
        {[{label:"A pagar este mes",value:fmtDec(totalOwedNow),warn:totalOwedNow>0},{label:"Deuda acumulada",value:fmtDec(totalOwedAll),warn:totalOwedAll>0},{label:"Pagado historial",value:fmtDec(totalPaidAll)}].map(k=>(
          <div key={k.label} style={{ background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"1rem" }}>
            <div style={{ fontSize:12,color:"var(--color-text-tertiary)",marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:20,fontWeight:500,color:k.warn?"var(--color-text-warning)":"var(--color-text-primary)" }}>{k.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
        {stats.map(ref=>(
          <div key={ref.id} style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",overflow:"hidden" }}>
            <div onClick={()=>setExpanded(expanded===ref.id?null:ref.id)} style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 16px",cursor:"pointer" }}>
              <div style={{ width:36,height:36,borderRadius:"50%",background:"var(--color-background-info)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:500,color:"var(--color-text-info)",flexShrink:0 }}>{ref.name.split(" ").map(w=>w[0]).slice(0,2).join("")}</div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:14,fontWeight:500 }}>{ref.name}</div>
                <div style={{ fontSize:11,color:"var(--color-text-tertiary)",marginTop:2 }}>{ref.email} · {ref.commission_rate}% · {ref.activeBrokers} brokers</div>
              </div>
              <div style={{ textAlign:"right",flexShrink:0 }}>
                <div style={{ fontSize:13,fontWeight:500,color:ref.totalOwed>0?"var(--color-text-warning)":"var(--color-text-success)" }}>{ref.totalOwed>0?`Debo ${fmtDec(ref.totalOwed)}`:"Al día"}</div>
                <div style={{ fontSize:11,color:"var(--color-text-tertiary)",marginTop:2 }}>este mes: {fmtDec(ref.curCommission)}</div>
              </div>
              <span style={{ fontSize:12,color:"var(--color-text-tertiary)" }}>{expanded===ref.id?"▲":"▼"}</span>
            </div>
            {expanded===ref.id&&(
              <div style={{ borderTop:"0.5px solid var(--color-border-tertiary)",padding:"14px 16px" }}>
                {Object.entries(ref.months).sort(([a],[b])=>b.localeCompare(a)).map(([mk,m])=>{
                  const owed=Math.max(0,m.commission-m.paid);
                  return (
                    <div key={mk} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
                      <div style={{ flex:1,fontSize:13 }}>{monthLabel(mk)}</div>
                      <div style={{ fontSize:12,color:"var(--color-text-tertiary)",minWidth:90,textAlign:"right" }}>Rev {fmtDec(m.revenue)}</div>
                      <div style={{ fontSize:13,fontWeight:500,minWidth:80,textAlign:"right" }}>{fmtDec(m.commission)}</div>
                      <div style={{ minWidth:90,textAlign:"right" }}>
                        {owed<0.01
                          ?<span style={{ fontSize:11,background:"var(--color-background-success)",color:"var(--color-text-success)",padding:"2px 8px",borderRadius:4 }}>pagado</span>
                          :isAdmin&&<button onClick={()=>markPaid(ref,mk,owed)} style={{ fontSize:11,padding:"2px 10px",borderRadius:4,cursor:"pointer",background:"var(--color-background-warning)",color:"var(--color-text-warning)",border:"none" }}>marcar pagado</button>
                        }
                      </div>
                    </div>
                  );
                })}
                <div style={{ display:"flex",gap:10,marginTop:14 }}>
                  {[{label:"Generado",value:fmtDec(ref.totalRevenue)},{label:"Comisión",value:fmtDec(ref.totalCommission)},{label:"Pagado",value:fmtDec(ref.totalPaid)},{label:"Pendiente",value:fmtDec(ref.totalOwed),warn:ref.totalOwed>0}].map(s=>(
                    <div key={s.label} style={{ flex:1,background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"8px 10px" }}>
                      <div style={{ fontSize:11,color:"var(--color-text-tertiary)",marginBottom:4 }}>{s.label}</div>
                      <div style={{ fontSize:14,fontWeight:500,color:s.warn?"var(--color-text-warning)":"var(--color-text-primary)" }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {isAdmin&&(showAdd?(
          <div style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1.25rem" }}>
            <div style={{ fontSize:15,fontWeight:500,marginBottom:12 }}>Nuevo socio referidor</div>
            {[{label:"ID único",field:"id",placeholder:"socio_pablo"},{label:"Nombre",field:"name",placeholder:"Pablo Méndez"},{label:"Email",field:"email",placeholder:"pablo@example.com"}].map(row=>(
              <div key={row.field} style={{ marginBottom:12 }}>
                <div style={{ fontSize:12,color:"var(--color-text-tertiary)",marginBottom:5 }}>{row.label}</div>
                <input value={newRef[row.field]} placeholder={row.placeholder} onChange={e=>setNewRef(f=>({...f,[row.field]:e.target.value}))} style={{ width:"100%",fontSize:13,boxSizing:"border-box" }}/>
              </div>
            ))}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12,color:"var(--color-text-tertiary)",marginBottom:5 }}>Comisión (%)</div>
              <input type="number" value={newRef.commission_rate} onChange={e=>setNewRef(f=>({...f,commission_rate:Number(e.target.value)}))} style={{ width:"100%",fontSize:13,boxSizing:"border-box" }}/>
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={()=>setShowAdd(false)} style={{ flex:1,padding:"8px",borderRadius:"var(--border-radius-md)",fontSize:13,cursor:"pointer",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-secondary)" }}>Cancelar</button>
              <button onClick={saveReferrer} style={{ flex:2,padding:"8px",borderRadius:"var(--border-radius-md)",fontSize:13,fontWeight:500,cursor:"pointer",background:"var(--color-background-info)",color:"var(--color-text-info)",border:"0.5px solid var(--color-border-info)" }}>Guardar</button>
            </div>
          </div>
        ):(
          <button onClick={()=>setShowAdd(true)} style={{ width:"100%",padding:"9px",borderRadius:"var(--border-radius-md)",fontSize:13,cursor:"pointer",border:"0.5px dashed var(--color-border-secondary)",background:"transparent",color:"var(--color-text-secondary)" }}>+ Agregar socio referidor</button>
        ))}
      </div>
    </div>
  );
}

// ── CSV Parser ─────────────────────────────────────────────────────────────
function autoCategory(desc,type){const d=(desc||"").toLowerCase();if(type==="income"){if(d.includes("subscription")||d.includes("mrr")||d.includes("plan"))return"SaaS MRR";if(d.includes("invest")||d.includes("capital"))return"Inversión";return"Otro ingreso";}if(d.includes("salary")||d.includes("deel")||d.includes("sueldo"))return"Salarios";if(d.includes("aws")||d.includes("vercel")||d.includes("notion")||d.includes("openai")||d.includes("stripe fee"))return"SaaS Tools";if(d.includes("meta")||d.includes("facebook")||d.includes("ads"))return"Marketing / Ads";return"Otro gasto";}
function parseCSVRows(text,defaultAccountId){const lines=text.trim().split(/\r?\n/);if(lines.length<2)return[];const cols=lines[0].split(",").map(c=>c.trim().replace(/^"|"$/g,"").toLowerCase());const isMercury=cols.some(c=>c.includes("bank description"))||(cols.includes("amount")&&cols.includes("status"));const isStripe=cols.some(c=>c.includes("created (utc)"))||(cols.includes("net")&&cols.includes("fee"));if(!isMercury&&!isStripe)return[];const rows=[];for(let i=1;i<lines.length;i++){const line=lines[i].trim();if(!line)continue;const values=[];let cur="",inQ=false;for(const ch of line){if(ch==='"'){inQ=!inQ;}else if(ch===","&&!inQ){values.push(cur.trim());cur="";}else cur+=ch;}values.push(cur.trim());const get=(key)=>{const idx=cols.findIndex(c=>c.includes(key));return idx>=0?(values[idx]||"").replace(/^"|"$/g,"").trim():"";};if(isMercury){const rawDate=get("date"),rawAmount=parseFloat(get("amount").replace(/,/g,""))||0,desc=get("description")||get("bank description");if(get("status").toLowerCase()==="pending"||!rawDate||rawAmount===0)continue;const type=rawAmount>0?"income":"expense";rows.push({id:"imp_"+i+"_"+Date.now(),type,amount:Math.abs(rawAmount),description:desc,category:autoCategory(desc,type),date:rawDate.split("T")[0],source:"mercury",account_id:"mercury"});}else{const rawDate=get("created (utc)")||get("created"),rawNet=parseFloat(get("net").replace(/,/g,""))||0,txType=get("type").toLowerCase(),desc=get("description")||get("source");if(!rawDate||txType==="payout")continue;const type=rawNet<0?"expense":"income";rows.push({id:"imp_str_"+i+"_"+Date.now(),type,amount:Math.abs(rawNet),description:desc,category:autoCategory(desc,type),date:rawDate.split(" ")[0],source:"stripe",account_id:defaultAccountId||"mercury"});}}return rows;}

// ── Main App ───────────────────────────────────────────────────────────────
export default function SpicyFinanzas() {
  const [session,  setSession]  = useState(null);
  const [role,     setRole]     = useState(null);
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

  useEffect(()=>{
    sb.auth.getSession().then(({data:{session}})=>{
      setSession(session); setAuthReady(true);
    });
    const {data:{subscription}}=sb.auth.onAuthStateChange((_,session)=>{
      setSession(session); if(!session){setRole(null);setDataLoaded(false);}
    });
    return ()=>subscription.unsubscribe();
  },[]);

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

  async function deleteTxn(id) {
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

  const now=new Date();
  const income=txns.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount),0);
  const expenses=txns.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount),0);
  const mrrTxns=txns.filter(t=>t.category==="SaaS MRR").sort((a,b)=>b.date.localeCompare(a.date));
  const mrr=mrrTxns.length>0?Number(mrrTxns[0].amount):0;
  const last3months=[0,1,2].map(i=>{const d=new Date(now.getFullYear(),now.getMonth()-i,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;});
  const monthlyBurn=last3months.reduce((acc,mk)=>acc+txns.filter(t=>t.type==="expense"&&monthKey(t.date)===mk).reduce((a,t)=>a+Number(t.amount),0),0)/3;
  const totalCash=accounts.reduce((s,a)=>s+Number(a.balance),0);
  const runway=monthlyBurn>0?Math.round(totalCash/monthlyBurn):0;
  const months6=Array.from({length:6},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-(5-i),1);return{key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,label:MONTH_LABELS[d.getMonth()]};});
  const chartData=months6.map(m=>({label:m.label,income:txns.filter(t=>t.type==="income"&&monthKey(t.date)===m.key).reduce((s,t)=>s+Number(t.amount),0),expense:txns.filter(t=>t.type==="expense"&&monthKey(t.date)===m.key).reduce((s,t)=>s+Number(t.amount),0),referralCost:txns.filter(t=>t.category==="Comisiones referidos"&&monthKey(t.date)===m.key).reduce((s,t)=>s+Number(t.amount),0)}));
  const maxVal=Math.max(...chartData.map(d=>Math.max(d.income,d.expense)),1);
  const expByCat=catsExpense.map(cat=>({cat:cat.name,total:txns.filter(t=>t.type==="expense"&&t.category===cat.name).reduce((s,t)=>s+Number(t.amount),0)})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const totalExpAll=expByCat.reduce((s,x)=>s+x.total,1);
  const curMK=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const referralOwed=txns.filter(t=>t.type==="income"&&t.referrer_id&&monthKey(t.date)===curMK).reduce((s,t)=>s+Number(t.amount),0)*COMMISSION_RATE;
  const visibleTxns=txns.filter(t=>(filterType==="all"||t.type===filterType)&&(filterAcc==="all"||t.account_id===filterAcc)).slice(0,60);

  const sourceBadge=(t)=>{
    if(t.source)return <span style={{ fontSize:10,padding:"1px 5px",borderRadius:4,marginLeft:5,background:t.source==="mercury"?"var(--color-background-info)":"var(--color-background-success)",color:t.source==="mercury"?"var(--color-text-info)":"var(--color-text-success)" }}>{t.source}</span>;
    if(t.referrer_id)return <span style={{ fontSize:10,padding:"1px 5px",borderRadius:4,marginLeft:5,background:"var(--color-background-warning)",color:"var(--color-text-warning)" }}>ref</span>;
    return null;
  };

  if (!authReady) return <div style={{ padding:"2rem",color:"var(--color-text-secondary)",fontSize:14 }}>Cargando...</div>;
  if (!session)   return <LoginScreen/>;
  if (!dataLoaded)return <div style={{ padding:"2rem",color:"var(--color-text-secondary)",fontSize:14 }}>Cargando datos...</div>;

  const navBtn=(v,label,badge)=>(
    <button key={v} onClick={()=>setView(v)} style={{ fontSize:13,padding:"6px 14px",borderRadius:"var(--border-radius-md)",background:view===v?"var(--color-background-info)":"transparent",color:view===v?"var(--color-text-info)":"var(--color-text-secondary)",border:view===v?"0.5px solid var(--color-border-info)":"0.5px solid var(--color-border-tertiary)",cursor:"pointer",fontWeight:view===v?500:400 }}>
      {label}{badge&&<span style={{ fontSize:10,background:"#BA7517",color:"#fff",borderRadius:10,padding:"1px 5px",marginLeft:5 }}>{badge}</span>}
    </button>
  );

  return (
    <div style={{ fontFamily:"var(--font-sans)",padding:"1rem 0",maxWidth:720 }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.5rem",flexWrap:"wrap",gap:10 }}>
        <div>
          <div style={{ fontSize:11,fontWeight:500,color:"var(--color-text-tertiary)",letterSpacing:1,textTransform:"uppercase",marginBottom:4 }}>SpicyTool</div>
          <div style={{ fontSize:22,fontWeight:500 }}>Control financiero</div>
        </div>
        <div style={{ display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
          {navBtn("dashboard","Resumen")}
          {navBtn("accounts","Cuentas")}
          {navBtn("referrals","Referidos",referralOwed>0?fmt(referralOwed):null)}
          {isAdmin&&navBtn("add","+ Registrar")}
          {navBtn("history","Historial")}
          {navBtn("categories","Categorías")}
          {WORKER_URL&&<button onClick={handleSync} disabled={syncing} style={{ fontSize:13,padding:"6px 14px",borderRadius:"var(--border-radius-md)",background:"transparent",color:"var(--color-text-secondary)",border:"0.5px solid var(--color-border-tertiary)",cursor:"pointer" }}>{syncing?"Sincronizando…":"⟳ Sync"}</button>}
          <div style={{ display:"flex",alignItems:"center",gap:6,marginLeft:4 }}>
            <span style={{ fontSize:11,color:"var(--color-text-tertiary)" }}>{session.user.email}</span>
            <span style={{ fontSize:10,padding:"2px 7px",borderRadius:10,background:isAdmin?"var(--color-background-success)":"var(--color-background-secondary)",color:isAdmin?"var(--color-text-success)":"var(--color-text-tertiary)" }}>{role}</span>
            <button onClick={()=>sb.auth.signOut()} style={{ fontSize:11,padding:"4px 8px",borderRadius:"var(--border-radius-md)",cursor:"pointer",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-tertiary)" }}>Salir</button>
          </div>
        </div>
      </div>
      {syncError&&<div style={{ fontSize:12,color:"var(--color-text-danger)",marginBottom:12,padding:"8px 12px",background:"var(--color-background-danger)",borderRadius:"var(--border-radius-md)" }}>{syncError}</div>}

      {view==="dashboard"&&(
        <>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginBottom:"1.25rem" }}>
            {[{label:"MRR",value:fmt(mrr),sub:"último mes"},{label:"ARR",value:fmt(mrr*12),sub:"proyectado"},{label:"Cash total",value:fmt(totalCash),sub:`${accounts.filter(a=>a.balance>0).length} cuentas`},{label:"Runway",value:runway>0?`${runway} meses`:"—",sub:monthlyBurn>0?`burn ${fmt(monthlyBurn)}/mes`:"sin burn"}].map(k=>(
              <div key={k.label} style={{ background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"0.875rem" }}>
                <div style={{ fontSize:12,color:"var(--color-text-tertiary)",marginBottom:6 }}>{k.label}</div>
                <div style={{ fontSize:18,fontWeight:500 }}>{k.value}</div>
                <div style={{ fontSize:11,color:"var(--color-text-tertiary)",marginTop:4 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"12px 16px",marginBottom:"1.25rem" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
              <span style={{ fontSize:13,fontWeight:500 }}>Saldos por banco</span>
              <button onClick={()=>setView("accounts")} style={{ fontSize:12,color:"var(--color-text-info)",background:"none",border:"none",cursor:"pointer" }}>Ver todas →</button>
            </div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
              {accounts.map(a=>(
                <div key={a.id} onClick={()=>setView("accounts")} style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 10px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer" }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:a.color }}/>
                  <span style={{ fontSize:12,color:"var(--color-text-secondary)" }}>{a.name}</span>
                  <span style={{ fontSize:13,fontWeight:500,color:a.balance>0?"var(--color-text-primary)":"var(--color-text-tertiary)" }}>{fmt(a.balance)}</span>
                </div>
              ))}
            </div>
          </div>

          {referralOwed>0&&<div onClick={()=>setView("referrals")} style={{ background:"var(--color-background-warning)",border:"0.5px solid var(--color-border-warning)",borderRadius:"var(--border-radius-md)",padding:"10px 14px",marginBottom:"1.25rem",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div style={{ fontSize:13,color:"var(--color-text-warning)",fontWeight:500 }}>Comisiones a pagar este mes: {fmtDec(referralOwed)}</div>
            <span style={{ fontSize:12,color:"var(--color-text-warning)" }}>Ver →</span>
          </div>}

          <div style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem",marginBottom:"1.25rem" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem" }}>
              <span style={{ fontSize:14,fontWeight:500 }}>Ingresos vs egresos — 6 meses</span>
              <div style={{ display:"flex",gap:10,fontSize:12,color:"var(--color-text-secondary)" }}>
                <span style={{ display:"flex",alignItems:"center",gap:3 }}><span style={{ width:9,height:9,borderRadius:2,background:"#1D9E75",display:"inline-block" }}/> Ing.</span>
                <span style={{ display:"flex",alignItems:"center",gap:3 }}><span style={{ width:9,height:9,borderRadius:2,background:"#D85A30",display:"inline-block" }}/> Egr.</span>
                <span style={{ display:"flex",alignItems:"center",gap:3 }}><span style={{ width:9,height:9,borderRadius:2,background:"#BA7517",display:"inline-block" }}/> Ref.</span>
              </div>
            </div>
            <div style={{ display:"flex",alignItems:"flex-end",gap:6,paddingTop:4 }}>
              {chartData.map(d=><ChartBar key={d.label} {...d} maxVal={maxVal}/>)}
            </div>
          </div>

          <div style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem" }}>
            <div style={{ fontSize:14,fontWeight:500,marginBottom:"1rem" }}>Egresos por categoría</div>
            {expByCat.map(x=>(
              <div key={x.cat} style={{ marginBottom:11 }}>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5 }}>
                  <span style={{ color:x.cat==="Comisiones referidos"?"var(--color-text-warning)":"var(--color-text-secondary)" }}>{x.cat}</span>
                  <span style={{ fontWeight:500 }}>{fmt(x.total)}</span>
                </div>
                <div style={{ height:5,background:"var(--color-background-secondary)",borderRadius:3,overflow:"hidden" }}>
                  <div style={{ height:"100%",width:`${Math.round((x.total/totalExpAll)*100)}%`,background:x.cat==="Comisiones referidos"?"#BA7517":"#D85A30",borderRadius:3 }}/>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {view==="accounts"&&<AccountsPanel accounts={accounts} txns={txns} isAdmin={isAdmin} onRefresh={loadAll}/>}
      {view==="referrals"&&<ReferralDashboard txns={txns} referrers={referrers} isAdmin={isAdmin} onRefresh={loadAll}/>}
      {view==="categories"&&<CategoriesPanel catsIncome={catsIncome} catsExpense={catsExpense} isAdmin={isAdmin} onRefresh={loadAll}/>}

      {view==="add"&&isAdmin&&(
        <div style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1.25rem" }}>
          <div style={{ fontSize:16,fontWeight:500,marginBottom:"1.25rem" }}>Registrar movimiento</div>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12,color:"var(--color-text-tertiary)",marginBottom:6 }}>Tipo</div>
            <div style={{ display:"flex",gap:8 }}>
              {["income","expense"].map(t=>(
                <button key={t} onClick={()=>setForm(f=>({...f,type:t,category:t==="income"?(catsIncome[0]?.name||"SaaS MRR"):(catsExpense[0]?.name||"Salarios")}))} style={{ flex:1,padding:"8px",borderRadius:"var(--border-radius-md)",fontSize:13,cursor:"pointer",background:form.type===t?(t==="income"?"var(--color-background-success)":"var(--color-background-danger)"):"var(--color-background-secondary)",color:form.type===t?(t==="income"?"var(--color-text-success)":"var(--color-text-danger)"):"var(--color-text-secondary)",border:"0.5px solid var(--color-border-tertiary)",fontWeight:form.type===t?500:400 }}>
                  {t==="income"?"Ingreso":"Egreso"}
                </button>
              ))}
            </div>
          </div>
          {[
            {label:"Cuenta",field:"account_id",type:"select",options:accounts.map(a=>({value:a.id,label:a.name}))},
            {label:"Categoría",field:"category",type:"select",options:(form.type==="income"?catsIncome:catsExpense).map(c=>({value:c.name,label:c.name}))},
            {label:"Monto (USD)",field:"amount",type:"number",placeholder:"0.00"},
            {label:"Descripción",field:"description",type:"text",placeholder:"Concepto"},
            {label:"Fecha",field:"date",type:"date"},
          ].map(row=>(
            <div key={row.field} style={{ marginBottom:14 }}>
              <div style={{ fontSize:12,color:"var(--color-text-tertiary)",marginBottom:6 }}>{row.label}</div>
              {row.type==="select"
                ?<select value={form[row.field]} onChange={e=>setForm(f=>({...f,[row.field]:e.target.value}))} style={{ width:"100%",fontSize:13 }}>{row.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
                :<input type={row.type} value={form[row.field]} placeholder={row.placeholder} onChange={e=>setForm(f=>({...f,[row.field]:e.target.value}))} style={{ width:"100%",fontSize:13,boxSizing:"border-box" }}/>
              }
            </div>
          ))}
          <button onClick={handleAdd} style={{ width:"100%",padding:"10px",marginTop:8,borderRadius:"var(--border-radius-md)",fontSize:14,fontWeight:500,cursor:"pointer",background:"var(--color-background-info)",color:"var(--color-text-info)",border:"0.5px solid var(--color-border-info)" }}>
            {saved?"Guardado ✓":"Guardar movimiento"}
          </button>
        </div>
      )}

      {view==="history"&&(
        <>
          <div style={{ display:"flex",gap:8,marginBottom:"1rem",flexWrap:"wrap" }}>
            {[["all","Todos"],["income","Ingresos"],["expense","Egresos"]].map(([f,l])=>(
              <button key={f} onClick={()=>setFilterType(f)} style={{ fontSize:12,padding:"5px 12px",borderRadius:"var(--border-radius-md)",background:filterType===f?"var(--color-background-secondary)":"transparent",color:filterType===f?"var(--color-text-primary)":"var(--color-text-tertiary)",border:"0.5px solid var(--color-border-tertiary)",cursor:"pointer",fontWeight:filterType===f?500:400 }}>{l}</button>
            ))}
            <select value={filterAcc} onChange={e=>setFilterAcc(e.target.value)} style={{ fontSize:12,padding:"4px 8px",borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-secondary)",cursor:"pointer" }}>
              <option value="all">Todas las cuentas</option>
              {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <span style={{ marginLeft:"auto",fontSize:12,color:"var(--color-text-tertiary)",alignSelf:"center" }}>{visibleTxns.length} registros</span>
          </div>
          <div style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",overflow:"hidden" }}>
            {visibleTxns.length===0&&<div style={{ padding:"2rem",textAlign:"center",fontSize:13,color:"var(--color-text-tertiary)" }}>Sin movimientos.</div>}
            {visibleTxns.map((t,i)=>{
              const acc=accounts.find(a=>a.id===t.account_id);
              return(
                <div key={t.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<visibleTxns.length-1?"0.5px solid var(--color-border-tertiary)":"none" }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",flexShrink:0,background:t.type==="income"?"#1D9E75":"#D85A30" }}/>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{t.description||t.category}{sourceBadge(t)}</div>
                    <div style={{ fontSize:11,color:"var(--color-text-tertiary)",marginTop:2 }}>{t.category} · {t.date}{acc&&<span style={{ marginLeft:6 }}>· <span style={{ color:acc.color }}>{acc.name}</span></span>}</div>
                  </div>
                  <div style={{ fontSize:14,fontWeight:500,color:t.type==="income"?"var(--color-text-success)":"var(--color-text-danger)",flexShrink:0 }}>{t.type==="income"?"+":"−"}{fmt(t.amount)}</div>
                  {isAdmin&&<button onClick={()=>deleteTxn(t.id)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:16,color:"var(--color-text-tertiary)",padding:"0 4px",lineHeight:1 }}>×</button>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
