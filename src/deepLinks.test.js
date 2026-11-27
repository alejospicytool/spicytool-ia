import { describe, it, expect } from "vitest";
import { entitySearch, buildEntityLink, parseEntityLink, clearedSearch, LINK_TARGETS } from "./deepLinks.js";

describe("links directos", () => {
  it("arma el link de cada tipo", () => {
    expect(buildEntityLink("https://backoffice.wearespicy.net", "ticket", "tk_1790782282727")).toBe("https://backoffice.wearespicy.net/?ticket=tk_1790782282727");
    expect(entitySearch("dev_task", "dt_1")).toBe("?devtask=dt_1");
    expect(entitySearch("task", "task_9")).toBe("?task=task_9");
    expect(entitySearch("onboarding", "ob_1")).toBe("?onboarding=ob_1"); // el que llevan los eventos de Google Calendar
  });
  it("codifica ids raros y no arma links sin id o de tipos desconocidos", () => {
    expect(entitySearch("ticket", "a b&c")).toBe("?ticket=a%20b%26c");
    expect(entitySearch("ticket", "")).toBe("");
    expect(entitySearch("otro", "x")).toBe("");
  });
  it("lee el link de la URL (ida y vuelta)", () => {
    expect(parseEntityLink("?ticket=tk_1")).toEqual({ type: "ticket", id: "tk_1" });
    expect(parseEntityLink("?devtask=dt_1")).toEqual({ type: "dev_task", id: "dt_1" });
    expect(parseEntityLink(entitySearch("task", "a b&c"))).toEqual({ type: "task", id: "a b&c" });
    expect(parseEntityLink("?onboarding=ob_1")).toEqual({ type: "onboarding", id: "ob_1" });
  });
  it("ignora URLs sin link", () => {
    expect(parseEntityLink("")).toBeNull();
    expect(parseEntityLink("?foo=bar")).toBeNull();
    expect(parseEntityLink("?ticket=")).toBeNull();
    expect(parseEntityLink(undefined)).toBeNull();
  });
  it("clearedSearch saca solo los parámetros de link", () => {
    expect(clearedSearch("?ticket=tk_1")).toBe("");
    expect(clearedSearch("?ticket=tk_1&utm=x")).toBe("?utm=x");
    expect(clearedSearch("?utm=x")).toBe("?utm=x");
  });
  it("cada tipo abre su vista y exige su sección", () => {
    expect(LINK_TARGETS.ticket).toEqual({ view: "tickets", section: "Operaciones" });
    expect(LINK_TARGETS.dev_task).toEqual({ view: "devtasks", section: "Devs" });
    expect(LINK_TARGETS.task).toEqual({ view: "tasks", section: "Operaciones" });
    expect(LINK_TARGETS.onboarding).toEqual({ view: "onboarding", section: "Operaciones" });
  });
});
