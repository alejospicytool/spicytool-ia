import { describe, it, expect } from "vitest";
import { chargeAmount, nextCharge, chargeText, nextChargeOfCustomer, upcomingCharges, groupByDay, dayLabel } from "./proximoCobro.js";

const NOW = new Date("2026-11-25T15:00:00Z"); // 12:00 en Argentina
const sub = (over = {}) => ({ id: "stripe:s1", customer_key: "stripe:c1", status: "active", currency: "usd", items: [{ unitAmount: 40000, quantity: 1 }], discount: null, current_period_end: "2026-12-05T15:00:00Z", cancel_at_period_end: false, ...over });

describe("chargeAmount", () => {
  it("suma los ítems (centavos → unidades) con su cantidad", () => {
    expect(chargeAmount(sub({ items: [{ unitAmount: 30000, quantity: 2 }, { unitAmount: 1050, quantity: 1 }] }))).toBe(610.5);
    expect(chargeAmount(sub({ items: [] }))).toBe(0);
    expect(chargeAmount(null)).toBe(0);
  });
  it("aplica el descuento solo si todavía vale ese día", () => {
    const at = new Date("2026-12-05T00:00:00Z");
    expect(chargeAmount(sub({ discount: { percentOff: 25, endsAt: null } }), at)).toBe(300);
    expect(chargeAmount(sub({ discount: { amountOff: 5000, endsAt: "2027-01-01T00:00:00Z" } }), at)).toBe(350);
    expect(chargeAmount(sub({ discount: { percentOff: 25, endsAt: "2026-12-01T00:00:00Z" } }), at)).toBe(400); // ya venció
    expect(chargeAmount(sub({ discount: { amountOff: 999999 } }), at)).toBe(0); // nunca negativo
  });
});

describe("nextCharge", () => {
  it("cobro normal: fecha en hora argentina, días que faltan y monto", () => {
    const n = nextCharge(sub(), NOW);
    expect(n).toMatchObject({ iso: "2026-12-05", days: 10, kind: "cobro", vencida: false, amount: 400, currency: "usd" });
  });
  it("tipos: cancela al final, pago atrasado y prueba", () => {
    expect(nextCharge(sub({ cancel_at_period_end: true }), NOW).kind).toBe("cancela");
    expect(nextCharge(sub({ status: "past_due" }), NOW).kind).toBe("atrasado");
    expect(nextCharge(sub({ status: "trialing" }), NOW).kind).toBe("prueba");
    expect(nextCharge(sub({ status: "past_due", cancel_at_period_end: true }), NOW).kind).toBe("cancela");
  });
  it("sin próximo cobro: cancelada, impaga, sin fecha o fecha rota", () => {
    expect(nextCharge(sub({ status: "canceled" }), NOW)).toBeNull();
    expect(nextCharge(sub({ status: "unpaid" }), NOW)).toBeNull();
    expect(nextCharge(sub({ current_period_end: null }), NOW)).toBeNull();
    expect(nextCharge(sub({ current_period_end: "no-es-fecha" }), NOW)).toBeNull();
    expect(nextCharge(null, NOW)).toBeNull();
  });
  it("fecha ya pasada: queda marcada como vencida (dato viejo)", () => {
    expect(nextCharge(sub({ current_period_end: "2026-11-20T15:00:00Z" }), NOW)).toMatchObject({ vencida: true, days: -5 });
  });
  it("el día se cuenta en hora argentina (03:00 UTC del 5 es todavía el 4 a la noche)", () => {
    expect(nextCharge(sub({ current_period_end: "2026-12-05T02:00:00Z" }), NOW).iso).toBe("2026-12-04");
  });
});

describe("chargeText", () => {
  it("frases para cada caso", () => {
    expect(chargeText(nextCharge(sub(), NOW)).text).toBe("Próximo cobro: 05/12/2026 (en 10 días) · USD 400");
    expect(chargeText(nextCharge(sub({ current_period_end: "2026-11-26T15:00:00Z" }), NOW)).text).toContain("(mañana)");
    expect(chargeText(nextCharge(sub({ current_period_end: "2026-11-25T20:00:00Z" }), NOW)).text).toContain("(hoy)");
    expect(chargeText(nextCharge(sub({ cancel_at_period_end: true }), NOW))).toEqual({ text: "Se cancela el 05/12/2026 (en 10 días): no se renueva", tone: "bad" });
    expect(chargeText(nextCharge(sub({ status: "past_due" }), NOW)).tone).toBe("warn");
    expect(chargeText(nextCharge(sub({ status: "trialing" }), NOW)).text).toContain("Termina la prueba");
    expect(chargeText(nextCharge(sub({ current_period_end: "2026-11-20T15:00:00Z" }), NOW))).toMatchObject({ tone: "warn", text: expect.stringContaining("a confirmar") });
    expect(chargeText(null)).toBeNull();
  });
  it("monto con decimales y miles en formato argentino", () => {
    expect(chargeText(nextCharge(sub({ items: [{ unitAmount: 123456, quantity: 1 }] }), NOW)).text).toContain("USD 1.234,56");
  });
});

describe("nextChargeOfCustomer", () => {
  it("elige la fecha más cercana entre las suscripciones vivas", () => {
    const n = nextChargeOfCustomer([sub({ current_period_end: "2026-12-20T15:00:00Z" }), sub({ id: "b", current_period_end: "2026-12-02T15:00:00Z" }), sub({ id: "c", status: "canceled" })], NOW);
    expect(n.iso).toBe("2026-12-02");
    expect(nextChargeOfCustomer([], NOW)).toBeNull();
  });
});

describe("upcomingCharges", () => {
  const customers = [{ key: "stripe:c1", name: "Ana" }, { key: "stripe:c2", name: "Beto" }, { key: "stripe:c3", name: "Carla" }, { key: "stripe:c4", name: "Dani" }];
  const subs = [
    sub({ id: "a", customer_key: "stripe:c1", current_period_end: "2026-11-27T15:00:00Z" }),
    sub({ id: "b", customer_key: "stripe:c2", current_period_end: "2026-12-05T15:00:00Z", cancel_at_period_end: true, items: [{ unitAmount: 4000, quantity: 1 }] }),
    sub({ id: "c", customer_key: "stripe:c3", current_period_end: "2026-12-03T15:00:00Z", status: "past_due", items: [{ unitAmount: 30000, quantity: 1 }] }),
    sub({ id: "d", customer_key: "stripe:c4", current_period_end: "2027-02-01T15:00:00Z" }),
    sub({ id: "e", customer_key: "stripe:c4", current_period_end: "2026-11-20T15:00:00Z" }),
    sub({ id: "f", customer_key: "stripe:c1", status: "canceled" }),
    sub({ id: "g", customer_key: "stripe:c2", current_period_end: "2026-12-10T15:00:00Z", currency: "ars", items: [{ unitAmount: 1000000, quantity: 1 }] }),
  ];
  it("incluye lo que vence dentro del rango y las fechas vencidas; ordena por fecha", () => {
    const { rows } = upcomingCharges(subs, customers, { now: NOW, days: 30 });
    expect(rows.map((r) => r.sub.id)).toEqual(["e", "a", "c", "b", "g"]);
    expect(rows[1].customer.name).toBe("Ana");
  });
  it("el rango se achica y se agranda", () => {
    expect(upcomingCharges(subs, customers, { now: NOW, days: 7 }).rows.map((r) => r.sub.id)).toEqual(["e", "a"]);
    expect(upcomingCharges(subs, customers, { now: NOW, days: 90 }).rows.map((r) => r.sub.id)).toContain("d");
  });
  it("totales: separa lo esperado, lo que se cancela, lo atrasado y lo vencido; otra moneda no se mezcla", () => {
    const { totals } = upcomingCharges(subs, customers, { now: NOW, days: 30 });
    expect(totals).toEqual({ expected: 400, expectedCount: 1, cancel: 40, cancelCount: 1, late: 300, lateCount: 1, vencidas: 1, otherCurrency: 1 });
  });
  it("sin datos no rompe", () => {
    expect(upcomingCharges(null, null, { now: NOW }).rows).toEqual([]);
  });
});

describe("groupByDay / dayLabel", () => {
  it("agrupa por día con el total esperado y deja los vencidos primero", () => {
    const customers = [{ key: "stripe:c1", name: "Ana" }];
    const subs = [sub({ id: "a", current_period_end: "2026-11-27T15:00:00Z" }), sub({ id: "b", current_period_end: "2026-11-27T18:00:00Z", items: [{ unitAmount: 10000, quantity: 1 }] }), sub({ id: "c", current_period_end: "2026-11-26T15:00:00Z", cancel_at_period_end: true }), sub({ id: "d", current_period_end: "2026-11-20T15:00:00Z" })];
    const g = groupByDay(upcomingCharges(subs, customers, { now: NOW, days: 30 }).rows);
    expect(g.map((x) => [x.key, x.rows.length, x.total])).toEqual([["vencida", 1, 0], ["2026-11-26", 1, 0], ["2026-11-27", 2, 500]]);
    expect(g.map(dayLabel)).toEqual(["Fecha vencida: a confirmar", "Mañana 26/11", "viernes 27/11"]);
  });
});
