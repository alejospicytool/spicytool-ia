import { describe, it, expect } from "vitest";
import { fold, queryWords, searchAll, spicyUserItems, withSpicyGroup, flatItems, MIN_CHARS } from "./searchLogic.js";

const data = () => ({
  can: { ops: true, devs: true },
  followup: [
    { company_id: "c1", company_name: "Inmobiliaria Peña", contact_name: "Marcos Gil", contact_email: "marcos@pena.com", contact_phone: "+54 9 341 555-1234", updated_at: "2026-11-20" },
    { company_id: "c2", company_name: "Terra Pueblo", contact_name: "Ana Paz", contact_email: "ana@terra.com", contact_phone: "", baja_en: "2026-10-01", updated_at: "2026-10-01" },
  ],
  tickets: [{ id: "t1", title: "Error al subir contactos", client_name: "Inmobiliaria Peña", status: "En curso", message: "No carga el excel", created_at: "2026-11-21" }, { id: "t2", title: "", client_name: "Otro cliente", status: "Inicio por OPS", message: "", created_at: "2026-11-01" }],
  tasks: [{ id: "k1", title: "Revisar campañas de Peña", description: "", stage: "En Curso", created_at: "2026-11-10" }],
  devTasks: [{ id: "d1", title: "Fix importación de contactos", description: "excel con tildes", stage: "Backlog", created_at: "2026-11-12" }],
  onboarding: [{ id: "o1", client_name: "Nuevo Cliente SRL", responsable: "Tici", etapa_actual: "Reunión inicial", created_at: "2026-11-05" }],
  notes: [{ id: "n1", title: "Reunión con Peña", content: "Quedamos en revisar el onboarding la semana próxima", updated_at: "2026-11-22" }],
  ideas: [{ id: "i1", title: "Importar contactos desde Excel", description: "", requested_by: "Marcos", status: "nueva", created_at: "2026-11-23" }],
  views: [{ id: "metrics_customers", label: "Clientes", section: "Métricas" }, { id: "metrics", label: "Overview", section: "Métricas" }],
});
const types = (r) => r.groups.map((g) => g.type);

describe("consulta", () => {
  it("fold quita tildes y mayúsculas; queryWords exige un mínimo", () => {
    expect(fold("ÁÉÍ Peña")).toBe("aei pena");
    expect(queryWords("a")).toEqual([]);
    expect(queryWords("  ")).toEqual([]);
    expect(queryWords("Peña  excel")).toEqual(["pena", "excel"]);
    expect(MIN_CHARS).toBe(2);
  });
});

describe("searchAll", () => {
  it("sin consulta suficiente no devuelve nada", () => {
    expect(searchAll("", data())).toEqual({ groups: [], total: 0 });
    expect(searchAll("p", data()).total).toBe(0);
  });
  it("encuentra en varios lados sin importar tildes ni mayúsculas, con los grupos en orden", () => {
    const r = searchAll("PENA", data());
    expect(types(r)).toEqual(["client", "ticket", "task", "note"]);
    expect(r.groups[0].items[0]).toMatchObject({ type: "client", id: "c1", title: "Inmobiliaria Peña", companyId: "c1" });
  });
  it("todas las palabras tienen que aparecer (aunque estén en campos distintos)", () => {
    expect(types(searchAll("peña excel", data()))).toEqual(["ticket"]); // título/cliente en un campo y 'excel' en el mensaje del ticket
    expect(searchAll("peña zzz", data()).total).toBe(0);
  });
  it("teléfono: se compara por dígitos, con o sin símbolos", () => {
    expect(searchAll("341 555", data()).groups[0].items[0].id).toBe("c1");
    expect(searchAll("3415551234", data()).groups[0].items[0].id).toBe("c1");
    expect(searchAll("999999", data()).total).toBe(0);
  });
  it("clientes de baja se marcan", () => {
    const c = searchAll("terra", data()).groups[0].items[0];
    expect(c.sub).toContain("de baja");
  });
  it("ticket sin título usa el nombre del cliente", () => {
    expect(searchAll("otro cliente", data()).groups[0].items[0].title).toBe("Otro cliente");
  });
  it("el título que empieza con lo escrito va primero; después lo más reciente", () => {
    const d = data();
    d.tickets = [
      { id: "a", title: "Contactos que no cargan", client_name: "X", status: "s", created_at: "2026-01-01" },
      { id: "b", title: "Error con contactos", client_name: "X", status: "s", created_at: "2026-11-01" },
      { id: "c", title: "Contactos duplicados", client_name: "X", status: "s", created_at: "2026-06-01" },
    ];
    expect(searchAll("contactos", d).groups.find((g) => g.type === "ticket").items.map((i) => i.id)).toEqual(["c", "a", "b"]);
  });
  it("respeta permisos: sin Operaciones no hay clientes/tickets/tareas/onboarding, y sin Devs no hay tareas de Devs; notas e ideas siempre", () => {
    const sinOps = searchAll("contactos", { ...data(), can: { ops: false, devs: true } });
    expect(types(sinOps)).toEqual(["dev_task", "idea"]);
    const nada = searchAll("contactos", { ...data(), can: { ops: false, devs: false } });
    expect(types(nada)).toEqual(["idea"]);
  });
  it("límite por grupo y 'more'", () => {
    const d = data();
    d.tickets = Array.from({ length: 8 }, (_, i) => ({ id: "t" + i, title: "Caso " + i, client_name: "X", status: "s", created_at: "2026-11-0" + (i + 1) }));
    const g = searchAll("caso", d, { limit: 3 }).groups[0];
    expect(g.items).toHaveLength(3);
    expect(g.more).toBe(5);
  });
  it("secciones del menú", () => {
    const r = searchAll("clientes", data());
    expect(r.groups.at(-1)).toMatchObject({ type: "view", items: [{ id: "metrics_customers", sub: "Métricas" }] });
  });
  it("las notas muestran un resumen del contenido", () => {
    expect(searchAll("onboarding", data()).groups.find((g) => g.type === "note").items[0].sub).toContain("revisar el onboarding");
  });
  it("datos vacíos o faltantes no rompen", () => {
    expect(searchAll("hola", {}).total).toBe(0);
    expect(searchAll("hola", { can: { ops: true }, followup: [{}], tickets: [null].filter(Boolean) }).total).toBe(0);
  });
});

describe("usuarios de Admin Spicy", () => {
  const users = [{ _id: "u1", name: "Ana", surname: "Paz", email: "ana@x.com", companyName: "Alfa" }, { _id: "u2", name: "", surname: "", email: "b@x.com", companyName: "—" }];
  const nameOf = (u) => [u.name, u.surname].filter(Boolean).join(" ") || u.email;
  it("se convierten en resultados", () => {
    expect(spicyUserItems(users, nameOf)).toEqual([
      { type: "spicy_user", id: "u1", title: "Ana Paz", sub: "ana@x.com · Alfa", score: 0, when: "" },
      { type: "spicy_user", id: "u2", title: "b@x.com", sub: "b@x.com", score: 0, when: "" },
    ]);
  });
  it("el grupo se ubica después de Clientes y antes de Tickets", () => {
    const base = searchAll("peña", data()).groups;
    const g = withSpicyGroup(base, spicyUserItems(users, nameOf), 2);
    expect(g.map((x) => x.type)).toEqual(["client", "spicy_user", "ticket", "task", "note"]);
    expect(g[1].more).toBe(2);
    expect(withSpicyGroup(base, [], 0)).toBe(base);
  });
  it("flatItems da el orden plano para las flechas", () => {
    const g = withSpicyGroup(searchAll("peña", data()).groups, spicyUserItems(users, nameOf));
    expect(flatItems(g).map((i) => i.type)).toEqual(["client", "spicy_user", "spicy_user", "ticket", "task", "note"]);
  });
});
