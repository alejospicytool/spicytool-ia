import { describe, it, expect } from "vitest";
import { cleanLabels, readPrefs, orderSections, moveLabel, toggleLabel, MAX_LABELS } from "./menuPrefs.js";

const S = ["Inicio", "Notas", "Finanzas", "CRM", "Métricas"].map((label) => ({ label }));
const labels = (a) => a.map((s) => s.label);

describe("orden del menú", () => {
  it("sin nada guardado: el orden de siempre", () => {
    expect(labels(orderSections(S, []))).toEqual(["Inicio", "Notas", "Finanzas", "CRM", "Métricas"]);
    expect(labels(orderSections(S, undefined))).toEqual(["Inicio", "Notas", "Finanzas", "CRM", "Métricas"]);
  });
  it("respeta el orden guardado y deja el resto detrás, en su orden", () => {
    expect(labels(orderSections(S, ["CRM", "Inicio"]))).toEqual(["CRM", "Inicio", "Notas", "Finanzas", "Métricas"]);
  });
  it("ignora secciones guardadas que ya no existen o están repetidas, y no pierde ninguna", () => {
    const r = labels(orderSections(S, ["Borrada", "CRM", "CRM", "Notas"]));
    expect(r).toEqual(["CRM", "Notas", "Inicio", "Finanzas", "Métricas"]);
    expect(r.slice().sort()).toEqual(S.map((s) => s.label).sort());
  });
  it("una sección nueva (no guardada) queda al final, sin desordenar lo demás", () => {
    expect(labels(orderSections([...S, { label: "Nueva" }], ["Métricas", "CRM"]))).toEqual(["Métricas", "CRM", "Inicio", "Notas", "Finanzas", "Nueva"]);
  });
  it("no modifica la lista original", () => {
    const antes = labels(S); orderSections(S, ["CRM"]);
    expect(labels(S)).toEqual(antes);
  });
});

describe("mover una sección", () => {
  const v = ["Inicio", "CRM", "Métricas"];
  it("sube y baja intercambiando con la vecina", () => {
    expect(moveLabel(v, "CRM", -1)).toEqual(["CRM", "Inicio", "Métricas"]);
    expect(moveLabel(v, "CRM", 1)).toEqual(["Inicio", "Métricas", "CRM"]);
  });
  it("en los extremos o con una etiqueta desconocida no cambia nada", () => {
    expect(moveLabel(v, "Inicio", -1)).toEqual(v);
    expect(moveLabel(v, "Métricas", 1)).toEqual(v);
    expect(moveLabel(v, "Nada", 1)).toEqual(v);
  });
  it("no modifica el original", () => {
    moveLabel(v, "CRM", -1);
    expect(v).toEqual(["Inicio", "CRM", "Métricas"]);
  });
});

describe("plegar y desplegar", () => {
  it("agrega y saca", () => {
    expect(toggleLabel([], "CRM")).toEqual(["CRM"]);
    expect(toggleLabel(["CRM", "Notas"], "CRM")).toEqual(["Notas"]);
  });
});

describe("datos que vienen de afuera", () => {
  it("normaliza lo que llega de la base (section_order / collapsed_sections) o del navegador (order / collapsed)", () => {
    expect(readPrefs({ section_order: ["CRM"], collapsed_sections: ["Métricas"] })).toEqual({ order: ["CRM"], collapsed: ["Métricas"] });
    expect(readPrefs({ order: ["CRM"], collapsed: [] })).toEqual({ order: ["CRM"], collapsed: [] });
  });
  it("datos rotos o hostiles dan listas vacías o limpias, sin tirar error", () => {
    for (const raw of [null, undefined, "x", 5, [], { section_order: "CRM" }, { section_order: [1, null, {}, "", "  "] }]) {
      const p = readPrefs(raw);
      expect(Array.isArray(p.order) && Array.isArray(p.collapsed)).toBe(true);
      expect(p.order).toEqual([]);
    }
    expect(cleanLabels(["a".repeat(41), " CRM ", "CRM"])).toEqual(["CRM"]);
  });
  it("pone un tope a la cantidad", () => {
    expect(cleanLabels(Array.from({ length: 200 }, (_, i) => "s" + i))).toHaveLength(MAX_LABELS);
  });
});
