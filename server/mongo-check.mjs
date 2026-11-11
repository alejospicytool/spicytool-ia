// Prueba de conexión a Mongo. SOLO LEE: hace ping y cuenta documentos por colección.
// No muestra datos de clientes ni la contraseña. Uso (en el droplet): cd server && npm install && npm run mongo:check
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Falta MONGODB_URI. Revisá /etc/spicytool-backoffice.env (paso 6).");
  process.exit(1);
}

// Cualquier mensaje de error pasa por acá para no imprimir el string de conexión.
const limpiar = (t) => String(t).split(uri).join("<MONGODB_URI>");

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, appName: "backoffice-check" });
try {
  await client.connect();
  const db = client.db(); // base indicada en el string
  await db.command({ ping: 1 });
  console.log(`OK: conectó. Base: "${db.databaseName}"`);

  let cols = [];
  try {
    cols = await db.listCollections({}, { nameOnly: true }).toArray();
  } catch (e) {
    console.log("Conecta, pero este usuario no puede listar colecciones:", limpiar(e.message));
  }
  for (const c of cols.sort((a, b) => a.name.localeCompare(b.name))) {
    try {
      const n = await db.collection(c.name).estimatedDocumentCount();
      console.log(`  ${c.name}: ${n}`);
    } catch (e) {
      console.log(`  ${c.name}: sin permiso (${limpiar(e.message).slice(0, 80)})`);
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
