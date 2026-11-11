// Muestra la ESTRUCTURA de algunas colecciones: nombre de cada campo, su tipo y en qué % de documentos aparece.
// NO imprime valores (ni emails, ni teléfonos, ni claves). Solo lee. Uso: npm run mongo:schema
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("Falta MONGODB_URI en /etc/spicytool-backoffice.env"); process.exit(1); }
const limpiar = (t) => String(t).split(uri).join("<MONGODB_URI>");

const BASE = process.env.MONGODB_DB || "spicytool";
// Solo colecciones que usa el backoffice. A propósito NO están las de tokens ni claves.
const COLECCIONES = [
  "users", "companies", "contacts", "campaigns", "landings", "companyconversions",
  "whatsappconversions", "kapsoapps", "whatsappapps", "workflows", "pipelines", "pipelinestages",
  "mailtemplates", "webforms", "contactlists", "supportsessions", "supportadminusers",
];
const MUESTRA = 200;   // documentos que se miran por colección
const PROFUNDIDAD = 2; // niveles de campos anidados (a.b.c)

const tipo = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : v instanceof Date ? "date" : v?._bsontype ? String(v._bsontype).toLowerCase() : typeof v);

function recorrer(obj, prefijo, nivel, acc) {
  for (const [k, v] of Object.entries(obj)) {
    const ruta = prefijo ? `${prefijo}.${k}` : k;
    const t = tipo(v);
    (acc[ruta] ||= { n: 0, tipos: new Set() });
    acc[ruta].n += 1; acc[ruta].tipos.add(t);
    if (t === "object" && nivel < PROFUNDIDAD) recorrer(v, ruta, nivel + 1, acc);
    if (t === "array" && v.length && tipo(v[0]) === "object" && nivel < PROFUNDIDAD) recorrer(v[0], ruta + "[]", nivel + 1, acc);
  }
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, appName: "backoffice-schema" });
try {
  await client.connect();
  const db = client.db(BASE);
  for (const nombre of COLECCIONES) {
    try {
      const docs = await db.collection(nombre).find({}).limit(MUESTRA).toArray();
      const acc = {};
      for (const d of docs) recorrer(d, "", 1, acc);
      console.log(`\n== ${nombre} (muestra de ${docs.length}) ==`);
      for (const [ruta, i] of Object.entries(acc).sort(([a], [b]) => a.localeCompare(b))) {
        console.log(`  ${ruta}: ${[...i.tipos].join("|")} (${Math.round((i.n / docs.length) * 100)}%)`);
      }
    } catch (e) {
      console.log(`\n== ${nombre}: error (${limpiar(e.message).slice(0, 80)}) ==`);
    }
  }
} catch (e) {
  console.error("FALLÓ:", e?.name, "-", limpiar(e?.message));
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
