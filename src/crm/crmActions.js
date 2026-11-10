// Acciones del CRM comercial (guardar deal, mover de etapa, hacer tareas, bajas...), portadas de
// _import/crm-comercial-spicytool.html. Cada función MUTA el estado que recibe `crm` (creado con
// createCrm sobre una copia: ver cloneState) y devuelve info para que la pantalla decida qué abrir.
// La persistencia (qué filas cambiaron) la resuelve crmStore.js comparando antes/después.
import { isDemoTxt, money, fmtDate, monthLabel } from "./crmLogic.js";

export const cloneState = (S) => JSON.parse(JSON.stringify(S));
export const newId = (prefix, nowMs = Date.now()) => prefix + nowMs.toString(36) + Math.random().toString(36).slice(2, 4);

export function logH(crm, d, x) {
  d.hist = d.hist || [];
  d.hist.push({ t: crm.now.toISOString(), x });
  if (d.hist.length > 80) d.hist.shift();
}

export function markClosed(crm, d, prev) {
  const s = crm.stageById(d.stage);
  if (d.stage === prev) return;
  if (s && (s.kind === "won" || s.kind === "lost")) d.cerradoEn = crm.today;
  if (s && s.kind === "won" && !d.estado) { d.estado = "pago"; d.estadoDesde = crm.today; }
  d.stageSince = crm.today;
  d.trail = (d.trail || []).concat([{ s: d.stage, at: crm.today }]);
  const ps = crm.stageById(prev);
  logH(crm, d, (ps ? ps.name : "?") + " → " + (s ? s.name : "?") + (s && s.kind === "lost" && d.motivo ? " (" + d.motivo + ")" : ""));
}

// Valores por defecto de un deal nuevo (el original los armaba en openDeal)
export function blankDeal(crm, stage, preset) {
  const c = crm.S.config;
  const d = { id: newId("d"), empresa: "", contacto: "", pais: "", tipo: c.types[0] || "", origen: "", partner: "", vendedor: c.sellers[0] || "", stage: stage || c.stages[0].id, mrr: c.ticket || 200, plan: "Mensual", cierre: addMonthsStr(crm.curMonth(), 1), proxima: "", proximaFecha: "", tags: [], notas: "", motivo: "", aConfirmar: false, _new: true };
  return preset ? Object.assign(d, preset) : d;
}
function addMonthsStr(ym, n) {
  const p = ym.split("-").map(Number); let y = p[0], m = p[1] + n;
  y += Math.floor((m - 1) / 12); m = (((m - 1) % 12) + 12) % 12 + 1;
  return y + "-" + String(m).padStart(2, "0");
}

// Port de submitDeal. `editing` es la copia que se editó (con _new si es nuevo); `v` los valores del formulario:
// { empresa, contacto, telefono, stage, vendedor, plan, cierre, pais, tipo, origen, partner, proxima, proximaFecha,
//   proximaTipo, proximaHora, motivo, motivoDetalle, notas, estado, mrr, promoMrr, promoMeses, tags[], calOn, calif|null }
export function saveDeal(crm, editing, v) {
  const d = { ...editing };
  const emp = (v.empresa || "").trim();
  if (!emp) return { error: "Escribí el nombre de la empresa para guardar el deal." };
  const prevStage = d.stage, live = crm.dealById(d.id);
  const prevMrr = live ? +live.mrr : null, prevProx = live ? live.proxima + "|" + live.proximaFecha : "", prevNotas = live ? live.notas : "";
  if (live) { d.hist = (live.hist || []).slice(); d.trail = (live.trail || []).slice(); }
  ["contacto", "telefono", "stage", "vendedor", "plan", "cierre", "pais", "tipo", "origen", "partner", "proxima", "proximaFecha", "proximaTipo", "proximaHora", "motivo", "motivoDetalle", "notas", "estado"].forEach((k) => { d[k] = (v[k] == null ? "" : v[k]).toString().trim(); });
  const stK = (crm.stageById(d.stage) || {}).kind;
  if (stK !== "won") d.estado = live ? live.estado || "" : "";
  else if (live && live.estado !== d.estado && (crm.stageById(prevStage) || {}).kind === "won") { d.estadoDesde = crm.today; logH(crm, d, "Estado: " + crm.estLabel(d.estado)); }
  markClosed(crm, d, prevStage);
  if (d.proximaFecha && !d.proxima) d.proxima = d.proximaTipo === "reunion" ? "Reunión" : "Seguimiento";
  d.empresa = emp;
  d.mrr = Math.max(0, +v.mrr || 0);
  d.tags = (v.tags || []).slice();
  d.promoMrr = Math.max(0, +v.promoMrr || 0);
  d.promoMeses = Math.max(0, Math.round(+v.promoMeses || 0));
  if (d.promoMrr && d.promoMrr >= d.mrr) return { error: "El precio promocional tiene que ser menor que el precio normal." };
  d.calOn = !!v.calOn;
  d.aConfirmar = false;
  if (v.calif) {
    const nc = { decisor: (v.calif.decisor || "") + "", problema: ((v.calif.problema || "") + "").trim(), usaHoy: ((v.calif.usaHoy || "") + "").trim(), timing: (v.calif.timing || "") + "" };
    const oc = JSON.stringify((live && live.calif) || {});
    d.calif = nc;
    if (JSON.stringify(nc) !== oc && (nc.decisor || nc.problema || nc.usaHoy || nc.timing)) logH(crm, d, "Calificación de la demo: " + crm.califScore(d) + "/4");
  }
  const isNew = d._new;
  delete d._new;
  if (isNew) { d.stageSince = crm.today; d.trail = [{ s: d.stage, at: crm.today }]; d.hist = []; logH(crm, d, "Deal creado en " + ((crm.stageById(d.stage) || {}).name || "")); }
  else {
    if (prevMrr !== null && prevMrr !== d.mrr) logH(crm, d, "MRR: " + money(prevMrr) + " → " + money(d.mrr));
    if (d.notas !== prevNotas) logH(crm, d, "Actualizó notas");
  }
  if (d.proxima && d.proximaFecha && (d.proxima + "|" + d.proximaFecha) !== prevProx) logH(crm, d, "Próxima acción: " + d.proxima + " para el " + fmtDate(d.proximaFecha));
  if (isNew) crm.S.deals.push(d); else crm.S.deals = crm.S.deals.map((x) => (x.id === d.id ? d : x));
  return { deal: d, isNew };
}

export function deleteDeal(crm, id) { crm.S.deals = crm.S.deals.filter((d) => d.id !== id); }

// Arrastrar un deal a otra columna. Devuelve qué hacer después: abrir el deal por falta de motivo (lost) o para reagendar (hold).
export function moveDealToStage(crm, id, stageId) {
  const d = crm.dealById(id), s = crm.stageById(stageId);
  if (!d || !s || d.stage === s.id) return { moved: false };
  const prev = d.stage;
  d.stage = s.id;
  markClosed(crm, d, prev);
  return { moved: true, deal: d, stage: s, openDeal: (s.kind === "lost" && !d.motivo) ? "motivo" : s.kind === "hold" ? "reagendar" : "" };
}

export function setEstado(crm, d, e) {
  if (!d || d.estado === e) return null;
  d.estado = e;
  d.estadoDesde = crm.today;
  logH(crm, d, "Estado: " + crm.estLabel(e));
  let askOnboarding = false;
  if (e === "agendado") askOnboarding = !crm.tasks().some((t) => t.dealId === d.id && !t.hecha && /onboarding/i.test(t.titulo));
  return { askOnboarding };
}

export function setClientField(crm, d, field, value) {
  if (field === "salud" && d.salud !== value) logH(crm, d, "Salud: " + ({ bien: "Bien", atencion: "Atención", riesgo: "Riesgo" }[value] || value));
  d[field] = value;
}

export function giveBaja(crm, d, { mes, motivo, detalle }) {
  d.bajaMes = (mes || crm.curMonth()) + "";
  d.bajaMotivo = (motivo || "") + "";
  d.bajaDetalle = ((detalle || "") + "").trim();
  logH(crm, d, "Baja desde " + monthLabel(d.bajaMes) + (d.bajaMotivo ? " (" + d.bajaMotivo + ")" : ""));
}
export function reactivate(crm, d) {
  delete d.bajaMes; delete d.bajaMotivo; delete d.bajaDetalle;
  logH(crm, d, "Cliente reactivado");
}

// Marcar una tarea (o la próxima acción de un deal) como hecha / pendiente. Devuelve el siguiente paso de la pantalla.
export function toggleTask(crm, k, id) {
  if (k === "deal") {
    const d = crm.dealById(id);
    if (!d) return null;
    delete d.calEventId; delete d.calKey;
    const wasDemo = isDemoTxt(d.proxima), prev = { titulo: d.proxima, tipo: d.proximaTipo, hora: d.proximaHora };
    logH(crm, d, "Hecho: " + d.proxima);
    d.proxima = ""; d.proximaFecha = ""; d.proximaTipo = "followup";
    return wasDemo ? { open: "deal-calif", dealId: d.id } : { open: "next", ctx: { k: "deal", dealId: d.id, prev } };
  }
  const t = crm.tasks().find((x) => x.id === id);
  if (!t) return null;
  t.hecha = !t.hecha;
  t.hechaEn = t.hecha ? crm.today : "";
  const td = crm.dealById(t.dealId);
  if (td && t.hecha) logH(crm, td, "Tarea hecha: " + t.titulo);
  if (t.hecha) { delete t.calEventId; delete t.calKey; }
  if (t.hecha && td && isDemoTxt(t.titulo)) return { open: "deal-calif", dealId: td.id };
  if (t.hecha) return { open: "next", ctx: { k: "task", dealId: td ? td.id : "", taskId: t.id, prev: { titulo: t.titulo, tipo: t.tipo, hora: t.hora } } };
  return null;
}

// Diálogo "Hecho. ¿Agendamos el próximo paso?" -> guardar
export function saveNext(crm, ctx, { titulo, fecha, hora, tipo }) {
  if (!fecha) return { error: "Elegí cuándo: tocá una fecha rápida o cargala." };
  hora = hora || "10:00"; tipo = tipo || "followup";
  titulo = (titulo || "").trim() || (tipo === "reunion" ? "Reunión" : "Follow up");
  const d = ctx.dealId ? crm.dealById(ctx.dealId) : null;
  if (ctx.k === "deal" && d && !d.proxima) {
    d.proxima = titulo; d.proximaFecha = fecha; d.proximaHora = hora; d.proximaTipo = tipo === "reunion" ? "reunion" : "followup"; d.calOn = d.calOn !== false;
    logH(crm, d, "Próxima acción: " + titulo + " para el " + fmtDate(fecha));
    return { kind: "deal", titulo, fecha, hora };
  }
  const prevTask = ctx.taskId ? crm.tasks().find((x) => x.id === ctx.taskId) : null;
  const t = { id: newId("k"), titulo, tipo, fecha, hora, dealId: d ? d.id : "", vendedor: (d && d.vendedor) || (prevTask && prevTask.vendedor) || crm.S.config.sellers[0] || "", notas: "", calOn: true, hecha: false };
  crm.S.tasks = crm.tasks().concat([t]);
  if (d) logH(crm, d, "Tarea creada: " + titulo + " para el " + fmtDate(fecha));
  return { kind: "task", task: t, titulo, fecha, hora };
}

export function blankTask(crm, dealId, preset) {
  const dd = dealId && crm.dealById(dealId);
  const t = { id: newId("k"), titulo: "", tipo: "tarea", fecha: crm.today, hora: "09:00", dealId: dealId || "", vendedor: (dd && dd.vendedor) || crm.S.config.sellers[0] || "", notas: "", calOn: true, hecha: false, _new: true };
  return preset ? Object.assign(t, preset) : t;
}
// Port de submitTask. v: { titulo, tipo, fecha, hora, vendedor, dealId, notas, calOn }
export function saveTask(crm, editing, v) {
  const TT = { tarea: "Tarea", followup: "Follow-up", reunion: "Reunión" };
  const t = { ...editing };
  t.tipo = (v.tipo || "tarea") + "";
  t.titulo = ((v.titulo || "") + "").trim() || TT[t.tipo] || "Tarea";
  t.fecha = (v.fecha || "") + ""; t.hora = (v.hora || "09:00") + "";
  if (!t.fecha) return { error: "Elegí una fecha para la tarea." };
  t.vendedor = (v.vendedor || "") + ""; t.dealId = (v.dealId || "") + ""; t.notas = ((v.notas || "") + "").trim(); t.calOn = !!v.calOn;
  const isNew = t._new;
  delete t._new;
  if (isNew) { crm.S.tasks = crm.tasks().concat([t]); const td = crm.dealById(t.dealId); if (td) logH(crm, td, "Tarea creada: " + t.titulo + " para el " + fmtDate(t.fecha)); }
  else crm.S.tasks = crm.tasks().map((x) => (x.id === t.id ? t : x));
  return { task: t, isNew };
}
export function deleteTask(crm, id) { crm.S.tasks = crm.tasks().filter((x) => x.id !== id); }

// Configuración: etapas, etiquetas, listas
export function applyConfigField(crm, key, value, isNumber) { crm.S.config[key] = isNumber ? Math.max(0, +value || 0) : value; }
export function setStageField(crm, idx, field, value) {
  const s = crm.S.config.stages[idx];
  s[field] = field === "prob" ? Math.max(0, Math.min(100, +value || 0)) : field === "rot" ? Math.max(0, Math.round(+value || 0)) : value;
  if (field === "kind" && s.kind !== "open" && s.kind !== "won") s.prob = 0;
  if (field === "kind" && s.kind === "won") s.prob = 100;
}
export function moveStage(crm, i, dir) {
  const st = crm.S.config.stages, j = i + dir;
  if (j < 0 || j >= st.length) return;
  st.splice(j, 0, st.splice(i, 1)[0]);
}
// Devuelve un mensaje si no se puede borrar
export function deleteStage(crm, i) {
  const c = crm.S.config, s = c.stages[i], n = crm.S.deals.filter((d) => d.stage === s.id).length;
  if (n) return "Mové los " + n + " deals de " + s.name + " antes de eliminar la etapa";
  if (c.stages.length < 2) return "El pipeline necesita al menos una etapa";
  c.stages.splice(i, 1);
  return "";
}
export function addStage(crm) {
  const c = crm.S.config, at = Math.max(0, c.stages.findIndex((s) => s.kind !== "open"));
  c.stages.splice(at, 0, { id: newId("s"), name: "Nueva etapa", prob: 50, kind: "open", color: "#6B7A90" });
}
export function addTag(crm) { crm.S.config.tags.push({ id: newId("t"), name: "Nueva etiqueta", group: "Otras", color: "#7A7A70" }); }
export function deleteTag(crm, i) {
  const c = crm.S.config, tid = c.tags[i].id;
  c.tags.splice(i, 1);
  crm.S.deals.forEach((d) => { d.tags = (d.tags || []).filter((x) => x !== tid); });
  return tid;
}
export function applyConvAsProbabilities(crm) {
  const cs = crm.convStats();
  cs.rows.forEach((r) => { if (r.ok) r.stage.prob = Math.round(r.win * 100); });
}

// "Pegar conversación": a partir de lo que devolvió la IA arma qué abrir en la ficha del deal.
//  - si el deal ya existe: { existingId, prefill } (valores del formulario a pisar/completar, como el original)
//  - si es nuevo: { stage, preset } (valores iniciales del deal nuevo)
export function buildPasteResult(crm, r, ex) {
  const c = crm.S.config, p = r.proxima || {}, note = (r.resumen || "").trim();
  const stamp = "Cargado desde conversación pegada el " + fmtDate(crm.today) + ".";
  const okTime = /^\d\d:\d\d$/.test(p.hora || "");
  const pick = (v, arr) => (arr && arr.indexOf(v) >= 0 ? v : "");
  const tagIds = crm.pasteTagIds(r.etiquetas);
  if (ex) {
    const prefill = {};
    if (!ex.telefono && r.telefono) prefill.telefono = r.telefono;
    if (!ex.contacto && r.contacto) prefill.contacto = r.contacto;
    if (p.accion) {
      prefill.proxima = p.accion; prefill.proximaTipo = p.tipo === "reunion" ? "reunion" : "followup";
      if (p.fecha && p.fecha >= crm.today) prefill.proximaFecha = p.fecha;
      if (okTime) prefill.proximaHora = p.hora;
    }
    if (note) prefill.notas = (ex.notas ? ex.notas + "\n\n" : "") + note + "\n" + stamp;
    if (tagIds.length) prefill.tags = Array.from(new Set([...(ex.tags || []), ...tagIds]));
    return { existingId: ex.id, prefill };
  }
  const okStage = c.stages.find((s) => s.id === r.etapa && s.kind === "open");
  return {
    stage: okStage ? okStage.id : null,
    preset: {
      empresa: r.empresa || r.contacto || "", contacto: r.contacto || "", telefono: r.telefono || "", pais: pick(r.pais, c.countries), tipo: pick(r.tipoCuenta, c.types) || c.types[0] || "",
      origen: pick(r.origen, c.sources), partner: pick(r.partner, c.partners), tags: tagIds, mrr: +r.mrrEstimado > 0 ? +r.mrrEstimado : (c.ticket || 200), notas: (note ? note + "\n" : "") + stamp,
      proxima: p.accion || "", proximaTipo: p.tipo === "reunion" ? "reunion" : "followup", proximaFecha: p.fecha && p.fecha >= crm.today ? p.fecha : "", proximaHora: okTime ? p.hora : "09:00",
    },
  };
}
