import { describe, it, expect } from "vitest";
import { proximoToque, estadoToque, tocaEstaSemana, sortPorUrgencia, resumen, whatsappLink, validateToque, validateRespuesta, respuestaInfo, respuestaTexto, notaConRespuesta, RESPUESTAS, candidatosCartera, filaDesdeCuenta, buildConstancia, normFrecuencia, diasEntre, escapeHtml } from "./seguimientoLogic.js";

// 2026-11-18 es miércoles → la semana va del 16 al 22.
const HOY = "2026-11-18";
const row = (o = {}) => ({ company_id: "c1", company_name: "Acme", frecuencia_dias: 7, ultimo_toque: null, created_at: "2026-11-01T12:00:00Z", semaforo: "verde", sin_respuesta: 0, baja_en: null, proximo_toque: null, responsable_id: "u1", ...o });

describe("proximoToque", () => {
  it("último toque + frecuencia", () => expect(proximoToque(row({ ultimo_toque: "2026-11-16" }))).toBe("2026-11-23"));
  it("una frecuencia distinta cambia la fecha", () => expect(proximoToque(row({ ultimo_toque: "2026-11-16", frecuencia_dias: 3 }))).toBe("2026-11-19"));
  it("una fecha puntual pisa a la frecuencia", () => expect(proximoToque(row({ ultimo_toque: "2026-11-16", proximo_toque: "2026-11-20" }))).toBe("2026-11-20"));
  it("sin toques: le toca desde el día que se sumó a la cartera", () => expect(proximoToque(row())).toBe("2026-11-01"));
  it("sin frecuencia no hay rutina", () => expect(proximoToque(row({ frecuencia_dias: null, ultimo_toque: "2026-11-16" }))).toBeNull());
  it("con fecha puntual aunque no tenga frecuencia", () => expect(proximoToque(row({ frecuencia_dias: null, proximo_toque: "2026-12-01" }))).toBe("2026-12-01"));
  it("de baja: nada", () => expect(proximoToque(row({ baja_en: "2026-11-10", ultimo_toque: "2026-11-01" }))).toBeNull());
  it("cruza el fin de mes", () => expect(proximoToque(row({ ultimo_toque: "2026-11-28" }))).toBe("2026-12-05"));
});

describe("estadoToque", () => {
  it("vencido si la fecha ya pasó", () => expect(estadoToque(row({ ultimo_toque: "2026-11-05" }), HOY)).toBe("vencido"));
  it("le toca hoy → esta semana (no vencido)", () => expect(estadoToque(row({ ultimo_toque: "2026-11-11" }), HOY)).toBe("esta_semana"));
  it("le toca el domingo → todavía esta semana", () => expect(estadoToque(row({ proximo_toque: "2026-11-22" }), HOY)).toBe("esta_semana"));
  it("le toca el lunes que viene → al día", () => expect(estadoToque(row({ proximo_toque: "2026-11-23" }), HOY)).toBe("al_dia"));
  it("sin frecuencia → sin rutina", () => expect(estadoToque(row({ frecuencia_dias: null }), HOY)).toBe("sin_rutina"));
  it("de baja", () => expect(estadoToque(row({ baja_en: "2026-11-01" }), HOY)).toBe("baja"));
  it("tocaEstaSemana incluye vencidos y los de la semana", () => {
    expect(tocaEstaSemana(row({ ultimo_toque: "2026-11-05" }), HOY)).toBe(true);
    expect(tocaEstaSemana(row({ ultimo_toque: "2026-11-11" }), HOY)).toBe(true);
    expect(tocaEstaSemana(row({ ultimo_toque: "2026-11-17" }), HOY)).toBe(false);
  });
});

describe("sortPorUrgencia", () => {
  it("vencidos primero (el más atrasado arriba), después la semana, al día, sin rutina y bajas", () => {
    const rows = [
      row({ company_id: "a", company_name: "Al día", ultimo_toque: "2026-11-17" }),
      row({ company_id: "b", company_name: "Vencido leve", ultimo_toque: "2026-11-10" }),
      row({ company_id: "c", company_name: "Vencido fuerte", ultimo_toque: "2026-11-01" }),
      row({ company_id: "d", company_name: "Sin rutina", frecuencia_dias: null }),
      row({ company_id: "e", company_name: "Baja", baja_en: "2026-11-01" }),
      row({ company_id: "f", company_name: "Semana", ultimo_toque: "2026-11-12" }),
    ];
    expect(sortPorUrgencia(rows, HOY).map((r) => r.company_id)).toEqual(["c", "b", "f", "a", "d", "e"]);
  });
  it("no modifica el arreglo original", () => {
    const rows = [row({ company_id: "z", company_name: "Z" }), row({ company_id: "a", company_name: "A", ultimo_toque: "2026-11-17" })];
    sortPorUrgencia(rows, HOY);
    expect(rows[0].company_id).toBe("z");
  });
});

describe("resumen", () => {
  const rows = [
    row({ company_id: "1", ultimo_toque: "2026-11-17" }),                                  // tocado esta semana, al día
    row({ company_id: "2", ultimo_toque: "2026-11-05", semaforo: "rojo", sin_respuesta: 3 }), // vencido
    row({ company_id: "3", ultimo_toque: "2026-11-11" }),                                  // le toca hoy
    row({ company_id: "4", baja_en: "2026-11-02" }),                                       // baja: no cuenta
    row({ company_id: "5", ultimo_toque: "2026-11-05", responsable_id: "u2" }),             // de otra persona
  ];
  it("todos", () => {
    const r = resumen(rows, HOY);
    expect(r).toMatchObject({ total: 4, vencidos: 2, estaSemana: 1, toca: 3, tocadosSemana: 1, pctTocados: 25, rojos: 1, sinRespuesta: 1 });
  });
  it("solo los de una persona", () => {
    const r = resumen(rows, HOY, "u1");
    expect(r).toMatchObject({ total: 3, vencidos: 1, estaSemana: 1, toca: 2 });
  });
  it("sin clientes no divide por cero", () => expect(resumen([], HOY).pctTocados).toBe(0));
});

describe("whatsappLink", () => {
  it("deja solo los dígitos", () => expect(whatsappLink("+54 9 11 5555-1234")).toBe("https://wa.me/5491155551234"));
  it("saca el 00 inicial", () => expect(whatsappLink("0054911555512")).toBe("https://wa.me/54911555512"));
  it("rechaza lo que no parece un teléfono", () => { expect(whatsappLink("123")).toBeNull(); expect(whatsappLink("")).toBeNull(); expect(whatsappLink(null)).toBeNull(); });
});

describe("validateToque", () => {
  const ok = { canal: "whatsapp", resultado: "no_respondio", fecha: HOY, proximo: "" };
  it("válido", () => expect(validateToque(ok, HOY).ok).toBe(true));
  it("exige canal y resultado", () => {
    const r = validateToque({ ...ok, canal: "", resultado: "" }, HOY);
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors)).toEqual(["canal", "resultado"]);
  });
  it("no acepta una fecha futura", () => expect(validateToque({ ...ok, fecha: "2026-11-19" }, HOY).errors.fecha).toMatch(/futura/));
  it("la fecha de un próximo toque tiene que ser válida", () => expect(validateToque({ ...ok, proximo: "mañana" }, HOY).errors.proximo).toBeTruthy());
});

describe("candidatosCartera", () => {
  const u = (o) => ({ email: "d@x.com", name: "Dana", surname: "Paz", phoneNumber: "+5491100", companies: ["c1"], isOwner: true, companyName: "Inmo Paz", companyStatus: "active", subscription: { subscriptionType: "SpicyPro" }, ...o });
  it("incluye al dueño de una cuenta activa con plan pago", () => {
    expect(candidatosCartera([u()])).toEqual([{ company_id: "c1", company_name: "Inmo Paz", contact_name: "Dana Paz", contact_email: "d@x.com", contact_phone: "+5491100", plan: "SpicyPro" }]);
  });
  it("deja afuera Freemium, Free trial y sin plan", () => {
    const r = candidatosCartera([u({ companies: ["a"], subscription: { subscriptionType: "Freemium" } }), u({ companies: ["b"], subscription: { subscriptionType: "FreeTrial" } }), u({ companies: ["c"], subscription: { subscriptionType: null } })]);
    expect(r).toEqual([]);
  });
  it("deja afuera a quien no es dueño y a las cuentas pausadas", () => {
    expect(candidatosCartera([u({ isOwner: false }), u({ companies: ["p"], companyStatus: "paused" })])).toEqual([]);
  });
  it("deja afuera las que ya están en la cartera y no repite", () => {
    expect(candidatosCartera([u(), u()], ["c1"])).toEqual([]);
    expect(candidatosCartera([u(), u()])).toHaveLength(1);
  });
  it("incluye otros planes pagos (Custom, Growth, Build)", () => {
    expect(candidatosCartera([u({ companies: ["a"], subscription: { subscriptionType: "Custom" } }), u({ companies: ["b"], subscription: { subscriptionType: "Growth" } })])).toHaveLength(2);
  });
});

describe("filaDesdeCuenta", () => {
  it("arma la fila con la rutina por defecto", () => {
    expect(filaDesdeCuenta({ company_id: 9, company_name: " Acme ", plan: "SpicyPro" }, { responsableId: "u1", userId: "u9" })).toMatchObject({ company_id: "9", company_name: "Acme", responsable_id: "u1", frecuencia_dias: 7, semaforo: "verde", created_by: "u9", contact_email: null });
  });
});

describe("normFrecuencia / diasEntre", () => {
  it("normaliza", () => { expect(normFrecuencia("7")).toBe(7); expect(normFrecuencia("")).toBeNull(); expect(normFrecuencia(0)).toBeNull(); expect(normFrecuencia(400)).toBeNull(); expect(normFrecuencia(3.9)).toBe(3); });
  it("días entre fechas", () => { expect(diasEntre("2026-11-10", "2026-11-18")).toBe(8); expect(diasEntre(null, HOY)).toBeNull(); });
});

describe("buildConstancia", () => {
  const r = row({ company_name: "Inmo Paz", contact_name: "Dana Paz", contact_email: "d@x.com", contact_phone: "+5491100" });
  const t = (fecha, resultado, extra = {}) => ({ fecha, resultado, canal: "whatsapp", created_at: fecha + "T10:00:00Z", author_email: "tici@spicytool.net", nota: "", ...extra });
  it("sin toques", () => expect(buildConstancia(r, [], HOY)).toMatch(/Todavía no hay intentos/));
  it("cuenta los intentos y los seguidos sin respuesta", () => {
    const txt = buildConstancia(r, [t("2026-11-02", "respondio"), t("2026-11-09", "no_respondio"), t("2026-11-16", "no_respondio", { nota: "Le escribí\nde nuevo" })], HOY);
    expect(txt).toContain("CONSTANCIA DE CONTACTO — Inmo Paz");
    expect(txt).toContain("Intentos de contacto: 3 (2 sin respuesta, 1 con respuesta)");
    expect(txt).toContain("Intentos seguidos sin respuesta al día de hoy: 2");
    expect(txt).toContain("Último contacto con respuesta: 02/11/2026");
    expect(txt).toContain("- 16/11/2026 · WhatsApp · Sin respuesta por ahora · Le escribí de nuevo (tici)");
    expect(txt).toContain("Período: 02/11/2026 al 16/11/2026");
  });
  it("si el último tuvo respuesta no hay racha", () => {
    expect(buildConstancia(r, [t("2026-11-02", "no_respondio"), t("2026-11-09", "respondio")], HOY)).toContain("El último contacto tuvo respuesta.");
  });
  it("ordena por fecha aunque lleguen desordenados", () => {
    const txt = buildConstancia(r, [t("2026-11-16", "no_respondio"), t("2026-11-02", "respondio")], HOY);
    expect(txt.indexOf("02/11/2026 · WhatsApp")).toBeLessThan(txt.indexOf("16/11/2026 · WhatsApp"));
  });
});

describe("escapeHtml", () => {
  it("escapa lo que rompería el HTML impreso", () => expect(escapeHtml(`<b>"a" & 'b'</b>`)).toBe("&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;"));
});

describe("respuesta posterior al contacto", () => {
  const T = { fecha: "2026-11-10", resultado: "no_respondio", nota: "Le escribí por WhatsApp" };
  it("RESPUESTAS son las opciones con respuesta (no 'sin respuesta')", () => {
    expect(RESPUESTAS.map((r) => r.key)).toEqual(["respondio", "queja"]);
  });
  it("validateRespuesta: exige resultado con respuesta y fecha entre el contacto y hoy", () => {
    expect(validateRespuesta({ resultado: "respondio", fecha: "2026-11-12" }, T, HOY).ok).toBe(true);
    expect(validateRespuesta({ resultado: "respondio", fecha: "2026-11-10" }, T, HOY).ok).toBe(true); // el mismo día
    expect(validateRespuesta({ resultado: "no_respondio", fecha: "2026-11-12" }, T, HOY).errors.resultado).toBeTruthy();
    expect(validateRespuesta({ resultado: "", fecha: "2026-11-12" }, T, HOY).errors.resultado).toBeTruthy();
    expect(validateRespuesta({ resultado: "queja", fecha: "2026-11-09" }, T, HOY).errors.fecha).toMatch(/anterior al contacto/);
    expect(validateRespuesta({ resultado: "queja", fecha: "2999-01-01" }, T, HOY).errors.fecha).toMatch(/futura/);
    expect(validateRespuesta({ resultado: "queja", fecha: "x" }, T, HOY).errors.fecha).toBeTruthy();
  });
  it("respuestaInfo / respuestaTexto: cuántos días después respondió", () => {
    expect(respuestaInfo({ ...T })).toBeNull();
    expect(respuestaInfo({ ...T, respondio_en: "2026-11-13" })).toEqual({ fecha: "2026-11-13", dias: 3 });
    expect(respuestaTexto({ ...T, respondio_en: "2026-11-13" })).toBe("respondió el 13/11/2026, 3 días después");
    expect(respuestaTexto({ ...T, respondio_en: "2026-11-11" })).toBe("respondió el 11/11/2026, 1 día después");
    expect(respuestaTexto({ ...T, respondio_en: "2026-11-10" })).toBe("respondió el 10/11/2026, el mismo día");
    expect(respuestaTexto(T)).toBe("");
  });
  it("notaConRespuesta agrega lo nuevo sin pisar la nota original", () => {
    expect(notaConRespuesta(T, "2026-11-13", "Dice que está de viaje")).toBe("Le escribí por WhatsApp\nRespondió el 13/11/2026: Dice que está de viaje");
    expect(notaConRespuesta(T, "2026-11-13", "  ")).toBe("Le escribí por WhatsApp");
    expect(notaConRespuesta({ nota: "" }, "2026-11-13", "ok")).toBe("Respondió el 13/11/2026: ok");
    expect(notaConRespuesta({ nota: "" }, "2026-11-13", "")).toBeNull();
  });
  it("la constancia cuenta como respuesta al contacto actualizado y muestra cuándo contestó", () => {
    const r = row({ company_name: "Inmo Paz" });
    const t = (fecha, resultado, extra = {}) => ({ fecha, resultado, canal: "whatsapp", created_at: fecha + "T10:00:00Z", author_email: "tici@spicytool.net", nota: "", ...extra });
    const txt = buildConstancia(r, [t("2026-11-02", "respondio", { respondio_en: "2026-11-05" }), t("2026-11-09", "no_respondio")], HOY);
    expect(txt).toContain("Intentos de contacto: 2 (1 sin respuesta, 1 con respuesta)");
    expect(txt).toContain("Último contacto con respuesta: 05/11/2026");
    expect(txt).toContain("- 02/11/2026 · WhatsApp · Respondió (contestó el 05/11/2026, 3 días después)");
  });
});
