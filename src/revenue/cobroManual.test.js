import { describe, it, expect } from "vitest";
import { addMonthsISO, isCobro, coverageEnd, monthsOfCobro, previewCobro, liveCobros, cobroText, cobroAlerts } from "./cobroManual.js";

const NOW = new Date("2026-11-27T15:00:00Z"); // 27/11/2026 12:00 en Buenos Aires
const cobro = (over = {}) => ({ id: "manual:1", customer_key: "stripe:cus_1", source: "manual", status: "active", currency: "usd", items: [{ priceId: "pa", unitAmount: 72000, quantity: 1, interval: "month", intervalCount: 12 }], current_period_end: "2027-11-27T03:00:00.000Z", ...over });

describe("addMonthsISO", () => {
  it("suma meses y respeta el fin de mes", () => {
    expect(addMonthsISO("2026-11-27", 12)).toBe("2027-11-27");
    expect(addMonthsISO("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonthsISO("2027-11-27", -12)).toBe("2026-11-27");
  });
});

describe("previewCobro", () => {
  it("MRR = monto ÷ meses y fecha de vencimiento (un año con descuento, un semestre, otro plazo)", () => {
    expect(previewCobro({ amount: "720", months: 12, paidAt: "2026-11-27" }, NOW)).toMatchObject({ ok: true, mrr: 60, end: "2027-11-27", months: 12 });
    expect(previewCobro({ amount: "300", months: "6" }, NOW)).toMatchObject({ ok: true, mrr: 50, end: "2027-05-27" });
    expect(previewCobro({ amount: "1000", months: 12 }, NOW).mrr).toBe(83.33);
    expect(previewCobro({ amount: "99,5", months: 3 }, NOW)).toMatchObject({ ok: true, amount: 99.5, mrr: 33.17 });
  });
  it("explica qué falta: monto, meses, fecha futura o cobro ya vencido", () => {
    expect(previewCobro({ amount: "", months: 12 }, NOW).ok).toBe(false);
    expect(previewCobro({ amount: "0", months: 12 }, NOW).error).toMatch(/monto/);
    for (const m of [0, 37, 1.5, "x", ""]) expect(previewCobro({ amount: 10, months: m }, NOW).error).toMatch(/meses/);
    expect(previewCobro({ amount: 10, months: 12, paidAt: "2026-12-05" }, NOW).error).toMatch(/futura/);
    expect(previewCobro({ amount: 10, months: 12, paidAt: "ayer" }, NOW).error).toMatch(/no es válida/);
    expect(previewCobro({ amount: 10, months: 6, paidAt: "2026-01-05" }, NOW).error).toMatch(/ya venció el 05\/07\/2026/);
  });
});

describe("cobro manual en la lista de clientes", () => {
  it("reconoce un cobro (manual con vencimiento), hasta cuándo cubre y cuántos meses", () => {
    expect(isCobro(cobro())).toBe(true);
    expect(isCobro(cobro({ current_period_end: null }))).toBe(false); // manual mensual sin fecha
    expect(isCobro(cobro({ source: "stripe" }))).toBe(false);
    expect(coverageEnd(cobro())).toBe("2027-11-27");
    expect(monthsOfCobro(cobro())).toBe(12);
    expect(monthsOfCobro(cobro({ items: [{ interval: "year", intervalCount: 1, unitAmount: 1 }] }))).toBe(12);
  });
  it("liveCobros: solo los vivos y no vencidos; si hay dos, el que vence más tarde", () => {
    const viejo = cobro({ id: "a", current_period_end: "2027-03-01T03:00:00.000Z" }), nuevo = cobro({ id: "b" });
    const vencido = cobro({ id: "c", customer_key: "stripe:cus_2", current_period_end: "2026-11-01T03:00:00.000Z" });
    const baja = cobro({ id: "d", customer_key: "stripe:cus_3", status: "canceled" });
    const r = liveCobros([viejo, nuevo, vencido, baja], NOW);
    expect(Object.keys(r).sort()).toEqual(["stripe:cus_1"]);
    expect(r["stripe:cus_1"].id).toBe("b");
  });
  it("texto: cubre hasta…, por vencer (aviso para renovar) y vencido", () => {
    expect(cobroText(cobro(), NOW)).toEqual({ text: "Cobro manual de 12 meses: cubre hasta el 27/11/2027", tone: "ok" });
    expect(cobroText(cobro({ current_period_end: "2026-12-10T03:00:00.000Z" }), NOW)).toMatchObject({ tone: "warn", text: expect.stringContaining("hay que renovarlo") });
    expect(cobroText(cobro({ current_period_end: "2026-11-20T03:00:00.000Z" }), NOW)).toMatchObject({ tone: "warn", text: expect.stringContaining("venció el 20/11/2026") });
    expect(cobroText(cobro({ status: "canceled" }), NOW)).toBeNull();
    expect(cobroText(cobro({ current_period_end: null }), NOW)).toBeNull();
  });
});

describe("cobroAlerts", () => {
  const customers = [{ key: "stripe:cus_1", name: "Alvaro Greco", mrr: 60 }, { key: "stripe:cus_2", name: "Fermin Toscano", mrr: 0 }];
  it("avisa cuando un cobro venció y el MRR todavía lo cuenta", () => {
    const a = cobroAlerts({ subs: [cobro({ current_period_end: "2026-11-20T03:00:00.000Z" })], customers, now: NOW });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ code: "cobro_vencido", level: "warn", tab: "planes" });
    expect(a[0].text).toContain("Alvaro Greco");
  });
  it("si el MRR del cliente ya bajó a 0, no hay nada que avisar", () => {
    expect(cobroAlerts({ subs: [cobro({ customer_key: "stripe:cus_2", current_period_end: "2026-11-20T03:00:00.000Z" })], customers, now: NOW })).toEqual([]);
  });
  it("avisa los que vencen en los próximos 30 días y no los lejanos", () => {
    const a = cobroAlerts({ subs: [cobro({ current_period_end: "2026-12-15T03:00:00.000Z" })], customers, now: NOW });
    expect(a[0]).toMatchObject({ code: "cobro_por_vencer", level: "info", tab: "clientes" });
    expect(cobroAlerts({ subs: [cobro()], customers, now: NOW })).toEqual([]);
  });
  it("ignora suscripciones de Stripe y bajas", () => {
    expect(cobroAlerts({ subs: [cobro({ source: "stripe", current_period_end: "2026-11-20T03:00:00.000Z" }), cobro({ status: "canceled", current_period_end: "2026-11-20T03:00:00.000Z" })], customers, now: NOW })).toEqual([]);
  });
});
