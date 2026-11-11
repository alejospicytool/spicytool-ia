// Datos de EJEMPLO de la sección "Admin Spicy". Son inventados (nombres, emails y teléfonos ficticios): el repo es público,
// acá nunca van datos reales de clientes. Tienen la misma estructura de campos que las queries de Retool
// (retool-admin-filtrado.json), para que al conectar Mongo / Postgres solo haya que reemplazar adminApi.js.
//
//   Mongo     → users, companies, contacts, campaigns, landings, companyconversions, whatsappconversions,
//               workflows, pipelines, pipelinestages, whatsapptemplates, webforms, contactlists
//   Postgres  → credit_balances, credit_transactions (columnas de transacciones supuestas: el original es SELECT *)

// _id con forma de ObjectId (24 hexa); crece con n, así "más recientes primero" funciona igual que en Mongo.
const oid = (n) => "6650" + n.toString(16).padStart(20, "0");
const iso = (d) => new Date(d).toISOString();

const COMPANIES = [
  { n: 1, name: "Inmobiliaria Ejemplo Norte", vertical: "real_estate", teamSize: "6-10", status: "active", credits: 1200, phone: "+54 11 5555-0101", created: "2025-02-11", tier: "tier4" },
  { n: 2, name: "Propiedades Demo Sur", vertical: "real_estate", teamSize: "2-5", status: "active", credits: 300, phone: "+54 11 5555-0102", created: "2025-05-03", tier: "tier3" },
  { n: 3, name: "Estudio Ficticio & Asociados", vertical: "services", teamSize: "1", status: "paused", credits: 0, phone: "+54 351 555-0103", created: "2025-07-19", tier: null, type: "freemium" },
  { n: 4, name: "Casas de Prueba SRL", vertical: "real_estate", teamSize: "11-25", status: "active", credits: 4500, phone: "+54 11 5555-0104", created: "2025-09-30", tier: "tier4" },
  { n: 5, name: "Hogar Modelo", vertical: "real_estate", teamSize: "2-5", status: "active", credits: 80, phone: "+54 261 555-0105", created: "2026-01-14", tier: null, type: "promo_landing" },
  { n: 6, name: "Terrenos Muestra", vertical: "real_estate", teamSize: "1", status: "paused", credits: 15, phone: "+54 11 5555-0106", created: "2026-03-02", tier: null, type: "freemium" },
];

// Un usuario por company (el dueño) y algunos más; companies[0] es la company del usuario.
const U = [
  // n, company, nombre, apellido, extra
  [101, 1, "Lucía", "Fernández", {}], [102, 1, "Martín", "Gómez", { kapso: { kapsoAppId: "kapso_app_9001" } }],
  [103, 2, "Camila", "Rossi", { gupshup: { whatsAppAppId: "gupshup_app_7002" } }], [104, 2, "Joaquín", "Pérez", {}],
  [105, 3, "Valentina", "Silva", {}], [106, 4, "Tomás", "Acosta", { kapso: { kapsoAppId: "kapso_app_9004" } }],
  [107, 4, "Sofía", "Benítez", {}], [108, 4, "Nicolás", "Ibáñez", {}], [109, 5, "Agustina", "Molina", { gupshup: { whatsAppAppId: "gupshup_app_7005" } }],
  [110, 6, "Facundo", "Ríos", {}], [111, 5, "Julieta", "Vega", {}], [112, 1, "Bruno", "Castro", {}],
];

export const users = U.map(([n, c, name, surname, extra], i) => {
  const co = COMPANIES[c - 1];
  return {
    _id: oid(n), email: `${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}.${surname.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}@ejemplo.test`,
    phoneNumber: `+54 9 11 5555-${String(2000 + i * 37).slice(-4)}`, name, surname, companies: [oid(c)],
    subscription: { subscriptionType: co.type || "paid", tier: co.tier },
    stripe: { customerId: `cus_Mock${String(n).padStart(4, "0")}` },
    ...extra,
  };
});

// El owner de cada company es el primer usuario cargado de esa company; su email es el "userEmail" de la company.
const ownerEmail = (n) => users.find((u) => u.companies[0] === oid(n)).email;

export const companies = COMPANIES.map((c) => ({
  _id: oid(c.n), name: c.name, isConfigured: c.status === "active", credits: c.credits, currency: "USD",
  userEmail: ownerEmail(c.n), phoneNumber: c.phone, creationDate: iso(c.created), accountId: `${5000000000 + c.n * 1117}`,
  activeWhatsAppConversations: c.status === "active" ? c.n * 7 : 0, status: c.status, lastUnpaidBill: c.n === 3 ? iso("2026-08-01") : null,
  onboardingEnded: c.status === "active", trackId: `trk_${c.n}a9f`, vertical: c.vertical, teamSize: c.teamSize,
}));

// ── Datos hijos de cada company (generados de forma determinística) ────────────────────────────────
const contacts = [], campaigns = [], landings = [], companyconversions = [], whatsappconversions = [], workflows = [];
const pipelines = [], pipelinestages = [], whatsapptemplates = [], webforms = [], contactlists = [];
const credit_balances = [], credit_transactions = [];

const NAMES = ["Ana", "Luis", "Marta", "Pablo", "Elena", "Diego", "Carla", "Hugo"];
const SURNAMES = ["Soto", "Luna", "Paz", "Roca", "Mora", "Díaz", "Ruiz", "Sosa"];
const SOURCES = ["landing", "whatsapp", "webform", "importado"];
const KEYWORDS = ["departamento venta", "casa alquiler", "terreno", "oficina", "lote barrio cerrado"];
let seq = 1;
const nid = () => oid(10000 + seq++);

COMPANIES.forEach((co, ci) => {
  const companyId = oid(co.n), userEmail = ownerEmail(co.n);

  const nContacts = 3 + (ci % 4);
  for (let i = 0; i < nContacts; i++) {
    const name = NAMES[(ci + i) % NAMES.length], surname = SURNAMES[(ci * 2 + i) % SURNAMES.length];
    contacts.push({
      _id: nid(), companyId, email: `${name}.${surname}${i}@contacto.test`.toLowerCase(), date: iso(`2026-0${1 + (i % 9)}-1${i}`), name, surname,
      keyword: KEYWORDS[i % KEYWORDS.length], phoneNumber: `+54 9 11 4444-${String(1000 + ci * 100 + i).slice(-4)}`, source: SOURCES[i % SOURCES.length],
      createdAt: iso(`2026-0${1 + (i % 9)}-1${i}T14:00:00Z`), updatedAt: iso(`2026-0${1 + (i % 9)}-2${i}T09:30:00Z`), pipelineStages: [], createdFrom: i % 2 ? "chatbot" : "web",
    });
  }

  for (let i = 0; i < 1 + (ci % 2); i++) {
    campaigns.push({
      _id: nid(), companyId, userEmail, campaignId: `${7000000000 + ci * 31 + i}`, campaignName: `Campaña ${KEYWORDS[(ci + i) % KEYWORDS.length]}`,
      budgetPerDay: 10 + ci * 5 + i * 3, investedPerDay: 8 + ci * 4 + i * 2, campaignStatus: i === 0 ? "ENABLED" : "PAUSED", accountId: co.n === 3 ? null : `${5000000000 + co.n * 1117}`,
    });
  }

  landings.push({ _id: nid(), companyId, userEmail, name: `Landing ${co.name}`, keyword: KEYWORDS[ci % KEYWORDS.length], phoneNumber: co.phone, source: "google" });

  companyconversions.push(
    { _id: nid(), companyId, condition: "Mensaje de WhatsApp recibido", conversionCategory: "LEAD" },
    { _id: nid(), companyId, condition: "Formulario enviado", conversionCategory: "SUBMIT_LEAD_FORM" },
  );

  for (let i = 0; i < 3; i++) {
    whatsappconversions.push({ _id: nid(), companyId, behavior: ["inbound", "outbound", "inbound"][i], checked: i !== 1, date: iso(`2026-1${i}-0${2 + i}`), trackId: co.n === 3 ? null : `trk_${co.n}a9f`, source: SOURCES[i] });
  }

  for (let i = 0; i < 1 + (ci % 2); i++) {
    workflows.push({
      _id: nid(), companyId, name: ["Bienvenida a nuevos contactos", "Seguimiento a las 24 h", "Aviso de visita agendada"][(ci + i) % 3],
      description: "Flujo automático de ejemplo", triggerProperty: i ? "stage" : "source", triggerValue: i ? "Visita" : "webform",
    });
  }

  const pipeCount = 1 + (ci % 2);
  for (let p = 0; p < pipeCount; p++) {
    const pid = nid();
    pipelines.push({ _id: pid, companyId, name: p ? "Alquileres" : "Ventas", description: p ? "Pipeline de alquileres" : "Pipeline principal de ventas" });
    ["Nuevo", "Contactado", "Visita", "Cerrado"].forEach((s, pos) => pipelinestages.push({ _id: nid(), pipelineId: pid, name: s, description: `Etapa ${s.toLowerCase()}`, position: pos + 1 }));
  }

  for (let i = 0; i < 2; i++) {
    whatsapptemplates.push({
      _id: nid(), companyId, name: i ? "recordatorio_visita" : "bienvenida", header: i ? "Tu visita" : "¡Hola!", description: i ? "Recordatorio de visita agendada" : "Mensaje de bienvenida",
      category: i ? "UTILITY" : "MARKETING", message: i ? "Te recordamos tu visita de mañana a las {{1}}." : "Hola {{1}}, gracias por escribirnos.", variables: i ? ["hora"] : ["nombre"], gupshup: { templateId: `tpl_${co.n}_${i}`, status: "APPROVED" },
    });
  }

  webforms.push({ _id: nid(), companyId, name: "Contacto web", description: "Formulario de la landing", position: 1 });
  contactlists.push({ _id: nid(), companyId, name: "Todos los contactos", position: 1 }, { _id: nid(), companyId, name: "Interesados en venta", position: 2 });

  // Postgres de billing
  credit_balances.push({ company_id: companyId, monthly_credits: Math.round(co.credits * 0.4), total_credits: co.credits + 350, available_credits: co.credits });
  const tx = [["purchase", 500, "Compra de créditos"], ["usage", -120, "Conversaciones de WhatsApp"], ["monthly_grant", Math.round(co.credits * 0.4), "Crédito mensual"], ["usage", -75, "Conversaciones de WhatsApp"]];
  tx.forEach(([type, amount, description], i) => credit_transactions.push({ id: 1000 * co.n + i, company_id: companyId, amount, type, description, created_at: iso(`2026-0${3 + i}-1${i}T12:00:00Z`) }));
});

export const MOCK = {
  users, companies, contacts, campaigns, landings, companyconversions, whatsappconversions, workflows,
  pipelines, pipelinestages, whatsapptemplates, webforms, contactlists, credit_balances, credit_transactions,
};
