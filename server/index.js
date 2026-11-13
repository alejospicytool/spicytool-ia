// Arranque del backend del backoffice. Lee las claves del archivo /etc/spicytool-backoffice.env (ver package.json: "start").
// Solo escucha en 127.0.0.1: nginx lo expone en /api/admin/ y el resto de internet no llega directo.
import { MongoClient } from "mongodb";
import { createApp } from "./app.js";
import { makeAuthenticator } from "./auth.js";
import { makeQueries } from "./queries.js";
import { makeAudit } from "./audit.js";
import { makeBilling } from "./billing.js";
import { makeCompanyAdmin } from "./companies.js";
import { makeUserAdmin } from "./users.js";
import { makeWebhookClient } from "./webhooks.js";
import { STANDARD_PRICES } from "./prices.js";
import { COUPONS } from "./coupons.js";

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("Falta MONGODB_URI en /etc/spicytool-backoffice.env"); process.exit(1); }

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 5, appName: "backoffice-api" });
await client.connect();
const db = client.db(process.env.MONGODB_DB || "spicytool");

// Cobros (webhooks de Spicytool). Sin BACKOFFICE_WEBHOOK_TOKEN esas acciones responden "no configurado" y no hacen nada.
// WEBHOOK_COUPON_FIELD (opcional): nombre del campo del webhook para el cupón. Por defecto "coupon" (confirmado por Jonathan); el valor es el id promo_… del cupón.
// WEBHOOK_ALLOWED_EMAILS (opcional, separados por coma): si está, SOLO esos clientes se pueden tocar. Útil para la primera prueba real.
const queries = makeQueries(db);
const audit = makeAudit();
const allowedEmails = String(process.env.WEBHOOK_ALLOWED_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
const webhookClient = makeWebhookClient({ token: process.env.BACKOFFICE_WEBHOOK_TOKEN, baseUrl: process.env.WEBHOOK_BASE_URL || "https://api.spicytool.net", couponField: process.env.WEBHOOK_COUPON_FIELD || "coupon" });
const billing = makeBilling({ getUser: queries.getUser, audit, allowedEmails, coupons: COUPONS, webhook: webhookClient });
console.log(`Cupones: ${webhookClient.couponsEnabled ? `habilitados (campo "${process.env.WEBHOOK_COUPON_FIELD || "coupon"}"), ${COUPONS.length} en la lista` : "NO habilitados"}`);
console.log(`Cobros: ${process.env.BACKOFFICE_WEBHOOK_TOKEN ? "token cargado" : "SIN token (desactivados)"} · ${allowedEmails.length ? `solo ${allowedEmails.length} email(s) habilitado(s)` : "todos los clientes habilitados"}`);

// Escrituras en Mongo (pausar/activar company). Si existe MONGODB_WRITE_URI se usa un usuario aparte, limitado a escribir;
// si no, se usa la misma conexión de lectura. Conviene separarlos cuando haya un usuario de solo lectura.
let writeDb = db;
if (process.env.MONGODB_WRITE_URI) {
  const writeClient = new MongoClient(process.env.MONGODB_WRITE_URI, { serverSelectionTimeoutMS: 10000, maxPoolSize: 3, appName: "backoffice-api-write" });
  await writeClient.connect();
  writeDb = writeClient.db(process.env.MONGODB_DB || "spicytool");
}
const companies = makeCompanyAdmin({ db: writeDb, audit, invalidate: queries.invalidate });
const users = makeUserAdmin({ db: writeDb, audit, invalidate: queries.invalidate });
console.log(`Escrituras en Mongo: ${process.env.MONGODB_WRITE_URI ? "usuario de escritura aparte" : "misma conexión que la lectura"}`);

const port = Number(process.env.PORT || 3100);
createApp({ queries, authenticate: makeAuthenticator(), billing, companies, users, audit, prices: STANDARD_PRICES }).listen(port, "127.0.0.1", () => console.log(`Backoffice API escuchando en 127.0.0.1:${port}`));
