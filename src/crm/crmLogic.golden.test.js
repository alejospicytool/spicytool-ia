// Verifica que la lógica portada da los MISMOS números que el HTML original, con los datos reales
// (_import/crm-datos.json) leídos en la fecha de referencia: martes 10/11/2026 (15:09 hora Argentina).
// Se salta sola si no están los datos. IMPORTANTE: este archivo va a git (repo público), así que NO
// contiene nombres ni datos de clientes: solo totales y huellas (hash) de las listas, calculadas en
// el navegador sobre el HTML original.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { createCrm, money, ESTADOS } from "./crmLogic.js";

const FILE = "_import/crm-datos.json";
const has = fs.existsSync(FILE);
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

describe.skipIf(!has)("CRM: coincide con el HTML original (datos reales, 10/11/2026)", () => {
  const S = has ? JSON.parse(fs.readFileSync(FILE, "utf8")) : null;
  const crm = has ? createCrm(S, { now: new Date("2026-11-10T18:09:31Z") }) : null;
  const rnd = (n) => Math.round(n);

  it("la importación tiene 29 deals y 19 tareas", () => {
    expect(S.deals).toHaveLength(29);
    expect(S.tasks).toHaveLength(19);
  });

  it("Cómo vamos: KPIs", () => {
    const f = crm.forecastData();
    expect(money(f.totOpen)).toBe("USD 4.160");
    expect(f.open).toHaveLength(19);
    expect(money(f.totW)).toBe("USD 1.225");
    expect(money(f.commitM)).toBe("USD 1.000");
    expect(money(f.metaRow.proj)).toBe("USD 8.989");
    expect(money(-f.gap)).toBe("USD 3.011");
  });

  it("Cómo vamos: proyección mes a mes", () => {
    const rows = crm.forecastData().rows.map((r) => [r.m, rnd(r.won), rnd(r.commit), rnd(r.best), rnd(r.pipe), rnd(r.sube), rnd(r.bajas), rnd(r.nuevo + r.bajas), rnd(r.proj)]);
    expect(rows).toEqual([
      ["2026-11", 480, 520, 78, 117, 0, 0, 1195, 8075],
      ["2026-12", 0, 0, 582, 232, 100, 0, 914, 8989],
      ["2027-01", 0, 0, 0, 0, 494, 0, 494, 9483],
      ["2027-02", 0, 0, 120, 20, 52, 0, 192, 9675],
      ["2027-03", 0, 0, 0, 0, 0, 0, 0, 9675],
      ["2027-04", 0, 0, 0, 0, 0, 0, 0, 9675],
    ]);
  });

  it("Cómo vamos: por etapa, vendedor y origen (solo cantidades y montos)", () => {
    const f = crm.forecastData();
    expect(f.byStage.map((x) => [x.deals, rnd(x.mrr), rnd(x.weighted)])).toEqual([[9, 2170, 217], [4, 620, 186], [6, 1370, 822], [0, 0, 0]]);
    const g = (rows) => rows.map((r) => [r[1], rnd(r[2]), rnd(r[3])]);
    expect(g(f.bySeller)).toEqual([[17, 3810, 1015], [2, 350, 210]]);
    expect(g(f.byOrigin)).toEqual([[12, 2240, 483], [6, 1520, 502], [1, 400, 240]]);
    expect(g(f.byPartner)).toEqual([[1, 400, 240]]);
  });

  it("Conversión real del embudo y motivos de pérdida", () => {
    const cs = crm.convStats();
    expect(cs.rows.map((r) => [r.reached, r.next, r.dec, Math.round(r.win * 100)])).toEqual([[6, 4, 1, 100], [4, 1, 1, 100], [1, 1, 1, 100], [1, 1, 1, 100]]);
    expect(cs.ready).toBe(false);
    expect(crm.forecastData().lostReasons.map((x) => [x.deals, x.mrr, x.pct])).toEqual([[1, 200, 50], [1, 200, 50]]);
  });

  it("Pipeline: deals por columna y atajos", () => {
    const by = (id) => S.deals.filter((d) => d.stage === id).length;
    expect(["lead", "demo_ag", "prop", "nego", "won", "noshow", "lost"].map(by)).toEqual([9, 4, 6, 0, 8, 0, 2]);
    expect(S.deals.filter(crm.overdue)).toHaveLength(5);
    expect(S.deals.filter((d) => crm.isOpen(d) && !d.proxima)).toHaveLength(2);
    expect(S.deals.filter((d) => crm.rotLevel(d) === "red")).toHaveLength(13);
  });

  it("Clientes", () => {
    const c = crm.clientsData();
    expect(c.act).toHaveLength(1);
    expect(c.arr).toHaveLength(7);
    expect(c.risk).toBe(0);
    expect(money(c.mrrHoy)).toBe("USD 580");
    expect(money(c.unpaid.reduce((t, d) => t + (crm.hasPromo(d) ? +d.promoMrr : +d.mrr), 0))).toBe("USD 520");
    expect(money(c.ups.reduce((t, d) => t + (+d.mrr - +d.promoMrr), 0))).toBe("USD 570");
    expect(c.ups).toHaveLength(5);
    expect(c.b90).toHaveLength(0);
    expect(crm.nextMilestone(crm.dealById("dmvufl763"))).toBe("Renueva en nov 27");
    expect(crm.lastContact(crm.dealById("dmvufl763"))).toBe("Hace 9 días");
    const arr = ESTADOS.slice(0, 3).map((e) => c.arr.filter((d) => (d.estado || "pago") === e[0]).map((d) => d.empresa).join(",")).join("\n");
    expect(sha(arr)).toBe("099fd859839629b2");
  });

  it("Tareas: grupos, contadores y orden", () => {
    const t = crm.taskGroups("", "", false);
    expect(t.groups.map((g) => g[1].length)).toEqual([19, 3, 2, 2]);
    expect(["", "demo", "followup", "reunion", "onboarding", "tarea"].map((k) => t.cnt[k] || 0)).toEqual([26, 8, 13, 0, 2, 3]);
    expect(crm.dueCounts()).toEqual({ v: 19, h: 3 });
    const hashes = t.groups.map((g) => sha(g[1].map((x) => x.titulo + "|" + x.k).join("\n")));
    expect(hashes).toEqual(["6a3a941b24d3bf94", "6e1de66bc40c86fb", "665f395a608508e9", "e5543d0dcf3b016f"]);
  });

  it("Hoy: los 5 bloques y su orden", () => {
    const h = crm.hoyData();
    expect([h.demos.length, h.todo.length, h.frenados.length, h.unpaid.length, h.hitos.length]).toEqual([0, 22, 13, 5, 3]);
    const sub = (d) => d.daysIn;
    expect(sha(h.demos.map((x) => x.titulo).join("\n"))).toBe("e3b0c44298fc1c14");
    expect(sha(h.todo.map((x) => x.titulo + "|" + (x.deal ? x.deal.empresa : "")).join("\n"))).toBe("0cbcab6b8378f960");
    expect(sha(h.frenados.map((d) => d.empresa + "|" + crm.daysIn(d) + " días en " + crm.stageById(d.stage).name + (d.proxima ? ". Próximo: " + d.proxima : ". Sin próximo paso")).join("\n"))).toBe("e394f87aee4213d1");
    expect(sha(h.unpaid.map((d) => d.empresa + "|" + (crm.hasPromo(d) ? crm.promoTxt(d) + " → " + money(d.mrr) : money(d.mrr)) + "/mes").join("\n"))).toBe("2c2b17e1318a6384");
    expect(sha(h.hitos.map((x) => x.d.empresa + "|" + x.t).join("\n"))).toBe("4d906f84d331fba9");
    void sub;
  });

  it("Texto del lunes para WhatsApp: idéntico al original (huella)", () => {
    expect(sha(crm.weeklyText())).toBe("6a28cd2afe3eb9a4");
  });
});
