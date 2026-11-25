import { describe, it, expect } from "vitest";
import { canSendToCrm, findExistingDeals, sentDealOf, defaultSendForm, buildFreemiumDeal, openStages } from "./crmSend.js";
import { fixture, NOW } from "../crm/crmFixture.js";

const config = () => fixture().config;
const user = (over = {}) => ({ _id: "u1", name: "Lucía", surname: "Gómez", email: "lucia@mail.com", phoneNumber: "+54 9 341 555 0000", subscription: { subscriptionType: "Freemium" }, ...over });

describe("canSendToCrm", () => {
  it("solo los Freemium", () => {
    expect(canSendToCrm(user())).toBe(true);
    expect(canSendToCrm(user({ subscription: { subscriptionType: "SpicyPro" } }))).toBe(false);
    expect(canSendToCrm(user({ subscription: { subscriptionType: "FreeTrial" } }))).toBe(false);
    expect(canSendToCrm(user({ subscription: null }))).toBe(false);
  });
});

describe("findExistingDeals", () => {
  const deals = [
    { id: "d1", empresa: "Otra", spicyUserId: "u1" },
    { id: "d2", empresa: "Otra 2", email: "LUCIA@mail.com" },
    { id: "d3", empresa: "Otra 3", telefono: "341-555-0000" },
    { id: "d4", empresa: "Inmobiliaria Sol" },
    { id: "d5", empresa: "Nada que ver" },
  ];
  it("detecta el mismo usuario, email, teléfono (fuertes) y misma empresa (débil)", () => {
    const r = findExistingDeals(deals, user(), "Inmobiliaria Sol");
    expect(r.map((x) => [x.deal.id, x.strong])).toEqual([["d1", true], ["d2", true], ["d3", true], ["d4", false]]);
  });
  it("no marca nada si no hay coincidencias ni empresa corta", () => {
    expect(findExistingDeals(deals, user({ _id: "x", email: "z@z.com", phoneNumber: "" }), "Sol")).toEqual([]);
  });
  it("sentDealOf: solo el que se envió por ese usuario", () => {
    expect(sentDealOf(deals, user()).id).toBe("d1");
    expect(sentDealOf(deals, user({ _id: "otro" }))).toBeNull();
  });
});

describe("buildFreemiumDeal", () => {
  const form = (over = {}) => ({ stage: "lead", vendedor: "Beto", proxima: "Follow up", proximaFecha: "2026-11-12", nota: "Usó 3 campañas", ...over });
  it("arma un deal abierto en la etapa elegida, con recorrido, historial y próxima acción", () => {
    const r = buildFreemiumDeal(config(), user(), { companyName: "Inmobiliaria Sol", form: form(), actor: "nico@x.com", now: NOW });
    expect(r.error).toBeUndefined();
    const d = r.deal;
    expect(d.stage).toBe("lead");
    expect(d.empresa).toBe("Inmobiliaria Sol");
    expect(d.contacto).toBe("Lucía Gómez");
    expect(d.telefono).toBe("+54 9 341 555 0000");
    expect(d.email).toBe("lucia@mail.com");
    expect(d.spicyUserId).toBe("u1");
    expect(d.vendedor).toBe("Beto");
    expect(d.proxima).toBe("Follow up");
    expect(d.proximaFecha).toBe("2026-11-12");
    expect(d.trail).toEqual([{ s: "lead", at: "2026-11-10" }]);
    expect(d.notas).toContain("Freemium");
    expect(d.notas).toContain("Usó 3 campañas");
    expect(d._new).toBeUndefined();
    expect(d.hist.at(-1).x).toMatch(/Enviado desde Admin Spicy.*nico@x.com.*Follow up/);
    expect(d.hist.some((h) => /Deal creado en Lead/.test(h.x))).toBe(true);
  });
  it("sin company usa el nombre de la persona como empresa", () => {
    expect(buildFreemiumDeal(config(), user(), { companyName: "—", form: form(), now: NOW }).deal.empresa).toBe("Lucía Gómez");
  });
  it("sin próxima acción no deja fecha", () => {
    const d = buildFreemiumDeal(config(), user(), { form: form({ proxima: "" }), now: NOW }).deal;
    expect(d.proxima).toBe("");
    expect(d.proximaFecha).toBe("");
  });
  it("rechaza etapas que no son abiertas (ganado, perdido, fuera del forecast) y etapas inexistentes", () => {
    for (const s of ["won", "lost", "hold", "nope", ""]) expect(buildFreemiumDeal(config(), user(), { form: form({ stage: s }), now: NOW }).error).toMatch(/etapa/);
  });
  it("sin config del CRM avisa", () => {
    expect(buildFreemiumDeal(null, user(), { form: form() }).error).toMatch(/configurado/);
  });
  it("no modifica la config original", () => {
    const c = config(), copy = JSON.stringify(c);
    buildFreemiumDeal(c, user(), { form: form(), now: NOW });
    expect(JSON.stringify(c)).toBe(copy);
  });
});

describe("helpers del formulario", () => {
  it("defaultSendForm toma la primera etapa abierta, el primer vendedor y la primera acción", () => {
    expect(defaultSendForm(config(), "2026-11-10")).toEqual({ stage: "lead", vendedor: "Ana", proxima: "Follow up", proximaFecha: "2026-11-10", nota: "" });
    expect(openStages(config()).map((s) => s.id)).toEqual(["lead", "demo", "prop", "nego"]);
  });
});
