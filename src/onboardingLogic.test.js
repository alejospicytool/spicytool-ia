import { describe, it, expect } from "vitest";
import { calcularEstado, calcularAvance, diasEntre, ONBOARDING_STAGES, companyOption, defaultCompanySearch } from "./onboardingLogic.js";

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

describe("vínculo con la cuenta de Spicytool", () => {
  it("da forma al resultado del buscador", () => {
    expect(companyOption({ _id: "abc123", name: " Inmo Sur ", userEmail: "dueno@inmo.test", phoneNumber: "+54911" })).toEqual({ id: "abc123", name: "Inmo Sur", email: "dueno@inmo.test", phone: "+54911" });
  });
  it("tolera datos que faltan", () => {
    expect(companyOption({ _id: "x" })).toEqual({ id: "x", name: "Sin nombre", email: "", phone: "" });
    expect(companyOption(null)).toBeNull();
    expect(companyOption({ name: "sin id" })).toBeNull();
  });
  it("la búsqueda por defecto es el nombre del cliente", () => {
    expect(defaultCompanySearch("  Inmo   Sur ")).toBe("Inmo Sur");
    expect(defaultCompanySearch(null)).toBe("");
  });
});

// ── Próximo paso ──
import { esFechaISO, atajosFecha, validarPaso, tienePaso, quienDelPaso, estadoPaso, chipPaso, pasoParaHoy, sinPaso, esMio, pasosParaHacer, notaPasoHecho, PASO_VACIO, PASO_MAX } from "./onboardingLogic.js";

describe("próximo paso", () => {
  const H = new Date("2026-11-26T10:00:00"); // jueves
  const r = (f, over = {}) => ({ id: "o1", client_name: "Inmo Sol", etapa_actual: "Crear Pipeline", responsable: "Nico", proximo_paso: "Pedir acceso a Tokko", proximo_paso_fecha: f, ...over });

  it("esFechaISO acepta fechas reales y rechaza el resto", () => {
    expect(esFechaISO("2026-11-26")).toBe(true);
    expect(esFechaISO("2026-02-31")).toBe(false);
    expect(esFechaISO("26/11/2026")).toBe(false);
    expect(esFechaISO("")).toBe(false);
    expect(esFechaISO(null)).toBe(false);
  });

  it("atajosFecha: hoy, mañana, 3 días, próximo lunes y 1 semana (fecha local)", () => {
    expect(atajosFecha(H).map((a) => [a.label, a.iso])).toEqual([["Hoy", "2026-11-26"], ["Mañana", "2026-11-27"], ["En 3 días", "2026-11-29"], ["El lunes", "2026-11-30"], ["En 1 semana", "2026-12-03"]]);
    // un lunes, "el lunes" es el de la semana que viene; un domingo, el de mañana
    expect(atajosFecha(new Date("2026-11-30T09:00:00")).find((a) => a.label === "El lunes").iso).toBe("2026-12-07");
    expect(atajosFecha(new Date("2026-11-29T23:30:00")).find((a) => a.label === "El lunes").iso).toBe("2026-11-30");
    expect(atajosFecha(new Date("2026-11-29T23:30:00"))[0].iso).toBe("2026-11-29"); // de noche no se corre al día siguiente
  });

  it("validarPaso: limpia espacios y exige texto y fecha", () => {
    expect(validarPaso({ texto: "  Mandar   templates  ", fecha: "2026-11-27", quien: "Ticiana" }).value).toEqual({ proximo_paso: "Mandar templates", proximo_paso_fecha: "2026-11-27", proximo_paso_quien: "Ticiana" });
    expect(validarPaso({ texto: "ab", fecha: "2026-11-27" }).error).toMatch(/qué hay que hacer/);
    expect(validarPaso({ texto: "x".repeat(PASO_MAX + 1), fecha: "2026-11-27" }).error).toMatch(/largo/);
    expect(validarPaso({ texto: "Llamar", fecha: "" }).error).toMatch(/día/);
    expect(validarPaso({ texto: "Llamar", fecha: "2026-11-27", quien: " " }).value.proximo_paso_quien).toBeNull();
  });

  it("estadoPaso y chipPaso: vencido, hoy, mañana, en N días y fecha", () => {
    expect(estadoPaso({}, H)).toBeNull();
    expect(chipPaso(r(null), H)).toBeNull();
    expect(chipPaso(r("2026-11-24"), H)).toMatchObject({ kind: "vencido", dias: 2, label: "Vencido hace 2 días", tone: "red" });
    expect(chipPaso(r("2026-11-25"), H).label).toBe("Vencido hace 1 día");
    expect(chipPaso(r("2026-11-26"), H)).toMatchObject({ kind: "hoy", label: "Hoy", tone: "amber" });
    expect(chipPaso(r("2026-11-27"), H)).toMatchObject({ kind: "manana", label: "Mañana" });
    expect(chipPaso(r("2026-11-29"), H).label).toBe("En 3 días");
    expect(chipPaso(r("2026-12-12"), H).label).toBe("El 12/12");
  });

  it("pasoParaHoy: solo hoy o vencido", () => {
    expect(pasoParaHoy(r("2026-11-20"), H)).toBe(true);
    expect(pasoParaHoy(r("2026-11-26"), H)).toBe(true);
    expect(pasoParaHoy(r("2026-11-27"), H)).toBe(false);
    expect(pasoParaHoy({ id: "x" }, H)).toBe(false);
  });

  it("tienePaso, quienDelPaso (cae al responsable) y sinPaso", () => {
    expect(tienePaso(r("2026-11-26"))).toBe(true);
    expect(tienePaso({ ...PASO_VACIO })).toBe(false);
    expect(quienDelPaso(r("2026-11-26", { proximo_paso_quien: "Lucas" }))).toBe("Lucas");
    expect(quienDelPaso(r("2026-11-26"))).toBe("Nico");
    expect(quienDelPaso({})).toBe("");
    expect(sinPaso({ etapa_actual: "Workflow" })).toBe(true);
    expect(sinPaso({ etapa_actual: "Aha confirmado" })).toBe(false);
    expect(sinPaso({ etapa_actual: "Spicy Finalizado" })).toBe(false);
    expect(sinPaso(r("2026-11-26"))).toBe(false);
  });

  it("esMio: compara el nombre del equipo con el nombre o el mail de la persona", () => {
    const nico = { first_name: "Nicolás", email: "nicolas@spicytool.net" };
    expect(esMio(r("2026-11-26"), nico)).toBe(true); // "Nico" ~ "Nicolás"
    expect(esMio(r("2026-11-26", { proximo_paso_quien: "Lucas" }), nico)).toBe(false);
    expect(esMio(r("2026-11-26", { proximo_paso_quien: "Ticiana" }), { first_name: "Ticiana", email: "t@x.com" })).toBe(true);
    expect(esMio(r("2026-11-26", { proximo_paso_quien: "Lucas" }), { email: "lucas@spicytool.net" })).toBe(true); // sin nombre cargado, por el mail
    expect(esMio(r("2026-11-26", { proximo_paso_quien: null, responsable: null }), nico)).toBe(false); // sin responsable no es de nadie
    expect(esMio(r("2026-11-26"), null)).toBe(false);
    expect(esMio(r("2026-11-26", { proximo_paso_quien: "Lu" }), { first_name: "Lucas", email: "lucas@x.com" })).toBe(true); // prefijo corto
  });

  it("pasosParaHacer: hoy y vencidos, del más atrasado al más nuevo, con filtro opcional", () => {
    const l = [r("2026-11-26", { id: "a", client_name: "Beta" }), r("2026-11-27", { id: "b" }), r("2026-11-20", { id: "c", client_name: "Zeta" }), r("2026-11-26", { id: "d", client_name: "Alfa" }), { id: "e", client_name: "Sin" }];
    expect(pasosParaHacer(l, H).map((x) => x.id)).toEqual(["c", "d", "a"]);
    expect(pasosParaHacer(l, H, (x) => x.id === "a").map((x) => x.id)).toEqual(["a"]);
    expect(pasosParaHacer(null, H)).toEqual([]);
  });

  it("notaPasoHecho deja constancia con el texto y la fecha original", () => {
    expect(notaPasoHecho(r("2026-11-24"))).toBe("✓ Paso hecho: Pedir acceso a Tokko (era para el 24/11)");
  });
});

// ── En pausa ──
import { enPausa, diasEnPausa, diasRegistroActivos, armarPausa, armarRetomar, textoPausa } from "./onboardingLogic.js";

describe("en pausa", () => {
  const H = new Date("2026-11-27T10:00:00");
  const dias = (n) => { const d = new Date(H); d.setDate(d.getDate() - n); return d.toLocaleDateString("en-CA"); };
  const cli = (over = {}) => ({ id: "o1", client_name: "Inmo Sol", etapa_actual: "Crear Pipeline", bloqueado: false, integraciones_pendientes: [], responsable: "Nico",
    fecha_registro: dias(30), fecha_entrada_etapa_actual: dias(10), pausa_desde: null, pausa_motivo: null, pausa_dias_acum: 0, ...over });

  it("un cliente muy atrasado figura 'atrasado general' y, en pausa, 'en pausa' (aunque también esté bloqueado)", () => {
    expect(calcularEstado(cli(), H)).toBe("atrasado general");
    expect(calcularEstado(cli({ pausa_desde: dias(5), pausa_motivo: "Cambio de nombre" }), H)).toBe("en pausa");
    expect(calcularEstado(cli({ bloqueado: true, pausa_desde: dias(5), pausa_motivo: "Cambio de nombre" }), H)).toBe("en pausa");
    expect(calcularEstado(cli({ bloqueado: true }), H)).toBe("bloqueado");
  });

  it("las etapas finales mandan sobre la pausa", () => {
    expect(calcularEstado(cli({ etapa_actual: "Spicy Finalizado", pausa_desde: dias(2), pausa_motivo: "xxx" }), H)).toBe("esperando aha");
    expect(calcularEstado(cli({ etapa_actual: "Aha confirmado", pausa_desde: dias(2), pausa_motivo: "xxx" }), H)).toBe("ok");
  });

  it("los días de pausas anteriores no cuentan para el atraso general de 20 días", () => {
    expect(calcularEstado(cli({ fecha_registro: dias(25), fecha_entrada_etapa_actual: dias(1) }), H)).toBe("atrasado general");
    expect(calcularEstado(cli({ fecha_registro: dias(25), fecha_entrada_etapa_actual: dias(1), pausa_dias_acum: 10 }), H)).toBe("verde"); // 15 días activos
    expect(diasRegistroActivos(cli({ fecha_registro: dias(25), pausa_dias_acum: 10 }), H)).toBe(15);
    expect(diasRegistroActivos(cli({ fecha_registro: dias(5), pausa_dias_acum: 99 }), H)).toBe(0); // nunca negativo
    expect(diasRegistroActivos({ fecha_registro: null }, H)).toBeNull();
  });

  it("mientras está en pausa, los días registro quedan quietos", () => {
    const r = cli({ fecha_registro: dias(30), pausa_desde: dias(5), pausa_motivo: "Esperando portfolio" });
    expect(diasEnPausa(r, H)).toBe(5);
    expect(diasRegistroActivos(r, H)).toBe(25);
    expect(enPausa(r)).toBe(true);
    expect(enPausa(cli())).toBe(false);
    expect(diasEnPausa(cli(), H)).toBe(0);
  });

  it("armarPausa: valida el motivo y arma el patch y la nota", () => {
    expect(armarPausa(cli(), { motivo: "ab" }, H).error).toMatch(/por qué/);
    expect(armarPausa(cli(), { motivo: "x".repeat(201) }, H).error).toMatch(/largo/);
    const r = armarPausa(cli(), { motivo: "  Cambió el nombre de   la inmobiliaria " }, H);
    expect(r.patch).toEqual({ pausa_desde: "2026-11-27", pausa_motivo: "Cambió el nombre de la inmobiliaria" });
    expect(r.nota).toBe("⏸ En pausa (esperando al cliente): Cambió el nombre de la inmobiliaria");
  });

  it("armarPausa con fecha de revisión crea el recordatorio (reemplaza el paso anterior); sin fecha no lo toca", () => {
    const con = armarPausa(cli({ proximo_paso: "Algo viejo", proximo_paso_fecha: dias(0) }), { motivo: "Sin portfolio", revisar: "2026-12-04", quien: "Ticiana" }, H);
    expect(con.patch).toMatchObject({ proximo_paso: "Revisar pausa: Sin portfolio", proximo_paso_fecha: "2026-12-04", proximo_paso_quien: "Ticiana" });
    expect(con.nota).toMatch(/se revisa el 04\/12/);
    const sin = armarPausa(cli({ proximo_paso: "Algo viejo", proximo_paso_fecha: dias(0) }), { motivo: "Sin portfolio" }, H);
    expect(sin.patch).not.toHaveProperty("proximo_paso");
    expect(armarPausa(cli(), { motivo: "Sin portfolio", revisar: "2026-11-20" }, H).error).toMatch(/anterior a hoy/);
    expect(armarPausa(cli(), { motivo: "Sin portfolio", revisar: "2026-13-40" }, H).error).toMatch(/no es válida/);
    expect(armarPausa(cli(), { motivo: "y".repeat(190), revisar: "2026-12-04" }, H).patch.proximo_paso.length).toBeLessThanOrEqual(200);
  });

  it("editar el motivo de una pausa en curso no reinicia la fecha de inicio", () => {
    const r = armarPausa(cli({ pausa_desde: dias(8), pausa_motivo: "Viejo motivo" }), { motivo: "Nuevo motivo" }, H);
    expect(r.patch.pausa_desde).toBe(dias(8));
    expect(r.nota).toBe("⏸ Motivo de la pausa actualizado: Nuevo motivo");
  });

  it("armarRetomar: suma los días y corre la entrada a la etapa para que la pausa no cuente como demora", () => {
    const r = cli({ fecha_entrada_etapa_actual: dias(20), pausa_desde: dias(8), pausa_motivo: "Cambio de nombre", pausa_dias_acum: 3 });
    const x = armarRetomar(r, H);
    expect(x.dias).toBe(8);
    expect(x.patch).toMatchObject({ pausa_desde: null, pausa_motivo: null, pausa_dias_acum: 11, fecha_entrada_etapa_actual: dias(12) });
    expect(x.nota).toBe("▶ Retomado después de 8 días en pausa (motivo: Cambio de nombre)");
    // tras retomar: 20 días en etapa − 8 de pausa = 12 días en la etapa
    expect(diasEntre(x.patch.fecha_entrada_etapa_actual, H)).toBe(12);
  });

  it("armarRetomar: si cambió de etapa durante la pausa, solo descuenta desde que entró a la etapa nueva", () => {
    const r = cli({ fecha_entrada_etapa_actual: dias(2), pausa_desde: dias(8), pausa_motivo: "Esperando" });
    const x = armarRetomar(r, H);
    expect(x.patch.pausa_dias_acum).toBe(8);
    expect(x.patch.fecha_entrada_etapa_actual).toBe(dias(0)); // 2 días en pausa dentro de la etapa → hoy
  });

  it("armarRetomar: el mismo día y sin pausa", () => {
    expect(armarRetomar(cli({ pausa_desde: dias(0), pausa_motivo: "Prueba" }), H).nota).toBe("▶ Retomado el mismo día (motivo: Prueba)");
    expect(armarRetomar(cli(), H).error).toMatch(/no está en pausa/);
    expect(armarRetomar(cli({ pausa_desde: dias(1), pausa_motivo: "Prueba" }), H).nota).toMatch(/1 día en pausa/);
  });

  it("textoPausa y sinPaso (un cliente en pausa no es 'sin próximo paso')", () => {
    expect(textoPausa(cli({ pausa_desde: dias(12), pausa_motivo: "x y z" }), H)).toBe("En pausa hace 12 días");
    expect(textoPausa(cli({ pausa_desde: dias(0), pausa_motivo: "x y z" }), H)).toBe("En pausa desde hoy");
    expect(sinPaso(cli())).toBe(true);
    expect(sinPaso(cli({ pausa_desde: dias(1), pausa_motivo: "x y z" }))).toBe(false);
  });
});
