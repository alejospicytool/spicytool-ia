import { describe, it, expect, beforeEach } from "vitest";
import { buildPlan, extractJson, handle, rateLimited, resetRateLimit, AI_RULES } from "./index.ts";

const jwt = (sub) => "h." + btoa(JSON.stringify({ sub })) + ".s";
const post = (body, sub = "u1") => new Request("http://x/crm-ai", { method: "POST", headers: { authorization: "Bearer " + jwt(sub), "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
const deps = (over = {}) => ({ apiKey: "k", model: "m", hasAccess: async () => true, callClaude: async () => ({ status: 200, body: { content: [{ type: "text", text: "hola" }] } }), ...over });

beforeEach(() => resetRateLimit());

describe("buildPlan", () => {
  it("chat: la pregunta lleva los datos del CRM y las reglas van como system", () => {
    const p = buildPlan({ mode: "chat", data: { deals: [1] }, messages: [{ role: "assistant", content: "ignorado: empieza por assistant" }, { role: "user", content: "¿qué empujo?" }] });
    expect(p.system).toBe(AI_RULES);
    expect(p.messages).toHaveLength(1);
    expect(p.messages[0].content).toContain('Datos del CRM (JSON):\n{"deals":[1]}');
    expect(p.messages[0].content).toContain("Pregunta: ¿qué empujo?");
    expect(p.json).toBe(false);
  });
  it("chat: recorta a 9 turnos, limita el largo y exige terminar en una pregunta del usuario", () => {
    const msgs = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "x".repeat(10000) + i }));
    msgs.push({ role: "user", content: "final" });
    const p = buildPlan({ mode: "chat", data: {}, messages: msgs });
    expect(p.messages.length).toBeLessThanOrEqual(9);
    expect(p.messages.at(-1).content).toBe("final");
    p.messages.slice(1).forEach((m) => expect(m.content.length).toBeLessThanOrEqual(4000));
    expect(buildPlan({ mode: "chat", data: {}, messages: [{ role: "assistant", content: "x" }] })).toEqual({ error: "bad_request" });
  });
  it("brief, paste y next", () => {
    expect(buildPlan({ mode: "brief", data: {}, hoy: "2026-11-10" }).messages[0].content).toContain("Hoy es 2026-11-10");
    const paste = buildPlan({ mode: "paste", text: "Hola, soy Juan de Acme, quiero una demo", context: { paises: ["Argentina"] } });
    expect(paste.json).toBe(true);
    expect(paste.messages[0].content).toContain("Respondé SOLO un objeto JSON");
    expect(paste.messages[0].content).toContain('"paises":["Argentina"]');
    expect(buildPlan({ mode: "next", info: { empresa: "A" } }).messages[0].content).toContain('"analisis"');
  });
  it("rechaza pedidos inválidos", () => {
    [null, "x", {}, { mode: "otro" }, { mode: "chat" }, { mode: "brief", data: {} }, { mode: "paste", text: "corto", context: {} }, { mode: "paste", text: "texto largo suficiente", context: null }, { mode: "next" }]
      .forEach((b) => expect(buildPlan(b)).toEqual({ error: "bad_request" }));
  });
});

describe("extractJson", () => {
  it("saca el objeto aunque venga entre ``` o con texto alrededor", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Acá va: {"a":{"b":2}} listo')).toEqual({ a: { b: 2 } });
    expect(extractJson("sin json")).toBeNull();
    expect(extractJson("{roto")).toBeNull();
  });
});

describe("handle", () => {
  it("responde el texto de Claude", async () => {
    const r = await handle(post({ mode: "brief", data: {}, hoy: "2026-11-10" }), deps());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ text: "hola" });
  });
  it("manda el modelo, el system y los mensajes a Claude", async () => {
    let seen;
    await handle(post({ mode: "chat", data: {}, messages: [{ role: "user", content: "hola" }] }), deps({ callClaude: async (p, key) => { seen = { p, key }; return { status: 200, body: { content: [{ type: "text", text: "ok" }] } }; } }));
    expect(seen.key).toBe("k");
    expect(seen.p).toMatchObject({ model: "m", max_tokens: 1024, system: AI_RULES });
  });
  it("modo JSON devuelve el objeto; si el modelo no devuelve JSON, error", async () => {
    const ok = await handle(post({ mode: "next", info: {} }), deps({ callClaude: async () => ({ status: 200, body: { content: [{ type: "text", text: 'Dale: {"accion":"Llamar"}' }] } }) }));
    expect(await ok.json()).toEqual({ json: { accion: "Llamar" } });
    const bad = await handle(post({ mode: "next", info: {} }), deps({ callClaude: async () => ({ status: 200, body: { content: [{ type: "text", text: "no sé" }] } }) }));
    expect(bad.status).toBe(502);
    expect((await bad.json()).error).toBe("bad_model_output");
  });
  it("sin acceso al CRM -> 403 y NO llama a Claude", async () => {
    let called = false;
    const r = await handle(post({ mode: "brief", data: {}, hoy: "x" }), deps({ hasAccess: async () => false, callClaude: async () => { called = true; return { status: 200, body: {} }; } }));
    expect(r.status).toBe(403);
    expect(called).toBe(false);
  });
  it("sin key configurada, método incorrecto, JSON roto y pedido gigante", async () => {
    expect((await handle(post({}), deps({ apiKey: undefined }))).status).toBe(500);
    expect((await handle(new Request("http://x", { method: "GET" }), deps())).status).toBe(405);
    expect((await handle(post("{no es json"), deps())).status).toBe(400);
    expect((await handle(post({ mode: "chat", data: { x: "a".repeat(250000) }, messages: [] }), deps())).status).toBe(413);
  });
  it("errores de Claude: 429 se propaga, otros -> upstream_error, excepción -> 502", async () => {
    const mk = (status) => deps({ callClaude: async () => ({ status, body: {} }) });
    const b = { mode: "brief", data: {}, hoy: "2026-11-10" };
    expect((await handle(post(b), mk(429))).status).toBe(429);
    expect((await handle(post(b), mk(500))).status).toBe(502);
    expect((await handle(post(b), deps({ callClaude: async () => { throw new Error("red"); } }))).status).toBe(502);
  });
  it("límite de uso por persona: 30 pedidos cada 10 minutos", async () => {
    const b = { mode: "brief", data: {}, hoy: "2026-11-10" };
    for (let i = 0; i < 30; i++) expect((await handle(post(b, "u7"), deps())).status).toBe(200);
    expect((await handle(post(b, "u7"), deps())).status).toBe(429);
    expect((await handle(post(b, "otra"), deps())).status).toBe(200); // otra persona no se ve afectada
  });
  it("rateLimited libera la ventana con el tiempo", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 30; i++) expect(rateLimited("k", t0)).toBe(false);
    expect(rateLimited("k", t0)).toBe(true);
    expect(rateLimited("k", t0 + 11 * 60 * 1000)).toBe(false);
  });
});
