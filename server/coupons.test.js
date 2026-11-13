import { describe, it, expect } from "vitest";
import { COUPONS } from "./coupons.js";
import { makeWebhookClient } from "./webhooks.js";
import { vi } from "vitest";

describe("lista de cupones", () => {
  it("cada cupón tiene id promo_…, código, descripción y un descuento válido (los errores de tipeo acá cobrarían de menos o de más)", () => {
    expect(COUPONS.length).toBeGreaterThan(0);
    for (const c of COUPONS) {
      expect(c.id).toMatch(/^promo_[A-Za-z0-9]{20,}$/);
      expect(c.code).toMatch(/^[A-Za-z0-9]{6,12}$/);
      expect(c.label.length).toBeGreaterThan(3);
      expect(Number.isFinite(c.percentOff) !== Number.isFinite(c.amountOff)).toBe(true); // uno u otro, no los dos
      if (c.percentOff != null) expect(c.percentOff > 0 && c.percentOff <= 100).toBe(true);
      expect(["repeating", "once", "forever"]).toContain(c.duration);
      if (c.duration === "repeating") expect(Number.isInteger(c.months) && c.months >= 1 && c.months <= 36).toBe(true);
    }
  });
  it("no hay ids ni códigos repetidos", () => {
    expect(new Set(COUPONS.map((c) => c.id)).size).toBe(COUPONS.length);
    expect(new Set(COUPONS.map((c) => c.code)).size).toBe(COUPONS.length);
  });
  it("la descripción coincide con el descuento y la duración (la gente elige por el texto)", () => {
    for (const c of COUPONS) {
      expect(c.label).toContain(c.percentOff + "%");
      if (c.duration === "repeating") expect(c.label).toContain(c.months === 1 ? "1 mes" : c.months + " meses");
      if (c.duration === "forever") expect(c.label.toLowerCase()).toMatch(/ilimitado|siempre/);
    }
  });
  it("el webhook recibe el cupón en el campo 'coupon' con el id promo_…, igual que el ejemplo de Jonathan", async () => {
    const f = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({}) }));
    await makeWebhookClient({ token: "T", fetchImpl: f, couponField: "coupon" }).assign({ email: "cliente@inmobiliaria.com", plan: "SpicyPro", stripePriceId: "price_x1", idempotencyKey: "k-12345678", couponId: COUPONS[1].id });
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ email: "cliente@inmobiliaria.com", plan: "SpicyPro", stripePriceId: "price_x1", idempotencyKey: "k-12345678", coupon: "promo_1Ub4pgJdCZldzCmGSZNkXcft" });
  });
});
