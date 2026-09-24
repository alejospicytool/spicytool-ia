import { describe, it, expect } from "vitest";
import { calcularEstado, calcularAvance, diasEntre, ONBOARDING_STAGES } from "./onboardingLogic.js";

const HOY = new Date("2026-09-23T12:00:00");
const haceNDias = (n) => {
  const d = new Date(HOY);
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
};

const base = {
  etapa_actual: "Crear Pipeline",
  bloqueado: false,
  integraciones_pendientes: [],
  fecha_registro: haceNDias(2),
  fecha_entrada_etapa_actual: haceNDias(1),
};

describe("calcularEstado", () => {
  it("Aha confirmado con integraciones pendientes → revisar", () => {
    const r = { ...base, etapa_actual: "Aha confirmado", integraciones_pendientes: ["Meta Ads"] };
    expect(calcularEstado(r, HOY)).toBe("revisar");
  });

  it("Aha confirmado sin integraciones pendientes → ok", () => {
    const r = { ...base, etapa_actual: "Aha confirmado", integraciones_pendientes: [] };
    expect(calcularEstado(r, HOY)).toBe("ok");
  });

  it("Spicy Finalizado → esperando aha (gana aunque esté bloqueado o atrasado)", () => {
    const r = { ...base, etapa_actual: "Spicy Finalizado", bloqueado: true, fecha_registro: haceNDias(30) };
    expect(calcularEstado(r, HOY)).toBe("esperando aha");
  });

  it("Bloqueado → bloqueado (gana sobre atrasado/en tiempo)", () => {
    const r = { ...base, bloqueado: true };
    expect(calcularEstado(r, HOY)).toBe("bloqueado");
  });

  it("Sin fecha_entrada_etapa_actual → sin fecha", () => {
    const r = { ...base, fecha_entrada_etapa_actual: null };
    expect(calcularEstado(r, HOY)).toBe("sin fecha");
  });

  it("Más de 20 días desde el registro → atrasado general (gana sobre la regla de etapa)", () => {
    const r = { ...base, fecha_registro: haceNDias(21), fecha_entrada_etapa_actual: haceNDias(1) };
    expect(calcularEstado(r, HOY)).toBe("atrasado general");
  });

  it("Etapa de Cliente, <= 3 días en etapa → verde", () => {
    const r = { ...base, etapa_actual: "Conectar WhatsApp", fecha_entrada_etapa_actual: haceNDias(3) };
    expect(calcularEstado(r, HOY)).toBe("verde");
  });

  it("Etapa de Cliente, > 3 días en etapa → amarillo", () => {
    const r = { ...base, etapa_actual: "Conectar WhatsApp", fecha_entrada_etapa_actual: haceNDias(4) };
    expect(calcularEstado(r, HOY)).toBe("amarillo");
  });

  it("Etapa de Equipo, <= 5 días en etapa → verde", () => {
    const r = { ...base, etapa_actual: "Workflow", fecha_entrada_etapa_actual: haceNDias(5) };
    expect(calcularEstado(r, HOY)).toBe("verde");
  });

  it("Etapa de Equipo, > 5 días en etapa → rojo", () => {
    const r = { ...base, etapa_actual: "Workflow", fecha_entrada_etapa_actual: haceNDias(6) };
    expect(calcularEstado(r, HOY)).toBe("rojo");
  });
});

describe("calcularAvance", () => {
  it("primera etapa → 1/8", () => {
    expect(calcularAvance("Crear cuenta")).toBeCloseTo(1 / 8);
  });
  it("última etapa → 1", () => {
    expect(calcularAvance("Aha confirmado")).toBe(1);
  });
  it("etapa inexistente → 0", () => {
    expect(calcularAvance("etapa que no existe")).toBe(0);
  });
  it("ONBOARDING_STAGES tiene 8 etapas", () => {
    expect(ONBOARDING_STAGES).toHaveLength(8);
  });
});

describe("diasEntre", () => {
  it("calcula días completos transcurridos", () => {
    expect(diasEntre(haceNDias(5), HOY)).toBe(5);
  });
  it("null si no hay fecha", () => {
    expect(diasEntre(null, HOY)).toBe(null);
  });
});
