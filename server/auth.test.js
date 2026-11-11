import { describe, it, expect, vi } from "vitest";
import { makeAuthenticator } from "./auth.js";

const res = (ok, body) => ({ ok, json: async () => body });
// Supabase simulado: /auth/v1/user y /rest/v1/user_roles
const supabase = ({ user = { id: "u1", email: "nico@spicytool.test" }, role = "admin", userOk = true, roleOk = true } = {}) =>
  vi.fn(async (url) => (String(url).includes("/auth/v1/user") ? res(userOk, user) : res(roleOk, role == null ? [] : [{ role }])));

describe("autenticación de admins", () => {
  it("un admin con token válido pasa", async () => {
    const f = supabase();
    const a = makeAuthenticator({ fetchImpl: f });
    expect(await a("Bearer abc.def-123")).toEqual({ id: "u1", email: "nico@spicytool.test" });
    expect(f.mock.calls[0][1].headers.Authorization).toBe("Bearer abc.def-123");
  });
  it("sin cabecera, con otro esquema o con caracteres raros: no pasa y ni siquiera consulta", async () => {
    const f = supabase();
    const a = makeAuthenticator({ fetchImpl: f });
    for (const h of [undefined, "", "abc", "Basic abc", "Bearer ", "Bearer a b", "Bearer a;b"]) expect(await a(h)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it("token inválido o vencido: no pasa", async () => {
    expect(await makeAuthenticator({ fetchImpl: supabase({ userOk: false }) })("Bearer x")).toBeNull();
  });
  it("usuario que no es admin (dev, reader o sin rol): no pasa", async () => {
    for (const role of ["dev", "reader", null]) expect(await makeAuthenticator({ fetchImpl: supabase({ role }) })("Bearer x")).toBeNull();
  });
  it("si falla la consulta del rol: no pasa", async () => {
    expect(await makeAuthenticator({ fetchImpl: supabase({ roleOk: false }) })("Bearer x")).toBeNull();
  });
  it("guarda el acierto 1 minuto y después vuelve a preguntar; los rechazos no se guardan", async () => {
    let t = 0;
    const f = supabase();
    const a = makeAuthenticator({ fetchImpl: f, now: () => t });
    await a("Bearer x"); await a("Bearer x");
    expect(f).toHaveBeenCalledTimes(2); // una vez usuario + rol, la segunda sale del caché
    t = 61_000;
    await a("Bearer x");
    expect(f).toHaveBeenCalledTimes(4);
    const bad = supabase({ role: "dev" });
    const b = makeAuthenticator({ fetchImpl: bad });
    await b("Bearer y"); await b("Bearer y");
    expect(bad).toHaveBeenCalledTimes(4);
  });
});
