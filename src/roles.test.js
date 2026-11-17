import { describe, it, expect } from "vitest";
import { ROLES, ROLE_HELP, canWriteOps, canDeleteOps } from "./roles.js";

describe("roles", () => {
  it("quién puede crear y editar: admin, dev y editor; el reader no", () => {
    expect(ROLES.filter(canWriteOps)).toEqual(["admin", "dev", "editor"]);
  });
  it("quién puede borrar: solo admin y dev (el editor no)", () => {
    expect(ROLES.filter(canDeleteOps)).toEqual(["admin", "dev"]);
  });
  it("quien puede borrar también puede escribir", () => {
    for (const r of ROLES) if (canDeleteOps(r)) expect(canWriteOps(r)).toBe(true);
  });
  it("un rol desconocido, vacío o sin sesión no puede nada (falla cerrado)", () => {
    for (const r of [undefined, null, "", "Admin", "ADMIN", "superadmin", "x"]) { expect(canWriteOps(r)).toBe(false); expect(canDeleteOps(r)).toBe(false); }
  });
  it("cada rol tiene su descripción", () => {
    for (const r of ROLES) expect(ROLE_HELP[r]).toBeTruthy();
  });
});
