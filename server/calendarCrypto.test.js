import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken, signState, verifyState } from "./calendarCrypto.js";

const KEY = "una-frase-larga-para-las-pruebas";

describe("cifrado del permiso de Google", () => {
  it("se descifra con la misma clave y no deja el texto a la vista", () => {
    const enc = encryptToken("1//refresh-token-secreto", KEY);
    expect(enc).not.toContain("refresh-token-secreto");
    expect(enc.startsWith("v1.")).toBe(true);
    expect(decryptToken(enc, KEY)).toBe("1//refresh-token-secreto");
  });
  it("dos cifrados del mismo texto son distintos (iv al azar)", () => {
    expect(encryptToken("x", KEY)).not.toBe(encryptToken("x", KEY));
  });
  it("con otra clave, con el dato alterado o con basura devuelve null", () => {
    const enc = encryptToken("abc", KEY);
    expect(decryptToken(enc, "otra-frase-larga-distinta-1234")).toBeNull();
    const parts = enc.split(".");
    parts[3] = Buffer.from("alterado").toString("base64url");
    expect(decryptToken(parts.join("."), KEY)).toBeNull();
    expect(decryptToken("basura", KEY)).toBeNull();
    expect(decryptToken(null, KEY)).toBeNull();
  });
  it("no deja usar una clave corta o vacía", () => {
    expect(() => encryptToken("x", "corta")).toThrow(/GOOGLE_TOKEN_KEY/);
    expect(() => encryptToken("x", "")).toThrow(/GOOGLE_TOKEN_KEY/);
  });
});

describe("state del login con Google", () => {
  it("devuelve lo firmado mientras no venza", () => {
    const s = signState({ uid: "u1", email: "a@x.com" }, KEY, 1000);
    expect(verifyState(s, KEY, 2000)).toMatchObject({ uid: "u1", email: "a@x.com" });
  });
  it("vence a los 10 minutos", () => {
    const s = signState({ uid: "u1" }, KEY, 0);
    expect(verifyState(s, KEY, 9 * 60_000)).not.toBeNull();
    expect(verifyState(s, KEY, 11 * 60_000)).toBeNull();
  });
  it("rechaza un state alterado, de otra clave o mal formado", () => {
    const s = signState({ uid: "u1" }, KEY, 0);
    const [body, sig] = s.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "admin", exp: 9e15 })).toString("base64url");
    expect(verifyState(`${forged}.${sig}`, KEY, 1)).toBeNull();
    expect(verifyState(s, "otra-frase-larga-distinta-1234", 1)).toBeNull();
    expect(verifyState(body, KEY, 1)).toBeNull();
    expect(verifyState("", KEY, 1)).toBeNull();
    expect(verifyState(undefined, KEY, 1)).toBeNull();
  });
});
