import { describe, it, expect } from "vitest";
import { closureEvents, weekStartBA, dayBA, scoreRequiredForStatus } from "./metricsLogic.js";

const CERRADOS = ["Testeando (Prod)", "Solucionado", "Archivado"];
const h = (ticket_id, status, changed_at) => ({ ticket_id, status, changed_at });

describe("closureEvents: un cierre por ticket", () => {
  it("Testeando → Solucionado → Archivado cuenta una sola vez, el día que entró al grupo", () => {
    const hist = [
      h("a", "Inicio", "2026-10-01T10:00:00Z"), h("a", "En Curso", "2026-10-02T10:00:00Z"),
      h("a", "Testeando (Prod)", "2026-10-05T10:00:00Z"), h("a", "Solucionado", "2026-10-06T10:00:00Z"), h("a", "Archivado", "2026-10-20T10:00:00Z"),
    ];
    expect(closureEvents(hist, "ticket_id", "status", CERRADOS, { a: "Archivado" })).toEqual([{ id: "a", changed_at: "2026-10-05T10:00:00Z" }]);
  });
  it("un ticket reabierto no suma mientras esté abierto", () => {
    const hist = [h("a", "Solucionado", "2026-10-05T10:00:00Z"), h("a", "En Curso", "2026-10-06T10:00:00Z")];
    expect(closureEvents(hist, "ticket_id", "status", CERRADOS, { a: "En Curso" })).toEqual([]);
  });
  it("si se reabre y se vuelve a cerrar, cuenta en el último cierre", () => {
    const hist = [h("a", "Solucionado", "2026-10-05T10:00:00Z"), h("a", "En Curso", "2026-10-06T10:00:00Z"), h("a", "Solucionado", "2026-10-09T10:00:00Z")];
    expect(closureEvents(hist, "ticket_id", "status", CERRADOS, { a: "Solucionado" })).toEqual([{ id: "a", changed_at: "2026-10-09T10:00:00Z" }]);
  });
  it("el orden del historial no importa y cada ticket va por separado", () => {
    const hist = [h("b", "Solucionado", "2026-10-07T10:00:00Z"), h("a", "Solucionado", "2026-10-05T10:00:00Z"), h("a", "Archivado", "2026-10-08T10:00:00Z")];
    const ev = closureEvents(hist, "ticket_id", "status", CERRADOS, { a: "Archivado", b: "Solucionado" });
    expect(ev.sort((x, y) => x.id.localeCompare(y.id))).toEqual([{ id: "a", changed_at: "2026-10-05T10:00:00Z" }, { id: "b", changed_at: "2026-10-07T10:00:00Z" }]);
  });
  it("funciona con las etapas de tareas de dev (Testing → Done)", () => {
    const hist = [{ dev_task_id: "t", stage: "Testing", changed_at: "2026-10-05T10:00:00Z" }, { dev_task_id: "t", stage: "Done", changed_at: "2026-10-07T10:00:00Z" }];
    expect(closureEvents(hist, "dev_task_id", "stage", ["Testing", "Done"], { t: "Done" })).toHaveLength(1);
  });
  it("sin historial o con estado actual desconocido no genera eventos", () => {
    expect(closureEvents([], "ticket_id", "status", CERRADOS, {})).toEqual([]);
    expect(closureEvents([h("x", "Solucionado", "2026-10-05T10:00:00Z")], "ticket_id", "status", CERRADOS, {})).toEqual([]);
  });
});

describe("semanas en horario de Buenos Aires", () => {
  it("un cierre el lunes a las 22:30 (01:30Z del martes) queda en la semana de ese lunes", () => {
    expect(dayBA("2026-10-13T01:30:00Z")).toBe("2026-10-12");
    expect(weekStartBA("2026-10-13T01:30:00Z")).toBe("2026-10-12");
  });
  it("todos los instantes de una misma semana comparten el mismo lunes", () => {
    const week = ["2026-10-12T04:00:00Z", "2026-10-14T15:00:00Z", "2026-10-17T23:00:00Z", "2026-10-19T02:59:00Z"].map(weekStartBA);
    expect(new Set(week)).toEqual(new Set(["2026-10-12"]));
  });
  it("el domingo a la noche pertenece a la semana que termina, no a la siguiente", () => {
    expect(weekStartBA("2026-10-19T01:00:00Z")).toBe("2026-10-12"); // domingo 18/10 22:00 BA
    expect(weekStartBA("2026-10-19T03:00:00Z")).toBe("2026-10-19"); // lunes 00:00 BA
  });
});

describe("puntaje obligatorio según el estado", () => {
  it("no se puede sacar el puntaje en curso ni cerrado", () => {
    expect(scoreRequiredForStatus("En curso")).toBe(true);
    expect(scoreRequiredForStatus("Cerrados")).toBe(true);
    expect(scoreRequiredForStatus("Sin empezar")).toBe(false);
    expect(scoreRequiredForStatus("En espera")).toBe(false);
    expect(scoreRequiredForStatus(null)).toBe(false);
  });
});
