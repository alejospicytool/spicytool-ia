import { describe, it, expect } from "vitest";
import {
  PAID_PLANS, planOf, planLabel, isPaidPlan, validatePlanAssignment, newIdempotencyKey, formatPrice, explainWebhookError, WEBHOOK_ERRORS, validateSupportReason, buildSupportRequest, explainSupportError, SUPPORT_ERRORS, SUPPORT_ACTIONS, AUDIT_ACTIONS, expiryText, REASON_MIN, REASON_MAX, matchesSearch, escapeRegExp, sortUsersRecent, paginate, whatsappProvider, companyIdOf,
  validateCompanyEdit, validateContactEdit, diffFields, buildAuditEntry, userFullName, sortByPosition, isOwner, matchesFilters, isPaused, matchesCompanySearch, sortCompaniesByName,
} from "./adminLogic.js";

describe("planes y suscripciones", () => {
  it("los planes pagos son exactamente los cuatro del webhook", () => {
    expect(PAID_PLANS).toEqual(["SpicyOne", "SpicyStart", "SpicyPro", "SpicyProMax"]);
    expect(isPaidPlan("SpicyPro")).toBe(true);
    expect(isPaidPlan("Freemium")).toBe(false);
    expect(isPaidPlan("Free trial")).toBe(false);
    expect(isPaidPlan("tier3")).toBe(false);
    expect(isPaidPlan(undefined)).toBe(false);
  });
  it("el plan del usuario sale de la suscripción; los tiers ya no cuentan", () => {
    expect(planOf({ subscription: { subscriptionType: "SpicyStart" } })).toBe("SpicyStart"); // campo real de Mongo
    expect(planOf({ subscription: { plan: "SpicyStart" } })).toBeNull();
    expect(planOf({ subscription: { tier: "tier4" } })).toBeNull();
    expect(planOf({})).toBeNull();
    expect(planOf(null)).toBeNull();
    expect(planLabel(null)).toBe("Sin plan");
    expect(planLabel("SpicyPro")).toBe("SpicyPro");
    expect(planLabel("FreeTrial")).toBe("Free trial");
  });
  const ok = { email: "a@b.test", plan: "SpicyStart", stripePriceId: "price_1UVakiJdCZldzCmGb1bTskUp" };
  it("asignación válida: acepta price_ y prod_, y recorta espacios", () => {
    expect(validatePlanAssignment(ok).ok).toBe(true);
    expect(validatePlanAssignment({ ...ok, stripePriceId: "prod_ABC123" }).ok).toBe(true);
    expect(validatePlanAssignment({ ...ok, email: " a@b.test ", stripePriceId: " price_X1 " }).value).toEqual({ email: "a@b.test", plan: "SpicyStart", stripePriceId: "price_X1" });
  });
  it("asignación: Freemium, free trial, tiers o plan vacío se rechazan", () => {
    for (const plan of ["Freemium", "Free trial", "tier3", "", undefined, "spicystart"]) expect(validatePlanAssignment({ ...ok, plan }).errors.plan).toBeTruthy();
  });
  it("asignación: precio vacío, sin prefijo o con espacios o símbolos", () => {
    expect(validatePlanAssignment({ ...ok, stripePriceId: "" }).errors.stripePriceId).toMatch(/Falta/);
    expect(validatePlanAssignment({ ...ok, stripePriceId: undefined }).errors.stripePriceId).toMatch(/Falta/);
    for (const bad of ["1234", "sub_123", "price_", "price_ a", "price_a-b", "PRICE_abc"]) expect(validatePlanAssignment({ ...ok, stripePriceId: bad }).errors.stripePriceId).toMatch(/empieza con price_/);
  });
  it("asignación: email inválido", () => {
    expect(validatePlanAssignment({ ...ok, email: "no-es-email" }).errors.email).toBeTruthy();
    expect(validatePlanAssignment({ ...ok, email: "" }).errors.email).toBeTruthy();
  });
  it("la clave de idempotencia es única y legible", () => {
    const a = newIdempotencyKey(), b = newIdempotencyKey();
    expect(a).toMatch(/^bo-[0-9a-z]+-.+/);
    expect(a).not.toBe(b);
  });
  it("sin crypto.randomUUID sigue generando claves distintas", () => {
    const orig = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    try {
      const k1 = newIdempotencyKey(1000, () => 0.1), k2 = newIdempotencyKey(1000, () => 0.9);
      expect(k1).toMatch(/^bo-/);
      expect(k1).not.toBe(k2);
    } finally { Object.defineProperty(globalThis, "crypto", { value: orig, configurable: true }); }
  });
  it("formato de precio", () => {
    expect(formatPrice(4900, "usd")).toBe("USD 49");
    expect(formatPrice(3950, "usd")).toMatch(/^USD 39,5/);
    expect(formatPrice(0)).toBe("USD 0");
  });
  it("cada código de error del doc tiene título y acción; uno desconocido cae en ERROR", () => {
    for (const c of ["EMAIL_INVALIDO", "USUARIO_NO_ENCONTRADO", "PLAN_INVALIDO", "PRECIO_REQUERIDO", "PRECIO_INVALIDO", "YA_SUSCRIPTO", "CLIENTE_STRIPE_BORRADO", "SIN_MEDIO_DE_PAGO", "PAGO_RECHAZADO", "STRIPE_PORTAL_FALLIDO", "ERROR", "UNAUTHORIZED", "FORBIDDEN"]) {
      expect(WEBHOOK_ERRORS[c].title).toBeTruthy();
      expect(WEBHOOK_ERRORS[c].action).toBeTruthy();
    }
    expect(explainWebhookError("PAGO_RECHAZADO").action).toMatch(/link/i);
    expect(explainWebhookError("CODIGO_NUEVO")).toBe(WEBHOOK_ERRORS.ERROR);
    expect(explainWebhookError(undefined)).toBe(WEBHOOK_ERRORS.ERROR);
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
  it("proveedor de WhatsApp: manda activeWhatsAppProvider; sin él se usa el id cargado", () => {
    expect(whatsappProvider({ activeWhatsAppProvider: "gupshup", kapso: { kapsoAppId: "k1" }, gupshup: { whatsAppAppId: "g1" } })).toEqual({ provider: "Gupshup", appId: "g1" });
    expect(whatsappProvider({ activeWhatsAppProvider: "kapso" })).toEqual({ provider: "Kapso", appId: null });
    expect(whatsappProvider({ activeWhatsAppProvider: "", kapso: { kapsoAppId: "k1" } })).toEqual({ provider: "Kapso", appId: "k1" });
    expect(whatsappProvider({ activeWhatsAppProvider: null })).toBeNull();
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
    const e = buildAuditEntry({ id: 1, actor: "nico@x.test", action: "plan_assign", targetType: "user", targetId: "u1", targetLabel: "Ana Paz", companyId: "c1", detail: { plan: "SpicyPro" }, now: new Date("2026-11-11T10:00:00Z") });
    expect(e).toEqual({ id: 1, at: "2026-11-11T10:00:00.000Z", actor: "nico@x.test", action: "plan_assign", targetType: "user", targetId: "u1", targetLabel: "Ana Paz", companyId: "c1", detail: { plan: "SpicyPro" } });
  });
  it("sin quién o con una acción desconocida no se registra", () => {
    expect(() => buildAuditEntry({ id: 1, actor: "", action: "plan_assign", targetType: "user", targetId: "u1" })).toThrow(/quién/);
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

describe("filtros de la lista", () => {
  const co = { userEmail: "Dueno@Ejemplo.test", status: "active" };
  const owner = { email: "dueno@ejemplo.test" }, other = { email: "otro@ejemplo.test" };
  it("owner: el email del usuario es el userEmail de la company, sin distinguir mayúsculas ni espacios", () => {
    expect(isOwner(owner, co)).toBe(true);
    expect(isOwner({ email: " DUENO@ejemplo.test " }, co)).toBe(true);
    expect(isOwner(other, co)).toBe(false);
  });
  it("sin email o sin company nunca es owner", () => {
    expect(isOwner({}, {})).toBe(false);
    expect(isOwner({ email: "" }, { userEmail: "" })).toBe(false);
    expect(isOwner(owner, null)).toBe(false);
    expect(isOwner(null, co)).toBe(false);
  });
  it("sin filtros pasa todo, incluso sin company", () => {
    expect(matchesFilters(other, co)).toBe(true);
    expect(matchesFilters(other, null)).toBe(true);
    expect(matchesFilters(other, co, {})).toBe(true);
  });
  it("solo owners", () => {
    expect(matchesFilters(owner, co, { owners: true })).toBe(true);
    expect(matchesFilters(other, co, { owners: true })).toBe(false);
  });
  it("company activa: lo que no está pausada cuenta como activa", () => {
    expect(matchesFilters(other, { status: "active" }, { activeOnly: true })).toBe(true);
    expect(matchesFilters(other, { status: undefined }, { activeOnly: true })).toBe(true);
    expect(matchesFilters(other, { status: "paused" }, { activeOnly: true })).toBe(false);
    expect(matchesFilters(other, null, { activeOnly: true })).toBe(false);
  });
  it("los dos filtros se combinan (hay que cumplir ambos)", () => {
    expect(matchesFilters(owner, co, { owners: true, activeOnly: true })).toBe(true);
    expect(matchesFilters(owner, { ...co, status: "paused" }, { owners: true, activeOnly: true })).toBe(false);
    expect(matchesFilters(other, co, { owners: true, activeOnly: true })).toBe(false);
  });
});

describe("companies activas y pausadas", () => {
  it("pausada: sin distinguir mayúsculas ni espacios; todo lo demás es activa", () => {
    expect(isPaused({ status: "paused" })).toBe(true);
    expect(isPaused({ status: "Paused" })).toBe(true);
    expect(isPaused({ status: " PAUSED " })).toBe(true);
    expect(isPaused({ status: "active" })).toBe(false);
    expect(isPaused({ status: undefined })).toBe(false);
    expect(isPaused({})).toBe(false);
    expect(isPaused(null)).toBe(false);
  });
  it("una company con estado raro cae en una sola lista", () => {
    for (const status of ["paused", "Paused", "active", "", null, "suspended"]) {
      expect(isPaused({ status }) !== !isPaused({ status })).toBe(true);
    }
  });
  it("el filtro 'company activa' usa la misma definición", () => {
    expect(matchesFilters({ email: "a@b.test" }, { status: "Paused" }, { activeOnly: true })).toBe(false);
  });
  it("búsqueda de company por nombre o email del owner, literal", () => {
    const c = { name: "Casas (Norte) S.A.", userEmail: "Dueno@Ejemplo.test" };
    expect(matchesCompanySearch(c, "casas (norte)")).toBe(true);
    expect(matchesCompanySearch(c, "dueno@")).toBe(true);
    expect(matchesCompanySearch(c, ".*")).toBe(false);
    expect(matchesCompanySearch(c, "")).toBe(true);
    expect(matchesCompanySearch({}, "x")).toBe(false);
  });
  it("orden por nombre, ignorando mayúsculas y acentos, sin mutar", () => {
    const a = [{ name: "zeta" }, { name: "Álamo" }, { name: "beta" }, { name: "Alfa" }];
    expect(sortCompaniesByName(a).map((c) => c.name)).toEqual(["Álamo", "Alfa", "beta", "zeta"]);
    expect(a[0].name).toBe("zeta");
  });
});

describe("soporte: motivo", () => {
  it("acepta un motivo real y lo normaliza", () => {
    const r = validateSupportReason("  ticket 4821:\n el cliente   no ve sus contactos ");
    expect(r).toEqual({ ok: true, error: null, value: "ticket 4821: el cliente no ve sus contactos" });
  });
  it("rechaza vacío, corto o solo espacios", () => {
    for (const x of ["", "   ", "corto", "123456789", null, undefined]) expect(validateSupportReason(x).ok).toBe(false);
    expect(validateSupportReason("a".repeat(REASON_MIN - 1)).error).toMatch(/mínimo 10/);
  });
  it("rechaza texto de relleno", () => {
    for (const x of ["aaaaaaaaaaaa", "............", "1111111111", "ab ab ab ab ab", "!!!!!!!!!!!!"]) expect(validateSupportReason(x).ok).toBe(false);
  });
  it("acepta acentos y números", () => {
    expect(validateSupportReason("revisión de facturación del cliente").ok).toBe(true);
    expect(validateSupportReason("caso 4821 y 4822").ok).toBe(true);
  });
  it("el máximo es 500", () => {
    expect(validateSupportReason("motivo válido ".repeat(40).slice(0, REASON_MAX)).ok).toBe(true);
    expect(validateSupportReason("motivo válido ".repeat(40).slice(0, REASON_MAX + 1)).error).toMatch(/largo/);
  });
});

describe("soporte: pedido, errores y vencimiento", () => {
  const user = { _id: "u1", email: "a@b.test", companies: ["c1"], name: "Ana" };
  it("el pedido lleva exactamente los cuatro campos de la API", () => {
    expect(buildSupportRequest(user, "ticket 4821: revisar contactos")).toEqual({ targetUserId: "u1", targetEmail: "a@b.test", companyId: "c1", reason: "ticket 4821: revisar contactos" });
  });
  it("no arma el pedido sin usuario, sin company o con motivo malo", () => {
    expect(() => buildSupportRequest(null, "ticket 4821: revisar")).toThrow(/usuario/);
    expect(() => buildSupportRequest({ ...user, companies: [] }, "ticket 4821: revisar")).toThrow(/company/);
    expect(() => buildSupportRequest({ _id: "u1", companies: ["c1"] }, "ticket 4821: revisar")).toThrow(/usuario/);
    expect(() => buildSupportRequest(user, "corto")).toThrow(/motivo/i);
  });
  it("cada error tiene título y acción; uno desconocido cae en ERROR", () => {
    for (const c of ["SIN_PERMISO_SOPORTE", "USUARIO_NO_ENCONTRADO", "MOTIVO_INVALIDO", "SESION_NO_DISPONIBLE", "ERROR"]) { expect(SUPPORT_ERRORS[c].title).toBeTruthy(); expect(SUPPORT_ERRORS[c].action).toBeTruthy(); }
    expect(explainSupportError("XYZ")).toBe(SUPPORT_ERRORS.ERROR);
    expect(explainSupportError(undefined)).toBe(SUPPORT_ERRORS.ERROR);
  });
  it("las acciones de soporte están en la auditoría", () => {
    for (const a of SUPPORT_ACTIONS) expect(AUDIT_ACTIONS[a]).toBeTruthy();
  });
  it("texto de vencimiento", () => {
    const now = new Date("2026-11-11T10:00:00Z");
    expect(expiryText("2026-11-11T10:15:00Z", now)).toBe("vence en 15 min");
    expect(expiryText("2026-11-11T10:00:30Z", now)).toBe("vence en menos de 1 min");
    expect(expiryText("2026-11-11T10:00:00Z", now)).toBe("venció");
    expect(expiryText("2026-11-11T09:00:00Z", now)).toBe("venció");
    expect(expiryText("no-es-fecha", now)).toBe("");
    expect(expiryText(undefined, now)).toBe("");
  });
  it("constantes", () => { expect([REASON_MIN, REASON_MAX]).toEqual([10, 500]); });
});
