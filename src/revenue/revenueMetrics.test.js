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
