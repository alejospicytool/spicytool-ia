// Arranque del backend del backoffice. Lee las claves del archivo /etc/spicytool-backoffice.env (ver package.json: "start").
// Solo escucha en 127.0.0.1: nginx lo expone en /api/admin/ y el resto de internet no llega directo.
import { MongoClient } from "mongodb";
import { createApp } from "./app.js";
import { makeAuthenticator } from "./auth.js";
import { makeQueries } from "./queries.js";

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("Falta MONGODB_URI en /etc/spicytool-backoffice.env"); process.exit(1); }

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 5, appName: "backoffice-api" });
await client.connect();
const db = client.db(process.env.MONGODB_DB || "spicytool");

const port = Number(process.env.PORT || 3100);
createApp({ queries: makeQueries(db), authenticate: makeAuthenticator() }).listen(port, "127.0.0.1", () => console.log(`Backoffice API escuchando en 127.0.0.1:${port}`));
