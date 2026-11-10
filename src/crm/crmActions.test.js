import { describe, it, expect } from "vitest";
import { createCrm } from "./crmLogic.js";
import * as A from "./crmActions.js";
import { fixture, NOW } from "./crmFixture.js";

const make = () => createCrm(A.cloneState(fixture()), { now: NOW });
const baseForm = (d, over = {}) => ({ empresa: d.empresa, contacto: d.contacto || "", telefono: d.telefono || "", stage: d.stage, vendedor: d.vendedor, plan: d.plan, cierre: d.cierre, pais: d.pais || "", tipo: d.tipo || "", origen: d.origen || "", partner: d.partner || "", proxima: d.proxima || "", proximaFecha: d.proximaFecha || "", proximaTipo: d.proximaTipo || "followup", proximaHora: d.proximaHora || "09:00", motivo: d.motivo || "", motivoDetalle: d.motivoDetalle || "", notas: d.notas || "", estado: d.estado || "", mrr: d.mrr, promoMrr: d.promoMrr || 0, promoMeses: d.promoMeses || 0, tags: d.tags || [], calOn: true, calif: null, ...over });
const last = (d) => d.hist[d.hist.length - 1].x;

describe("saveDeal", () => {
  it("deal nuevo: queda en su etapa con recorrido e historial 'Deal creado'", () => {
    const crm = make();
    const nd = A.blankDeal(crm, "lead");
    expect(nd.mrr).toBe(200);          // ticket por defecto de la config
    expect(nd.cierre).toBe("2026-12"); // el mes que viene
    const r = A.saveDeal(crm, nd, { ...baseForm(nd), empresa: "  Nueva SA  ", mrr: 250 });
    expect(r.isNew).toBe(true);
    expect(r.deal.empresa).toBe("Nueva SA");
    expect(r.deal._new).toBeUndefined();
    expect(r.deal.trail).toEqual([{ s: "lead", at: "2026-11-10" }]);
    expect(r.deal.stageSince).toBe("2026-11-10");
    expect(r.deal.hist.map((h) => h.x)).toEqual(["Deal creado en Lead"]);
    expect(crm.S.deals.at(-1).id).toBe(nd.id);
  });
  it("exige empresa y que la promo sea menor al precio normal", () => {
    const crm = make();
    expect(A.saveDeal(crm, A.blankDeal(crm), { ...baseForm({ empresa: "", mrr: 1, vendedor: "Ana", plan: "Mensual", cierre: "2026-12", stage: "lead" }) }).error).toMatch(/nombre de la empresa/);
    const d = crm.dealById("b");
    expect(A.saveDeal(crm, d, baseForm(d, { promoMrr: 200, promoMeses: 2 })).error).toMatch(/menor que el precio normal/);
    expect(crm.dealById("b").promoMrr).toBe(0); // no se guardó nada
  });
  it("editar: registra cambios de MRR, notas y próxima acción", () => {
    const crm = make();
    const d = A.cloneState(crm.dealById("b"));
    const r = A.saveDeal(crm, d, baseForm(d, { mrr: 260, notas: "nota nueva", proxima: "Llamar", proximaFecha: "2026-11-12" }));
    expect(r.deal.hist.map((h) => h.x)).toEqual(["MRR: USD 200 → USD 260", "Actualizó notas", "Próxima acción: Llamar para el 12 nov"]);
    expect(crm.dealById("b").mrr).toBe(260);
  });
  it("pasar a Ganado: fecha de cierre, estado 'Esperando pago' y recorrido", () => {
    const crm = make();
    const d = A.cloneState(crm.dealById("a"));
    const r = A.saveDeal(crm, d, baseForm(d, { stage: "won" }));
    expect(r.deal.cerradoEn).toBe("2026-11-10");
    expect(r.deal.estado).toBe("pago");
    expect(r.deal.estadoDesde).toBe("2026-11-10");
    expect(r.deal.trail.at(-1)).toEqual({ s: "won", at: "2026-11-10" });
    expect(r.deal.stageSince).toBe("2026-11-10");
    expect(r.deal.hist.some((h) => h.x === "Negociación → Ganado")).toBe(true);
  });
  it("pasar a Lost guarda el motivo en el historial", () => {
    const crm = make();
    const d = A.cloneState(crm.dealById("b"));
    const r = A.saveDeal(crm, d, baseForm(d, { stage: "lost", motivo: "Precio" }));
    expect(r.deal.cerradoEn).toBe("2026-11-10");
    expect(last(r.deal)).toBe("Propuesta → Lost (Precio)");
  });
  it("si hay fecha pero no acción, completa 'Seguimiento' o 'Reunión'", () => {
    const crm = make();
    const d = A.cloneState(crm.dealById("b"));
    expect(A.saveDeal(crm, d, baseForm(d, { proximaFecha: "2026-11-15" })).deal.proxima).toBe("Seguimiento");
    expect(A.saveDeal(crm, A.cloneState(crm.dealById("b")), baseForm(d, { proximaFecha: "2026-11-15", proximaTipo: "reunion" })).deal.proxima).toBe("Reunión");
  });
  it("calificación de la demo: se registra el puntaje solo si cambió", () => {
    const crm = make();
    const d = A.cloneState(crm.dealById("b"));
    const calif = { decisor: "si", problema: "x", usaHoy: "y", timing: "ya" };
    const r1 = A.saveDeal(crm, d, baseForm(d, { calif }));
    expect(r1.deal.hist.map((h) => h.x)).toContain("Calificación de la demo: 4/4");
    const n = r1.deal.hist.length;
    const r2 = A.saveDeal(crm, A.cloneState(crm.dealById("b")), baseForm(d, { calif }));
    expect(r2.deal.hist.length).toBe(n);
  });
  it("el historial se corta en 80 movimientos", () => {
    const crm = make();
    const d = crm.dealById("b");
    for (let i = 0; i < 100; i++) A.logH(crm, d, "m" + i);
    expect(d.hist).toHaveLength(80);
    expect(d.hist.at(-1).x).toBe("m99");
  });
});

describe("mover y eliminar deals", () => {
  it("arrastrar a Lost sin motivo pide el motivo; a No show pide reagendar; a otra abierta no pide nada", () => {
    expect(A.moveDealToStage(make(), "b", "lost")).toMatchObject({ moved: true, openDeal: "motivo" });
    expect(A.moveDealToStage(make(), "b", "hold")).toMatchObject({ moved: true, openDeal: "reagendar" });
    expect(A.moveDealToStage(make(), "b", "nego")).toMatchObject({ moved: true, openDeal: "" });
    expect(A.moveDealToStage(make(), "b", "prop")).toEqual({ moved: false });
  });
  it("mover a Ganado fija estado de pago y registra el recorrido", () => {
    const crm = make();
    A.moveDealToStage(crm, "a", "won");
    const d = crm.dealById("a");
    expect([d.stage, d.estado, d.cerradoEn]).toEqual(["won", "pago", "2026-11-10"]);
    expect(d.trail.map((x) => x.s)).toEqual(["lead", "nego", "won"]);
  });
  it("eliminar un deal", () => {
    const crm = make();
    A.deleteDeal(crm, "c");
    expect(crm.dealById("c")).toBeUndefined();
  });
});

describe("clientes: estado, salud, bajas", () => {
  it("setEstado registra el cambio y pide agendar el onboarding si no hay uno", () => {
    const crm = make();
    const d = crm.dealById("w2");
    expect(A.setEstado(crm, d, "agendado")).toEqual({ askOnboarding: true });
    expect(d.estado).toBe("agendado");
    expect(last(d)).toBe("Estado: Onboarding agendado");
    expect(A.setEstado(crm, d, "agendado")).toBeNull(); // sin cambio
  });
  it("no pide agendar onboarding si ya hay una tarea de onboarding abierta", () => {
    const crm = make();
    crm.S.tasks.push({ id: "k9", titulo: "Onboarding", tipo: "reunion", fecha: "2026-11-12", hora: "10:00", dealId: "w2", hecha: false });
    expect(A.setEstado(crm, crm.dealById("w2"), "agendado")).toEqual({ askOnboarding: false });
  });
  it("cambio de salud queda en el historial", () => {
    const crm = make();
    A.setClientField(crm, crm.dealById("w1"), "salud", "riesgo");
    expect(crm.dealById("w1").salud).toBe("riesgo");
    expect(last(crm.dealById("w1"))).toBe("Salud: Riesgo");
  });
  it("dar de baja descuenta del forecast y reactivar lo revierte", () => {
    const crm = make();
    const d = crm.dealById("w1");
    const before = crm.forecastRows().rows[2].proj;
    A.giveBaja(crm, d, { mes: "2027-01", motivo: "Precio", detalle: " caro " });
    expect(d.bajaDetalle).toBe("caro");
    expect(last(d)).toBe("Baja desde ene 27 (Precio)");
    expect(crm.forecastRows().rows[2].proj).toBeLessThan(before);
    A.reactivate(crm, d);
    expect(d.bajaMes).toBeUndefined();
    expect(last(d)).toBe("Cliente reactivado");
    expect(crm.forecastRows().rows[2].proj).toBe(before);
  });
});

describe("tareas", () => {
  it("hacer la próxima acción de un deal: la limpia, la registra y ofrece agendar el siguiente paso", () => {
    const crm = make();
    const r = A.toggleTask(crm, "deal", "a");
    expect(r).toEqual({ open: "next", ctx: { k: "deal", dealId: "a", prev: { titulo: "Follow up", tipo: "followup", hora: "10:00" } } });
    const d = crm.dealById("a");
    expect([d.proxima, d.proximaFecha]).toEqual(["", ""]);
    expect(last(d)).toBe("Hecho: Follow up");
  });
  it("si era una demo, abre el deal para cargar la calificación", () => {
    const crm = make();
    crm.dealById("a").proxima = "Hacer demo";
    expect(A.toggleTask(crm, "deal", "a")).toEqual({ open: "deal-calif", dealId: "a" });
  });
  it("tildar y destildar una tarea", () => {
    const crm = make();
    const r = A.toggleTask(crm, "task", "t_2");
    expect(r.open).toBe("next");
    expect(crm.tasks().find((t) => t.id === "t_2")).toMatchObject({ hecha: true, hechaEn: "2026-11-10" });
    expect(A.toggleTask(crm, "task", "t_2")).toBeNull(); // destildar no pregunta nada
    expect(crm.tasks().find((t) => t.id === "t_2")).toMatchObject({ hecha: false, hechaEn: "" });
  });
  it("tarea de un deal: queda en el historial del deal; si es una demo, abre la calificación", () => {
    const crm = make();
    const r = A.toggleTask(crm, "task", "t_1"); // "Hacer demo" del deal a
    expect(r).toEqual({ open: "deal-calif", dealId: "a" });
    expect(last(crm.dealById("a"))).toBe("Tarea hecha: Hacer demo");
  });
  it("próximo paso: si el deal no tiene próxima acción se la pone; si tiene, crea una tarea", () => {
    const crm = make();
    const ctxDeal = A.toggleTask(crm, "deal", "a").ctx;
    expect(A.saveNext(crm, ctxDeal, { titulo: "", fecha: "" }).error).toMatch(/Elegí cuándo/);
    const r1 = A.saveNext(crm, ctxDeal, { titulo: "Llamar", fecha: "2026-11-13", hora: "11:00", tipo: "reunion" });
    expect(r1.kind).toBe("deal");
    expect(crm.dealById("a")).toMatchObject({ proxima: "Llamar", proximaFecha: "2026-11-13", proximaHora: "11:00", proximaTipo: "reunion" });
    const r2 = A.saveNext(crm, { k: "deal", dealId: "a", prev: {} }, { titulo: "Otra", fecha: "2026-11-14" });
    expect(r2.kind).toBe("task");
    expect(crm.tasks().at(-1)).toMatchObject({ titulo: "Otra", dealId: "a", vendedor: "Ana", hora: "10:00", tipo: "followup" });
  });
  it("crear, editar y borrar una tarea", () => {
    const crm = make();
    const nt = A.blankTask(crm, "b");
    expect(nt.vendedor).toBe("Beto"); // hereda el vendedor del deal
    expect(A.saveTask(crm, nt, { titulo: "", tipo: "reunion", fecha: "" }).error).toMatch(/fecha/);
    const r = A.saveTask(crm, nt, { titulo: "", tipo: "reunion", fecha: "2026-11-20", hora: "10:00", vendedor: "Beto", dealId: "b", notas: " n ", calOn: true });
    expect(r.task.titulo).toBe("Reunión"); // título por defecto según el tipo
    expect(last(crm.dealById("b"))).toBe("Tarea creada: Reunión para el 20 nov");
    A.saveTask(crm, { ...r.task }, { titulo: "Editada", tipo: "tarea", fecha: "2026-11-21", hora: "09:00", vendedor: "Ana", dealId: "b", notas: "", calOn: false });
    expect(crm.tasks().find((t) => t.id === r.task.id)).toMatchObject({ titulo: "Editada", fecha: "2026-11-21" });
    A.deleteTask(crm, r.task.id);
    expect(crm.tasks().find((t) => t.id === r.task.id)).toBeUndefined();
  });
});

describe("configuración", () => {
  it("etapas: la probabilidad queda entre 0 y 100; solo abiertas y ganadas tienen probabilidad", () => {
    const crm = make();
    A.setStageField(crm, 0, "prob", 150);
    expect(crm.S.config.stages[0].prob).toBe(100);
    A.setStageField(crm, 1, "kind", "lost");
    expect(crm.S.config.stages[1].prob).toBe(0);
    A.setStageField(crm, 1, "kind", "won");
    expect(crm.S.config.stages[1].prob).toBe(100);
    A.setStageField(crm, 2, "rot", "-3");
    expect(crm.S.config.stages[2].rot).toBe(0);
  });
  it("no deja borrar una etapa con deals ni la última", () => {
    const crm = make();
    expect(A.deleteStage(crm, 0)).toMatch(/Mové los 1 deals de Lead/);
    expect(crm.S.config.stages).toHaveLength(7);
    A.deleteStage(crm, 1); // Demo agendada: sin deals
    expect(crm.S.config.stages).toHaveLength(6);
  });
  it("mover etapas de lugar y agregar una nueva antes de las no abiertas", () => {
    const crm = make();
    A.moveStage(crm, 1, -1);
    expect(crm.S.config.stages.slice(0, 2).map((s) => s.id)).toEqual(["demo", "lead"]);
    A.moveStage(crm, 0, -1); // no sale del borde
    expect(crm.S.config.stages[0].id).toBe("demo");
    A.addStage(crm);
    expect(crm.S.config.stages[4].name).toBe("Nueva etapa");
    expect(crm.S.config.stages[5].kind).toBe("won");
  });
  it("borrar una etiqueta la saca de todos los deals", () => {
    const crm = make();
    A.deleteTag(crm, 0);
    expect(crm.dealById("a").tags).toEqual([]);
    expect(crm.S.config.tags.map((t) => t.id)).toEqual(["t2"]);
  });
  it("usar el cierre real como probabilidades solo en etapas con datos suficientes", () => {
    const crm = make();
    for (let i = 0; i < 6; i++) crm.S.deals.push({ id: "x" + i, empresa: "X" + i, stage: i < 3 ? "won" : "lost", mrr: 1, trail: [{ s: "lead", at: "2026-10-01" }, { s: i < 3 ? "won" : "lost", at: "2026-10-05" }], hist: [] });
    A.applyConvAsProbabilities(crm);
    expect(crm.S.config.stages[0].prob).toBe(Math.round(100 * crm.convStats().rows[0].win)); // Lead: tiene >= 5 cerrados
    expect(crm.S.config.stages[2].prob).toBe(60); // Propuesta: sin datos suficientes, queda igual
  });
});
