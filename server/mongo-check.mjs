// Prueba de conexión a Mongo. SOLO LEE: hace ping y lista bases/colecciones con su cantidad de documentos.
// No muestra datos de clientes ni la contraseña. Uso (en el droplet): cd server && npm install && npm run mongo:check
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Falta MONGODB_URI. La línea de /etc/spicytool-backoffice.env debe empezar con MONGODB_URI=");
  process.exit(1);
}

// Cualquier mensaje de error pasa por acá para no imprimir el string de conexión.
const limpiar = (t) => String(t).split(uri).join("<MONGODB_URI>");
const SISTEMA = new Set(["admin", "local", "config"]);

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, appName: "backoffice-check" });
try {
  await client.connect();
  await client.db("admin").command({ ping: 1 });
  console.log("OK: conectó a Mongo.");

  let bases = [];
  try {
    bases = (await client.db("admin").admin().listDatabases({ nameOnly: true })).databases.map((d) => d.name);
  } catch (e) {
    console.log("Conecta, pero este usuario no puede listar las bases:", limpiar(e.message));
  }
  for (const nombre of bases.filter((n) => !SISTEMA.has(n)).sort()) {
    const db = client.db(nombre);
    let cols = [];
    try {
      cols = await db.listCollections({}, { nameOnly: true }).toArray();
    } catch (e) {
      console.log(`Base "${nombre}": sin permiso para listar (${limpiar(e.message).slice(0, 80)})`);
      continue;
    }
    console.log(`Base "${nombre}" (${cols.length} colecciones):`);
    for (const c of cols.sort((a, b) => a.name.localeCompare(b.name))) {
      try {
        console.log(`  ${c.name}: ${await db.collection(c.name).estimatedDocumentCount()}`);
      } catch (e) {
        console.log(`  ${c.name}: sin permiso`);
      }
    }
  }
} catch (e) {
  console.error("FALLÓ la conexión:", e?.name, "-", limpiar(e?.message));
  console.error("Si dice 'Server selection timed out' o 'ENOTFOUND': suele ser el firewall de Mongo (falta habilitar la IP del droplet) o un host mal escrito.");
  console.error("Si dice 'Authentication failed': usuario o contraseña del string (revisá caracteres especiales codificados).");
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
