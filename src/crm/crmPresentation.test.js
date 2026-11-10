import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { createCrm } from "./crmLogic.js";
import { rpSlides, rpStandalone } from "./crmPresentation.js";
import { fixture, NOW } from "./crmFixture.js";

const text = (html) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("presentación (datos ficticios)", () => {
  const crm = createCrm(fixture(), { now: NOW });
  const slides = rpSlides(crm);
  it("son 8 diapositivas numeradas", () => {
    expect(slides).toHaveLength(8);
    slides.forEach((s, i) => expect(s).toContain((i + 1) + " / 8"));
  });
  it("portada con MRR real, meta y semana", () => {
    const t = text(slides[0]);
    expect(t).toContain("Cómo vamos");
    expect(t).toContain("Semana del 3 nov al 10 nov");
    expect(t).toContain("USD 1.000");
    expect(t).toContain("USD 3.000");
  });
  it("escapa el HTML de los datos (no se puede inyectar código desde un nombre de empresa)", () => {
    const S = fixture();
    S.deals[0].empresa = '<img src=x onerror="alert(1)">';
    const html = rpSlides(createCrm(S, { now: NOW })).join("");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });
  it("el archivo descargable es un HTML completo con todas las diapositivas", () => {
    const h = rpStandalone(crm);
    expect(h.startsWith("<!doctype html>")).toBe(true);
    expect((h.match(/class="rp-page"/g) || []).length).toBe(8);
    expect(h).toContain("Flechas para avanzar");
  });
});

describe.skipIf(!fs.existsSync("_import/crm-datos.json"))("presentación con los datos reales (10/11/2026)", () => {
  it("los números clave coinciden con los del original", () => {
    const S = JSON.parse(fs.readFileSync("_import/crm-datos.json", "utf8"));
    const sl = rpSlides(createCrm(S, { now: new Date("2026-11-10T18:09:31Z") })).map(text);
    expect(sl[0]).toContain("57% de la meta hoy. Proyectado a dic 26: USD 8.989, faltan USD 3.011.");
    expect(sl[1]).toMatch(/USD 6\.880.*USD 8\.989.*Faltan USD 3\.011.*USD 1\.225.*19 deals abiertos.*USD 1\.000/);
    expect(sl[2]).toMatch(/Clientes activos 8 0 en riesgo.*MRR de la cartera USD 1\.100.*\+USD 570.*5 fin de promo.*Bajas últimos 3 meses 0/);
    expect(sl[4]).toMatch(/9 deals, USD 2\.170 \(USD 217 pond\.\).*4 deals, USD 620 \(USD 186 pond\.\).*6 deals, USD 1\.370 \(USD 822 pond\.\).*0 deals, USD 0.*Frenados 13/);
    expect(sl[5]).toMatch(/Motivos de pérdida \(2 deals\).*1 \(50%\).*1 \(50%\)/);
    expect(sl[6]).toMatch(/17 USD 1\.015 0 19 5.*2 USD 210 0 0 0/);
    expect(sl[7]).toContain("Los deals que mueven la aguja");
  });
});
