import { describe, it, expect } from "vitest";
import { createCrm, addMonths, monthLabel, fmtDate, money, daysBetween, isDemoTxt, niceMax } from "./crmLogic.js";
import { fixture, NOW } from "./crmFixture.js";

const make = (mut) => { const S = fixture(); if (mut) mut(S); return createCrm(S, { now: NOW }); };

describe("helpers", () => {
  it("addMonths cruza años y meses", () => {
    expect(addMonths("2026-11", 1)).toBe("2026-12");
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 12)).toBe("2027-12");
  });
  it("formatos", () => {
    expect(monthLabel("2026-11")).toBe("nov 26");
    expect(fmtDate("2026-11-04")).toBe("4 nov");
    expect(money(6880)).toBe("USD 6.880");
    expect(money(null)).toBe("USD 0");
    expect(daysBetween("2026-11-01", "2026-11-10")).toBe(9);
    expect(niceMax(1195)).toBe(2000);
    expect(niceMax(100)).toBe(100);
  });
  it("isDemoTxt: demo sí, agendar/coordinar demo no", () => {
    expect(isDemoTxt("Hacer demo")).toBe(true);
    expect(isDemoTxt("Agendar demo")).toBe(false);
    expect(isDemoTxt("coordinar demo")).toBe(false);
    expect(isDemoTxt("Follow up")).toBe(false);
  });
});

describe("hoy = fecha de Buenos Aires", () => {
  it("usa la fecha argentina, no la UTC", () => {
    expect(createCrm(fixture(), { now: new Date("2026-11-11T02:30:00Z") }).today).toBe("2026-11-10");
    expect(createCrm(fixture(), { now: new Date("2026-11-11T03:00:00Z") }).today).toBe("2026-11-11");
  });
});

describe("promos, precios y clientes", () => {
  const crm = make();
  it("hasPromo exige meses > 0 y precio promo menor al normal", () => {
    expect(crm.hasPromo({ mrr: 300, promoMrr: 120, promoMeses: 2 })).toBe(true);
    expect(crm.hasPromo({ mrr: 300, promoMrr: 0, promoMeses: 1 })).toBe(true); // gratis
    expect(crm.hasPromo({ mrr: 300, promoMrr: 300, promoMeses: 2 })).toBe(false);
    expect(crm.hasPromo({ mrr: 300, promoMrr: 100, promoMeses: 0 })).toBe(false);
  });
  it("priceAt: 0 antes del cierre, promo durante, normal después", () => {
    const d = crm.dealById("w1");
    expect(crm.priceAt(d, "2026-10")).toBe(0);
    expect(crm.priceAt(d, "2026-11")).toBe(120);
    expect(crm.priceAt(d, "2026-12")).toBe(120);
    expect(crm.priceAt(d, "2027-01")).toBe(300);
  });
  it("promoTxt: 'Gratis' si el precio promo es 0", () => {
    expect(crm.promoTxt({ promoMrr: 0 })).toBe("Gratis");
    expect(crm.promoTxt({ promoMrr: 120 })).toBe("USD 120");
  });
  it("próximo hito: fin de promo, renovación anual o inicio de cobro", () => {
    expect(crm.nextMilestone(crm.dealById("w1"))).toBe("Sube a USD 300 en ene 27");
    expect(crm.nextMilestone(crm.dealById("w2"))).toBe("Empieza a pagar en dic 26");
  });
  it("renovación anual: la próxima desde hoy, avanzando de a 12 meses", () => {
    expect(crm.renewal({ plan: "Anual", cierre: "2025-03" })).toBe("2027-03");
    expect(crm.renewal({ plan: "Anual", cierre: "2026-12", renovacion: "2027-11" })).toBe("2027-11");
    expect(crm.renewal({ plan: "Mensual", cierre: "2026-12" })).toBe("");
  });
  it("cliente dado de baja deja de ser activo", () => {
    const c = make((S) => { S.deals.find((d) => d.id === "w1").bajaMes = "2026-11"; });
    expect(c.isActiveClient(c.dealById("w1"))).toBe(false);
    expect(c.isActiveClient(c.dealById("w2"))).toBe(true);
  });
  it("datos de Clientes: activos, arrancando, MRR de la cartera y riesgo", () => {
    const c = crm.clientsData();
    expect(c.act.map((d) => d.id)).toEqual(["w1"]);
    expect(c.arr.map((d) => d.id)).toEqual(["w2"]);
    expect(c.mrrHoy).toBe(120);
    expect(c.risk).toBe(1);
    expect(c.ups.map((d) => d.id)).toEqual(["w1"]);
  });
  it("último contacto", () => {
    expect(crm.lastContact(crm.dealById("w1"))).toBe("Hace 5 días");
    expect(crm.lastContact(crm.dealById("b"))).toBe("–");
  });
});

describe("frenados (rot)", () => {
  const crm = make();
  it("amarillo al 70% del plazo, rojo al pasarlo, nada fuera de etapas abiertas", () => {
    expect(crm.rotLevel({ stage: "lead", stageSince: "2026-11-07" })).toBe(""); // 3 de 5 días
    expect(crm.rotLevel({ stage: "lead", stageSince: "2026-11-06" })).toBe("amber"); // 4 >= ceil(3.5)
    expect(crm.rotLevel({ stage: "lead", stageSince: "2026-11-05" })).toBe("red"); // 5 >= 5
    expect(crm.rotLevel({ stage: "won", stageSince: "2026-01-01" })).toBe("");
  });
  it("acción vencida solo en deals abiertos", () => {
    expect(crm.overdue(crm.dealById("a"))).toBe(true);
    expect(crm.overdue(crm.dealById("c"))).toBe(false);
    expect(crm.overdue(crm.dealById("l1"))).toBe(false);
  });
});

describe("forecast", () => {
  it("clasifica en ganado / commit / best case / pipeline según etapa y estado", () => {
    const f = make().forecastRows().rows;
    const nov = f[0], dic = f[1];
    expect(nov.m).toBe("2026-11");
    expect(nov.won).toBe(120);          // Cliente Uno: ganado y ya pagó (activo), con precio de promo
    expect(nov.commit).toBe(0);
    expect(nov.best).toBe(120);         // Beta: propuesta (60%), cierre noviembre -> 200 * 60%
    expect(nov.pipe).toBe(0);
    expect(dic.won).toBe(0);
    expect(dic.commit).toBe(150 + 400 * 0.8); // Cliente Dos (ganado esperando pago) + Alfa en negociación (80%)
    expect(dic.pipe).toBe(0);
  });
  it("un lead (10%) es pipeline, no best case", () => {
    const feb = make().forecastRows().rows[3];
    expect(feb.m).toBe("2027-02");
    expect(feb.pipe).toBeCloseTo(100 * 0.1, 5); // Gamma
    expect(feb.best).toBe(0);
  });
  it("un deal abierto con cierre vencido se cuenta en el mes actual y se avisa", () => {
    const F = make((S) => { S.deals.find((d) => d.id === "b").cierre = "2026-09"; }).forecastRows();
    expect(F.lateClose).toBe(1);
  });
  it("fin de promo suma la diferencia el mes en que pasa al precio normal", () => {
    const rows = make().forecastRows().rows;
    expect(rows[2].m).toBe("2027-01");
    expect(rows[2].sube).toBe(180); // 300 - 120
  });
  it("proyección acumulada parte del MRR real y descuenta bajas y churn", () => {
    const base = make().forecastRows().rows;
    expect(base[0].proj).toBeCloseTo(1000 + base[0].nuevo, 5);
    const churn = make((S) => { S.config.churnPct = 10; }).forecastRows().rows;
    expect(churn[0].est).toBe(0);
    expect(churn[1].est).toBeLessThan(0);
    const baja = make((S) => { S.deals.find((d) => d.id === "w1").bajaMes = "2027-01"; }).forecastRows().rows;
    expect(baja[2].baja).toBe(-300);
  });
  it("forecastData: pipeline abierto, ponderado y gap a la meta", () => {
    const f = make().forecastData();
    expect(f.open.map((d) => d.id)).toEqual(["a", "b", "c"]);
    expect(f.totOpen).toBe(700);
    expect(f.totW).toBeCloseTo(400 * 0.8 + 200 * 0.6 + 100 * 0.1, 5);
    expect(f.metaRow.m).toBe("2027-01");
    expect(f.gap).toBeCloseTo(f.metaRow.proj - 3000, 5);
    expect(f.lostReasons).toEqual([{ motivo: "Precio", deals: 1, mrr: 250, pct: 100 }]);
  });
  it("el SVG del gráfico tiene una barra por segmento y la etiqueta de cada mes", () => {
    const crm = make();
    const svg = crm.chartSvg(crm.forecastRows().rows);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("nov 26");
    expect(svg).toContain("s-commit");
  });
});

describe("conversión del embudo", () => {
  it("cuenta hasta qué etapa llegó cada deal y el cierre real", () => {
    const rows = make().convStats().rows;
    expect(rows[0].stage.id).toBe("lead");
    expect(rows[0].reached).toBeGreaterThan(0);
    expect(rows.every((r) => r.ok === false)).toBe(true); // hace falta >= 5 cerrados por etapa
  });
  it("se habilita cuando cada etapa tiene al menos 5 deals cerrados", () => {
    const crm = make((S) => {
      for (let i = 0; i < 6; i++) S.deals.push({ id: "x" + i, empresa: "X" + i, stage: "won", mrr: 1, trail: [{ s: "lead", at: "2026-10-01" }, { s: "demo", at: "2026-10-02" }, { s: "prop", at: "2026-10-03" }, { s: "nego", at: "2026-10-04" }, { s: "won", at: "2026-10-05" }], hist: [] });
    });
    const cs = crm.convStats();
    expect(cs.ready).toBe(true);
    expect(cs.rows.every((r) => r.win === 1)).toBe(true);
  });
});

describe("tareas, hoy y alertas", () => {
  const crm = make();
  it("taskItems mezcla tareas y la próxima acción de cada deal (menos los perdidos), ordenado por fecha y hora", () => {
    const items = crm.taskItems(true);
    expect(items.map((x) => x.titulo)).toEqual(["Vieja", "Mandar contrato", "Follow up", "Hacer demo", "Llamar"]);
    expect(items.some((x) => x.deal && x.deal.id === "l1")).toBe(false);
    for (let i = 1; i < items.length; i++) expect(items[i - 1].fecha + items[i - 1].hora <= items[i].fecha + items[i].hora).toBe(true);
  });
  it("filtra por vendedor", () => {
    expect(crm.taskItems(false, "Beto").every((x) => x.vendedor === "Beto")).toBe(true);
  });
  it("kindOf detecta demo, onboarding y el tipo", () => {
    expect(crm.kindOf({ titulo: "Hacer demo", tipo: "tarea" })).toBe("demo");
    expect(crm.kindOf({ titulo: "Onboarding", tipo: "followup" })).toBe("onboarding");
    expect(crm.kindOf({ titulo: "Llamar", tipo: "followup" })).toBe("followup");
  });
  it("dueCounts: vencidas y de hoy (las hechas no cuentan)", () => {
    expect(crm.dueCounts()).toEqual({ v: 2, h: 1 });
  });
  it("taskGroups agrupa vencidas / hoy / próximos 7 días / más adelante", () => {
    const g = crm.taskGroups("", "", false).groups;
    expect(g.map((x) => [x[0], x[1].length])).toEqual([["Vencidas", 2], ["Hoy", 1], ["Próximos 7 días", 1], ["Más adelante", 0]]);
    expect(crm.taskGroups("", "", true).groups.at(-1)[0]).toBe("Hechas");
  });
  it("fmtDay: Hoy / Mañana / fecha", () => {
    expect(crm.fmtDay("2026-11-10")).toBe("Hoy");
    expect(crm.fmtDay("2026-11-11")).toBe("Mañana");
    expect(crm.fmtDay("2026-11-20")).toBe("20 nov");
  });
  it("nextDays: salta fines de semana y termina con 1 y 2 semanas", () => {
    const d = crm.nextDays();
    expect(d[0]).toEqual(["2026-11-11", "Mañana"]);
    expect(d.slice(-2).map((x) => x[1])).toEqual(["En 1 semana", "En 2 semanas"]);
    expect(d.every((x) => { const w = new Date(x[0] + "T12:00:00").getDay(); return w !== 0 && w !== 6 || /semana/.test(x[1]); })).toBe(true);
  });
  it("Hoy: bloques de firmados sin pagar y arranque de clientes", () => {
    const h = crm.hoyData();
    expect(h.unpaid.map((d) => d.id)).toEqual(["w2"]);
    expect(h.todo.every((x) => x.fecha <= "2026-11-10")).toBe(true);
  });
});

describe("calificación de la demo y WhatsApp", () => {
  const crm = make();
  it("puntaje 0 a 4", () => {
    expect(crm.califScore({ calif: { decisor: "si", problema: "x", usaHoy: "y", timing: "ya" } })).toBe(4);
    expect(crm.califScore({ calif: { decisor: "influye", problema: "", usaHoy: "", timing: "mas" } })).toBe(0);
    expect(crm.califScore({ calif: { decisor: "si", timing: "1-3" } })).toBe(2);
    expect(crm.califFilled({ calif: {} })).toBe(false);
  });
  it("etiqueta 'demo sin calificar' si se hizo una demo y no se cargó la calificación", () => {
    expect(crm.califState({ stage: "prop", hist: [{ t: "x", x: "Hecho: Hacer demo" }] })).toBe("sin_calificar");
    expect(crm.califState({ stage: "prop", hist: [{ t: "x", x: "Hecho: Agendar demo" }] })).toBe("");
    expect(crm.califState({ stage: "prop", calif: { decisor: "si" }, hist: [] })).toBe("calificada");
    expect(crm.califState({ stage: "won", hist: [{ t: "x", x: "Hecho: Hacer demo" }] })).toBe("");
  });
  it("mensaje de WhatsApp: usa la plantilla de la próxima acción o la general, con {nombre}, {empresa}, {vendedor}", () => {
    expect(crm.waMsg(crm.dealById("a"))).toBe("Hola Juan, de Ana para Empresa Alfa");
    expect(crm.waMsg({ proxima: "otra cosa", contacto: "", empresa: "Acme SA", vendedor: "Ana" })).toBe("Hola Acme");
  });
  it("link de WhatsApp solo con teléfono de 8+ dígitos", () => {
    expect(crm.waLink(crm.dealById("a")).startsWith("https://wa.me/5493415551234?text=")).toBe(true);
    expect(crm.waLink(crm.dealById("b"))).toBe("");
    expect(crm.waLink({ telefono: "1234567" })).toBe("");
  });
});

describe("pegar conversación", () => {
  const crm = make();
  it("detecta un deal existente por teléfono (últimos 8 dígitos) o nombre", () => {
    expect(crm.pasteMatch({ telefono: "+5493415551234", empresa: "otro" }).id).toBe("a");
    expect(crm.pasteMatch({ telefono: "", empresa: "empresa beta" }).id).toBe("b");
    expect(crm.pasteMatch({ telefono: "", empresa: "xx" })).toBeNull();
  });
  it("convierte nombres de etiquetas a ids ignorando mayúsculas", () => {
    expect(crm.pasteTagIds(["equipo 2–5", "planilla", "no existe"])).toEqual(["t1", "t2"]);
  });
});

describe("texto semanal y datos para la IA", () => {
  const crm = make();
  it("el texto del lunes tiene todas las secciones", () => {
    const t = crm.weeklyText();
    ["*Resumen comercial Spicytool*", "*MRR*", "*Ganados en la semana", "*Perdidos en la semana (1)*", "*Movimientos de etapa*", "*Frenados", "*Tareas vencidas*", "Próximos 7 días:"].forEach((s) => expect(t).toContain(s));
    expect(t).toContain("- Perdido Uno: Precio");
  });
  it("aiData resume deals y tareas pendientes sin campos internos", () => {
    const a = crm.aiData();
    expect(a.deals).toHaveLength(6);
    expect(a.tareasPendientes).toHaveLength(crm.taskItems(true).filter((x) => !x.done).length);
    expect(JSON.stringify(a)).not.toContain("calEventId");
    expect(a.deals.find((d) => d.empresa === "Cliente Uno").cliente.estado).toBe("Activo");
  });
});
