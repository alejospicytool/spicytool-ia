import { describe, it, expect, vi } from "vitest";
import { askConfirm, settleConfirm, getConfirmState, subscribeConfirm } from "./confirmStore.js";

describe("askConfirm", () => {
  it("queda abierto hasta que se responde, y confirmar devuelve true", async () => {
    const p = askConfirm({ title: "Eliminar ticket", message: "x" });
    expect(getConfirmState()).toMatchObject({ title: "Eliminar ticket", confirmLabel: "Eliminar", danger: true });
    settleConfirm(true);
    expect(await p).toBe(true);
    expect(getConfirmState()).toBeNull();
  });
  it("cancelar devuelve false", async () => {
    const p = askConfirm();
    settleConfirm(false);
    expect(await p).toBe(false);
  });
  it("si se abre otro cartel, el anterior se cancela y no se borra nada", async () => {
    const a = askConfirm({ title: "A" });
    const b = askConfirm({ title: "B" });
    expect(await a).toBe(false);
    expect(getConfirmState().title).toBe("B");
    settleConfirm(true);
    expect(await b).toBe(true);
  });
  it("responder sin cartel abierto no hace nada", () => { expect(() => settleConfirm(true)).not.toThrow(); });
  it("avisa a quien escucha cuando abre y cuando cierra", async () => {
    const fn = vi.fn();
    const off = subscribeConfirm(fn);
    const p = askConfirm();
    settleConfirm(true);
    await p;
    off();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
