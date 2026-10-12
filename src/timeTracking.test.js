import { describe, it, expect } from "vitest";
import {
  formatClock, formatHM, formatHours, formatDiffHours, baDateISO, addDaysISO, weekRangeISO, monthRangeISO,
  baTimeToISO, formatTimeBA, estadoUI, liveSeconds, shouldSendHeartbeat, isIdleExpired, toCSV, csvEscape,
  weekdayShort, timeErrorMessage,
} from "./timeTracking.js";

describe("formato de duraciones", () => {
  it("formatClock", () => {
    expect(formatClock(0)).toBe("00:00:00");
    expect(formatClock(3661)).toBe("01:01:01");
    expect(formatClock(10800)).toBe("03:00:00");
    expect(formatClock(-5)).toBe("00:00:00");
  });
  it("formatHM", () => {
    expect(formatHM(59)).toBe("0m");
    expect(formatHM(60)).toBe("1m");
    expect(formatHM(1800)).toBe("30m");
    expect(formatHM(27120)).toBe("7h 32m");
  });
  it("formatHours / formatDiffHours", () => {
    expect(formatHours(7.5)).toBe("7,5 h");
    expect(formatHours(8)).toBe("8 h");
    expect(formatDiffHours(-1.25)).toBe("-1,25 h");
    expect(formatDiffHours(2)).toBe("+2 h");
    expect(formatDiffHours(0)).toBe("0 h");
  });
});

describe("fechas en Buenos Aires", () => {
  it("baDateISO usa la fecha de Buenos Aires, no la UTC", () => {
    expect(baDateISO(new Date("2026-10-28T02:30:00Z"))).toBe("2026-10-27");
    expect(baDateISO(new Date("2026-10-28T03:00:00Z"))).toBe("2026-10-28");
  });
  it("addDaysISO cruza meses y años", () => {
    expect(addDaysISO("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysISO("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("weekRangeISO devuelve lunes a domingo", () => {
    expect(weekRangeISO("2026-10-12")).toEqual({ desde: "2026-10-12", hasta: "2026-10-18" }); // lunes
    expect(weekRangeISO("2026-10-14")).toEqual({ desde: "2026-10-12", hasta: "2026-10-18" }); // miércoles
    expect(weekRangeISO("2026-10-18")).toEqual({ desde: "2026-10-12", hasta: "2026-10-18" }); // domingo
    expect(weekRangeISO("2026-10-19")).toEqual({ desde: "2026-10-19", hasta: "2026-10-25" });
  });
  it("monthRangeISO", () => {
    expect(monthRangeISO("2026-10-15")).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" });
    expect(monthRangeISO("2026-02-03")).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
  });
  it("baTimeToISO y formatTimeBA son inversos", () => {
    const iso = baTimeToISO("2026-10-12", "09:30");
    expect(new Date(iso).toISOString()).toBe("2026-10-12T12:30:00.000Z");
    expect(formatTimeBA(iso)).toBe("09:30");
    expect(formatTimeBA(null)).toBe("—");
  });
  it("weekdayShort", () => {
    expect(weekdayShort("2026-10-12")).toBe("lun");
    expect(weekdayShort("2026-10-18")).toBe("dom");
  });
});

describe("estado y reloj en vivo", () => {
  const trabajando = { jornada: { estado: "trabajando" }, hoy_segundos: 600, puede_extender_segundos: 1200, jornadas_hoy: 1 };
  it("estadoUI", () => {
    expect(estadoUI(null)).toBe("sin_iniciar");
    expect(estadoUI({ jornada: null, jornadas_hoy: 0 })).toBe("sin_iniciar");
    expect(estadoUI({ jornada: null, jornadas_hoy: 2 })).toBe("finalizada");
    expect(estadoUI(trabajando)).toBe("trabajando");
    expect(estadoUI({ jornada: { estado: "pausa" }, jornadas_hoy: 1 })).toBe("pausa");
  });
  it("liveSeconds suma lo transcurrido mientras trabaja", () => {
    expect(liveSeconds(trabajando, 1000, 1000 + 30_000)).toBe(630);
  });
  it("liveSeconds no pasa del tope que informa el servidor", () => {
    expect(liveSeconds({ ...trabajando, puede_extender_segundos: 100 }, 0, 60 * 60 * 1000)).toBe(700);
  });
  it("liveSeconds no avanza en pausa ni finalizada", () => {
    expect(liveSeconds({ jornada: { estado: "pausa" }, hoy_segundos: 600 }, 0, 99_000)).toBe(600);
    expect(liveSeconds({ jornada: null, hoy_segundos: 900 }, 0, 99_000)).toBe(900);
    expect(liveSeconds(null, 0, 1)).toBe(0);
  });
});

describe("heartbeat e inactividad", () => {
  it("solo manda heartbeat con la pestaña visible y actividad reciente", () => {
    expect(shouldSendHeartbeat({ visible: true, idleMs: 10_000, heartbeatSeconds: 60 })).toBe(true);
    expect(shouldSendHeartbeat({ visible: true, idleMs: 60_000, heartbeatSeconds: 60 })).toBe(true);
    expect(shouldSendHeartbeat({ visible: true, idleMs: 61_000, heartbeatSeconds: 60 })).toBe(false);
    expect(shouldSendHeartbeat({ visible: false, idleMs: 1_000, heartbeatSeconds: 60 })).toBe(false);
  });
  it("el umbral de inactividad viene de la configuración", () => {
    expect(isIdleExpired({ idleMs: 19 * 60_000, inactivityMinutes: 20 })).toBe(false);
    expect(isIdleExpired({ idleMs: 20 * 60_000, inactivityMinutes: 20 })).toBe(true);
    expect(isIdleExpired({ idleMs: 20 * 60_000, inactivityMinutes: 30 })).toBe(false);
  });
});

describe("CSV", () => {
  it("escapa comas, comillas y saltos de línea", () => {
    expect(csvEscape('Pérez, Juan')).toBe('"Pérez, Juan"');
    expect(csvEscape('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(7.5)).toBe("7.5");
  });
  it("toCSV arma cabecera y filas en el orden de las columnas", () => {
    const csv = toCSV(
      [{ nombre: "Lucas, E.", horas: 8 }, { nombre: "Tici", horas: 6.5 }],
      [{ key: "nombre", label: "Persona" }, { key: "horas", label: "Horas" }],
    );
    expect(csv).toBe('Persona,Horas\r\n"Lucas, E.",8\r\nTici,6.5');
  });
});

describe("errores de la base", () => {
  it("traduce los códigos conocidos", () => {
    expect(timeErrorMessage({ message: "ya_hay_jornada_abierta" })).toBe("Ya tenés una jornada abierta.");
    expect(timeErrorMessage({ message: "ERROR: se_superpone" })).toContain("se superpone");
  });
  it("deja pasar lo desconocido", () => {
    expect(timeErrorMessage({ message: "algo raro" })).toBe("algo raro");
  });
});

describe("errores del resumen del día", () => {
  it("traduce los códigos nuevos", () => {
    expect(timeErrorMessage({ message: "resumen_requerido" })).toContain("resumen del día");
    expect(timeErrorMessage({ message: "resumen_ya_cargado" })).toContain("ya tiene");
  });
});
