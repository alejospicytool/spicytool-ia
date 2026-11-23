import { describe, it, expect } from "vitest";
import { nameTokens, nameScore, suggestRevCustomers, suggestDeals, suggestTicketClients, dealIdsOfCompany, ticketsOfCompany, ticketsOpen, totalMrr, subLine, subStatusInfo, stageName, refsOf, linkOf, clientOptions, linkStatus, companyOfTicketName } from "./cliente360Logic.js";

const co = { company_id: "c1", company_name: "Terra Pueblo Inmobiliaria", contact_name: "Marcos Gil", contact_email: "marcos@terra.com", contact_phone: "+54 9 351 555-0000" };

describe("nombres parecidos", () => {
  it("ignora palabras genéricas, tildes y mayúsculas", () => {
    expect(nameTokens("Inmobiliaria Terra-Pueblo S.R.L.")).toEqual(["terra", "pueblo"]);
    expect(nameTokens("Propiedades Ñandú")).toEqual(["nandu"]);
  });
  it("puntaje: comparten las palabras del nombre más corto", () => {
    expect(nameScore("Terra Pueblo", "TERRA PUEBLO Inmobiliaria")).toBe(1);
    expect(nameScore("Terra Pueblo", "Terra Norte")).toBe(0.5);
    expect(nameScore("Inmobiliaria", "Propiedades")).toBe(0); // sin palabras útiles no hay coincidencia
    expect(nameScore("", "Terra")).toBe(0);
  });
});

describe("sugerencias de pagos (Métricas)", () => {
  const customers = [
    { key: "stripe:a", name: "Otra persona", email: "MARCOS@terra.com", mrr: 100 },
    { key: "stripe:b", name: "Terra Pueblo SRL", email: "x@y.com", mrr: 400 },
    { key: "stripe:c", name: "Casa Sur", email: "c@d.com", mrr: 50 },
    { key: "stripe:d", name: "Terra Pueblo", email: "z@z.com", mrr: 200 },
  ];
  it("mismo email primero (aunque cambien mayúsculas), después nombre parecido; sin mezclar a los que no tienen nada que ver", () => {
    const r = suggestRevCustomers(co, customers, []);
    expect(r.map((x) => [x.item.key, x.reason])).toEqual([["stripe:a", "Mismo email"], ["stripe:b", "Nombre parecido"], ["stripe:d", "Nombre parecido"]]);
  });
  it("también usa otros emails de la cuenta (el del dueño en Spicytool)", () => {
    expect(suggestRevCustomers({ ...co, contact_email: "" }, customers, [], ["Z@z.com"]).some((x) => x.item.key === "stripe:d" && x.reason === "Mismo email")).toBe(true);
  });
  it("no sugiere a quien ya está vinculado a alguna cuenta (esta u otra)", () => {
    const links = [{ company_id: "c9", kind: "rev_customer", ref: "stripe:a" }, { company_id: "c1", kind: "rev_customer", ref: "stripe:b" }];
    expect(suggestRevCustomers(co, customers, links).map((x) => x.item.key)).toEqual(["stripe:d"]);
  });
});

describe("sugerencias de deals y tickets", () => {
  const deals = [{ id: "d1", data: { empresa: "Terra Pueblo", contacto: "Marcos", telefono: "351 5550000" } }, { id: "d2", data: { empresa: "Otra", contacto: "Pepe", telefono: "+54 9 351 555-0000" } }, { id: "d3", data: { empresa: "Casa Sur" } }];
  it("deals: mismo teléfono (fuerte) o nombre parecido", () => {
    expect(suggestDeals(co, deals, []).map((x) => [x.item.id, x.reason])).toEqual([["d1", "Mismo teléfono"], ["d2", "Mismo teléfono"]]);
    expect(suggestDeals({ ...co, contact_phone: "" }, deals, []).map((x) => [x.item.id, x.reason])).toEqual([["d1", "Nombre parecido"]]);
    expect(suggestDeals(co, deals, [{ kind: "crm_deal", ref: "d2", company_id: "c9" }]).map((x) => x.item.id)).toEqual(["d1"]);
  });
  it("tickets: agrupa por el texto exacto del cliente, cuenta y no repite los vinculados", () => {
    const tickets = [{ client_name: "Terra Pueblo" }, { client_name: "Terra Pueblo" }, { client_name: "terra pueblo srl" }, { client_name: "Casa Sur" }, { client_name: "" }];
    const r = suggestTicketClients(co, tickets, []);
    expect(r.map((x) => [x.item.name, x.item.count])).toEqual([["Terra Pueblo", 2], ["terra pueblo srl", 1]]);
    expect(suggestTicketClients(co, tickets, [{ kind: "ticket_client", ref: "Terra Pueblo", company_id: "c1" }]).map((x) => x.item.name)).toEqual(["terra pueblo srl"]);
  });
});

describe("lo que ya está vinculado", () => {
  const links = [{ company_id: "c1", kind: "crm_deal", ref: "d1" }, { company_id: "c1", kind: "ticket_client", ref: "Terra Pueblo" }, { company_id: "c2", kind: "ticket_client", ref: "Otro" }];
  it("refs y vínculo puntual", () => {
    expect(refsOf(links, "c1", "crm_deal")).toEqual(["d1"]);
    expect(linkOf(links, "c1", "ticket_client", "Terra Pueblo")).toBe(links[1]);
    expect(linkOf(links, "c2", "ticket_client", "Terra Pueblo")).toBeNull();
  });
  it("deals de la cuenta: los vinculados a mano más los del onboarding vinculado (sin repetir)", () => {
    const onb = [{ spicy_company_id: "c1", deal_id: "d7" }, { spicy_company_id: "c1", deal_id: "d1" }, { spicy_company_id: "c2", deal_id: "d9" }, { spicy_company_id: "c1", deal_id: null }];
    expect(dealIdsOfCompany(links, onb, "c1")).toEqual(["d1", "d7"]);
  });
  it("tickets de la cuenta por nombre vinculado, los más nuevos primero; abiertos = no cerrados", () => {
    const tickets = [{ id: 1, client_name: "Terra Pueblo ", status: "Inicio", created_at: "2026-11-01" }, { id: 2, client_name: "Terra Pueblo", status: "Solucionado", created_at: "2026-11-10" }, { id: 3, client_name: "Otro", status: "Inicio", created_at: "2026-11-11" }];
    const l = ticketsOfCompany(tickets, links, "c1");
    expect(l.map((t) => t.id)).toEqual([2, 1]);
    expect(ticketsOpen(l).map((t) => t.id)).toEqual([1]);
  });
});

describe("pagos", () => {
  it("MRR total (números como texto también) y línea de suscripción", () => {
    expect(totalMrr([{ mrr: "400.00" }, { mrr: 100 }, { mrr: null }])).toBe(500);
    expect(subLine({ currency: "usd", items: [{ unitAmount: 40000, quantity: 1, interval: "month", intervalCount: 1 }] })).toBe("USD 400 / mes");
    expect(subLine({ currency: "usd", items: [{ unitAmount: 99000, quantity: 1, interval: "year", intervalCount: 1 }] })).toBe("USD 990 / año");
    expect(subLine({ currency: "usd", items: [{ unitAmount: 1000, quantity: 2, interval: "month", intervalCount: 3 }] })).toBe("USD 20 cada 3 meses");
    expect(subLine({ items: [] })).toBe("—");
    expect(subLine(null)).toBe("—");
  });
  it("estado de suscripción y nombre de etapa", () => {
    expect(subStatusInfo("past_due")).toEqual({ label: "Pago atrasado", tone: "red" });
    expect(subStatusInfo("rara")).toEqual({ label: "rara", tone: "muted" });
    expect(stageName([{ id: "won", name: "Ganado" }], "won")).toBe("Ganado");
    expect(stageName([], "x")).toBe("x");
  });
});

describe("selector de cliente para tickets", () => {
  const f = [
    { company_id: "c1", company_name: "Terra Pueblo", contact_name: "Marcos Gil", contact_email: "marcos@terra.com" },
    { company_id: "c2", company_name: "Casa Terra Sur", contact_name: "Ana", contact_email: "a@x.com" },
    { company_id: "c3", company_name: "Álamo Propiedades", contact_name: "Luis", contact_email: "l@y.com" },
    { company_id: "c4", company_name: "Terraza Norte", contact_name: "", contact_email: "", baja_en: "2026-11-01" },
  ];
  it("sin texto: los primeros por nombre, sin los dados de baja", () => {
    expect(clientOptions(f, "").map((r) => r.company_id)).toEqual(["c3", "c2", "c1"]);
  });
  it("busca por empresa, dueño o email, sin tildes ni mayúsculas; los que empiezan igual primero", () => {
    expect(clientOptions(f, "terra").map((r) => r.company_id)).toEqual(["c1", "c2"]);
    expect(clientOptions(f, "alamo").map((r) => r.company_id)).toEqual(["c3"]);
    expect(clientOptions(f, "MARCOS").map((r) => r.company_id)).toEqual(["c1"]);
    expect(clientOptions(f, "l@y").map((r) => r.company_id)).toEqual(["c3"]);
    expect(clientOptions(f, "zzz")).toEqual([]);
  });
  it("respeta el límite y tolera datos vacíos", () => {
    expect(clientOptions(f, "", 2)).toHaveLength(2);
    expect(clientOptions(undefined, "x")).toEqual([]);
  });
  it("estado del vínculo nombre → cuenta", () => {
    const links = [{ kind: "ticket_client", ref: "Terra Pueblo", company_id: "c1" }, { kind: "crm_deal", ref: "Otro", company_id: "c9" }];
    expect(linkStatus(links, "c1", "Terra Pueblo")).toBe("ok");
    expect(linkStatus(links, "c2", "Terra Pueblo")).toBe("conflict");
    expect(linkStatus(links, "c2", "Casa Terra Sur")).toBe("create");
    expect(linkStatus(links, "c9", "Otro")).toBe("create"); // un vínculo de deal no cuenta como nombre de ticket
  });
  it("la cuenta de un nombre de ticket ya vinculado", () => {
    const links = [{ kind: "ticket_client", ref: "Terra Pueblo", company_id: "c1" }];
    expect(companyOfTicketName(links, " Terra Pueblo ")).toBe("c1");
    expect(companyOfTicketName(links, "Otro")).toBeNull();
    expect(companyOfTicketName(links, "")).toBeNull();
  });
});
