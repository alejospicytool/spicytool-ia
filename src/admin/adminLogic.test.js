import { describe, it, expect } from "vitest";
import {
  PAID_PLANS, planOf, planLabel, isPaidPlan, validatePlanAssignment, newIdempotencyKey, formatPrice, explainWebhookError, WEBHOOK_ERRORS, validateSupportReason, buildSupportRequest, explainSupportError, SUPPORT_ERRORS, SUPPORT_ACTIONS, AUDIT_ACTIONS, expiryText, REASON_MIN, REASON_MAX, matchesSearch, escapeRegExp, sortUsersRecent, paginate, whatsappProvider, companyIdOf, isMemberOf, isCollaboratorOf, kapsoStatusInfo, kapsoAppsOfUser, kapsoSummary, kapsoQualityInfo, messagingTierLabel, incomingModeLabel, listKapsoRows,
  validateCompanyEdit, validateContactEdit, diffFields, waLink, couponSummary, buildAuditEntry, userFullName, sortByPosition, isOwner, matchesFilters, isPaused, matchesCompanySearch, sortCompaniesByName, matchesPlan, planCounts, planOptions, NO_PLAN, companiesView, companyPlan, ownerIndex,
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
  it("los códigos que agrega el servidor (lista de habilitados, tope, auditoría, resultado incierto) también se explican", () => {
    for (const c of ["FUERA_DE_LA_LISTA", "DEMASIADOS_INTENTOS", "AUDITORIA_NO_DISPONIBLE", "WEBHOOK_NO_CONFIGURADO", "RESULTADO_INCIERTO", "CLAVE_INVALIDA"]) {
      expect(WEBHOOK_ERRORS[c].title).toBeTruthy();
      expect(WEBHOOK_ERRORS[c].action).toBeTruthy();
    }
    expect(explainWebhookError("RESULTADO_INCIERTO").action).toMatch(/Stripe/);
    expect(explainWebhookError("AUDITORIA_NO_DISPONIBLE").action).toMatch(/no se cobró/i);
  });
  it("las acciones de auditoría del cobro (iniciado, sin confirmar) tienen texto", () => {
    expect(AUDIT_ACTIONS.plan_assign_started).toBeTruthy();
    expect(AUDIT_ACTIONS.plan_assign_unknown).toMatch(/Stripe/);
    expect(AUDIT_ACTIONS.company_status_failed).toMatch(/no se guardó/);
    expect(AUDIT_ACTIONS.company_edit_failed).toMatch(/no se guardó/);
    expect(AUDIT_ACTIONS.contact_edit_failed).toMatch(/no se guardó/);
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
  it("un colaborador sin company propia usa la company en la que colabora; la propia gana si tiene", () => {
    expect(companyIdOf({ companies: [], collaboratesIn: ["c9"] })).toBe("c9");
    expect(companyIdOf({ companies: ["c1"], collaboratesIn: ["c9"] })).toBe("c1");
    expect(companyIdOf({ collaboratesIn: "no-es-lista" })).toBeNull();
  });
  it("pertenece a una company como miembro o como colaborador; colaborador es solo quien no la tiene como propia", () => {
    const u = { companies: ["c1"], collaboratesIn: ["c9"] };
    expect(isMemberOf(u, "c1")).toBe(true); expect(isMemberOf(u, "c9")).toBe(true); expect(isMemberOf(u, "c5")).toBe(false); expect(isMemberOf(u, null)).toBe(false);
    expect(isCollaboratorOf(u, "c9")).toBe(true); expect(isCollaboratorOf(u, "c1")).toBe(false);
    expect(isCollaboratorOf({ companies: ["c1"], collaboratesIn: ["c1"] }, "c1")).toBe(false);
  });
  it("estado de la conexión de Kapso: conectada, pendiente, y lo demás tal cual", () => {
    expect(kapsoStatusInfo("success")).toEqual({ label: "Conectada", tone: "green" });
    expect(kapsoStatusInfo("pending_setup")).toEqual({ label: "Pendiente de conexión", tone: "amber" });
    expect(kapsoStatusInfo("rara")).toEqual({ label: "rara", tone: "muted" });
    expect(kapsoStatusInfo("")).toEqual({ label: "—", tone: "muted" });
  });
  it("calidad, límite y modo de mensajes entrantes con los valores reales de la base", () => {
    expect(kapsoQualityInfo("GREEN")).toEqual({ label: "Verde", tone: "green" });
    expect(kapsoQualityInfo("UNKNOWN")).toEqual({ label: "Sin calificar", tone: "muted" });
    expect(kapsoQualityInfo("red")).toEqual({ label: "Roja", tone: "red" });
    expect(kapsoQualityInfo("OTRA")).toEqual({ label: "OTRA", tone: "muted" });
    expect(kapsoQualityInfo(null)).toBeNull();
    expect(messagingTierLabel("TIER_250")).toBe("250 por día");
    expect(messagingTierLabel("TIER_1K")).toBe("1.000 por día");
    expect(messagingTierLabel("TIER_RARO")).toBe("TIER_RARO");
    expect(messagingTierLabel(null)).toBe("—");
    expect(incomingModeLabel("workflow_only")).toBe("Solo workflows");
    expect(incomingModeLabel("standard")).toBe("Estándar");
    expect(incomingModeLabel(undefined)).toBe("—");
  });
  describe("listKapsoRows (vista de conexiones)", () => {
    const NOW = new Date("2026-11-23T12:00:00Z").getTime();
    const users = [{ _id: "u1", email: "ana@x.test", name: "Ana", surname: "Paz", phoneNumber: "+54911" }, { _id: "u2", email: "luis@x.test", name: "Luis", surname: "Gómez", phoneNumber: "+54922" }];
    const companies = [{ _id: "c1", name: "Inmo Paz", status: "active" }, { _id: "c2", name: "Casa Sur", status: "paused" }];
    const app = (o) => ({ _id: "k" + Math.random(), alias: "L", status: "pending_setup", companyId: "c1", userId: "u1", createdAt: "2026-11-13T12:00:00Z", isDefault: false, ...o });
    const apps = [app({ _id: "k1", createdAt: "2026-11-20T12:00:00Z" }), app({ _id: "k2", createdAt: "2026-10-01T12:00:00Z" }), app({ _id: "k3", status: "success", displayPhoneNumber: "+5491100" }), app({ _id: "k4", companyId: "c2", userId: "u2" }), app({ _id: "k5", companyId: "c9", userId: "u9" })];
    const run = (o) => listKapsoRows({ apps, users, companies }, { now: NOW, ...o });
    it("por defecto: pendientes de companies activas, las más antiguas primero", () => {
      const r = run({});
      expect(r.items.map((x) => x._id)).toEqual(["k2", "k1"]);
      expect(r.counts).toEqual({ pending: 2, connected: 1, all: 3 });
    });
    it("agrega company, usuario y los días que lleva creada", () => {
      expect(run({}).items[0]).toMatchObject({ companyName: "Inmo Paz", companyStatus: "active", userName: "Ana Paz", userEmail: "ana@x.test", userPhone: "+54911", daysSinceCreated: 53 });
    });
    it("con 'solo activas' apagado entran las companies pausadas (y las que no se encuentran se muestran sin datos)", () => {
      const r = run({ activeOnly: false });
      expect(r.counts.pending).toBe(4);
      expect(r.items.find((x) => x._id === "k5")).toMatchObject({ companyName: "—", userName: "—", companyStatus: null });
      expect(r.items.find((x) => x._id === "k4").companyStatus).toBe("paused");
    });
    it("conectadas y todas; la búsqueda ignora mayúsculas y tildes y mira company, usuario y números", () => {
      expect(run({ status: "connected" }).items.map((x) => x._id)).toEqual(["k3"]);
      expect(run({ status: "all" }).total).toBe(3);
      expect(run({ search: "ANA" }).total).toBe(2);
      expect(run({ search: "inmo paz", status: "all", activeOnly: false }).total).toBe(3);
      expect(run({ search: "gomez", activeOnly: false }).items.map((x) => x._id)).toEqual(["k4"]);
      expect(run({ search: "5491100", status: "all" }).items.map((x) => x._id)).toEqual(["k3"]);
      expect(run({ search: "zzz" }).total).toBe(0);
    });
    it("pagina y los totales de las pestañas siguen la búsqueda, no la página", () => {
      const r = run({ status: "all", pageSize: 2, page: 2 });
      expect(r).toMatchObject({ page: 2, pages: 2, total: 3 });
      expect(r.items).toHaveLength(1);
      expect(r.counts.all).toBe(3);
    });
    it("no se rompe con datos incompletos", () => {
      expect(listKapsoRows({}, {})).toMatchObject({ items: [], total: 0, counts: { pending: 0, connected: 0, all: 0 } });
      expect(listKapsoRows({ apps: [{ _id: "x", status: "pending_setup" }] }, { activeOnly: false }).items[0].daysSinceCreated).toBeNull();
    });
  });
  it("las conexiones de un usuario: por su id o por la que tiene marcada; resumen sin campos de más", () => {
    const apps = [{ _id: "k1", userId: "u1", alias: "A", status: "success", connectionType: "x", displayPhoneNumber: "+1", isDefault: true, businessAccountId: "waba" }, { _id: "k2", userId: "u2" }, { _id: "k3", userId: "u3" }];
    expect(kapsoAppsOfUser(apps, { _id: "u1" }).map((a) => a._id)).toEqual(["k1"]);
    expect(kapsoAppsOfUser(apps, { _id: "u9", kapso: { kapsoAppId: "k3" } }).map((a) => a._id)).toEqual(["k3"]);
    expect(kapsoAppsOfUser(apps, { _id: "u9" })).toEqual([]);
    expect(kapsoAppsOfUser(undefined, { _id: "u1" })).toEqual([]);
    expect(kapsoSummary(apps[0])).toEqual({ _id: "k1", alias: "A", status: "success", connectionType: "x", displayPhoneNumber: "+1", isDefault: true });
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
    expect(validateCompanyEdit({ name: "x", phoneNumber: "", credits: true }).errors.credits).toBeTruthy();
    expect(validateCompanyEdit({ name: "x", phoneNumber: "hola", credits: 1 }).errors.phoneNumber).toBeTruthy();
  });
  it("company: créditos vacío significa 'no cambiarlos' (null), no un error ni un 0", () => {
    for (const credits of ["", "  ", null, undefined]) {
      const r = validateCompanyEdit({ name: "x", phoneNumber: "", credits });
      expect(r.ok).toBe(true);
      expect(r.value.credits).toBeNull();
    }
    expect(validateCompanyEdit({ name: "x", phoneNumber: "", credits: "0" }).value.credits).toBe(0); // 0 sí es un valor
  });
  it("company: un teléfono ya guardado con formato raro no impide editar el nombre; uno nuevo se valida", () => {
    expect(validateCompanyEdit({ name: "x", phoneNumber: "tel: 4444 ext.7", credits: "" }).errors.phoneNumber).toBeTruthy();
    expect(validateCompanyEdit({ name: "x", phoneNumber: "tel: 4444 ext.7", credits: "" }, { currentPhone: "tel: 4444 ext.7" }).ok).toBe(true);
    expect(validateCompanyEdit({ name: "x", phoneNumber: "otro raro", credits: "" }, { currentPhone: "tel: 4444 ext.7" }).errors.phoneNumber).toBeTruthy();
  });
  it("company: créditos 0 es válido, teléfono vacío también", () => {
    expect(validateCompanyEdit({ name: "x", phoneNumber: "", credits: 0 }).ok).toBe(true);
  });
  it("contacto: nombre obligatorio y teléfono válido; el email no forma parte de lo que se valida ni se guarda", () => {
    const ok = validateContactEdit({ name: " A ", surname: "B", email: "cualquiera", phoneNumber: "" });
    expect(ok.ok).toBe(true);
    expect(ok.value).toEqual({ name: "A", surname: "B", phoneNumber: "" });
    expect(validateContactEdit({ name: "", surname: "B", phoneNumber: "" }).errors.name).toBeTruthy();
    expect(validateContactEdit({ name: "A", surname: "", phoneNumber: "12" }).errors.phoneNumber).toBeTruthy();
  });
  it("contacto: un teléfono ya guardado con formato raro no impide editar el nombre; uno nuevo se valida", () => {
    expect(validateContactEdit({ name: "A", surname: "", phoneNumber: "int. 44 / 7" }).errors.phoneNumber).toBeTruthy();
    expect(validateContactEdit({ name: "A", surname: "", phoneNumber: "int. 44 / 7" }, { currentPhone: "int. 44 / 7" }).ok).toBe(true);
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

describe("link de WhatsApp (waLink)", () => {
  it("con + o 00 adelante: arma https://wa.me/ con solo dígitos", () => {
    expect(waLink("+54 9 11 5555-0000")).toBe("https://wa.me/5491155550000");
    expect(waLink("+5491144445394")).toBe("https://wa.me/5491144445394");
    expect(waLink("  +598 94 622 258 ")).toBe("https://wa.me/59894622258");
    expect(waLink("0054 9 11 5555 0000")).toBe("https://wa.me/5491155550000");
    expect(waLink("+52 55 3233 69 88")).toBe("https://wa.me/525532336988");
  });
  it("sin + ni 00: solo si ya trae código de país (11 dígitos o más)", () => {
    expect(waLink("5491155550000")).toBe("https://wa.me/5491155550000");
    expect(waLink("549 3416898359")).toBe("https://wa.me/5493416898359");
    expect(waLink("1155550000")).toBe("");       // 10 dígitos: número local, no se sabe el país
    expect(waLink("11 5555-0000")).toBe("");
    expect(waLink("5555-0000")).toBe("");
  });
  it("vacío, texto o demasiado largo: no arma link", () => {
    for (const v of [undefined, null, "", "   ", "sin teléfono", "+", "+12", "+1234567890123456"]) expect(waLink(v)).toBe("");
  });
  it("nunca deja pasar caracteres raros en el link", () => {
    expect(waLink("+54 9 11 5555-0000?text=hola&x=<script>")).toMatch(/^https:\/\/wa\.me\/\d+$/);
    expect(waLink("javascript:alert(1)")).toBe("");
  });
});

describe("resumen del cobro con cupón (couponSummary)", () => {
  const price = { amount: 20000, currency: "usd" };
  const c = (o) => ({ duration: "repeating", months: 1, ...o });
  it("porcentaje por 1 mes: el primer mes con descuento y después el precio completo", () => {
    expect(couponSummary(price, c({ percentOff: 25 }))).toMatchObject({ discounted: 15000, full: 20000, free: false, forever: false });
    expect(couponSummary(price, c({ percentOff: 25 })).text).toBe("USD 150 el primer mes, después USD 200/mes");
  });
  it("por varios meses", () => {
    expect(couponSummary(price, c({ percentOff: 50, months: 2 })).text).toBe("USD 100/mes los primeros 2 meses, después USD 200/mes");
    expect(couponSummary({ amount: 20000 }, c({ percentOff: 10, months: 3 })).text).toBe("USD 180/mes los primeros 3 meses, después USD 200/mes");
  });
  it("con centavos muestra siempre 2 decimales", () => {
    expect(couponSummary({ amount: 4900 }, c({ percentOff: 50, months: 2 })).text).toBe("USD 24,50/mes los primeros 2 meses, después USD 49/mes");
  });
  it("monto fijo y 'una sola vez'", () => {
    expect(couponSummary(price, { amountOff: 5000, duration: "once" }).text).toBe("USD 150 el primer mes, después USD 200/mes");
  });
  it("100%: gratis, y si es ilimitado se avisa que no se cobra nunca", () => {
    const m = couponSummary(price, c({ percentOff: 100 }));
    expect(m).toMatchObject({ free: true, discounted: 0, forever: false });
    expect(m.text).toBe("Gratis el primer mes, después USD 200/mes");
    const f = couponSummary(price, { percentOff: 100, duration: "forever" });
    expect(f).toMatchObject({ free: true, forever: true });
    expect(f.text).toContain("no se le cobra nunca");
  });
  it("descuento permanente que no es total", () => {
    expect(couponSummary(price, { percentOff: 20, duration: "forever" }).text).toBe("USD 160/mes para siempre");
  });
  it("nunca da negativo y sin precio conocido devuelve null", () => {
    expect(couponSummary({ amount: 3000 }, { amountOff: 5000, duration: "once" }).discounted).toBe(0);
    expect(couponSummary(null, c({ percentOff: 10 }))).toBeNull();
    expect(couponSummary(price, null)).toBeNull();
    expect(couponSummary({}, c({ percentOff: 10 }))).toBeNull();
  });
});

describe("filtro por tipo de suscripción", () => {
  const u = (plan) => ({ subscription: plan === undefined ? undefined : { subscriptionType: plan } });
  it("matchesPlan: vacío pasa todos, 'none' es sin plan y el resto es el nombre exacto", () => {
    expect(matchesPlan(u("Freemium"), "")).toBe(true);
    expect(matchesPlan(u("Freemium"), "Freemium")).toBe(true);
    expect(matchesPlan(u("SpicyPro"), "Freemium")).toBe(false);
    expect(matchesPlan(u(undefined), NO_PLAN)).toBe(true);
    expect(matchesPlan(u(null), NO_PLAN)).toBe(true);
    expect(matchesPlan(u("Freemium"), NO_PLAN)).toBe(false);
    expect(matchesPlan(u(undefined), "Freemium")).toBe(false);
  });
  it("matchesFilters combina plan con owners y company activa", () => {
    const co = { userEmail: "a@a.com", status: "active" };
    const owner = { email: "a@a.com", subscription: { subscriptionType: "Freemium" } };
    expect(matchesFilters(owner, co, { owners: true, activeOnly: true, plan: "Freemium" })).toBe(true);
    expect(matchesFilters(owner, co, { owners: true, plan: "SpicyPro" })).toBe(false);
  });
  it("planCounts cuenta por plan y agrupa los sin plan", () => {
    expect(planCounts([u("Freemium"), u("Freemium"), u("SpicyPro"), u(undefined), u(null)])).toEqual({ Freemium: 2, SpicyPro: 1, none: 2 });
    expect(planCounts(null)).toEqual({});
  });
  it("planOptions: orden fijo, desconocidos al final, 'Sin plan' último y solo con usuarios", () => {
    const o = planOptions({ SpicyPro: 3, Freemium: 10, Zeta: 1, FreeTrial: 2, none: 4 });
    expect(o.map((x) => x.value)).toEqual(["Freemium", "FreeTrial", "SpicyPro", "Zeta", "none"]);
    expect(o.find((x) => x.value === "FreeTrial").label).toBe("Free trial");
    expect(o.at(-1)).toEqual({ value: "none", label: "Sin plan", count: 4 });
    expect(planOptions({ Freemium: 1 }, "SpicyPro").map((x) => [x.value, x.count])).toEqual([["Freemium", 1], ["SpicyPro", 0]]);
  });
});

describe("companies filtradas por plan del owner", () => {
  const cos = [
    { _id: "c1", name: "Alfa", userEmail: "a@x.com", status: "active" },
    { _id: "c2", name: "Beta", userEmail: "B@x.com", status: "active" },
    { _id: "c3", name: "Gamma", userEmail: "g@x.com", status: "paused" },
    { _id: "c4", name: "Delta", userEmail: "d@x.com", status: "active" },
  ];
  const us = [
    { _id: "u1", email: "a@x.com", companies: ["c1"], subscription: { subscriptionType: "Freemium" } },
    { _id: "u2", email: "b@x.com", companies: ["c2"], subscription: { subscriptionType: "SpicyPro" } },
    { _id: "u3", email: "g@x.com", companies: ["c3"], subscription: { subscriptionType: "Freemium" } },
    { _id: "u4", email: "otro@x.com", companies: ["c1"], subscription: { subscriptionType: "SpicyPro" } },
  ];
  it("companyPlan toma el plan del owner (email sin distinguir mayúsculas) y null si no hay owner", () => {
    const idx = ownerIndex(us);
    expect(companyPlan(cos[0], idx)).toBe("Freemium");
    expect(companyPlan(cos[1], idx)).toBe("SpicyPro");
    expect(companyPlan(cos[3], idx)).toBeNull();
  });
  it("sin filtro lista la pestaña activa con su plan", () => {
    const r = companiesView({ companies: cos, users: us });
    expect(r.items.map((c) => [c.name, c.plan])).toEqual([["Alfa", "Freemium"], ["Beta", "SpicyPro"], ["Delta", null]]);
    expect(r.counts).toEqual({ active: 3, paused: 1 });
    expect(r.planCounts).toEqual({ Freemium: 1, SpicyPro: 1, none: 1 });
    expect(r.items[0].userCount).toBe(2);
  });
  it("filtra por plan y los conteos de pestañas lo respetan; los del selector no", () => {
    const r = companiesView({ companies: cos, users: us, plan: "Freemium" });
    expect(r.items.map((c) => c.name)).toEqual(["Alfa"]);
    expect(r.counts).toEqual({ active: 1, paused: 1 });
    expect(r.planCounts).toEqual({ Freemium: 1, SpicyPro: 1, none: 1 });
    expect(companiesView({ companies: cos, users: us, status: "paused", plan: "Freemium" }).items.map((c) => c.name)).toEqual(["Gamma"]);
    expect(companiesView({ companies: cos, users: us, plan: "none" }).items.map((c) => c.name)).toEqual(["Delta"]);
  });
});
