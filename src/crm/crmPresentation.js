// Presentación "Cómo vamos" (8 diapositivas) portada de _import/crm-comercial-spicytool.html.
// Genera HTML como texto (todo lo que viene de datos pasa por esc()), igual que el original, para poder
// mostrarla en pantalla y descargarla como un único archivo. Colores del backoffice.
import { esc, fmtDate, monthLabel, money, sum } from "./crmLogic.js";

export const RP_VARS = "--bg:#F7F7F8;--surface:#FFFFFF;--surface-2:#EEEEF1;--ink:#111111;--muted:#6B6B78;--line:#E4E4EA;--primary:#EF3E3E;--primary-ink:#FFFFFF;--hot:#EF3E3E;--ok:#1A1A2E;--commit:#EF3E3E;--best:#F5A3A3;--pipe:#D9D9E0;--nav:#1A1A2E;--nav-ink:#FFFFFF;--nav-muted:#C8C8D8;color-scheme:light;";
const FONT = "'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif";
export const RP_CSS =
  `.rp-slide{width:1280px;height:720px;background:var(--bg);color:var(--ink);position:relative;overflow:hidden;padding:52px 72px 64px;box-sizing:border-box;font-family:${FONT};display:flex;flex-direction:column;-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
  `.rp-slide h1,.rp-slide h2,.rp-slide h3{font-family:${FONT};margin:0;font-weight:600}` +
  ".rp-k{font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--primary);font-weight:600;margin:0 0 8px}" +
  ".rp-slide h2{font-size:38px;line-height:1.1;margin-bottom:26px}" +
  ".rp-foot{position:absolute;left:72px;right:72px;bottom:24px;display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted)}" +
  ".rp-cover{background:var(--nav);color:var(--nav-ink);justify-content:center}" +
  ".rp-cover .rp-k{color:var(--nav-muted)}.rp-cover .rp-foot{color:var(--nav-muted)}" +
  ".rp-cover h1{font-size:92px;line-height:1;margin:0 0 14px}.rp-cover .sub{font-size:22px;color:var(--nav-muted);margin:0 0 56px}" +
  `.rp-hero{display:flex;gap:64px;align-items:flex-end}.rp-hero p{margin:0;font-size:15px;color:var(--nav-muted)}.rp-hero strong{display:block;font:600 64px/1.05 ${FONT};margin-top:6px;font-variant-numeric:tabular-nums}` +
  ".rp-prog{margin-top:40px;max-width:760px}.rp-prog .tr{height:12px;border-radius:6px;background:rgba(255,255,255,.18);overflow:hidden;position:relative}.rp-prog .f{position:absolute;left:0;top:0;bottom:0;background:var(--nav-ink)}.rp-prog .p{position:absolute;left:0;top:0;bottom:0;background:rgba(255,255,255,.45)}.rp-prog p{margin:10px 0 0;font-size:15px;color:var(--nav-muted)}" +
  `.rp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}.rp-kpi{background:var(--surface);border-radius:14px;padding:16px 18px}.rp-kpi p{margin:0;font-size:13px;color:var(--muted)}.rp-kpi strong{display:block;font:600 28px/1.2 ${FONT};margin-top:4px;font-variant-numeric:tabular-nums}.rp-kpi span{font-size:12.5px;color:var(--muted)}.rp-kpi .neg{color:var(--hot)}.rp-kpi .pos{color:var(--ok)}` +
  ".rp-chart{flex:1;min-height:0;background:var(--surface);border-radius:14px;padding:14px 18px;display:flex;flex-direction:column}.rp-chart svg{flex:1;min-height:0;width:100%;height:100%}" +
  `.chart text{fill:var(--muted);font-size:11px;font-family:${FONT}}.chart .tot{fill:var(--ink);font-weight:600}.chart .gl{stroke:var(--line)}.s-won{fill:var(--ok)}.s-commit{fill:var(--commit)}.s-best{fill:var(--best)}.s-pipe{fill:var(--pipe)}.s-sube{fill:var(--muted);opacity:.55}` +
  ".rp-leg{display:flex;gap:18px;font-size:12.5px;color:var(--muted);margin-top:6px}.rp-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px}" +
  ".rp-cols{display:grid;gap:18px;flex:1;min-height:0}.rp-cols.c3{grid-template-columns:repeat(3,1fr)}.rp-cols.c2{grid-template-columns:1.25fr 1fr}" +
  `.rp-card{background:var(--surface);border-radius:14px;padding:20px 22px;overflow:hidden;min-height:0}.rp-card h3{font-size:16px;margin:0 0 2px}.rp-big{font:600 32px/1.2 ${FONT};margin:0 0 12px;font-variant-numeric:tabular-nums}.rp-big.ok{color:var(--ok)}.rp-big.hot{color:var(--hot)}` +
  ".rp-list{list-style:none;margin:0;padding:0;font-size:15px}.rp-list li{padding:8px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:12px}.rp-list li:last-child{border-bottom:0}.rp-list li span:last-child{color:var(--muted);text-align:right}.rp-list .hot{color:var(--hot)}" +
  ".rp-empty{color:var(--muted);font-size:15px;margin:6px 0 0}" +
  ".rp-bars{display:flex;flex-direction:column;gap:14px}.rp-bar{display:grid;grid-template-columns:150px 1fr 290px;gap:14px;align-items:center;font-size:15px}.rp-bar .tr{height:26px;background:var(--surface-2);border-radius:6px;overflow:hidden}.rp-bar .f{height:100%;border-radius:6px}.rp-bar .v{color:var(--muted);font-size:13.5px;font-variant-numeric:tabular-nums}.rp-bar b{color:var(--ink);font-weight:600}" +
  ".rp-tbl{width:100%;border-collapse:collapse;font-size:15px;font-variant-numeric:tabular-nums}.rp-tbl th{font-weight:500;color:var(--muted);font-size:13px;text-align:right;padding:8px 10px;border-bottom:1px solid var(--line)}.rp-tbl td{text-align:right;padding:10px;border-bottom:1px solid var(--line)}.rp-tbl th:first-child,.rp-tbl td:first-child{text-align:left}.rp-tbl .hot{color:var(--hot);font-weight:600}";

const rpList = (items, max, emptyTxt) => {
  if (!items.length) return '<p class="rp-empty">' + emptyTxt + "</p>";
  const more = items.length - max;
  return '<ul class="rp-list">' + items.slice(0, max).join("") + (more > 0 ? "<li><span>Y " + more + " más</span><span></span></li>" : "") + "</ul>";
};

export function rpCtx(crm) {
  const t = crm.today, d7 = crm.isoPlus(-7), c = crm.S.config, F = crm.forecastRows(), meta = +c.metaMrr || 0, base = +c.mrrActual || 0;
  const mr = F.rows.find((r) => r.m === c.metaMes) || F.rows[F.rows.length - 1];
  const kind = (d) => (crm.stageById(d.stage) || {}).kind;
  const open = crm.S.deals.filter(crm.isOpen);
  const won = crm.S.deals.filter((d) => kind(d) === "won" && d.cerradoEn && d.cerradoEn > d7);
  const lost = crm.S.deals.filter((d) => kind(d) === "lost" && d.cerradoEn && d.cerradoEn > d7);
  const moves = [];
  crm.S.deals.forEach((d) => { const tr = d.trail || []; for (let i = 1; i < tr.length; i++) { if (tr[i].at > d7) { const a = crm.stageById(tr[i - 1].s), b = crm.stageById(tr[i].s); if (a && b && b.kind !== "won" && b.kind !== "lost") moves.push({ d, a, b }); } } });
  return { t, d7, c, F, meta, base, mr, open, won, lost, moves, kind };
}

// Devuelve un array de 8 diapositivas (HTML)
export function rpSlides(crm) {
  const X = rpCtx(crm), c = X.c, slides = [];
  const { weighted, hasPromo, promoTxt, daysIn, rotLevel, stageById, priceAt, isActiveClient, isClient, nextMilestone } = crm;
  const cm = crm.curMonth();
  const am = (ym, n) => { const p = ym.split("-").map(Number); let y = p[0], m = p[1] + n; y += Math.floor((m - 1) / 12); m = (((m - 1) % 12) + 12) % 12 + 1; return y + "-" + String(m).padStart(2, "0"); };
  const wrap = (cls, kicker, title, body) => '<div class="rp-slide ' + cls + '">' + (kicker ? '<p class="rp-k">' + kicker + "</p>" : "") + (title ? "<h2>" + title + "</h2>" : "") + body + "</div>";
  const wonMrr = sum(X.won, (d) => (hasPromo(d) ? +d.promoMrr : +d.mrr));
  // 1 portada
  const pctReal = X.meta ? Math.min(100, X.base * 100 / X.meta) : 0, pctProj = X.meta ? Math.min(100, X.mr.proj * 100 / X.meta) : 0;
  slides.push('<div class="rp-slide rp-cover"><p class="rp-k">Spicytool, reporte comercial</p><h1>Cómo vamos</h1><p class="sub">Semana del ' + fmtDate(X.d7) + " al " + fmtDate(X.t) + "</p>" +
    '<div class="rp-hero"><div><p>MRR real hoy</p><strong>' + money(X.base) + "</strong></div>" + (X.meta ? "<div><p>Meta " + monthLabel(c.metaMes) + "</p><strong>" + money(X.meta) + "</strong></div>" : "") + "<div><p>Ganados en la semana</p><strong>" + X.won.length + "</strong></div></div>" +
    (X.meta ? '<div class="rp-prog"><div class="tr"><div class="p" style="width:' + pctProj + '%"></div><div class="f" style="width:' + pctReal + '%"></div></div><p>' + Math.round(X.base * 100 / X.meta) + "% de la meta hoy. Proyectado a " + monthLabel(X.mr.m) + ": " + money(X.mr.proj) + (X.mr.proj >= X.meta ? ", la supera por " + money(X.mr.proj - X.meta) : ", faltan " + money(X.meta - X.mr.proj)) + ".</p></div>" : "") + "</div>");
  // 2 MRR
  const thisM = X.F.rows[0], gap = X.meta ? X.mr.proj - X.meta : null;
  slides.push(wrap("", "MRR", "Hacia dónde vamos",
    '<div class="rp-kpis"><div class="rp-kpi"><p>MRR real hoy</p><strong>' + money(X.base) + "</strong><span>Stripe + transferencias</span></div>" +
    '<div class="rp-kpi"><p>Proyectado a ' + monthLabel(X.mr.m) + "</p><strong>" + money(X.mr.proj) + "</strong>" + (X.meta ? '<span class="' + (gap >= 0 ? "pos" : "neg") + '">' + (gap >= 0 ? "Supera la meta por " : "Faltan ") + money(Math.abs(gap)) + "</span>" : "<span>Sin meta cargada</span>") + "</div>" +
    '<div class="rp-kpi"><p>Pipeline ponderado</p><strong>' + money(sum(X.open, weighted)) + "</strong><span>" + X.open.length + " deals abiertos</span></div>" +
    '<div class="rp-kpi"><p>Commit de ' + monthLabel(thisM.m) + "</p><strong>" + money(thisM.won + thisM.commit) + "</strong><span>Ganado + negociación</span></div></div>" +
    '<div class="rp-chart"><p class="rp-empty" style="margin:0 0 4px;font-size:13px">Nuevo MRR por mes de cierre, ponderado por probabilidad</p>' + crm.chartSvg(X.F.rows) +
    '<div class="rp-leg"><span><i style="background:var(--ok)"></i>Ganado</span><span><i style="background:var(--commit)"></i>Commit</span><span><i style="background:var(--best)"></i>Best case</span><span><i style="background:var(--pipe)"></i>Pipeline</span><span><i style="background:var(--muted);opacity:.55"></i>Fin de promo</span></div></div>'));
  // 3 cartera
  const act = crm.S.deals.filter(isActiveClient), upsC = act.filter((d) => { if (!hasPromo(d)) return false; const st = am(d.cierre, +d.promoMeses); return st > cm && st <= am(cm, 3); });
  const gone3 = crm.S.deals.filter((d) => isClient(d) && d.bajaMes && d.bajaMes >= am(cm, -3) && d.bajaMes <= cm);
  const hit = act.map((d) => ({ d, t: nextMilestone(d) })).filter((x) => x.t !== "–");
  slides.push(wrap("", "Clientes", "Cómo está la cartera", '<div class="rp-kpis"><div class="rp-kpi"><p>Clientes activos</p><strong>' + act.length + "</strong><span>" + act.filter((d) => d.salud === "riesgo").length + " en riesgo</span></div>" +
    '<div class="rp-kpi"><p>MRR de la cartera</p><strong>' + money(sum(act, (d) => priceAt(d, cm))) + "</strong><span>Cargada en el CRM</span></div>" +
    '<div class="rp-kpi"><p>Suben de precio en 90 días</p><strong>+' + money(sum(upsC, (d) => (+d.mrr) - (+d.promoMrr))) + "</strong><span>" + upsC.length + " fin de promo</span></div>" +
    '<div class="rp-kpi"><p>Bajas últimos 3 meses</p><strong class="' + (gone3.length ? "neg" : "") + '">' + gone3.length + "</strong><span>" + (gone3.length ? "−" + money(sum(gone3, (d) => +d.mrr || 0)) : "Sin bajas") + "</span></div></div>" +
    '<div class="rp-card" style="flex:1"><h3 style="margin-bottom:6px">Próximos hitos</h3>' + rpList(hit.map((x) => "<li><span>" + esc(x.d.empresa) + "</span><span>" + esc(x.t) + "</span></li>"), 8, "Sin hitos próximos") + "</div>"));
  // 4 la semana
  slides.push(wrap("", "La semana", "Qué pasó en los últimos 7 días", '<div class="rp-cols c3">' +
    '<div class="rp-card"><h3>Ganados</h3><p class="rp-big ok">' + X.won.length + (X.won.length ? ' <small style="font-size:16px;font-weight:500">+' + money(wonMrr) + "/mes</small>" : "") + "</p>" + rpList(X.won.map((d) => "<li><span>" + esc(d.empresa) + "</span><span>" + (hasPromo(d) ? promoTxt(d) + " → " + money(d.mrr) : money(d.mrr)) + "</span></li>"), 7, "Ninguno esta semana") + "</div>" +
    '<div class="rp-card"><h3>Perdidos</h3><p class="rp-big hot">' + X.lost.length + "</p>" + rpList(X.lost.map((d) => "<li><span>" + esc(d.empresa) + "</span><span>" + esc(d.motivo || "Sin motivo") + "</span></li>"), 7, "Ninguno esta semana") + "</div>" +
    '<div class="rp-card"><h3>Movimientos de etapa</h3><p class="rp-big">' + X.moves.length + "</p>" + rpList(X.moves.map((m) => "<li><span>" + esc(m.d.empresa) + "</span><span>" + esc(m.a.name) + " → " + esc(m.b.name) + "</span></li>"), 7, "Sin movimientos registrados") + "</div></div>"));
  // 5 pipeline
  const st = c.stages.filter((s) => s.kind === "open"), mx = Math.max(1, Math.max.apply(null, st.map((s) => sum(X.open.filter((d) => d.stage === s.id), (d) => +d.mrr || 0))));
  const fr = X.open.filter((d) => rotLevel(d) === "red").sort((a, b) => daysIn(b) - daysIn(a));
  slides.push(wrap("", "Pipeline", "Dónde está cada deal", '<div class="rp-cols c2"><div class="rp-card"><h3 style="margin-bottom:18px">Deals abiertos por etapa</h3><div class="rp-bars">' +
    st.map((s) => { const ds = X.open.filter((d) => d.stage === s.id), m = sum(ds, (d) => +d.mrr || 0); return '<div class="rp-bar"><span>' + esc(s.name) + '</span><div class="tr"><div class="f" style="width:' + (m * 100 / mx) + "%;background:" + esc(s.color || "#888") + '"></div></div><span class="v"><b>' + ds.length + "</b>" + (ds.length === 1 ? " deal, " : " deals, ") + money(m) + " (" + money(sum(ds, weighted)) + " pond.)</span></div>"; }).join("") + "</div></div>" +
    '<div class="rp-card"><h3>Frenados</h3><p class="rp-big' + (fr.length ? " hot" : "") + '">' + fr.length + "</p>" + rpList(fr.map((d) => "<li><span>" + esc(d.empresa) + '</span><span class="hot">' + daysIn(d) + " días en " + esc(stageById(d.stage).name) + "</span></li>"), 7, "Ningún deal pasó su límite de días") + "</div></div>"));
  // 6 por qué perdemos + conversión
  const lostAll = crm.S.deals.filter((d) => X.kind(d) === "lost"), g = {};
  lostAll.forEach((d) => { const k = d.motivo || "Sin motivo cargado"; g[k] = (g[k] || 0) + 1; });
  const gk = Object.keys(g).sort((a, b) => g[b] - g[a]), gm = Math.max(1, Math.max.apply(null, gk.map((k) => g[k]).concat([1])));
  const cs = crm.convStats();
  slides.push(wrap("", "Aprendizajes", "Por qué perdemos y cómo convertimos", '<div class="rp-cols c2"><div class="rp-card"><h3 style="margin-bottom:18px">Motivos de pérdida (' + lostAll.length + " deals)</h3>" +
    (gk.length ? '<div class="rp-bars">' + gk.slice(0, 7).map((k) => '<div class="rp-bar" style="grid-template-columns:230px 1fr 90px"><span>' + esc(k) + '</span><div class="tr"><div class="f" style="width:' + (g[k] * 100 / gm) + '%;background:var(--hot)"></div></div><span class="v"><b>' + g[k] + "</b> (" + Math.round(g[k] * 100 / lostAll.length) + "%)</span></div>").join("") + "</div>" : '<p class="rp-empty">Todavía no hay deals perdidos.</p>') + "</div>" +
    '<div class="rp-card"><h3 style="margin-bottom:10px">Conversión por etapa</h3><table class="rp-tbl"><thead><tr><th>Etapa</th><th>Llegaron</th><th>% a la siguiente</th><th>Cierre real</th></tr></thead><tbody>' +
    cs.rows.map((r) => "<tr><td>" + esc(r.stage.name) + "</td><td>" + r.reached + "</td><td>" + (r.reached ? Math.round(r.next * 100 / r.reached) + "%" : "–") + "</td><td>" + (r.dec ? Math.round(r.win * 100) + "%" : "–") + "</td></tr>").join("") +
    '</tbody></table><p class="rp-empty" style="font-size:12.5px;margin-top:12px">Registrado desde el 1 de noviembre. Se vuelve más preciso a medida que se cierran deals.</p></div></div>'));
  // 7 equipo
  const t7 = crm.isoPlus(7), items = crm.taskItems(true), sellers = c.sellers.slice();
  crm.S.deals.forEach((d) => { if (d.vendedor && sellers.indexOf(d.vendedor) < 0) sellers.push(d.vendedor); });
  slides.push(wrap("", "Equipo", "Cómo viene cada vendedor", '<div class="rp-card" style="flex:none"><table class="rp-tbl"><thead><tr><th>Vendedor</th><th>Deals abiertos</th><th>Pipeline ponderado</th><th>Ganados en la semana</th><th>Tareas vencidas</th><th>Próximos 7 días</th></tr></thead><tbody>' +
    sellers.map((v) => { const od = X.open.filter((d) => d.vendedor === v), venc = items.filter((x) => !x.done && x.vendedor === v && x.fecha < X.t).length, nx = items.filter((x) => !x.done && x.vendedor === v && x.fecha >= X.t && x.fecha <= t7).length;
      return "<tr><td>" + esc(v) + "</td><td>" + od.length + "</td><td>" + money(sum(od, weighted)) + "</td><td>" + X.won.filter((d) => d.vendedor === v).length + "</td><td" + (venc ? ' class="hot"' : "") + ">" + venc + "</td><td>" + nx + "</td></tr>"; }).join("") + "</tbody></table></div>"));
  // 8 foco
  const top = X.open.slice().sort((a, b) => weighted(b) - weighted(a)).slice(0, 8);
  slides.push(wrap("", "Foco", "Los deals que mueven la aguja", '<div class="rp-card" style="flex:none"><table class="rp-tbl"><thead><tr><th>Deal</th><th>Etapa</th><th>MRR</th><th>Cierre</th><th style="text-align:left">Próximo paso</th></tr></thead><tbody>' +
    (top.length ? top.map((d) => "<tr><td>" + esc(d.empresa) + "</td><td>" + esc(stageById(d.stage).name) + "</td><td>" + (hasPromo(d) ? promoTxt(d) + " → " + money(d.mrr) : money(d.mrr)) + "</td><td>" + (d.cierre ? monthLabel(d.cierre) : "–") + '</td><td style="text-align:left"' + (d.proxima ? "" : ' class="hot"') + ">" + (d.proxima ? esc(d.proxima) + (d.proximaFecha ? ", " + fmtDate(d.proximaFecha) : "") : "Sin próximo paso") + "</td></tr>").join("") : '<tr><td colspan="5">No hay deals abiertos.</td></tr>') + "</tbody></table></div>"));
  const n = slides.length;
  return slides.map((s, i) => s.replace(/<\/div>$/, '<div class="rp-foot"><span>Spicytool, cómo vamos</span><span>' + (i + 1) + " / " + n + "</span></div></div>"));
}

// Un solo archivo HTML para descargar (flechas para avanzar; imprimir -> PDF)
export function rpStandalone(crm) {
  const sl = rpSlides(crm), sc = "scr" + "ipt";
  return '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Spicytool, cómo vamos (' + fmtDate(crm.today) + ")</title>\n" +
    '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">\n' +
    "<style>:root{" + RP_VARS + "}html,body{margin:0;height:100%;background:var(--nav);font-family:" + FONT + "}" + RP_CSS +
    ".stage{height:calc(100% - 56px);display:grid;place-items:center;overflow:hidden}.rp-page{overflow:hidden;border-radius:6px;box-shadow:0 20px 60px rgba(0,0,0,.35)}.rp-page>.rp-slide{transform-origin:0 0}" +
    "nav{height:56px;display:flex;align-items:center;justify-content:center;gap:12px;color:var(--nav-ink);font-size:14px}nav button{font:inherit;background:transparent;color:var(--nav-ink);border:1px solid rgba(255,255,255,.3);border-radius:8px;padding:6px 14px;cursor:pointer}nav small{opacity:.7}" +
    "@page{size:1280px 720px;margin:0}@media print{html,body{background:none;height:auto}nav{display:none}.stage{display:block;height:auto}.rp-page{display:block!important;width:1280px!important;height:720px!important;box-shadow:none;border-radius:0;break-after:page;page-break-after:always}.rp-page>.rp-slide{transform:none!important}}</style>\n</head>\n<body>\n<div class=\"stage\">" +
    sl.map((s) => '<section class="rp-page">' + s + "</section>").join("\n") +
    '</div>\n<nav><button id="pv" aria-label="Anterior">‹</button><span id="n"></span><button id="nx" aria-label="Siguiente">›</button><small>Flechas para avanzar. Para PDF: Imprimir, Guardar como PDF.</small></nav>\n' +
    "<" + sc + '>(function(){var p=[].slice.call(document.querySelectorAll(".rp-page")),i=0,st=document.querySelector(".stage");function f(){var s=Math.min((st.clientWidth-24)/1280,(st.clientHeight-24)/720);p.forEach(function(x,j){x.style.display=j===i?"block":"none";x.style.width=1280*s+"px";x.style.height=720*s+"px";x.firstElementChild.style.transform="scale("+s+")";});document.getElementById("n").textContent=(i+1)+" / "+p.length;}' +
    'function go(d){i=Math.max(0,Math.min(p.length-1,i+d));f();}document.getElementById("pv").onclick=function(){go(-1)};document.getElementById("nx").onclick=function(){go(1)};document.addEventListener("keydown",function(e){if(e.key==="ArrowRight"||e.key===" ")go(1);if(e.key==="ArrowLeft")go(-1);});window.addEventListener("resize",f);f();})();</' + sc + ">\n</body>\n</html>\n";
}
