import { describe, it, expect } from "vitest";
import { nextDay, taskEvent, onboardingEvent, usersForName, eventHash, todayInBA, crmEvent, addMinutesLocal } from "./calendarEvents.js";

const APP = "https://backoffice.test";
const task = (over = {}) => ({ id: "task_1", title: "Armar portfolio", start_date: "2026-12-01", end_date: "2026-12-03", priority: "Alta", stage: "En Curso", description: "Con las fotos nuevas", ...over });
const step = (over = {}) => ({ id: "ob_1", client_name: "Miraglia Propiedades", etapa_actual: "Conectar WhatsApp", proximo_paso: "Llamar para vincular el número", proximo_paso_fecha: "2026-12-04", proximo_paso_quien: "Nico", ...over });

describe("nextDay", () => {
  it("suma un día, también a fin de mes y de año", () => {
    expect(nextDay("2026-12-03")).toBe("2026-12-04");
    expect(nextDay("2026-11-30")).toBe("2026-12-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
    expect(nextDay("2028-02-28")).toBe("2028-02-29");
  });
});

describe("taskEvent", () => {
  it("evento de día completo con el fin exclusivo, link de vuelta y marca para reconocerlo", () => {
    const e = taskEvent(task(), { appUrl: APP });
    expect(e.summary).toBe("Tarea: Armar portfolio");
    expect(e.start).toEqual({ date: "2026-12-01" });
    expect(e.end).toEqual({ date: "2026-12-04" });
    expect(e.description).toContain("Prioridad: Alta");
    expect(e.description).toContain("Con las fotos nuevas");
    expect(e.description).toContain(`${APP}/?task=task_1`);
    expect(e.extendedProperties.private.spicytool).toBe("task:task_1");
    expect(e.transparency).toBe("transparent");
    expect(e.colorId).toBe("11");
  });
  it("una tarea de un solo día termina al día siguiente (así lo pide Google)", () => {
    expect(taskEvent(task({ start_date: "2026-12-01", end_date: "2026-12-01" }), { appUrl: APP }).end).toEqual({ date: "2026-12-02" });
  });
  it("archivada no tiene evento", () => {
    expect(taskEvent(task({ stage: "Archivado" }), { appUrl: APP, hasLink: true })).toBeNull();
  });
  it("finalizada: solo si ya tenía evento, y queda con ✓ y en gris", () => {
    expect(taskEvent(task({ stage: "Finalizado" }), { appUrl: APP, hasLink: false })).toBeNull();
    const e = taskEvent(task({ stage: "Finalizado" }), { appUrl: APP, hasLink: true });
    expect(e.summary).toBe("✓ Tarea: Armar portfolio");
    expect(e.colorId).toBe("8");
  });
  it("sin fechas válidas no hay evento; fin anterior al inicio se corrige", () => {
    expect(taskEvent(task({ start_date: null }), { appUrl: APP })).toBeNull();
    expect(taskEvent(task({ end_date: "mañana" }), { appUrl: APP })).toBeNull();
    expect(taskEvent(null, { appUrl: APP })).toBeNull();
    expect(taskEvent(task({ start_date: "2026-12-05", end_date: "2026-12-01" }), { appUrl: APP }).end).toEqual({ date: "2026-12-06" });
  });
  it("títulos larguísimos o vacíos no rompen", () => {
    expect(taskEvent(task({ title: "x".repeat(500) }), { appUrl: APP }).summary.length).toBeLessThan(170);
    expect(taskEvent(task({ title: "" }), { appUrl: APP }).summary).toBe("Tarea: Sin título");
  });
});

describe("onboardingEvent", () => {
  it("título con el cliente y el paso, día completo y link al cliente", () => {
    const e = onboardingEvent(step(), { appUrl: APP });
    expect(e.summary).toBe("Onboarding · Miraglia Propiedades: Llamar para vincular el número");
    expect(e.start).toEqual({ date: "2026-12-04" });
    expect(e.end).toEqual({ date: "2026-12-05" });
    expect(e.description).toContain("Responsable: Nico");
    expect(e.description).toContain(`${APP}/?onboarding=ob_1`);
    expect(e.extendedProperties.private.spicytool).toBe("onboarding:ob_1");
  });
  it("sin paso o sin fecha válida no hay evento", () => {
    expect(onboardingEvent(step({ proximo_paso: null }), { appUrl: APP })).toBeNull();
    expect(onboardingEvent(step({ proximo_paso_fecha: null }), { appUrl: APP })).toBeNull();
    expect(onboardingEvent(step({ proximo_paso_fecha: "12/04" }), { appUrl: APP })).toBeNull();
    expect(onboardingEvent(null, { appUrl: APP })).toBeNull();
  });
});

describe("eventHash", () => {
  it("igual para el mismo evento y distinto si cambia algo", () => {
    expect(eventHash(taskEvent(task(), { appUrl: APP }))).toBe(eventHash(taskEvent(task(), { appUrl: APP })));
    expect(eventHash(taskEvent(task(), { appUrl: APP }))).not.toBe(eventHash(taskEvent(task({ end_date: "2026-12-09" }), { appUrl: APP })));
  });
});

describe("usersForName", () => {
  const people = [
    { user_id: "u1", email: "nicolas@spicytool.net", first_name: "Nicolás" },
    { user_id: "u2", email: "ticiana@spicytool.net", first_name: "Ticiana" },
    { user_id: "u3", email: "lucas@spicytool.net", first_name: null },
  ];
  it("'Nico' coincide con Nicolás; por mail también", () => {
    expect(usersForName("Nico", people).users.map((u) => u.user_id)).toEqual(["u1"]);
    expect(usersForName("Lucas", people).users.map((u) => u.user_id)).toEqual(["u3"]);
    expect(usersForName("ticiana", people).users.map((u) => u.user_id)).toEqual(["u2"]);
  });
  it("sin nombre o sin coincidencia no elige a nadie", () => {
    expect(usersForName("", people)).toEqual({ users: [], ambiguous: false });
    expect(usersForName("Beto", people)).toEqual({ users: [], ambiguous: false });
  });
  it("con dos coincidencias elige solo si una se llama exactamente así; si no, es ambiguo", () => {
    const dos = [...people, { user_id: "u4", email: "nico@otro.com", first_name: "Nico" }];
    expect(usersForName("Nico", dos).users.map((u) => u.user_id)).toEqual(["u4"]);
    const tres = [{ user_id: "a", email: "nicolas@x.com", first_name: "Nicolás" }, { user_id: "b", email: "nicole@x.com", first_name: "Nicole" }];
    expect(usersForName("Nico", tres)).toEqual({ users: [], ambiguous: true });
  });
});

describe("lo vencido se arrastra hasta hoy", () => {
  const TODAY = "2026-12-10";
  it("tarea Alta vencida: se estira hasta hoy, con 'Vencida', en rojo y aclarando cuándo venció", () => {
    const e = taskEvent(task({ end_date: "2026-12-03" }), { appUrl: APP, today: TODAY });
    expect(e.summary).toBe("Vencida · Tarea: Armar portfolio");
    expect(e.start).toEqual({ date: "2026-12-01" });
    expect(e.end).toEqual({ date: "2026-12-11" });
    expect(e.colorId).toBe("11");
    expect(e.description).toContain("Venció el 03/12");
  });
  it("tarea Alta que vence hoy o más adelante no cambia", () => {
    expect(taskEvent(task({ end_date: TODAY }), { appUrl: APP, today: TODAY }).summary).toBe("Tarea: Armar portfolio");
    expect(taskEvent(task({ end_date: "2026-12-20" }), { appUrl: APP, today: TODAY }).end).toEqual({ date: "2026-12-21" });
  });
  it("tareas Media/Baja no se arrastran, ni las finalizadas", () => {
    expect(taskEvent(task({ priority: "Media", end_date: "2026-12-03" }), { appUrl: APP, today: TODAY }).end).toEqual({ date: "2026-12-04" });
    expect(taskEvent(task({ priority: "Baja", end_date: "2026-12-03" }), { appUrl: APP, today: TODAY }).summary).toBe("Tarea: Armar portfolio");
    const f = taskEvent(task({ stage: "Finalizado", end_date: "2026-12-03" }), { appUrl: APP, today: TODAY, hasLink: true });
    expect(f.summary).toBe("✓ Tarea: Armar portfolio");
    expect(f.end).toEqual({ date: "2026-12-04" });
  });
  it("sin 'today' no se arrastra nada", () => {
    expect(taskEvent(task({ end_date: "2026-12-03" }), { appUrl: APP }).end).toEqual({ date: "2026-12-04" });
    expect(onboardingEvent(step({ proximo_paso_fecha: "2026-12-01" }), { appUrl: APP }).end).toEqual({ date: "2026-12-02" });
  });
  it("paso de Onboarding vencido: desde su fecha hasta hoy, con 'Vencido'", () => {
    const e = onboardingEvent(step({ proximo_paso_fecha: "2026-12-07" }), { appUrl: APP, today: TODAY });
    expect(e.summary).toMatch(/^Vencido · Onboarding · Miraglia/);
    expect(e.start).toEqual({ date: "2026-12-07" });
    expect(e.end).toEqual({ date: "2026-12-11" });
    expect(e.description).toContain("Venció el 07/12");
    expect(onboardingEvent(step({ proximo_paso_fecha: TODAY }), { appUrl: APP, today: TODAY }).summary).toMatch(/^Onboarding/);
  });
  it("todayInBA usa la fecha de Argentina, no la del servidor", () => {
    expect(todayInBA(Date.parse("2026-11-27T01:30:00Z"))).toBe("2026-11-26"); // 22:30 del 26 en Buenos Aires
    expect(todayInBA(Date.parse("2026-11-27T15:00:00Z"))).toBe("2026-11-27");
  });
});

describe("crmEvent (CRM comercial)", () => {
  const TODAY = "2026-11-27";
  const item = (over = {}) => ({ k: "task", id: "k1", titulo: "Follow up propuesta", fecha: "2026-12-01", hora: "11:00", tipo: "followup", done: false, calOn: true, dealId: "d1", empresa: "Ngr inmobiliaria", vendedor: "Hernán", notas: "Llamar después de las 10", ...over });
  it("evento con hora de Argentina, 15 min, que NO bloquea", () => {
    const e = crmEvent(item(), { appUrl: APP, today: TODAY });
    expect(e.summary).toBe("Seguimiento · Ngr inmobiliaria: Follow up propuesta");
    expect(e.start).toEqual({ dateTime: "2026-12-01T11:00:00", timeZone: "America/Argentina/Buenos_Aires" });
    expect(e.end).toEqual({ dateTime: "2026-12-01T11:15:00", timeZone: "America/Argentina/Buenos_Aires" });
    expect(e.transparency).toBe("transparent");
    expect(e.description).toContain("Vendedor: Hernán");
    expect(e.description).toContain("Llamar después de las 10");
    expect(e.description).toContain(`${APP}/?crm=d1`);
    expect(e.extendedProperties.private.spicytool).toBe("crm_task:k1");
  });
  it("las reuniones duran 30 minutos (como dice el formulario del CRM) y BLOQUEAN el horario", () => {
    const e = crmEvent(item({ tipo: "reunion", titulo: "Demo", hora: "13:30" }), { appUrl: APP, today: TODAY });
    expect(e.summary).toBe("Reunión · Ngr inmobiliaria: Demo");
    expect(e.end.dateTime).toBe("2026-12-01T14:00:00");
    expect(e.transparency).toBe("opaque");
  });
  it("la próxima acción de un deal tiene su propia marca", () => {
    const e = crmEvent(item({ k: "deal", id: "d9", dealId: "d9", tipo: "reunion" }), { appUrl: APP });
    expect(e.extendedProperties.private.spicytool).toBe("crm_deal:d9");
  });
  it("sin deal el link va a la pestaña de tareas; sin empresa el título no queda con 'undefined'", () => {
    const e = crmEvent(item({ dealId: "", empresa: undefined, tipo: "tarea", titulo: "FOLLOW UP A LOS FREEMIUM" }), { appUrl: APP });
    expect(e.description).toContain(`${APP}/?crm=tareas`);
    expect(e.summary).toBe("Tarea CRM · FOLLOW UP A LOS FREEMIUM");
  });
  it("una reunión tarde a la noche termina al día siguiente sin romperse", () => {
    expect(addMinutesLocal("2026-11-30", "23:30", 60)).toBe("2026-12-01T00:30:00");
    expect(addMinutesLocal("2026-12-31", "23:50", 15)).toBe("2027-01-01T00:05:00");
  });
  it("hora vacía o rara usa las 9:00", () => {
    expect(crmEvent(item({ hora: "" }), { appUrl: APP }).start.dateTime).toBe("2026-12-01T09:00:00");
    expect(crmEvent(item({ hora: "9am" }), { appUrl: APP }).start.dateTime).toBe("2026-12-01T09:00:00");
  });
  it("calOn apagado, sin fecha o fecha rara: sin evento (calOn sin definir cuenta como prendido)", () => {
    expect(crmEvent(item({ calOn: false }), { appUrl: APP })).toBeNull();
    expect(crmEvent(item({ calOn: undefined }), { appUrl: APP })).not.toBeNull();
    expect(crmEvent(item({ fecha: "" }), { appUrl: APP })).toBeNull();
    expect(crmEvent(item({ fecha: "1/12" }), { appUrl: APP })).toBeNull();
    expect(crmEvent(null, { appUrl: APP })).toBeNull();
  });
  it("hecha: solo queda (con ✓, sin bloquear) si ya tenía evento", () => {
    expect(crmEvent(item({ done: true }), { appUrl: APP, hasLink: false })).toBeNull();
    const e = crmEvent(item({ done: true, tipo: "reunion" }), { appUrl: APP, hasLink: true });
    expect(e.summary.startsWith("✓ Reunión")).toBe(true);
    expect(e.transparency).toBe("transparent");
    expect(e.colorId).toBe("8");
  });
  it("sin arrastre: lo vencido queda en su hora. Y no se crean las muy viejas (más de 14 días) que nunca se agendaron", () => {
    const e = crmEvent(item({ fecha: "2026-11-20" }), { appUrl: APP, today: TODAY, hasLink: false });
    expect(e.start.dateTime).toBe("2026-11-20T11:00:00");
    expect(e.end.dateTime).toBe("2026-11-20T11:15:00");
    expect(crmEvent(item({ fecha: "2026-11-01" }), { appUrl: APP, today: TODAY, hasLink: false })).toBeNull();
    expect(crmEvent(item({ fecha: "2026-11-01" }), { appUrl: APP, today: TODAY, hasLink: true })).not.toBeNull(); // si ya estaba, se mantiene
  });
});
