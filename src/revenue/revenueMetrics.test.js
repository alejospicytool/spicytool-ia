import { describe, it, expect } from "vitest";
import { summarize, mrrAt, movementsFor, churnRate, liveSeries, combinedSeries, compareWithHistory, healthAlerts, monthKeyOf, nextMonth, prevMonth, monthsBetween, baselineDate } from "./revenueMetrics.js";

// Cuatro clientes inventados. A y B venían de la carga inicial (3/nov); durante noviembre: C nuevo, B contrae, D se va.
const customers = [
  { key: "a", mrr: 300 }, { key: "b", mrr: 80 }, { key: "c", mrr: 150 }, { key: "d", mrr: 0 }, { key: "e", mrr: 0 },
];
const ev = (customer_key, date, type, delta, baseline = false) => ({ customer_key, date, type, delta, baseline });
const events = [
  ev("a", "2026-11-03T15:00:00Z", "baseline", 300, true),
  ev("b", "2026-11-03T15:00:00Z", "baseline", 100, true),
  ev("d", "2026-11-03T15:00:00Z", "baseline", 60, true),
  ev("c", "2026-11-05T15:00:00Z", "new", 150),
  ev("b", "2026-11-06T15:00:00Z", "contraction", -20),
  ev("d", "2026-11-07T15:00:00Z", "churn", -60),
];

describe("fechas de Buenos Aires", () => {
  it("el mes sigue la hora de Argentina (1/dic 01:00 UTC todavía es 30/nov allá)", () => {
    expect(monthKeyOf("2026-12-01T01:00:00Z")).toBe("2026-11");
    expect(monthKeyOf("2026-12-01T03:00:00Z")).toBe("2026-12");
  });
  it("mes siguiente / anterior / rango", () => {
    expect(nextMonth("2026-12")).toBe("2027-01"); expect(prevMonth("2027-01")).toBe("2026-12");
    expect(monthsBetween("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });
});

describe("resumen", () => {
  it("MRR, ARR, clientes que pagan y ARPA", () => {
    expect(summarize(customers)).toEqual({ mrr: 530, arr: 6360, customers: 3, arpa: 176.67 });
    expect(summarize([])).toEqual({ mrr: 0, arr: 0, customers: 0, arpa: 0 });
  });
});

describe("MRR en un instante pasado (hoy menos los movimientos posteriores)", () => {
  it("al momento de la carga inicial", () => {
    expect(mrrAt(customers, events, new Date("2026-11-03T16:00:00Z"))).toEqual({ mrr: 460, customers: 3 });
  });
  it("después del alta de C y antes de la contracción", () => {
    expect(mrrAt(customers, events, new Date("2026-11-05T16:00:00Z"))).toEqual({ mrr: 610, customers: 4 });
  });
  it("hoy coincide con la suma de clientes", () => {
    expect(mrrAt(customers, events, new Date("2026-11-30T00:00:00Z"))).toEqual({ mrr: 530, customers: 3 });
  });
});

describe("movimientos del mes", () => {
  it("no cuenta la carga inicial como 'nuevos' y suma por tipo", () => {
    const m = movementsFor(events, "2026-11");
    expect(m.new).toEqual({ count: 1, mrr: 150 });
    expect(m.contraction).toEqual({ count: 1, mrr: -20 });
    expect(m.churn).toEqual({ count: 1, mrr: -60 });
    expect(m.expansion).toEqual({ count: 0, mrr: 0 });
    expect(m.net).toBe(70);
    expect(movementsFor(events, "2026-10").net).toBe(0);
  });
});

describe("churn de clientes", () => {
  it("bajas del mes / clientes al inicio del mes (la base la dan los movimientos desde la carga inicial)", () => {
    // Inicio de noviembre (antes de la carga inicial) el motor no sabe nada: sin base no se inventa una tasa
    expect(churnRate(customers, events, "2026-11")).toBeNull();
    // Diciembre: arrancó con 3 clientes (A, B, C); si en diciembre se va uno, 1/3
    const dic = [...events, ev("a", "2026-12-10T15:00:00Z", "churn", -300)];
    const cs = customers.map((c) => (c.key === "a" ? { ...c, mrr: 0 } : c));
    const r = churnRate(cs, dic, "2026-12");
    expect(r.startCustomers).toBe(3);
    expect(r.rate).toBeCloseTo(1 / 3);
  });
  it("sin carga inicial no hay churn calculable", () => {
    expect(churnRate(customers, [], "2026-11")).toBeNull();
  });
});

describe("series e histórico", () => {
  const history = [
    { month: "2026-08", data: { mrr_usd: 5000, clientes_pagos: 40, parcial: "no" } },
    { month: "2026-10", data: { mrr_usd: 5500, clientes_pagos: 42, parcial: "no" } },
    { month: "2026-11", data: { mrr_usd: 5600, clientes_pagos: 43, parcial: "si" } },
  ];
  it("la serie nueva arranca en el mes de la carga inicial y el último punto es parcial", () => {
    const live = liveSeries(customers, events, new Date("2026-11-10T15:00:00Z"));
    expect(live).toEqual([{ month: "2026-11", mrr: 530, customers: 3, source: "nuevo", partial: true }]);
  });
  it("histórico hasta el mes anterior a lo nuevo; el parcial de ChartMogul se descarta; todo ordenado", () => {
    const live = liveSeries(customers, events, new Date("2026-11-10T15:00:00Z"));
    const s = combinedSeries(history.slice().reverse(), live);
    expect(s.map((p) => `${p.month}:${p.source}`)).toEqual(["2026-08:chartmogul", "2026-10:chartmogul", "2026-11:nuevo"]);
  });
  it("sin carga inicial se ve solo el histórico cerrado", () => {
    expect(combinedSeries(history, []).map((p) => p.month)).toEqual(["2026-08", "2026-10"]);
  });
  it("comparación con el último mes cerrado de ChartMogul", () => {
    expect(compareWithHistory(history, 5430)).toEqual({ month: "2026-10", chartmogulMrr: 5500, diff: -70 });
    expect(compareWithHistory([], 1)).toBeNull();
  });
  it("fecha de la carga inicial", () => {
    expect(baselineDate(events).toISOString()).toBe("2026-11-03T15:00:00.000Z");
    expect(baselineDate([])).toBeNull();
  });
});

describe("avisos", () => {
  const now = new Date("2026-11-12T12:00:00Z");
  const codes = (o) => healthAlerts({ now, ...o }).map((a) => a.code);
  it("sin carga inicial", () => { expect(codes({ events: [] })).toEqual(["sin_baseline"]); });
  it("planes sin clasificar", () => {
    expect(codes({ events, runs: [{ at: "2026-11-12T06:00:00Z", errors: [], stale: 0 }], plans: [{ category: "saas" }, { category: "sin_clasificar" }] })).toEqual(["sin_clasificar"]);
  });
  it("el chequeo nocturno no corrió, o está viejo", () => {
    expect(codes({ events, runs: [] })).toEqual(["sin_corridas"]);
    expect(codes({ events, runs: [{ at: "2026-11-10T06:00:00Z", errors: [], stale: 0 }] })).toEqual(["chequeo_viejo"]);
  });
  it("errores y suscripciones perdidas de la última corrida", () => {
    expect(codes({ events, runs: [{ at: "2026-11-12T06:00:00Z", errors: [{ customerKey: "x", error: "Falta tipo de cambio" }], stale: 2 }] })).toEqual(["errores", "perdidas"]);
  });
  it("todo en orden: sin avisos", () => {
    expect(codes({ events, runs: [{ at: "2026-11-12T06:00:00Z", errors: [], stale: 0 }], plans: [{ category: "saas" }] })).toEqual([]);
  });
});

// ══ Tablero tipo Revenue Dashboard ═══════════════════════════════════════════════════════════════════
import { monthlyRows, periodRows, periodKpis, customerMonthly, segmentSummary, matchSegment, projectionMonths, projectionDefaults, computeProjection, failuresSummary, liveCustomerKeys, baselineEnd } from "./revenueMetrics.js";

const H = (month, mrr, clientes, o = {}) => ({ month, data: { mrr_usd: mrr, clientes_pagos: clientes, new_mrr: 0, expansion_mrr: 0, contraction_mrr: 0, churn_mrr: 0, churn_clientes: 0, reactivation_mrr: 0, new_clientes: 0, parcial: "no", ...o } });
const hist = [
  H("2026-06", 10950, 30),
  H("2026-07", 11240, 37, { new_mrr: 400, expansion_mrr: 150, churn_mrr: -260, churn_clientes: 3 }),
  H("2026-08", 12390, 38, { new_mrr: 720, expansion_mrr: 700, contraction_mrr: -70, churn_mrr: -200, churn_clientes: 1 }),
  H("2026-09", 12590, 39, { new_mrr: 510, churn_mrr: -560, churn_clientes: 3, reactivation_mrr: 250 }),
  H("2026-10", 8765, 40),
  H("2026-11", 8615, 41, { parcial: "si" }),
];

describe("monthlyRows: histórico de ChartMogul", () => {
  const rows = monthlyRows({ history: hist, customers: [], events: [], now: new Date("2026-11-10T15:00:00Z") });
  it("usa solo meses cerrados y deja los movimientos en positivo", () => {
    expect(rows.map((r) => r.month)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    const ago = rows.find((r) => r.month === "2026-08");
    expect(ago).toMatchObject({ mrr: 12390, customers: 38, newBiz: 720, expansion: 700, contraction: 70, churn: 200, churnClients: 1, source: "chartmogul" });
  });
  it("retención neta con la fórmula del prototipo: (inicio + expansión − contracción − churn) / inicio", () => {
    const ago = rows.find((r) => r.month === "2026-08");
    expect(ago.startMrr).toBe(11240);
    expect(ago.nrr).toBeCloseTo(103.83, 2);                       // el prototipo mostraba 103,8
    expect(rows.find((r) => r.month === "2026-07").nrr).toBeCloseTo(((10950 + 150 - 260) / 10950) * 100, 2);
  });
  it("churn % = bajas / clientes al inicio del mes; ARPA = MRR / clientes; neto incluye reactivación y contracción", () => {
    const ago = rows.find((r) => r.month === "2026-08");
    expect(ago.churnPct).toBeCloseTo((1 / 37) * 100, 2);
    expect(ago.arpa).toBeCloseTo(12390 / 38, 2);
    expect(ago.net).toBe(1150);                                    // 720 + 700 − 70 − 200
    expect(rows.find((r) => r.month === "2026-09").net).toBe(510 + 250 - 560);
  });
  it("el primer mes no tiene base de comparación", () => {
    expect(rows[0].startMrr).toBeNull(); expect(rows[0].nrr).toBeNull(); expect(rows[0].churnPct).toBeNull();
  });
});

describe("monthlyRows: empalme con el sistema nuevo", () => {
  // La carga inicial se registra cliente por cliente (horas distintas) y el mes sigue con movimientos reales
  const evs = [
    ev("a", "2026-11-03T15:00:00.000Z", "baseline", 300, true),
    ev("b", "2026-11-03T15:00:02.000Z", "baseline", 100, true),
    ev("d", "2026-11-03T15:00:05.000Z", "baseline", 60, true),
    ev("c", "2026-11-05T15:00:00Z", "new", 150),
    ev("b", "2026-11-06T15:00:00Z", "contraction", -20),
    ev("d", "2026-11-07T15:00:00Z", "churn", -60),
  ];
  const now = new Date("2026-11-10T15:00:00Z");
  const rows = monthlyRows({ history: hist, customers, events: evs, now });
  it("histórico hasta octubre y sistema nuevo desde noviembre (el parcial de ChartMogul no se usa)", () => {
    expect(rows.map((r) => `${r.month}:${r.source}`).slice(-2)).toEqual(["2026-10:chartmogul", "2026-11:nuevo"]);
    expect(rows.at(-1)).toMatchObject({ mrr: 530, customers: 3, newBiz: 150, contraction: 20, churn: 60, churnClients: 1, partial: true });
  });
  it("el inicio del mes nuevo es el MRR tras la carga inicial (no el de ChartMogul, que suma otros planes)", () => {
    const nov = rows.at(-1);
    expect(baselineEnd(evs).toISOString()).toBe("2026-11-03T15:00:05.000Z");
    expect(nov.startMrr).toBe(460);                                 // 300 + 100 + 60
    expect(nov.startCustomers).toBe(3);
    expect(nov.nrr).toBeCloseTo(((460 - 20 - 60) / 460) * 100, 2);
    expect(nov.churnPct).toBeCloseTo((1 / 3) * 100, 2);
  });
});

describe("períodos y KPIs", () => {
  const rows = monthlyRows({ history: hist, customers: [], events: [], now: new Date("2026-10-28T15:00:00Z") });
  const now = new Date("2026-10-28T15:00:00Z");
  it("presets de período", () => {
    expect(periodRows(rows, "month", now).map((r) => r.month)).toEqual(["2026-10"]);
    expect(periodRows(rows, "last4", now).map((r) => r.month)).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(periodRows(rows, "year", now)).toHaveLength(5);
    expect(periodRows(rows, "all", now)).toHaveLength(5);
  });
  it("KPIs: acumulados, crecimiento, mejor new biz, churn máx/mín/prom, NRR", () => {
    const k = periodKpis(periodRows(rows, "last4", now));
    expect(k.newTotal).toBe(400 + 720 + 510);
    expect(k.churnTotal).toBe(260 + 200 + 560);
    expect(k.growthPct).toBe(Math.round(((8765 - 11240) / 11240) * 100));
    expect(k.bestNew.month).toBe("2026-08");
    expect(k.churnMax.month).toBe("2026-07");                       // 3 de 30 = 10%
    expect(k.churnMin.month).toBe("2026-10");                       // 0 bajas
    expect(k.nrrBest.month).toBe("2026-08");
    expect(periodKpis([])).toBeNull();
  });
});

describe("clientes por mes y segmentos", () => {
  const evs = [ev("a", "2026-10-03T15:00:00Z", "baseline", 300, true), ev("b", "2026-10-03T15:00:01Z", "baseline", 100, true), ev("b", "2026-11-06T15:00:00Z", "contraction", -20)];
  const cs = [{ key: "a", mrr: 300, segment: "inmobiliaria" }, { key: "b", mrr: 80, segment: "otro" }, { key: "c", mrr: 50, segment: null }, { key: "d", mrr: 0, segment: "otro" }];
  it("MRR de cada cliente al cierre de cada mes", () => {
    const m = customerMonthly(cs, evs, ["2026-10", "2026-11"], new Date("2026-11-10T15:00:00Z"));
    expect(m.a).toEqual({ "2026-10": 300, "2026-11": 300 });
    expect(m.b).toEqual({ "2026-10": 100, "2026-11": 80 });
    expect(m.d).toEqual({});
  });
  it("resumen por segmento (solo los que pagan; sin segmento aparte) y filtro", () => {
    expect(segmentSummary(cs)).toEqual({ inmobiliaria: { mrr: 300, customers: 1 }, otro: { mrr: 80, customers: 1 }, sin: { mrr: 50, customers: 1 } });
    expect(cs.filter((c) => matchSegment(c, "otro")).map((c) => c.key)).toEqual(["b", "d"]);
    expect(cs.filter((c) => matchSegment(c, "sin")).map((c) => c.key)).toEqual(["c"]);
    expect(cs.filter((c) => matchSegment(c, "todos"))).toHaveLength(4);
  });
});

describe("proyección (mismo cálculo que el prototipo)", () => {
  it("meses a proyectar: los 4 siguientes al actual", () => {
    expect(projectionMonths(new Date("2026-11-10T15:00:00Z"))).toEqual(["2026-12", "2027-01", "2027-02", "2027-03"]);
  });
  it("supuestos iniciales = promedio de los últimos 6 meses reales", () => {
    const rows = monthlyRows({ history: hist, customers: [], events: [], now: new Date("2026-10-28T15:00:00Z") });
    const d = projectionDefaults(rows);
    const r = rows.slice(-6).filter((x) => x.startMrr);
    expect(d.churnPct).toBeCloseTo(Math.round((r.reduce((s, x) => s + x.churn / x.startMrr, 0) / r.length) * 1000) / 10, 5);
    expect(d.newBiz).toBe(Math.round(rows.slice(-6).reduce((s, x) => s + x.newBiz, 0) / rows.slice(-6).length));
    expect(projectionDefaults([])).toEqual({ churnPct: 0, newBiz: 0, expansion: 0 });
  });
  it("el churn solo corre sobre el MRR 'automático' (sin los clientes por fuera) y suma new biz y expansión", () => {
    const proj = { churnPct: [5, 5], newBiz: [500, 600], expansion: [100, 100], extra: [{ name: "Directo", base: 100, mrr: [100, 100] }] };
    const r = computeProjection(12400, proj, ["2026-11", "2026-12"]);
    expect(r.manualBase).toBe(100);
    expect(r.rows[0]).toMatchObject({ start: 12400, nb: 500, ex: 100, churn: 615, manual: 100, dManual: 0 });
    expect(r.rows[0].total).toBe(12385);
    expect(r.rows[1].churn).toBeCloseTo(614.25, 2);
    expect(r.rows[1].total).toBeCloseTo(12470.75, 2);          // 12285 − 614,25 + 600 + 100 + 100 por fuera
  });
  it("simular una baja de un cliente por fuera (poner 0) o sumar uno proyectado", () => {
    const base = { churnPct: [0], newBiz: [0], expansion: [0] };
    const baja = computeProjection(1000, { ...base, extra: [{ name: "X", base: 200, mrr: [0] }] }, ["m"]);
    expect(baja.rows[0]).toMatchObject({ dManual: -200, total: 800 });
    const nuevo = computeProjection(1000, { ...base, extra: [{ name: "Nuevo", base: 0, mrr: [300] }] }, ["m"]);
    expect(nuevo.rows[0].total).toBe(1300);
  });
});

describe("pagos fallidos", () => {
  const now = new Date("2026-11-10T15:00:00Z");
  const cs = [{ key: "stripe:a", mrr: 300, name: "A" }, { key: "stripe:b", mrr: 150, name: "B" }, { key: "stripe:c", mrr: 0, name: "C" }];
  const f = (invoice_id, customer_key, status, o = {}) => ({ invoice_id, customer_key, status, amount_due: 100, first_failed_at: "2026-11-05T12:00:00Z", resolved_at: null, ...o });
  const failures = [
    f("in_1", "stripe:a", "open"), f("in_2", "stripe:a", "open", { first_failed_at: "2026-11-08T12:00:00Z" }), f("in_3", "stripe:b", "open", { first_failed_at: "2026-11-01T12:00:00Z", amount_due: 40 }),
    f("in_4", "stripe:c", "recovered", { resolved_at: "2026-11-07T12:00:00Z", amount_due: 60 }), f("in_5", "stripe:b", "uncollectible", { resolved_at: "2026-11-09T12:00:00Z" }),
    f("in_6", "stripe:b", "recovered", { resolved_at: "2026-10-20T12:00:00Z" }),
  ];
  const evs = [ev("stripe:c", "2026-11-09T12:00:00Z", "churn", -50), ev("stripe:b", "2026-11-09T13:00:00Z", "churn", -150), ev("stripe:x", "2026-10-02T12:00:00Z", "churn", -10)];
  const r = failuresSummary({ failures, customers: cs, involuntaryKeys: new Set(["stripe:c"]), events: evs, now });
  it("abiertas: ordenadas por antigüedad, con días abiertas y cliente; monto total", () => {
    expect(r.open.map((x) => x.invoice_id)).toEqual(["in_3", "in_1", "in_2"]);
    expect(r.open[0].daysOpen).toBe(9);
    expect(r.open[0].customer.name).toBe("B");
    expect(r.openCount).toBe(3); expect(r.openAmount).toBe(240);
  });
  it("MRR en riesgo cuenta una sola vez a cada cliente aunque tenga varias facturas fallidas", () => {
    expect(r.mrrAtRisk).toBe(450); expect(r.customersAtRisk).toBe(2);
  });
  it("recuperados del mes y tasa de recuperación (recuperadas / cerradas del mes)", () => {
    expect(r.recoveredCount).toBe(1); expect(r.recoveredAmount).toBe(60);
    expect(r.recoveryRate).toBe(50);                                // 1 recuperada y 1 incobrable en noviembre
  });
  it("churn involuntario del mes: bajas de clientes cuya suscripción se canceló por falta de pago", () => {
    expect(r.involuntary).toEqual({ count: 1, mrr: 50, of: 2 });
  });
  it("deuda histórica: las facturas de clientes SIN suscripción viva no cuentan como 'para cobrar' ni como MRR en riesgo", () => {
    const live = liveCustomerKeys([{ customer_key: "stripe:a", status: "past_due" }, { customer_key: "stripe:b", status: "canceled" }, { customer_key: "stripe:x", status: "trialing" }]);
    expect([...live].sort()).toEqual(["stripe:a", "stripe:x"]);
    const s = failuresSummary({ failures, customers: cs, liveKeys: live, involuntaryKeys: new Set(["stripe:c"]), events: evs, now });
    expect(s.open.map((x) => x.invoice_id)).toEqual(["in_1", "in_2"]);       // solo las de A
    expect(s.openCount).toBe(2); expect(s.openAmount).toBe(200);
    expect(s.legacy.map((x) => x.invoice_id)).toEqual(["in_3"]);               // la de B queda como histórica
    expect(s.legacyCount).toBe(1); expect(s.legacyAmount).toBe(40);
    expect(s.mrrAtRisk).toBe(300); expect(s.customersAtRisk).toBe(1);          // B ya no infla el riesgo
    // los recuperados del mes no dependen de la suscripción
    expect(s.recoveredCount).toBe(1);
  });
  it("sin liveKeys todas cuentan como activas (compatibilidad)", () => {
    expect(r.legacyCount).toBe(0); expect(r.openCount).toBe(3);
  });
  it("sin datos no inventa nada", () => {
    const e = failuresSummary({ now });
    expect(e).toMatchObject({ openCount: 0, openAmount: 0, mrrAtRisk: 0, recoveredCount: 0, recoveryRate: null, involuntary: { count: 0, mrr: 0, of: 0 } });
  });
});
