import { describe, it, expect } from "vitest";
import { callAi, aiErrorMessage } from "./crmAi.js";

describe("callAi", () => {
  it("devuelve la respuesta de la función", async () => {
    const sb = { functions: { invoke: async (name, { body }) => ({ data: { text: "hola " + name + body.mode }, error: null }) } };
    expect(await callAi(sb, { mode: "chat" })).toEqual({ text: "hola crm-aichat" });
  });
  it("traduce los errores de la función", async () => {
    const err = (status, json) => ({ data: null, error: { context: { status, json: async () => json } } });
    await expect(callAi({ functions: { invoke: async () => err(429, { error: "rate_limited" }) } }, {})).rejects.toMatchObject({ code: "rate_limited", message: /límite de uso/ });
    await expect(callAi({ functions: { invoke: async () => err(404, {}) } }, {})).rejects.toMatchObject({ code: "not_deployed" });
    await expect(callAi({ functions: { invoke: async () => err(500, null) } }, {})).rejects.toMatchObject({ code: "upstream_error" });
    await expect(callAi({ functions: { invoke: async () => ({ data: { error: "forbidden" }, error: null }) } }, {})).rejects.toMatchObject({ code: "forbidden" });
  });
  it("mensaje por defecto para códigos desconocidos", () => {
    expect(aiErrorMessage("x")).toMatch(/No pude responder/);
  });
});
