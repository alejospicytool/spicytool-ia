// Cifrado del refresh token de Google y firma del "state" del login con Google. La clave (GOOGLE_TOKEN_KEY) vive solo en el servidor.
// El token se guarda como "v1.<iv>.<tag>.<datos>" (AES-256-GCM): si alguien lee la base, sin la clave no sirve de nada.
import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const unb64u = (s) => Buffer.from(String(s), "base64url");
const keyOf = (secret) => {
  if (!secret || String(secret).length < 16) throw new Error("GOOGLE_TOKEN_KEY falta o es demasiado corta (mínimo 16 caracteres).");
  return scryptSync(String(secret), "spicytool-calendar-v1", 32);
};

export function encryptToken(plain, secret) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyOf(secret), iv);
  const data = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return ["v1", b64u(iv), b64u(c.getAuthTag()), b64u(data)].join(".");
}

// Devuelve el texto original, o null si no se puede descifrar (clave distinta, dato alterado o formato raro).
export function decryptToken(enc, secret) {
  try {
    const [v, iv, tag, data] = String(enc || "").split(".");
    if (v !== "v1" || !iv || !tag || !data) return null;
    const d = createDecipheriv("aes-256-gcm", keyOf(secret), unb64u(iv));
    d.setAuthTag(unb64u(tag));
    return Buffer.concat([d.update(unb64u(data)), d.final()]).toString("utf8");
  } catch { return null; }
}

// "state" del flujo OAuth: dice quién inició la conexión (la vuelta de Google no trae sesión) y vence a los 10 minutos.
export function signState(payload, secret, now = Date.now(), ttlMs = 10 * 60_000) {
  const body = b64u(JSON.stringify({ ...payload, exp: now + ttlMs }));
  const sig = b64u(createHmac("sha256", keyOf(secret)).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyState(state, secret, now = Date.now()) {
  try {
    const [body, sig] = String(state || "").split(".");
    if (!body || !sig) return null;
    const good = createHmac("sha256", keyOf(secret)).update(body).digest();
    const got = unb64u(sig);
    if (got.length !== good.length || !timingSafeEqual(got, good)) return null;
    const p = JSON.parse(unb64u(body).toString("utf8"));
    return p && typeof p.exp === "number" && p.exp > now ? p : null;
  } catch { return null; }
}
