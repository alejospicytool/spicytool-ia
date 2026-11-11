import { describe, it, expect } from "vitest";
import {
  PLAN_OPTIONS, planPatch, currentPlanKey, setPath, matchesSearch, escapeRegExp, sortUsersRecent, paginate, whatsappProvider, companyIdOf,
  validateCompanyEdit, validateContactEdit, diffFields, buildAuditEntry, userFullName, sortByPosition,
} from "./adminLogic.js";

describe("planes", () => {
  it("cada plan va al campo correcto", () => {
    expect(planPatch("tier3")).toEqual({ field: "subscription.tier", value: "tier3" });
    expect(planPatch("tier4")).toEqual({ field: "subscription.tier", value: "tier4" });
    expect(planPatch("freemium")).toEqual({ field: "subscription.subscriptionType", value: "freemium" });
    expect(planPatch("promoLanding")).toEqual({ field: "subscription.subscriptionType", value: "promo_landing" });
  });
  it("rechaza un plan que no existe", () => {
    expect(() => planPatch("tier9")).toThrow(/inválido/);
    expect(() => planPatch(undefined)).toThrow();
  });
  it("hay exactamente los cuatro planes del PLAN", () => {
    expect(PLAN_OPTIONS.map((o) => o.key)).toEqual(["promoLanding", "freemium", "tier3", "tier4"]);
  });
  it("el plan actual: el tier manda sobre el tipo de suscripción", () => {
    expect(currentPlanKey({ subscription: { subscriptionType: "freemium", tier: "tier3" } })).toBe("tier3");
    expect(currentPlanKey({ subscription: { subscriptionType: "promo_landing", tier: null } })).toBe("promoLanding");
    expect(currentPlanKey({ subscription: { subscriptionType: "paid", tier: null } })).toBeNull();
    expect(currentPlanKey({})).toBeNull();
    expect(currentPlanKey(null)).toBeNull();
  });
  it("setPath escribe la ruta con puntos sin mutar el original", () => {
    const u = { a: 1, subscription: { tier: "tier3", subscriptionType: "paid" } };
    const n = setPath(u, "subscription.tier", "tier4");
    expect(n.subscription).toEqual({ tier: "tier4", subscriptionType: "paid" });
    expect(u.subscription.tier).toBe("tier3");
    expect(setPath({}, "x.y.z", 1)).toEqual({ x: { y: { z: 1 } } });
  });
});

describe("búsqueda", () => {
  const u = { email: "Lucia.Fernandez@ejemplo.test", phoneNumber: "+54 9 11 5555-2000", name: "Lucía", surname: "Fernández" };
  it("busca en email, teléfono, nombre y apellido sin distinguir mayúsculas", () => {
    expect(matchesSearch(u, "FERNANDEZ")).toBe(true);
    expect(matchesSearch(u, "lucía")).toBe(true);
    expect(matchesSearch(u, "5555-2000")).toBe(true);
    expect(matchesSearch(u, "ejemplo.test")).toBe(true);
    expect(matchesSearch(u, "zzz")).toBe(false);
  });
  it("sin texto devuelve todo", () => {
    expect(matchesSearch(u, "")).toBe(true);
    expect(matchesSearch(u, "   ")).toBe(true);
    expect(matchesSearch(u, undefined)).toBe(true);
  });
  it("el texto es literal: los caracteres de regex no rompen ni matchean de más", () => {
    expect(() => matchesSearch(u, "(")).not.toThrow();
    expect(matchesSearch(u, "(")).toBe(false);
    expect(matchesSearch({ phoneNumber: "(11) 555" }, "(11)")).toBe(true);
  });
  it("un patrón de regex no se interpreta", () => {
    expect(matchesSearch(u, ".*")).toBe(false);
    expect(matchesSearch({ email: "a.b@x.test" }, "a.b")).toBe(true);
    expect(matchesSearch({ email: "axb@x.test" }, "a.b")).toBe(false);
  });
  it("tolera campos faltantes", () => {
    expect(matchesSearch({ email: "a@b.test" }, "a@b")).toBe(true);
    expect(matchesSearch({}, "x")).toBe(false);
  });
  it("escapeRegExp escapa todo lo especial", () => {
    expect(escapeRegExp("a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o")).toBe("a\\.b\\*c\\+d\\?e\\^f\\$g\\{h\\}i\\(j\\)k\\|l\\[m\\]n\\\\o");
  });
});

describe("orden y paginación", () => {
  it("más recientes primero por _id", () => {
    const r = sortUsersRecent([{ _id: "6650000000000000000a" }, { _id: "6650000000000000000c" }, { _id: "6650000000000000000b" }]);
    expect(r.map((x) => x._id.slice(-1))).toEqual(["c", "b", "a"]);
  });
  it("no muta el arreglo original", () => {
    const a = [{ _id: "1" }, { _id: "2" }];
    sortUsersRecent(a);
    expect(a[0]._id).toBe("1");
  });
  it("pagina y cuenta", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    expect(paginate(items, 1, 4)).toMatchObject({ items: [0, 1, 2, 3], total: 10, page: 1, pages: 3 });
    expect(paginate(items, 3, 4).items).toEqual([8, 9]);
  });
  it("una página fuera de rango se acomoda y vacío da una página", () => {
    expect(paginate([1, 2, 3], 99, 2).page).toBe(2);
    expect(paginate([1, 2, 3], -5, 2).page).toBe(1);
    expect(paginate([], 1, 8)).toMatchObject({ items: [], total: 0, page: 1, pages: 1 });
  });
  it("tamaño de página inválido no rompe", () => {
    expect(paginate([1, 2, 3], 1, 0).items).toEqual([1]);
    expect(paginate([1, 2, 3], 1, NaN).pageSize).toBe(1);
  });
  it("sortByPosition ordena por posición numérica", () => {
    expect(sortByPosition([{ position: 3 }, { position: 1 }, { position: 2 }]).map((x) => x.position)).toEqual([1, 2, 3]);
  });
});

describe("datos del usuario", () => {
  it("proveedor de WhatsApp: Kapso, Gupshup o ninguno", () => {
    expect(whatsappProvider({ kapso: { kapsoAppId: "k1" } })).toEqual({ provider: "Kapso", appId: "k1" });
    expect(whatsappProvider({ gupshup: { whatsAppAppId: "g1" } })).toEqual({ provider: "Gupshup", appId: "g1" });
    expect(whatsappProvider({ kapso: { kapsoAppId: "k1" }, gupshup: { whatsAppAppId: "g1" } }).provider).toBe("Kapso");
    expect(whatsappProvider({})).toBeNull();
    expect(whatsappProvider(null)).toBeNull();
  });
  it("la company del usuario es companies[0]", () => {
    expect(companyIdOf({ companies: ["c1", "c2"] })).toBe("c1");
    expect(companyIdOf({ companies: [] })).toBeNull();
    expect(companyIdOf({})).toBeNull();
  });
  it("nombre completo con respaldo al email", () => {
    expect(userFullName({ name: "Ana", surname: "Paz", email: "a@x" })).toBe("Ana Paz");
    expect(userFullName({ email: "a@x" })).toBe("a@x");
    expect(userFullName(null)).toBe("—");
  });
});

describe("validaciones", () => {
  it("company: acepta datos válidos y normaliza", () => {
    const r = validateCompanyEdit({ name: "  Mi Co ", phoneNumber: "+54 11 5555-0101", credits: "250" });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ name: "Mi Co", phoneNumber: "+54 11 5555-0101", credits: 250 });
  });
  it("company: nombre vacío, créditos negativos o no numéricos y teléfono raro", () => {
    expect(validateCompanyEdit({ name: "", phoneNumber: "", credits: 1 }).errors.name).toBeTruthy();
    expect(validateCompanyEdit({ name: "x", phoneNumber: "", credits: -1 }).errors.credits).toBeTruthy();
    expect(validateCompanyEdit({ name: "x", phoneNumber: "", credits: "abc" }).errors.credits).toBeTruthy();
    expect(validateCompanyEdit({ name: "x", phoneNumber: "", credits: "" }).errors.credits).toBeTruthy();
    expect(validateCompanyEdit({ name: "x", phoneNumber: "", credits: null }).errors.credits).toBeTruthy();
    expect(validateCompanyEdit({ name: "x", phoneNumber: "hola", credits: 1 }).errors.phoneNumber).toBeTruthy();
  });
  it("company: créditos 0 es válido, teléfono vacío también", () => {
    expect(validateCompanyEdit({ name: "x", phoneNumber: "", credits: 0 }).ok).toBe(true);
  });
  it("contacto: email obligatorio y válido", () => {
    expect(validateContactEdit({ name: "A", surname: "B", email: "a@b.test", phoneNumber: "" }).ok).toBe(true);
    expect(validateContactEdit({ name: "A", surname: "B", email: "no-es-email", phoneNumber: "" }).errors.email).toBeTruthy();
    expect(validateContactEdit({ name: "", surname: "B", email: "a@b.test", phoneNumber: "" }).errors.name).toBeTruthy();
    expect(validateContactEdit({ name: "A", surname: "", email: "a@b.test", phoneNumber: "12" }).errors.phoneNumber).toBeTruthy();
  });
});

describe("auditoría", () => {
  it("arma quién, qué, cuándo y sobre qué", () => {
    const e = buildAuditEntry({ id: 1, actor: "nico@x.test", action: "plan_change", targetType: "user", targetId: "u1", targetLabel: "Ana Paz", companyId: "c1", detail: { plan: "tier4" }, now: new Date("2026-11-11T10:00:00Z") });
    expect(e).toEqual({ id: 1, at: "2026-11-11T10:00:00.000Z", actor: "nico@x.test", action: "plan_change", targetType: "user", targetId: "u1", targetLabel: "Ana Paz", companyId: "c1", detail: { plan: "tier4" } });
  });
  it("sin quién o con una acción desconocida no se registra", () => {
    expect(() => buildAuditEntry({ id: 1, actor: "", action: "plan_change", targetType: "user", targetId: "u1" })).toThrow(/quién/);
    expect(() => buildAuditEntry({ id: 1, actor: "a", action: "inventada", targetType: "user", targetId: "u1" })).toThrow(/desconocida/);
  });
  it("sin etiqueta usa el id", () => {
    expect(buildAuditEntry({ id: 1, actor: "a", action: "company_pause", targetType: "company", targetId: "c9" }).targetLabel).toBe("c9");
  });
  it("diffFields devuelve solo lo que cambió", () => {
    expect(diffFields({ a: 1, b: "x", c: null }, { a: 1, b: "y", c: 5 }, ["a", "b", "c"])).toEqual([{ key: "b", from: "x", to: "y" }, { key: "c", from: null, to: 5 }]);
    expect(diffFields({ a: 1 }, { a: "1" }, ["a"])).toEqual([]);
  });
});
