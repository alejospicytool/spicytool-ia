import { describe, it, expect } from "vitest";
import { nextDay, taskEvent, onboardingEvent, usersForName, eventHash } from "./calendarEvents.js";

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
