// Lógica de negocio del CRM comercial, portada 1:1 de _import/crm-comercial-spicytool.html
// (cálculo de MRR, forecast, conversión, "frenado", renovaciones, textos). Sin React ni Supabase.
// Se usa como createCrm(estado, { now }) -> funciones ligadas a ese estado y a "hoy".
// "Hoy" es la fecha de Buenos Aires (el original usaba la del navegador).
import { baDateISO } from "../timeTracking.js";

export const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const ESTADOS = [["pago", "Esperando pago"], ["agendado", "Onboarding agendado"], ["onboarding", "En onboarding"], ["activo", "Activo"]];
export const EST_NEXT = { pago: "Pagó, agendar onboarding", agendado: "Empezó el onboarding", onboarding: "Terminó, pasa a activo" };
export const EST_LATE = { pago: 7, agendado: 10, onboarding: 21 };
export const Q_DEC = [["si", "Sí, habló con quien decide"], ["influye", "Influye, decide otro"], ["nose", "No sabemos"]];
export const Q_TIM = [["ya", "Ya, este mes"], ["1-3", "En 1 a 3 meses"], ["mas", "En más de 3 meses"], ["nose", "No sabe"]];
export const TTIPO = { tarea: ["Tarea", 15], followup: ["Follow-up", 15], reunion: ["Reunión", 30] };
export const TKINDS = [["", "Todas"], ["demo", "Demos"], ["followup", "Follow-ups"], ["reunion", "Reuniones"], ["onboarding", "Onboarding"], ["tarea", "Otras tareas"]];
export const KINDS_STAGE = [["open", "Abierta"], ["won", "Ganado"], ["hold", "Fuera del forecast"], ["lost", "Perdido"]];

export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function addMonths(ym, n) {
  const p = ym.split("-").map(Number);
  let y = p[0], m = p[1] + n;
  y += Math.floor((m - 1) / 12);
  m = (((m - 1) % 12) + 12) % 12 + 1;
  return y + "-" + String(m).padStart(2, "0");
}
export const monthLabel = (ym) => { const p = ym.split("-"); return MES[+p[1] - 1] + " " + p[0].slice(2); };
export const fmtDate = (iso) => { const p = iso.split("-"); return +p[2] + " " + MES[+p[1] - 1]; };
export const money = (n) => "USD " + Math.round(n || 0).toLocaleString("es-AR");
export const initials = (n) => (n || "?").split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase();
export const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
export const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);
export const niceMax = (v) => { const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
export const isDemoTxt = (s) => { s = s || ""; return /demo/i.test(s) && !/agendar|coordinar/i.test(s); };
const firstWord = (s) => (String(s || "").trim().split(/\s+/).filter((w) => /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(w))[0]) || "";

export function createCrm(S, opts = {}) {
  const now = opts.now || new Date();
  const today = opts.today || baDateISO(now);
  const iso = (d) => (d ? baDateISO(d) : today);
  const isoPlus = (n) => baDateISO(new Date(now.getTime() + n * 864e5));
  const curMonth = () => today.slice(0, 7);
  const cfg = () => S.config;
  const tasks = () => S.tasks || [];
  const dealById = (id) => S.deals.find((d) => d.id === id);

  const stageById = (id) => cfg().stages.find((s) => s.id === id);
  const tagById = (id) => cfg().tags.find((t) => t.id === id);
  const prob = (d) => { const s = stageById(d.stage); return s ? s.prob : 0; };
  const weighted = (d) => (+d.mrr || 0) * prob(d) / 100;
  const isOpen = (d) => { const s = stageById(d.stage); return !!s && s.kind === "open"; };
  const overdue = (d) => !!d.proximaFecha && d.proximaFecha < today && isOpen(d);
  const hasPromo = (d) => { const pm = +d.promoMeses || 0, pp = +d.promoMrr || 0; return pm > 0 && pp >= 0 && pp < (+d.mrr || 0); };
  const promoTxt = (d) => (+d.promoMrr > 0 ? money(d.promoMrr) : "Gratis");
  const daysIn = (d) => Math.max(0, daysBetween(d.stageSince || today, today));
  const rotLevel = (d) => {
    const s = stageById(d.stage);
    if (!s || s.kind !== "open" || !(+s.rot > 0)) return "";
    const n = daysIn(d);
    return n >= +s.rot ? "red" : n >= Math.ceil(s.rot * 0.7) ? "amber" : "";
  };

  // ── clientes ──
  const priceAt = (d, m) => {
    if (!d.cierre || m < d.cierre) return 0;
    if (hasPromo(d) && m < addMonths(d.cierre, +d.promoMeses)) return +d.promoMrr;
    return +d.mrr || 0;
  };
  const isClient = (d) => (stageById(d.stage) || {}).kind === "won";
  const isActiveClient = (d) => isClient(d) && !(d.bajaMes && d.bajaMes <= curMonth());
  const estLabel = (e) => { const x = ESTADOS.find((y) => y[0] === (e || "activo")); return x ? x[1] : "Activo"; };
  const renewal = (d) => {
    if (d.plan !== "Anual" || !d.cierre) return "";
    let r = d.renovacion || addMonths(d.cierre, 12);
    while (r < curMonth()) r = addMonths(r, 12);
    return r;
  };
  const nextMilestone = (d) => {
    const cm = curMonth(), it = [];
    if (d.bajaMes && d.bajaMes > cm) it.push([d.bajaMes, "Baja desde " + monthLabel(d.bajaMes)]);
    if (d.cierre && d.cierre > cm) it.push([d.cierre, "Empieza a pagar en " + monthLabel(d.cierre)]);
    if (hasPromo(d)) { const st = addMonths(d.cierre, +d.promoMeses); if (st > cm) it.push([st, "Sube a " + money(d.mrr) + " en " + monthLabel(st)]); }
    const r = renewal(d);
    if (r) it.push([r, "Renueva en " + monthLabel(r)]);
    it.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    return it.length ? it[0][1] : "–";
  };
  const lastContact = (d) => {
    const hs = d.hist || [];
    if (!hs.length) return "–";
    const n = daysBetween(iso(new Date(hs[hs.length - 1].t)), today);
    return n === 0 ? "Hoy" : n === 1 ? "Ayer" : "Hace " + n + " días";
  };

  // ── calificación de la demo ──
  const califScore = (d) => { const c = d.calif || {}; let s = 0; if (c.decisor === "si") s++; if (c.problema) s++; if (c.usaHoy) s++; if (c.timing === "ya" || c.timing === "1-3") s++; return s; };
  const califFilled = (d) => { const c = d.calif || {}; return !!(c.decisor || c.problema || c.usaHoy || c.timing); };
  const califTxt = (d) => {
    if (!califFilled(d)) return null;
    const c = d.calif, l = (a, v) => { const x = a.find((y) => y[0] === v); return x ? x[1] : ""; };
    return { puntaje: califScore(d) + "/4", decisor: l(Q_DEC, c.decisor), problema: c.problema, usaHoy: c.usaHoy, timing: l(Q_TIM, c.timing) };
  };
  // "calificada" | "sin_calificar" | "" para la etiqueta de la tarjeta
  const califState = (d) => {
    const s = stageById(d.stage) || {};
    if (s.kind !== "open") return "";
    if (califFilled(d)) return "calificada";
    if ((d.hist || []).some((x) => /^(Hecho|Tarea hecha): /.test(x.x) && isDemoTxt(x.x.replace(/^(Hecho|Tarea hecha): /, "")))) return "sin_calificar";
    return "";
  };

  // ── WhatsApp ──
  const fillTpl = (d, tpl) => String(tpl || "").replace(/\{nombre\}/g, firstWord(d.contacto) || firstWord(d.empresa)).replace(/\{empresa\}/g, d.empresa || "").replace(/\{vendedor\}/g, d.vendedor || "");
  const waMsg = (d) => {
    const T = cfg().waTemplates || {}, p = (d.proxima || "").trim().toLowerCase();
    let tpl = "";
    Object.keys(T).forEach((k) => { if (k !== "_general" && k.toLowerCase() === p) tpl = T[k]; });
    tpl = tpl || T._general || "Hola {nombre}";
    return fillTpl(d, tpl);
  };
  const waCustom = (d, msg) => { const n = String(d.telefono || "").replace(/\D/g, ""); return n.length >= 8 ? "https://wa.me/" + n + "?text=" + encodeURIComponent(msg) : ""; };
  const waLink = (d) => { const n = String(d.telefono || "").replace(/\D/g, ""); if (n.length < 8) return ""; return "https://wa.me/" + n + "?text=" + encodeURIComponent(waMsg(d)); };

  // ── forecast ──
  function forecastRows() {
    const base = curMonth(), months = [0, 1, 2, 3, 4, 5].map((i) => addMonths(base, i));
    const rows = months.map((m) => ({ m, won: 0, commit: 0, best: 0, pipe: 0, sube: 0, baja: 0 }));
    let lateClose = 0;
    const row = (m) => rows.find((x) => x.m === m);
    S.deals.forEach((d) => {
      const s = stageById(d.stage);
      if (!s || (s.kind !== "won" && s.kind !== "open")) return;
      let cm = d.cierre || base;
      const full = +d.mrr || 0, ramp = hasPromo(d), w = s.kind === "won" ? 1 : s.prob / 100;
      if (s.kind === "open" && cm < base) { cm = base; lateClose++; }
      const bm = s.kind === "won" ? d.bajaMes : "";
      if (bm && bm >= base) { const rb = row(bm); if (rb) rb.baja -= priceAt(d, bm); }
      if (bm && bm <= cm) return;
      if (cm >= base) {
        const r = row(cm);
        if (r) {
          const v = (ramp ? +d.promoMrr : full) * w;
          if (s.kind === "won" && d.estado !== "pago") r.won += v;
          else if (s.kind === "won" || s.prob >= 80) r.commit += v;
          else if (s.prob >= 40) r.best += v;
          else r.pipe += v;
        }
      }
      if (ramp) { const sm = addMonths(cm, +d.promoMeses); if (sm > base && !(bm && bm <= sm)) { const r2 = row(sm); if (r2) r2.sube += (full - d.promoMrr) * w; } }
    });
    let acc = +cfg().mrrActual || 0;
    const pct = +cfg().churnPct || 0;
    rows.forEach((r, i) => {
      r.nuevo = r.won + r.commit + r.best + r.pipe + r.sube;
      r.est = i > 0 ? -acc * pct / 100 : 0;
      r.bajas = r.baja + r.est;
      acc += r.nuevo + r.bajas;
      r.proj = acc;
    });
    return { rows, lateClose };
  }
  function chartSvg(rows) {
    const W = 720, H = 250, pl = 60, pr = 10, pt = 22, pb = 30, iw = W - pl - pr, ih = H - pt - pb;
    const max = niceMax(Math.max(100, Math.max.apply(null, rows.map((r) => r.nuevo))));
    let out = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Nuevo MRR ponderado por mes de cierre">';
    for (let i = 0; i <= 4; i++) { const v = max * i / 4, y = pt + ih - ih * i / 4; out += '<line class="gl" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (pl - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + Math.round(v).toLocaleString("es-AR") + "</text>"; }
    const slot = iw / rows.length, bw = Math.min(56, slot * 0.55);
    rows.forEach((r, i) => {
      const cx = pl + slot * (i + 0.5);
      let y = pt + ih;
      [["won", r.won], ["commit", r.commit], ["best", r.best], ["pipe", r.pipe], ["sube", r.sube]].forEach((s) => {
        if (s[1] <= 0) return;
        const h = ih * s[1] / max;
        y -= h;
        out += '<rect class="s-' + s[0] + '" x="' + (cx - bw / 2) + '" y="' + y + '" width="' + bw + '" height="' + h + '"><title>' + monthLabel(r.m) + ": " + money(s[1]) + "</title></rect>";
      });
      if (r.nuevo > 0) out += '<text class="tot" x="' + cx + '" y="' + (y - 6) + '" text-anchor="middle">' + Math.round(r.nuevo).toLocaleString("es-AR") + "</text>";
      out += '<text x="' + cx + '" y="' + (H - 10) + '" text-anchor="middle">' + monthLabel(r.m) + "</text>";
    });
    return out + "</svg>";
  }
  function groupBy(list, key) {
    const g = {};
    list.forEach((d) => { const k = key(d) || "Sin dato"; (g[k] = g[k] || []).push(d); });
    return Object.keys(g).map((k) => { const ds = g[k]; return [k, ds.length, sum(ds, (d) => +d.mrr || 0), sum(ds, weighted)]; }).sort((a, b) => b[1] - a[1]);
  }
  // Todo lo que muestra la pestaña "Forecast" (números crudos; el formateo lo hace la pantalla)
  function forecastData() {
    const open = S.deals.filter(isOpen), F = forecastRows(), rows = F.rows, last = rows[rows.length - 1];
    const meta = +cfg().metaMrr || 0, base = +cfg().mrrActual || 0;
    const totOpen = sum(open, (d) => +d.mrr || 0), totW = sum(open, weighted);
    const thisM = rows[0], commitM = thisM.won + thisM.commit;
    const metaRow = rows.find((r) => r.m === cfg().metaMes) || last;
    const gap = meta ? metaRow.proj - meta : null;
    const byStage = cfg().stages.filter((s) => s.kind === "open").map((s) => { const ds = open.filter((d) => d.stage === s.id); return { stage: s, deals: ds.length, mrr: sum(ds, (d) => +d.mrr || 0), weighted: sum(ds, weighted) }; });
    const lost = S.deals.filter((d) => { const s = stageById(d.stage); return s && s.kind === "lost"; });
    const noShow = S.deals.filter((d) => { const s = stageById(d.stage); return s && s.kind === "hold"; });
    const g = {};
    lost.forEach((d) => { const k = d.motivo || "Sin motivo cargado"; (g[k] = g[k] || []).push(d); });
    const lostReasons = Object.keys(g).map((k) => { const ds = g[k]; return { motivo: k, deals: ds.length, mrr: sum(ds, (d) => +d.mrr || 0), pct: lost.length ? Math.round(ds.length * 100 / lost.length) : 0 }; }).sort((a, b) => b.deals - a.deals);
    return {
      open, F, rows, last, meta, base, totOpen, totW, thisM, commitM, metaRow, gap, byStage, lost, noShow, lostReasons,
      bySeller: groupBy(open, (d) => d.vendedor), byOrigin: groupBy(open, (d) => d.origen),
      byPartner: groupBy(open.filter((d) => d.partner), (d) => d.partner), anyPartner: open.some((d) => d.partner),
    };
  }

  // ── conversión real del embudo ──
  function convStats() {
    const order = cfg().stages.filter((s) => s.kind === "open" || s.kind === "won"), idx = {};
    order.forEach((s, i) => { idx[s.id] = i; });
    const data = S.deals.filter((d) => (d.trail || []).length > 1 || (d.hist || []).some((x) => /^Deal creado/.test(x.x))).map((d) => {
      let mx = -1;
      (d.trail || []).concat([{ s: d.stage }]).forEach((x) => { if (idx[x.s] != null && idx[x.s] > mx) mx = idx[x.s]; });
      const k = (stageById(d.stage) || {}).kind;
      return { mx, won: k === "won", lost: k === "lost" };
    }).filter((x) => x.mx >= 0);
    const rows = order.filter((s) => s.kind === "open").map((s) => {
      const i = idx[s.id];
      const reached = data.filter((x) => x.mx >= i), next = reached.filter((x) => x.mx > i), dec = reached.filter((x) => x.won || x.lost), won = dec.filter((x) => x.won);
      return { stage: s, reached: reached.length, next: next.length, dec: dec.length, win: dec.length ? won.length / dec.length : 0, ok: dec.length >= 5 };
    });
    return { rows, ready: rows.length && rows.every((r) => r.ok) };
  }

  // ── tareas y "Hoy" ──
  const kindOf = (x) => {
    if (/demo/i.test(x.titulo || "")) return "demo";
    if (x.k === "deal" && x.deal && /demo/i.test((stageById(x.deal.stage) || {}).name || "") && x.tipo === "reunion") return "demo";
    if (/onboarding/i.test(x.titulo || "")) return "onboarding";
    return x.tipo || "tarea";
  };
  // all=true: de todos los vendedores; si no, filtra por `seller`
  function taskItems(all, seller) {
    let out = tasks().map((t) => ({ k: "task", id: t.id, titulo: t.titulo, fecha: t.fecha, hora: t.hora || "09:00", tipo: TTIPO[t.tipo] ? t.tipo : "tarea", deal: dealById(t.dealId), vendedor: t.vendedor, done: !!t.hecha, cal: !!t.calEventId }));
    S.deals.forEach((d) => {
      const s = stageById(d.stage);
      if (d.proxima && d.proximaFecha && s && s.kind !== "lost") out.push({ k: "deal", id: d.id, titulo: d.proxima, fecha: d.proximaFecha, hora: d.proximaHora || "09:00", tipo: d.proximaTipo === "reunion" ? "reunion" : "followup", deal: d, vendedor: d.vendedor, done: false, cal: !!d.calEventId });
    });
    if (!all && seller) out = out.filter((x) => x.vendedor === seller);
    return out.sort((a, b) => { const x = a.fecha + a.hora, y = b.fecha + b.hora; return x < y ? -1 : x > y ? 1 : 0; });
  }
  function dueCounts() {
    let v = 0, hh = 0;
    taskItems(true).forEach((x) => { if (x.done) return; if (x.fecha < today) v++; else if (x.fecha === today) hh++; });
    return { v, h: hh };
  }
  const fmtStampDate = (t) => fmtDate(baDateISO(new Date(t)));
  const fmtDay = (d) => (d === today ? "Hoy" : d === isoPlus(1) ? "Mañana" : fmtDate(d));
  function nextDays() {
    const out = [], dn = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    for (let i = 1; out.length < 6 && i < 14; i++) {
      const x = new Date(now.getTime() + i * 864e5), w = new Date(iso(x) + "T12:00:00").getDay();
      if (w === 0 || w === 6) continue;
      out.push([iso(x), i === 1 ? "Mañana" : dn[w] + " " + (+iso(x).slice(8))]);
    }
    out.push([isoPlus(7), "En 1 semana"]); out.push([isoPlus(14), "En 2 semanas"]);
    return out;
  }
  // Tareas agrupadas como en la pestaña "Tareas"
  function taskGroups(kind, seller, showDone) {
    const wk = isoPlus(7), all = taskItems(false, seller);
    const items = kind ? all.filter((x) => kindOf(x) === kind) : all, open = items.filter((x) => !x.done);
    let groups = [["Vencidas", open.filter((x) => x.fecha < today), "late"], ["Hoy", open.filter((x) => x.fecha === today), ""], ["Próximos 7 días", open.filter((x) => x.fecha > today && x.fecha <= wk), ""], ["Más adelante", open.filter((x) => x.fecha > wk), ""]];
    if (kind === "demo") { const ag = (x) => /agendar|coordinar/i.test(x.titulo || ""); groups = [["Demos por realizar", open.filter((x) => !ag(x)), ""], ["Demos por agendar", open.filter(ag), ""]]; }
    if (showDone) groups.push(["Hechas", items.filter((x) => x.done).reverse().slice(0, 20), ""]);
    const cnt = {};
    all.forEach((x) => { if (!x.done) { const k = kindOf(x); cnt[k] = (cnt[k] || 0) + 1; cnt[""] = (cnt[""] || 0) + 1; } });
    let missingDemo = [];
    if (kind === "demo") {
      const withDemo = {};
      all.forEach((x) => { if (!x.done && kindOf(x) === "demo" && x.deal) withDemo[x.deal.id] = 1; });
      missingDemo = S.deals.filter((d) => { const s = stageById(d.stage) || {}; return s.kind === "open" && /demo/i.test(s.name) && !withDemo[d.id]; });
    }
    return { groups, cnt, missingDemo };
  }
  // Los 5 bloques de la pestaña "Hoy"
  function hoyData() {
    const tm = isoPlus(1), cm = curMonth(), items = taskItems(true).filter((x) => !x.done);
    const ag = (x) => /agendar|coordinar/i.test(x.titulo || "");
    const demos = items.filter((x) => kindOf(x) === "demo" && !ag(x) && (x.fecha === today || x.fecha === tm));
    const todo = items.filter((x) => x.fecha <= today && demos.indexOf(x) < 0);
    const frenados = S.deals.filter((d) => rotLevel(d) === "red").sort((a, b) => daysIn(b) - daysIn(a));
    const unpaid = S.deals.filter((d) => isActiveClient(d) && d.estado === "pago");
    const hitos = [];
    S.deals.filter(isActiveClient).forEach((d) => {
      if (d.estado === "agendado" || d.estado === "onboarding") hitos.push({ d, t: estLabel(d.estado) });
      else {
        if (hasPromo(d)) { const st = addMonths(d.cierre, +d.promoMeses); if (st > cm && st <= addMonths(cm, 1)) hitos.push({ d, t: "Sube a " + money(d.mrr) + " en " + monthLabel(st) }); }
        const r = renewal(d);
        if (r && r <= addMonths(cm, 1)) hitos.push({ d, t: "Renueva en " + monthLabel(r) });
      }
    });
    const F = forecastRows(), meta = +cfg().metaMrr || 0, mr = F.rows.find((r) => r.m === cfg().metaMes) || F.rows[F.rows.length - 1];
    return { demos, todo, frenados, unpaid, hitos, F, meta, mr };
  }
  // Datos de la pestaña "Clientes"
  function clientsData() {
    const cm = curMonth(), cl = S.deals.filter(isClient), all = cl.filter(isActiveClient);
    const act = all.filter((d) => (d.estado || "activo") === "activo").sort((a, b) => priceAt(b, cm) - priceAt(a, cm));
    const arr = all.filter((d) => (d.estado || "activo") !== "activo"), gone = cl.filter((d) => !isActiveClient(d));
    const paying = all.filter((d) => d.estado !== "pago"), unpaid = all.filter((d) => d.estado === "pago");
    const mrrHoy = sum(paying, (d) => priceAt(d, cm)), real = +cfg().mrrActual || 0;
    const ups = all.filter((d) => { if (!hasPromo(d)) return false; const st = addMonths(d.cierre, +d.promoMeses); return st > cm && st <= addMonths(cm, 3); });
    const renov = all.filter((d) => { const r = renewal(d); return r && r <= addMonths(cm, 2); });
    const g90 = addMonths(cm, -3), b90 = gone.filter((d) => d.bajaMes >= g90);
    const risk = all.filter((d) => d.salud === "riesgo").length;
    return { cm, act, arr, gone, paying, unpaid, mrrHoy, real, ups, renov, b90, risk };
  }

  // ── texto semanal para WhatsApp ──
  function weeklyText() {
    const t = today, d7 = isoPlus(-7), c = cfg(), F = forecastRows(), meta = +c.metaMrr || 0;
    const mr = F.rows.find((r) => r.m === c.metaMes) || F.rows[F.rows.length - 1];
    const open = S.deals.filter(isOpen);
    let L = [];
    L.push("*Resumen comercial Spicytool*"); L.push("Semana del " + fmtDate(d7) + " al " + fmtDate(t)); L.push("");
    L.push("*MRR*"); L.push("Real hoy: " + money(c.mrrActual));
    if (meta) L.push("Meta " + monthLabel(c.metaMes) + ": " + money(meta) + ". Proyectado: " + money(mr.proj) + (mr.proj >= meta ? " (la supera por " + money(mr.proj - meta) + ")" : " (faltan " + money(meta - mr.proj) + ")"));
    L.push("Pipeline ponderado: " + money(sum(open, weighted)) + " en " + open.length + " deals abiertos"); L.push("");
    const won = S.deals.filter((d) => (stageById(d.stage) || {}).kind === "won" && d.cerradoEn && d.cerradoEn > d7);
    L.push("*Ganados en la semana (" + won.length + ")*");
    won.forEach((d) => { L.push("- " + d.empresa + ": " + (hasPromo(d) ? promoTxt(d) + " → " + money(d.mrr) + "/mes" : money(d.mrr) + "/mes")); });
    if (!won.length) L.push("- Ninguno");
    L.push("");
    const lost = S.deals.filter((d) => (stageById(d.stage) || {}).kind === "lost" && d.cerradoEn && d.cerradoEn > d7);
    L.push("*Perdidos en la semana (" + lost.length + ")*");
    lost.forEach((d) => { L.push("- " + d.empresa + ": " + (d.motivo || "sin motivo") + (d.motivoDetalle ? " (" + d.motivoDetalle + ")" : "")); });
    if (!lost.length) L.push("- Ninguno");
    L.push("");
    const adv = [];
    S.deals.forEach((d) => { const tr = d.trail || []; for (let i = 1; i < tr.length; i++) { if (tr[i].at > d7) { const a = stageById(tr[i - 1].s), b = stageById(tr[i].s); if (a && b && b.kind === "open") adv.push("- " + d.empresa + ": " + a.name + " → " + b.name); } } });
    L.push("*Movimientos de etapa*"); if (adv.length) L = L.concat(adv); else L.push("- Ninguno"); L.push("");
    const fr = open.filter((d) => rotLevel(d) === "red");
    L.push("*Frenados (" + fr.length + ")*");
    fr.forEach((d) => { L.push("- " + d.empresa + ": " + daysIn(d) + " días en " + stageById(d.stage).name); });
    if (!fr.length) L.push("- Ninguno");
    L.push("");
    const venc = {};
    taskItems(true).forEach((x) => { if (!x.done && x.fecha < t) { const k = x.vendedor || "Sin asignar"; venc[k] = (venc[k] || 0) + 1; } });
    L.push("*Tareas vencidas*");
    const vk = Object.keys(venc);
    if (vk.length) vk.forEach((k) => { L.push("- " + k + ": " + venc[k]); }); else L.push("- Ninguna");
    const nx = taskItems(true).filter((x) => !x.done && x.fecha >= t && x.fecha <= isoPlus(7)).length;
    L.push(""); L.push("Próximos 7 días: " + nx + (nx === 1 ? " tarea agendada" : " tareas agendadas"));
    return L.join("\n");
  }

  // ── datos para el asistente de IA (el servidor pone las instrucciones; ver crm-ai) ──
  function aiData() {
    const F = forecastRows(), cm = curMonth();
    return {
      hoy: today, mrrReal: +cfg().mrrActual || 0, meta: { mrr: +cfg().metaMrr || 0, mes: cfg().metaMes }, churnEstimadoMensualPct: +cfg().churnPct || 0,
      etapas: cfg().stages.map((s) => ({ nombre: s.name, prob: s.prob, tipo: s.kind, diasLimite: s.rot })),
      forecast: F.rows.map((r) => ({ mes: r.m, nuevoPonderado: Math.round(r.nuevo), bajas: Math.round(r.bajas), mrrProyectado: Math.round(r.proj) })),
      deals: S.deals.map((d) => {
        const s = stageById(d.stage) || {}, o = { empresa: d.empresa, etapa: s.name, tipoEtapa: s.kind, mrr: +d.mrr || 0, plan: d.plan, cierre: d.cierre, vendedor: d.vendedor };
        if (d.contacto) o.contacto = d.contacto;
        if (hasPromo(d)) o.promo = { precio: +d.promoMrr, meses: +d.promoMeses };
        if (s.kind === "open") { o.diasEnEtapa = daysIn(d); if (rotLevel(d) === "red") o.frenado = true; }
        if (d.proxima) o.proximaAccion = { que: d.proxima, fecha: d.proximaFecha };
        if (d.origen) o.origen = d.origen;
        if (d.partner) o.partner = d.partner;
        if (d.pais) o.pais = d.pais;
        const tg = (d.tags || []).map(tagById).filter(Boolean).map((x) => x.name);
        if (tg.length) o.etiquetas = tg;
        if (d.motivo) o.motivoPerdida = d.motivo + (d.motivoDetalle ? " (" + d.motivoDetalle + ")" : "");
        if (s.kind === "won") {
          o.cliente = { estado: estLabel(d.estado), mrrHoy: d.estado === "pago" ? 0 : priceAt(d, cm), cobro: d.cobro, salud: d.salud, proximoHito: nextMilestone(d), ultimoContacto: lastContact(d) };
          if (d.bajaMes) o.cliente.baja = { desde: d.bajaMes, motivo: d.bajaMotivo };
        }
        if (califFilled(d)) o.calificacionDemo = califTxt(d);
        if (d.notas) o.notas = d.notas.slice(0, 300);
        const hs = (d.hist || []).slice(-4);
        if (hs.length) o.ultimosMovimientos = hs.map((x) => x.t.slice(0, 10) + " " + x.x);
        return o;
      }),
      tareasPendientes: taskItems(true).filter((x) => !x.done).map((x) => { const o = { que: x.titulo, fecha: x.fecha }; if (x.deal) o.deal = x.deal.empresa; return o; }),
    };
  }
  function dealAiInfo(d) {
    const s = stageById(d.stage) || {};
    const ts = tasks().filter((t) => t.dealId === d.id && !t.hecha).map((t) => t.titulo + " (" + t.fecha + ")");
    return { hoy: today, empresa: d.empresa, contacto: d.contacto, etapa: s.name, diasEnEtapa: daysIn(d), diasLimiteEtapa: s.rot, mrr: +d.mrr, promo: hasPromo(d) ? { precio: +d.promoMrr, meses: +d.promoMeses } : null, plan: d.plan, cierreEstimado: d.cierre,
      proximaAccionActual: d.proxima ? { que: d.proxima, fecha: d.proximaFecha } : null, etiquetas: (d.tags || []).map(tagById).filter(Boolean).map((x) => x.name), origen: d.origen, partner: d.partner, pais: d.pais, tipoCuenta: d.tipo,
      calificacionDemo: califTxt(d), notas: d.notas, historial: (d.hist || []).slice(-15).map((x) => x.t.slice(0, 10) + " " + x.x), tareasAbiertas: ts, vendedor: d.vendedor };
  }
  function pasteContext() {
    const c = cfg(), groups = {};
    c.tags.forEach((t) => { (groups[t.group] = groups[t.group] || []).push(t.name); });
    return { hoy: today, zonaHoraria: "UTC-3 (Argentina y Uruguay)", etapasAbiertas: c.stages.filter((s) => s.kind === "open").map((s) => ({ id: s.id, nombre: s.name })), tiposDeCuenta: c.types, origenes: c.sources, partners: c.partners, paises: c.countries, etiquetasPorGrupo: groups, accionesRapidas: c.acciones, ticketPromedioUSD: c.ticket };
  }
  const pasteMatch = (r) => {
    const ph = String(r.telefono || "").replace(/\D/g, "").slice(-8), em = String(r.empresa || "").trim().toLowerCase();
    return S.deals.find((d) => { const dp = String(d.telefono || "").replace(/\D/g, "").slice(-8); if (ph.length === 8 && dp === ph) return true; const de = String(d.empresa || "").trim().toLowerCase(); return em.length > 3 && de === em; }) || null;
  };
  const pasteTagIds = (names) => (names || []).map((n) => { const t = cfg().tags.find((x) => x.name.toLowerCase() === String(n).toLowerCase()); return t ? t.id : null; }).filter(Boolean);

  return {
    S, now, today, curMonth, iso, isoPlus, dealById, tasks, stageById, tagById, prob, weighted, isOpen, overdue, hasPromo, promoTxt, daysIn, rotLevel,
    priceAt, isClient, isActiveClient, estLabel, renewal, nextMilestone, lastContact, califScore, califFilled, califTxt, califState,
    fmtStampDate, fillTpl, waMsg, waCustom, waLink, forecastRows, chartSvg, groupBy, forecastData, convStats, kindOf, taskItems, dueCounts, fmtDay, nextDays,
    taskGroups, hoyData, clientsData, weeklyText, aiData, dealAiInfo, pasteContext, pasteMatch, pasteTagIds,
  };
}
