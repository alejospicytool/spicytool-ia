import { describe, it, expect } from "vitest";
import { diffState, isEmptyDiff, persist, loadAll } from "./crmStore.js";

const S0 = () => ({ config: { a: 1, b: { x: 1, y: 2 } }, deals: [{ id: "d1", n: 1 }, { id: "d2", n: 2 }], tasks: [{ id: "t1", n: 1 }] });

describe("diffState", () => {
  it("sin cambios no hay nada para guardar (aunque cambie el orden de las claves)", () => {
    const next = S0(); next.config = { b: { y: 2, x: 1 }, a: 1 };
    expect(isEmptyDiff(diffState(S0(), next))).toBe(true);
  });
  it("detecta config, deals y tareas modificados, nuevos y borrados", () => {
    const next = S0();
    next.config.a = 2;
    next.deals[0].n = 9;
    next.deals.push({ id: "d3" });
    next.deals = next.deals.filter((d) => d.id !== "d2");
    next.tasks = [];
    const d = diffState(S0(), next);
    expect(d.config).toEqual(next.config);
    expect(d.dealsUpsert.map((x) => x.id)).toEqual(["d1", "d3"]);
    expect(d.dealsDelete).toEqual(["d2"]);
    expect(d.tasksUpsert).toEqual([]);
    expect(d.tasksDelete).toEqual(["t1"]);
  });
});

// Supabase falso en memoria con la misma semántica de versión
function fakeSb(rows) {
  const log = [];
  const tbl = (name) => {
    let op, payload, filters = {}, wantSelect = false;
    const q = {
      insert(p) { op = "insert"; payload = p; return q; },
      update(p) { op = "update"; payload = p; return q; },
      delete() { op = "delete"; return q; },
      select() { wantSelect = true; return q; },
      eq(k, v) { filters[k] = v; return q; },
      then(res, rej) {
        const t = rows[name];
        log.push([name, op, JSON.stringify(payload), JSON.stringify(filters)]);
        let out = { data: null, error: null };
        if (op === "insert") { if (t.find((r) => r.id === payload.id)) out = { data: null, error: { code: "23505" } }; else t.push({ id: payload.id, data: payload.data, version: 1 }); }
        if (op === "update") { const hit = t.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v)); hit.forEach((r) => Object.assign(r, payload)); out = { data: wantSelect ? hit.map((r) => ({ version: r.version })) : null, error: null }; }
        if (op === "delete") rows[name] = t.filter((r) => !Object.entries(filters).every(([k, v]) => r[k] === v));
        return Promise.resolve(out).then(res, rej);
      },
    };
    return q;
  };
  return { from: tbl, log };
}

describe("persist", () => {
  const mk = () => ({ crm_config: [{ id: 1, data: { a: 1 }, version: 3 }], crm_deals: [{ id: "d1", data: { id: "d1" }, version: 2 }], crm_tasks: [] });
  const versions = () => ({ config: 3, deals: { d1: 2 }, tasks: {} });

  it("actualiza con la versión que leyó y la incrementa", async () => {
    const rows = mk(), sb = fakeSb(rows);
    const r = await persist(sb, { config: { a: 2 }, dealsUpsert: [{ id: "d1", x: 1 }], dealsDelete: [], tasksUpsert: [{ id: "t9" }], tasksDelete: [] }, versions());
    expect(r.versions).toEqual({ config: 4, deals: { d1: 3 }, tasks: { t9: 1 } });
    expect(rows.crm_deals[0]).toMatchObject({ version: 3, data: { id: "d1", x: 1 } });
    expect(rows.crm_tasks).toHaveLength(1);
  });
  it("si otra persona editó antes (versión distinta) avisa conflicto y no pisa nada", async () => {
    const rows = mk(); rows.crm_deals[0].version = 7; // alguien más guardó
    const r = await persist(fakeSb(rows), { config: null, dealsUpsert: [{ id: "d1", x: 1 }], dealsDelete: [], tasksUpsert: [], tasksDelete: [] }, versions());
    expect(r).toEqual({ conflict: true });
    expect(rows.crm_deals[0].data).toEqual({ id: "d1" });
  });
  it("conflicto si alguien creó el mismo id, y también en la config", async () => {
    const rows = mk(); rows.crm_tasks.push({ id: "t9", data: {}, version: 1 });
    expect(await persist(fakeSb(rows), { config: null, dealsUpsert: [], dealsDelete: [], tasksUpsert: [{ id: "t9" }], tasksDelete: [] }, versions())).toEqual({ conflict: true });
    const rows2 = mk(); rows2.crm_config[0].version = 9;
    expect(await persist(fakeSb(rows2), { config: { a: 5 }, dealsUpsert: [], dealsDelete: [], tasksUpsert: [], tasksDelete: [] }, versions())).toEqual({ conflict: true });
  });
  it("borra filas y las saca del mapa de versiones", async () => {
    const rows = mk();
    const r = await persist(fakeSb(rows), { config: null, dealsUpsert: [], dealsDelete: ["d1"], tasksUpsert: [], tasksDelete: [] }, versions());
    expect(rows.crm_deals).toEqual([]);
    expect(r.versions.deals).toEqual({});
  });
  it("un error de la base se propaga", async () => {
    const sb = { from: () => ({ update() { return this; }, eq() { return this; }, select() { return Promise.resolve({ data: null, error: { message: "rls" } }); } }) };
    await expect(persist(sb, { config: { a: 1 }, dealsUpsert: [], dealsDelete: [], tasksUpsert: [], tasksDelete: [] }, versions())).rejects.toMatchObject({ message: "rls" });
  });
});

describe("loadAll", () => {
  it("arma el estado y el mapa de versiones", async () => {
    const mkQ = (res) => { const q = { select: () => q, eq: () => q, order: () => q, maybeSingle: () => Promise.resolve(res), then: (a, b) => Promise.resolve(res).then(a, b) }; return q; };
    const sb = { from: (t) => mkQ(t === "crm_config" ? { data: { data: { a: 1 }, version: 4 }, error: null } : { data: [{ id: "x", data: { id: "x" }, version: 2 }], error: null }) };
    const r = await loadAll(sb);
    expect(r.state.config).toEqual({ a: 1 });
    expect(r.state.deals).toEqual([{ id: "x" }]);
    expect(r.versions).toEqual({ config: 4, deals: { x: 2 }, tasks: { x: 2 } });
  });
});
