// Piezas visuales compartidas del CRM comercial (estilos con la estética del backoffice).
import { useEffect } from "react";
import { esc } from "./crmLogic.js";

export const RED = "#EF3E3E";
export const NAVY = "#1A1A2E";

export const CRM_CSS = `
.crm-root{--ink:#111;--muted:#888;--line:#EBEBEB;--soft:#F7F7F8;--red:${RED};--navy:${NAVY};--amber:#D97706;--green:#16A34A}
.crm-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px}
.crm-title{font-size:20px;font-weight:700;color:var(--ink)}
.crm-title small{display:block;font-size:12px;color:var(--muted);font-weight:500}
.crm-tabs{display:flex;gap:4px;flex-wrap:wrap;flex:1}
.crm-tab{border:none;background:transparent;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;color:#666;cursor:pointer;display:flex;align-items:center;gap:6px}
.crm-tab:hover{background:#EFEFF2}
.crm-tab[aria-selected=true]{background:var(--navy);color:#fff}
.crm-badge{font-size:10px;background:var(--amber);color:#fff;border-radius:10px;padding:1px 6px;font-weight:700}
.crm-badge.late{background:var(--red)}
.crm-save{font-size:12px;color:var(--muted)}
.crm-save[data-state=busy]{color:var(--amber)}.crm-save[data-state=err]{color:var(--red);font-weight:600}
.crm-ai-btn{border:1px solid #E0E0E0;background:#fff;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;color:var(--navy);cursor:pointer}
.crm-ai-btn i{color:var(--red);font-style:normal;margin-right:5px}
.crm-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.crm-toolbar input[type=search]{flex:1 1 220px;min-width:180px}
.crm-btn{background:#fff;color:#444;border:1px solid #E0E0E0;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:500;cursor:pointer}
.crm-btn:hover{border-color:#ccc;background:#fafafa}
.crm-btn.primary{background:var(--red);color:#fff;border-color:var(--red);font-weight:600}.crm-btn.primary:hover{background:#C42F2F}
.crm-btn.danger{color:var(--red);border-color:#F5C6C6}
.crm-btn.sm{padding:5px 10px;font-size:12px}
.crm-btn:disabled{opacity:.5;cursor:not-allowed}
.crm-flags{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.crm-flag{border:1px solid #E0E0E0;background:#fff;border-radius:20px;padding:5px 12px;font-size:12px;font-weight:500;color:#555;cursor:pointer;display:flex;gap:6px;align-items:center}
.crm-flag b{background:#EFEFF2;border-radius:10px;padding:0 7px;font-size:11px}
.crm-flag[aria-pressed=true]{background:var(--navy);color:#fff;border-color:var(--navy)}.crm-flag[aria-pressed=true] b{background:rgba(255,255,255,.2)}
.crm-flag.late b{background:#FEF0F0;color:var(--red)}.crm-flag.rot b{background:#FEF3C7;color:var(--amber)}
.crm-due{background:#FEF3C7;border:1px solid #FCD34D;color:#92400E;border-radius:10px;padding:9px 14px;font-size:13px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.crm-due.late{background:#FEF0F0;border-color:#F5C6C6;color:#B42318}
.crm-due button,.crm-alert button{background:none;border:none;color:inherit;font-weight:700;cursor:pointer;text-decoration:underline;font-size:13px}
.crm-alert{background:#FEF3C7;border:1px solid #FCD34D;color:#92400E;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:14px}
.crm-board{display:flex;gap:12px;overflow-x:auto;padding-bottom:10px;align-items:flex-start}
.crm-col{flex:0 0 250px;background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:10px;min-height:140px}
.crm-col.over{background:#FFF3EE;border-color:#F5B5AC}
.crm-col-h{margin-bottom:10px;border-top:3px solid var(--stage,#999);padding-top:8px}
.crm-col-t{display:flex;justify-content:space-between;align-items:center}
.crm-col-t h2{font-size:13px;font-weight:700;margin:0;color:#333}
.crm-prob{font-size:11px;color:var(--muted);font-weight:600}
.crm-col-m{display:flex;justify-content:space-between;font-size:11.5px;color:#666;margin-top:3px}
.crm-col-w{height:4px;background:#E6E6EA;border-radius:2px;margin-top:6px;overflow:hidden}.crm-col-w span{display:block;height:100%;background:var(--stage,#999)}
.crm-col-wv{font-size:11px;color:var(--muted);margin-top:3px}
.crm-lnk{background:none;border:none;color:var(--red);font-size:11.5px;cursor:pointer;padding:0;text-decoration:underline;font-weight:500}
.crm-empty{font-size:12px;color:#bbb;text-align:center;padding:14px 0;margin:0}
.crm-card{background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.03)}
.crm-card:hover{border-color:#D5D5DC}
.crm-card.is-late{border-left:3px solid var(--red)}.crm-card.rot-red{background:#FFF8F8}.crm-card.rot-amber{background:#FFFCF2}
.crm-card.dragging{opacity:.5}
.crm-c-top{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.crm-c-top h3{font-size:13px;font-weight:600;margin:0;color:var(--ink);overflow-wrap:anywhere}
.crm-mrr{font-size:12.5px;font-weight:700;color:var(--ink);white-space:nowrap}.crm-mrr small{font-weight:500;color:var(--muted)}
.crm-c-sub,.crm-c-via,.crm-c-days{font-size:11.5px;color:#777;margin:3px 0 0}
.crm-c-via{color:#555}.crm-c-lost{font-size:11.5px;color:var(--red);margin:3px 0 0}
.crm-c-days{color:#999}
.crm-pill{display:inline-block;font-size:10.5px;font-weight:600;border-radius:6px;padding:2px 7px;background:#EFEFF2;color:#555;margin-top:5px}
.crm-pill.warn{background:#FEF3C7;color:var(--amber)}.crm-pill.ok{background:#EDFAF3;color:var(--green)}
.crm-chips{list-style:none;padding:0;margin:6px 0 0;display:flex;gap:4px;flex-wrap:wrap}
.crm-chip{font-size:10.5px;color:#555;background:#F4F4F6;border-radius:10px;padding:1px 8px;display:flex;align-items:center;gap:4px}.crm-chip i{width:6px;height:6px;border-radius:50%;display:inline-block}
.crm-c-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px;font-size:11.5px;color:#666}
.crm-next{display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:0}.crm-next time{margin-left:6px;color:var(--ink);font-weight:600}.crm-next em{color:#bbb;font-style:normal}
.crm-whenb{display:inline-block;padding:1px 7px;border-radius:999px;background:#EFEFF2;color:var(--ink);font-weight:600;font-size:11.5px}.crm-whenb.today{background:#E8F0FE}.crm-whenb.late{background:#FDECEC;color:var(--red)}
.crm-nt{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink)}.crm-nx{font-size:11px;color:var(--muted)}.crm-nx .crm-cal-ok{margin-left:6px;color:var(--green)}
.crm-c-note{margin:8px 0 0;padding:6px 8px;border-radius:6px;background:var(--soft);font-size:12px;line-height:1.4;color:var(--ink)}.crm-c-note span{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.crm-arr-move{margin-top:6px;width:100%;font-size:12.5px;padding:4px 8px;color:var(--muted)}
.crm-right{display:flex;align-items:center;gap:6px}
.crm-who{width:22px;height:22px;border-radius:50%;background:#FEF0F0;color:var(--red);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center}
.crm-wa{color:#16A34A;display:flex}.crm-wa svg{width:16px;height:16px}
.crm-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.crm-kpi{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.crm-kpi p{font-size:12px;color:var(--muted);margin:0 0 6px;font-weight:500}.crm-kpi strong{font-size:22px;font-weight:700;color:var(--ink)}.crm-kpi span{display:block;font-size:11.5px;color:#999;margin-top:4px}
.crm-pos{color:var(--green)!important}.crm-neg{color:var(--red)!important}
.crm-panel{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin-bottom:16px}
.crm-panel h2{font-size:15px;font-weight:700;margin:0 0 6px;color:var(--ink)}
.crm-note{font-size:12.5px;color:var(--muted);margin:0 0 12px;line-height:1.5}
.crm-grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.crm-tbl-wrap{overflow-x:auto}
.crm-tbl{border-collapse:collapse;width:100%;font-size:13px}
.crm-tbl th{text-align:left;font-size:11.5px;color:var(--muted);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
.crm-tbl td{padding:9px 10px;border-bottom:1px solid #F5F5F5;color:#222;vertical-align:middle}
.crm-tbl tr.total td{font-weight:700;border-top:1px solid var(--line)}
.crm-tbl small{color:var(--muted)}
.crm-bar{height:8px;background:#EFEFF2;border-radius:4px;overflow:hidden;min-width:60px}.crm-bar span{display:block;height:100%;background:var(--red)}
.chart{width:100%;height:auto;display:block}
.chart text{fill:#888;font-size:11px}.chart .tot{fill:#111;font-weight:600}.chart .gl{stroke:#EBEBEB}
.s-won{fill:${NAVY}}.s-commit{fill:${RED}}.s-best{fill:#F5A3A3}.s-pipe{fill:#D9D9E0}.s-sube{fill:#888;opacity:.55}
.crm-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:#666;margin-top:8px}.crm-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px}
.crm-hoy-h{display:flex;gap:18px;flex-wrap:wrap;align-items:baseline;margin-bottom:14px}.crm-hoy-h h1{font-size:20px;font-weight:700;margin:0}.crm-hoy-h span{font-size:13px;color:#666}.crm-hoy-h b{color:var(--ink)}
.crm-brief{background:#fff;border:1px solid var(--line);border-left:3px solid var(--red);border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:13.5px;line-height:1.55}
.crm-brief p{margin:0 0 6px}.crm-brief ul{margin:4px 0 6px 18px;padding:0}
.crm-hoy{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;align-items:start}
.crm-tgroup{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:14px}
.crm-tgroup.late{border-color:#F5C6C6}
.crm-tgroup h2{font-size:13.5px;font-weight:700;margin:0 0 8px;display:flex;justify-content:space-between;align-items:center}
.crm-tgroup h2 span{font-size:11px;background:#EFEFF2;border-radius:10px;padding:1px 8px;color:#666}
.crm-tgroup.late h2 span{background:#FEF0F0;color:var(--red)}
.crm-tlist{list-style:none;margin:0;padding:0}
.crm-trow{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #F5F5F5}.crm-trow:last-child{border-bottom:none}
.crm-trow.done .crm-tmain strong{text-decoration:line-through;color:#aaa}
.crm-tcheck{width:20px;height:20px;border-radius:50%;border:2px solid #CFCFD6;background:#fff;cursor:pointer;flex-shrink:0;font-size:11px;color:#fff;display:flex;align-items:center;justify-content:center;padding:0}
.crm-trow.done .crm-tcheck{background:var(--green);border-color:var(--green)}
.crm-tmain{flex:1;min-width:0;cursor:pointer}.crm-tmain strong{font-size:13px;color:var(--ink);font-weight:600;display:block}
.crm-tmeta{display:flex;gap:8px;flex-wrap:wrap;font-size:11.5px;color:#888;margin-top:2px}
.crm-ttype{background:#F1F1F4;border-radius:5px;padding:0 6px;font-weight:600}
.crm-twhen{font-size:12px;color:#555;text-align:right;white-space:nowrap}.crm-trow.late .crm-twhen{color:var(--red);font-weight:600}
.crm-empty2{font-size:12.5px;color:#bbb;padding:8px 0}
.crm-arr{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.crm-arr-col h3{font-size:12.5px;font-weight:700;display:flex;justify-content:space-between;margin:0 0 8px;color:#444}
.crm-arr-card{background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px;font-size:12.5px}.crm-arr-card.late{border-color:#F5C6C6;background:#FFF8F8}
.crm-arr-card p{margin:3px 0;color:#666}.crm-arr-empty{font-size:12px;color:#bbb}
.crm-sel{padding:4px 8px;border:1px solid #E0E0E0;border-radius:6px;font-size:12px;background:#fff}
.crm-sel.riesgo{color:var(--red);border-color:#F5C6C6}.crm-sel.atencion{color:var(--amber);border-color:#FCD34D}.crm-sel.bien{color:var(--green)}
.crm-row{display:grid;grid-template-columns:1.6fr 70px 1.3fr 80px 50px 100px;gap:8px;align-items:center;margin-bottom:6px}
.crm-row.tag{grid-template-columns:1.6fr 1.2fr 50px 40px}
.crm-row-h{display:grid;grid-template-columns:1.6fr 70px 1.3fr 80px 50px 100px;gap:8px;font-size:11px;color:var(--muted);font-weight:600;margin-bottom:6px}
.crm-row input[type=color]{width:100%;height:34px;padding:2px;border:1px solid #E0E0E0;border-radius:6px;background:#fff}
.crm-acts{display:flex;gap:4px}.crm-icon{border:1px solid #E0E0E0;background:#fff;border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:12px}
.crm-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
.crm-lists{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.crm-f{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#666;font-weight:500}
.crm-f textarea{min-height:90px;resize:vertical}
.crm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px}
.crm-dlg{background:#fff;border-radius:16px;width:100%;max-width:640px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden}
.crm-dlg.sm{max-width:460px}
.crm-dlg-h{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--line)}.crm-dlg-h h2{font-size:16px;font-weight:700;margin:0}
.crm-dlg-b{padding:16px 20px;overflow-y:auto;display:grid;grid-template-columns:1fr 1fr;gap:12px}
.crm-dlg-b .full{grid-column:1/-1}
.crm-dlg-f{display:flex;gap:8px;justify-content:flex-end;padding:12px 20px;border-top:1px solid var(--line)}
.crm-dlg-f .danger{margin-right:auto}
.crm-err{font-size:12.5px;color:var(--red);background:#FEF0F0;border-radius:8px;padding:8px 10px;margin:0}
.crm-qa{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.crm-qa button{border:1px solid #E0E0E0;background:#fff;border-radius:14px;padding:2px 10px;font-size:11.5px;cursor:pointer;color:#555}
.crm-tg-group p{font-size:11.5px;color:var(--muted);margin:6px 0 4px;font-weight:600}.crm-tg-list{display:flex;gap:6px;flex-wrap:wrap}
.crm-tg{font-size:12px;display:flex;align-items:center;gap:4px;border:1px solid #E6E6EA;border-radius:14px;padding:2px 10px;cursor:pointer}
.crm-calif{background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.crm-calif .lg{grid-column:1/-1;font-size:12.5px;font-weight:700;margin:0;color:#333}.crm-calif .lg span{font-weight:500;color:var(--muted);margin-left:6px}
.crm-calif.focus{border-color:var(--red);box-shadow:0 0 0 3px #FEF0F0}
.crm-hist ol{list-style:none;margin:6px 0 0;padding:0;font-size:12px;color:#555}.crm-hist li{padding:3px 0}.crm-hist time{color:var(--muted);margin-right:8px}
.crm-aibox{background:var(--soft);border-radius:10px;padding:10px 12px;font-size:12.5px;color:#444}.crm-aibox p{margin:0 0 6px}
.crm-dtask{display:flex;justify-content:space-between;width:100%;text-align:left;background:var(--soft);border:1px solid var(--line);border-radius:8px;padding:6px 10px;font-size:12.5px;cursor:pointer;margin-bottom:4px}.crm-dtask time{color:var(--muted)}
.crm-ndays{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.crm-ndays button{border:1px solid #E0E0E0;background:#fff;border-radius:14px;padding:3px 10px;font-size:12px;cursor:pointer}.crm-ndays button[aria-pressed=true]{background:var(--navy);color:#fff;border-color:var(--navy)}
.crm-nctx{font-size:13px;color:#555;margin:0}
.crm-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:var(--navy);color:#fff;padding:10px 18px;border-radius:10px;font-size:13px;z-index:400;box-shadow:0 6px 20px rgba(0,0,0,.25)}
.crm-nudge{position:fixed;right:24px;bottom:24px;background:#fff;border:1px solid var(--line);border-left:4px solid var(--red);border-radius:12px;padding:14px 16px;z-index:350;box-shadow:0 10px 30px rgba(0,0,0,.18);max-width:320px;font-size:13px}.crm-nudge div{display:flex;gap:8px;margin-top:10px;justify-content:flex-end}
.crm-drawer{position:fixed;top:0;right:0;bottom:0;width:min(420px,100vw);background:#fff;border-left:1px solid var(--line);z-index:260;display:flex;flex-direction:column;box-shadow:-10px 0 30px rgba(0,0,0,.12)}
.crm-drawer-h{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--line)}.crm-drawer-h h2{font-size:15px;margin:0}
.crm-drawer-b{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.crm-drawer-f{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--line)}.crm-drawer-f textarea{flex:1;resize:none}
.crm-msg{border-radius:12px;padding:9px 12px;font-size:13px;line-height:1.5;max-width:92%}.crm-msg.u{background:var(--navy);color:#fff;align-self:flex-end}.crm-msg.a{background:var(--soft);color:#222}.crm-msg.err{background:#FEF0F0;color:#B42318}
.crm-msg p{margin:0 0 6px}.crm-msg ul{margin:4px 0 6px 18px;padding:0}
.crm-sug{display:flex;flex-direction:column;gap:6px}.crm-sug button{text-align:left;border:1px solid #E0E0E0;background:#fff;border-radius:10px;padding:8px 12px;font-size:12.5px;cursor:pointer;color:#444}
.crm-rp-overlay{position:fixed;inset:0;background:${NAVY};z-index:300;display:flex;flex-direction:column}
.crm-rp-stage{flex:1;display:grid;place-items:center;overflow:hidden}.crm-rp-page{overflow:hidden;border-radius:6px;box-shadow:0 20px 60px rgba(0,0,0,.35)}.crm-rp-page>.rp-slide{transform-origin:0 0}
.crm-rp-ctrl{display:flex;align-items:center;gap:12px;padding:10px 16px;color:#fff;font-size:13px}.crm-rp-ctrl .sp{flex:1}
@media(max-width:900px){.crm-kpis{grid-template-columns:repeat(2,1fr)}.crm-grid2,.crm-hoy,.crm-arr{grid-template-columns:1fr}.crm-dlg-b,.crm-calif{grid-template-columns:1fr}}
`;

export function CrmStyles() {
  useEffect(() => {
    const s = document.createElement("style");
    s.setAttribute("data-crm", "1");
    s.textContent = CRM_CSS;
    document.head.appendChild(s);
    return () => { document.head.removeChild(s); };
  }, []);
  return null;
}

export const WA_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.2A8.5 8.5 0 1 1 21 11.5z" /></svg>
);

// Markdown mínimo del asistente (**negrita**, viñetas "- ", títulos). Escapa primero, así que es seguro como HTML.
export function md(s) {
  let out = "", inL = false;
  esc(s).split("\n").forEach((l) => {
    const b = l.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/^#{1,4}\s+(.*)$/, "<strong>$1</strong>");
    if (/^\s*[-•*]\s+/.test(l)) { if (!inL) { out += "<ul>"; inL = true; } out += "<li>" + b.replace(/^\s*[-•*]\s+/, "") + "</li>"; }
    else { if (inL) { out += "</ul>"; inL = false; } if (b.trim()) out += "<p>" + b + "</p>"; }
  });
  if (inL) out += "</ul>";
  return out;
}

export function Overlay({ onClose, children, small }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="crm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={"crm-dlg" + (small ? " sm" : "")} role="dialog" aria-modal="true">{children}</div>
    </div>
  );
}
export const DlgHead = ({ title, onClose }) => (
  <div className="crm-dlg-h"><h2>{title}</h2><button type="button" className="crm-icon" onClick={onClose} aria-label="Cerrar">✕</button></div>
);
export const Field = ({ label, children, full }) => <label className={"crm-f" + (full ? " full" : "")}>{label}{children}</label>;
export const copyText = async (t) => { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } };
