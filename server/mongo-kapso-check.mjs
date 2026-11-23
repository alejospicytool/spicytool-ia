// Comprueba CÓMO se relacionan los usuarios con sus conexiones de WhatsApp por Kapso, para poder permitir cambiar "qué conexión usa" un usuario
// sin adivinar. SOLO CUENTA: no imprime emails, teléfonos, nombres ni ids; solo números. Solo lee. Uso: npm run mongo:kapso
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("Falta MONGODB_URI en /etc/spicytool-backoffice.env"); process.exit(1); }
const limpiar = (t) => String(t).split(uri).join("<MONGODB_URI>");
const BASE = process.env.MONGODB_DB || "spicytool";
const s = (v) => (v == null ? "" : String(v));

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, appName: "backoffice-kapso-check" });
try {
  await client.connect();
  const db = client.db(BASE);
  const apps = await db.collection("kapsoapps").find({}, { projection: { companyId: 1, userId: 1, isDefault: 1, status: 1, phoneNumberId: 1, kapsoCustomerId: 1 } }).toArray();
  const users = await db.collection("users").find({}, { projection: { companies: 1, activeWhatsAppProvider: 1, "kapso.kapsoAppId": 1 } }).toArray();

  const byId = new Map(apps.map((a) => [s(a._id), a]));
  const byPhone = new Map(apps.filter((a) => a.phoneNumberId).map((a) => [s(a.phoneNumberId), a]));
  const byCust = new Map(apps.filter((a) => a.kapsoCustomerId).map((a) => [s(a.kapsoCustomerId), a]));
  console.log(`kapsoapps: ${apps.length} · users: ${users.length}`);

  const conId = users.filter((u) => s(u.kapso && u.kapso.kapsoAppId));
  console.log(`\n== users.kapso.kapsoAppId ==`);
  console.log(`  usuarios con kapsoAppId cargado: ${conId.length}`);
  let mId = 0, mPhone = 0, mCust = 0, none = 0, otraCompany = 0, otroUser = 0;
  for (const u of conId) {
    const v = s(u.kapso.kapsoAppId);
    const a = byId.get(v) || null;
    if (a) mId++; else if (byPhone.has(v)) mPhone++; else if (byCust.has(v)) mCust++; else none++;
    const hit = a || byPhone.get(v) || byCust.get(v);
    if (hit) {
      if (!(u.companies || []).map(s).includes(s(hit.companyId))) otraCompany++;
      if (s(hit.userId) !== s(u._id)) otroUser++;
    }
  }
  console.log(`  coincide con kapsoapps._id: ${mId}`);
  console.log(`  coincide con kapsoapps.phoneNumberId: ${mPhone}`);
  console.log(`  coincide con kapsoapps.kapsoCustomerId: ${mCust}`);
  console.log(`  no coincide con nada: ${none}`);
  console.log(`  la conexión que apuntan es de OTRA company que la del usuario: ${otraCompany}`);
  console.log(`  la conexión que apuntan tiene OTRO userId: ${otroUser}`);
  console.log(`  usuarios con proveedor "kapso" pero SIN kapsoAppId: ${users.filter((u) => u.activeWhatsAppProvider === "kapso" && !s(u.kapso && u.kapso.kapsoAppId)).length}`);

  console.log(`\n== Companies con varias conexiones ==`);
  const porCompany = new Map();
  for (const a of apps) { const k = s(a.companyId); (porCompany.get(k) || porCompany.set(k, []).get(k)).push(a); }
  const varias = [...porCompany.values()].filter((l) => l.length > 1);
  console.log(`  companies con conexiones: ${porCompany.size} · con más de una: ${varias.length}`);
  const defCount = (l) => l.filter((a) => a.isDefault === true).length;
  console.log(`  entre las que tienen varias: con exactamente 1 principal (isDefault): ${varias.filter((l) => defCount(l) === 1).length} · con 0: ${varias.filter((l) => defCount(l) === 0).length} · con 2 o más: ${varias.filter((l) => defCount(l) > 1).length}`);
  console.log(`  entre todas las companies: con exactamente 1 principal: ${[...porCompany.values()].filter((l) => defCount(l) === 1).length} de ${porCompany.size}`);
  console.log(`  entre las que tienen varias: conexiones conectadas (success) por company: ${varias.map((l) => l.filter((a) => a.status === "success").length).sort((a, b) => a - b).join(",") || "—"}`);

  console.log(`\n== En companies con varias conexiones: ¿qué usa cada usuario? ==`);
  const idsVarias = new Set(varias.map((l) => s(l[0].companyId)));
  let usuarios = 0, usaPrincipal = 0, usaOtra = 0, sinDato = 0;
  for (const u of users) {
    const cid = s((u.companies || [])[0]);
    if (!idsVarias.has(cid)) continue;
    usuarios++;
    const v = s(u.kapso && u.kapso.kapsoAppId);
    if (!v) { sinDato++; continue; }
    const hit = byId.get(v) || byPhone.get(v) || byCust.get(v);
    if (hit && hit.isDefault === true) usaPrincipal++; else usaOtra++;
  }
  console.log(`  usuarios en esas companies: ${usuarios} · apuntan a la principal: ${usaPrincipal} · apuntan a otra: ${usaOtra} · sin dato: ${sinDato}`);
} catch (e) {
  console.error("FALLÓ:", e?.name, "-", limpiar(e?.message));
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
