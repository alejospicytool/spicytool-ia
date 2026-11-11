import { describe, it, expect } from "vitest";
import { shapeUser, shapeCompany, shapeSupportSession, numbered, CHILD, USER_PROJECTION, COMPANY_PROJECTION, SUPPORT_PROJECTION } from "./shape.js";

// Documento "como lo guarda Mongo", con campos peligrosos mezclados: nada de eso puede salir.
const rawUser = {
  _id: "6650000000000000000000a1", email: "ana@ejemplo.test", name: "Ana", surname: "Paz", phoneNumber: "+54 11 5555-0000", creationDate: "2026-01-02T00:00:00Z",
  companies: ["6650000000000000000000c1"], activeWhatsAppProvider: "kapso", kapso: { kapsoAppId: "k1" }, gupshup: { whatsAppAppId: null },
  subscription: { subscriptionType: "SpicyPro", subscriptionId: "sub_1", tier: "tier4", legacySubscriptionType: "Growth" },
  stripe: { customerId: "cus_1", subscriptionId: "sub_1", paymentMethodId: "pm_1" },
  passwordHash: "$2b$10$SECRETO", brizy: { userToken: "TOKEN_BRIZY" }, confirmationCode: "123456",
};

describe("shapeUser", () => {
  it("deja solo los campos permitidos: nunca passwordHash, tokens ni códigos", () => {
    const out = shapeUser(rawUser);
    const json = JSON.stringify(out);
    for (const secreto of ["SECRETO", "TOKEN_BRIZY", "123456", "pm_1", "passwordHash", "tier4", "Growth"]) expect(json).not.toContain(secreto);
    expect(out).toMatchObject({ _id: "6650000000000000000000a1", email: "ana@ejemplo.test", subscription: { subscriptionType: "SpicyPro" }, stripe: { customerId: "cus_1" }, activeWhatsAppProvider: "kapso" });
  });
  it("tolera campos que faltan (la mayoría de los usuarios tiene pocos)", () => {
    const out = shapeUser({ _id: "6650000000000000000000a2", email: "x@y.test" });
    expect(out).toMatchObject({ companies: [], name: "", subscription: { subscriptionType: null }, stripe: { customerId: null }, kapso: { kapsoAppId: null } });
    expect(out.creationDate).toBe("2024-05-24T02:48:32.000Z"); // sale de la fecha que lleva el _id
  });
  it("la projection pedida a Mongo no incluye campos peligrosos", () => {
    const pedidos = Object.keys(USER_PROJECTION).join(" ");
    for (const mal of ["passwordHash", "token", "Token", "confirmationCode", "brizy", "paymentMethodId"]) expect(pedidos).not.toContain(mal);
  });
});

describe("shapeCompany", () => {
  it("solo 'paused' es pausada; vacío, 'undefined' o faltante cuentan como activa", () => {
    const st = (status) => shapeCompany({ _id: "6650000000000000000000c1", status }).status;
    expect(st("paused")).toBe("paused");
    expect(st("Paused")).toBe("paused");
    expect(st("active")).toBe("active");
    expect(st("")).toBe("active");
    expect(st("undefined")).toBe("active");
    expect(st(undefined)).toBe("active");
    expect(shapeCompany({ _id: "6650000000000000000000c1", status: "undefined" }).statusRaw).toBe("undefined");
  });
  it("créditos: número o null; conversaciones activas: cantidad; sin tokens de integraciones", () => {
    const out = shapeCompany({ _id: "6650000000000000000000c1", name: "X", credits: 50, activeWhatsAppConversations: ["a", "b"], tokko: { apiToken: "TOKKO_SECRETO" }, tera: { token: "T" } });
    expect(out).toMatchObject({ credits: 50, activeWhatsAppConversations: 2 });
    expect(JSON.stringify(out)).not.toContain("TOKKO_SECRETO");
    expect(shapeCompany({ _id: "6650000000000000000000c1", credits: null }).credits).toBeNull();
    expect(shapeCompany({ _id: "6650000000000000000000c1" }).credits).toBeNull();
    expect(Object.keys(COMPANY_PROJECTION).join(" ")).not.toMatch(/token|apiKey|tokko|tera|tiendanube|easyBroker/i);
  });
});

describe("colecciones hijas", () => {
  it("campaña: el estado de Mongo (objeto) se muestra como ENABLED / PAUSED", () => {
    expect(CHILD.campaigns.shape({ _id: "1", campaignStatus: { status: true } }).campaignStatus).toBe("ENABLED");
    expect(CHILD.campaigns.shape({ _id: "1", campaignStatus: { status: false } }).campaignStatus).toBe("PAUSED");
    expect(CHILD.campaigns.shape({ _id: "1" }).campaignStatus).toBe("PAUSED");
  });
  it("landing: nombre, descripción acotada y estado", () => {
    const l = CHILD.landings.shape({ _id: "1", companyName: "Casa", businessDescription: "x".repeat(500), landingStatus: { status: "published" }, userEmail: "no@sale.test" });
    expect(l.name).toBe("Casa");
    expect(l.description).toHaveLength(140);
    expect(l.status).toBe("published");
    expect(JSON.stringify(l)).not.toContain("no@sale.test");
  });
  it("contacto: solo los campos de la tabla (no custom fields, ip, fbp, etc.)", () => {
    const c = CHILD.contacts.shape({ _id: "1", name: "Ana", email: "a@b.test", ip: "1.2.3.4", fbp: "fb", customFields: { Edad: 3 }, createdAt: new Date("2026-02-03T00:00:00Z") });
    expect(Object.keys(c).sort()).toEqual(["_id", "createdAt", "createdFrom", "email", "keyword", "name", "phoneNumber", "source", "surname"]);
    expect(c.createdAt).toBe("2026-02-03T00:00:00.000Z");
  });
  it("workflow: no trae el historial de ejecuciones ni las tareas (son enormes)", () => {
    expect(Object.keys(CHILD.workflows.projection)).not.toContain("executions");
    expect(Object.keys(CHILD.workflows.projection)).not.toContain("tasks");
  });
  it("webforms y listas se numeran en orden", () => {
    expect(numbered([{ name: "a" }, { name: "b" }]).map((r) => r.position)).toEqual([1, 2]);
  });
  it("etapa: posición numérica (si falta, 0)", () => {
    expect(CHILD.pipelinestages.shape({ _id: "1", position: "3" }).position).toBe(3);
    expect(CHILD.pipelinestages.shape({ _id: "1" }).position).toBe(0);
  });
});

describe("sesiones de soporte", () => {
  it("nunca expone el hash del código y toma el nombre de la company", () => {
    const s = shapeSupportSession({ _id: "s1", actorEmail: "adm@x.test", targetEmail: "u@x.test", reason: "ticket 1", createdAt: new Date("2026-11-01T10:00:00Z"), expiresAt: new Date("2026-11-01T10:15:00Z"), exchangeCount: 1, companyId: "c1", targetUserId: "u1", codeHash: "HASH_SECRETO" }, "Casa SRL");
    expect(JSON.stringify(s)).not.toContain("HASH_SECRETO");
    expect(s).toMatchObject({ actor: "adm@x.test", action: "support_link_created", targetLabel: "u@x.test", companyId: "c1", detail: { companyName: "Casa SRL", reason: "ticket 1", exchangeCount: 1 } });
    expect(Object.keys(SUPPORT_PROJECTION)).not.toContain("codeHash");
  });
});
