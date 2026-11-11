// Muestra valores de campos que son CATEGORÍAS (plan, estado, rol...) con su cantidad, tipos de ids e índices.
// Nunca muestra emails, teléfonos, nombres ni claves: solo una lista cerrada de campos de tipo "etiqueta". Solo lee.
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("Falta MONGODB_URI en /etc/spicytool-backoffice.env"); process.exit(1); }
const limpiar = (t) => String(t).split(uri).join("<MONGODB_URI>");
const BASE = process.env.MONGODB_DB || "spicytool";

// [colección, campo]: solo categorías (valores como "paused", "SpicyPro", "kapso").
const CATEGORIAS = [
  ["users", "subscription.subscriptionType"], ["users", "subscription.tier"], ["users", "subscription.legacySubscriptionType"],
  ["users", "activeWhatsAppProvider"], ["users", "role"], ["users", "isEnterprise"], ["users", "currency"],
  ["companies", "status"], ["companies", "currency"], ["companies", "vertical"],
  ["kapsoapps", "status"], ["whatsappapps", "status"], ["supportadminusers", "role"], ["supportadminusers", "active"],
];
const COLECCIONES_INDICES = ["users", "companies", "contacts", "campaigns", "landings", "workflows", "pipelines", "pipelinestages", "webforms", "contactlists", "kapsoapps", "whatsappapps", "supportsessions"];

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, appName: "backoffice-values" });
try {
  await client.connect();
  const db = client.db(BASE);

  console.log("== Categorías (valor: cantidad) ==");
  for (const [col, campo] of CATEGORIAS) {
    try {
      const filas = await db.collection(col).aggregate([{ $group: { _id: `$${campo}`, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 25 }]).toArray();
      console.log(`\n${col}.${campo}`);
      for (const f of filas) console.log(`  ${f._id === null || f._id === undefined ? "(vacío)" : JSON.stringify(f._id)}: ${f.n}`);
    } catch (e) { console.log(`\n${col}.${campo}: error (${limpiar(e.message).slice(0, 80)})`); }
  }

  console.log("\n== Tipos de ids y cantidad de companies por usuario ==");
  try {
    const u = await db.collection("users").aggregate([
      { $project: { n: { $size: { $cond: [{ $isArray: "$companies" }, "$companies", []] } }, t: { $type: { $arrayElemAt: ["$companies", 0] } } } },
      { $group: { _id: { n: "$n", t: "$t" }, c: { $sum: 1 } } }, { $sort: { c: -1 } }, { $limit: 10 },
    ]).toArray();
    for (const f of u) console.log(`  users.companies con ${f._id.n} elemento(s), tipo del primero ${f._id.t}: ${f.c} usuarios`);
    const idt = await db.collection("contacts").aggregate([{ $sample: { size: 200 } }, { $group: { _id: { $type: "$companyId" }, c: { $sum: 1 } } }]).toArray();
    for (const f of idt) console.log(`  contacts.companyId tipo ${f._id}: ${f.c} (de 200)`);
    const cr = await db.collection("companies").aggregate([{ $group: { _id: { $type: "$credits" }, c: { $sum: 1 } } }]).toArray();
    for (const f of cr) console.log(`  companies.credits tipo ${f._id}: ${f.c}`);
    const cd = await db.collection("users").aggregate([{ $group: { _id: { $type: "$creationDate" }, c: { $sum: 1 } } }]).toArray();
    for (const f of cd) console.log(`  users.creationDate tipo ${f._id}: ${f.c}`);
  } catch (e) { console.log("error:", limpiar(e.message).slice(0, 120)); }

  console.log("\n== Índices (campos por los que Mongo busca rápido) ==");
  for (const col of COLECCIONES_INDICES) {
    try {
      const idx = await db.collection(col).indexes();
      console.log(`${col}: ${idx.map((i) => Object.keys(i.key).join("+")).join(" | ")}`);
    } catch (e) { console.log(`${col}: error (${limpiar(e.message).slice(0, 60)})`); }
  }
} catch (e) {
  console.error("FALLÓ:", e?.name, "-", limpiar(e?.message));
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
