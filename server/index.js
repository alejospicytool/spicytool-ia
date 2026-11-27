// Arranque del backend del backoffice. Lee las claves del archivo /etc/spicytool-backoffice.env (ver package.json: "start").
// Solo escucha en 127.0.0.1: nginx lo expone en /api/admin/ y el resto de internet no llega directo.
import { MongoClient } from "mongodb";
import { createApp } from "./app.js";
import { makeAuthenticator, makeUserAuthenticator } from "./auth.js";
import { makeQueries } from "./queries.js";
import { makeAudit } from "./audit.js";
import { makeBilling } from "./billing.js";
import { makeCompanyAdmin } from "./companies.js";
import { makeUserAdmin } from "./users.js";
import { makeWebhookClient } from "./webhooks.js";
import { makeSupport } from "./support.js";
import { makeKapsoAdmin } from "./kapso.js";
import { makeGoogle } from "./googleCalendar.js";
import { makeCalendarStore } from "./calendarStore.js";
import { makeCalendarSync } from "./calendarSync.js";
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
const kapso = makeKapsoAdmin({ db: writeDb, readDb: db, audit, invalidate: queries.invalidate });
console.log(`Escrituras en Mongo: ${process.env.MONGODB_WRITE_URI ? "usuario de escritura aparte" : "misma conexión que la lectura"}`);

const port = Number(process.env.PORT || 3100);
// "Entrar como usuario": SPICY_API_BASE (opcional) es la dirección de la API de Spicytool; por defecto https://api.spicytool.net/api. No lleva ninguna clave: cada admin pone su propia cuenta de Spicytool en el momento.
const support = makeSupport({ getUser: queries.getUser, audit, apiBase: process.env.SPICY_API_BASE || undefined });
console.log(`Soporte (entrar como usuario): activo · API ${process.env.SPICY_API_BASE || "https://api.spicytool.net/api"}`);

// Google Calendar (tareas y próximos pasos de Onboarding → calendario de cada persona). Necesita estas variables en /etc/spicytool-backoffice.env:
// GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_TOKEN_KEY (una frase larga inventada, para cifrar los permisos) y SUPABASE_SERVICE_ROLE_KEY.
// Opcionales: APP_URL (por defecto https://backoffice.wearespicy.net) y GOOGLE_REDIRECT_URI (por defecto APP_URL + /api/admin/calendar/callback).
// Si falta alguna, la sección avisa "no configurado" y el resto del backoffice funciona igual.
const appUrl = String(process.env.APP_URL || "https://backoffice.wearespicy.net").replace(/\/+$/, "");
const google = makeGoogle({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, redirectUri: process.env.GOOGLE_REDIRECT_URI || `${appUrl}/api/admin/calendar/callback` });
const calendar = makeCalendarSync({ store: makeCalendarStore({ serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY }), google, secret: process.env.GOOGLE_TOKEN_KEY, appUrl });
if (calendar.configured) { calendar.startSchedule(); calendar.reconcile().catch((e) => console.error("Calendar (arranque):", e && e.message)); }
console.log(`Google Calendar: ${calendar.configured ? "activo" : "SIN configurar (faltan variables)"}`);

createApp({ queries, authenticate: makeAuthenticator(), authenticateUser: makeUserAuthenticator(), calendar, appUrl, billing, companies, users, audit, kapso, support, prices: STANDARD_PRICES }).listen(port, "127.0.0.1", () => console.log(`Backoffice API escuchando en 127.0.0.1:${port}`));
