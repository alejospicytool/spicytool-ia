import { describe, it, expect, vi } from "vitest";
import { makeAudit } from "./audit.js";

const ok = (body) => vi.fn(async () => ({ ok: true, status: 200, json: async () => body }));
const mk = (fetchImpl) => makeAudit({ supabaseUrl: "https://sb.test", apiKey: "pub_key", fetchImpl });

describe("auditoría en Supabase", () => {
  it("guarda con el token del admin (no con una clave secreta) y sin pedir la fila de vuelta", async () => {
    const f = ok(null);
    await mk(f).record("JWT_ADMIN", { actor: "nico@x.test", action: "plan_assign", targetType: "user", targetId: "u1", targetLabel: "Ana Paz", companyId: "c1", detail: { plan: "SpicyPro" } });
    const [url, o] = f.mock.calls[0];
    expect(url).toBe("https://sb.test/rest/v1/admin_audit");
    expect(o.method).toBe("POST");
    expect(o.headers).toMatchObject({ apikey: "pub_key", Authorization: "Bearer JWT_ADMIN", Prefer: "return=minimal" });
    expect(JSON.parse(o.body)).toEqual({ actor: "nico@x.test", action: "plan_assign", target_type: "user", target_id: "u1", target_label: "Ana Paz", company_id: "c1", detail: { plan: "SpicyPro" } });
  });
  it("si Supabase rechaza (por ejemplo la tabla no existe o RLS lo bloquea) lanza error", async () => {
    await expect(mk(vi.fn(async () => ({ ok: false, status: 404 }))).record("t", { actor: "a", action: "x" })).rejects.toThrow(/HTTP 404/);
  });
  it("lee las más recientes primero, filtra por company y devuelve la forma que usa la pantalla", async () => {
    const f = ok([{ id: 7, at: "2026-11-11T10:00:00Z", actor: "nico@x.test", action: "card_link_created", target_type: "user", target_id: "u1", target_label: "Ana", company_id: "c1", detail: null }]);
    const rows = await mk(f).list("JWT", { companyId: "6650000000000000000000c1", limit: 999 });
    const u = new URL(f.mock.calls[0][0]);
    expect(u.searchParams.get("order")).toBe("at.desc,id.desc");
    expect(u.searchParams.get("limit")).toBe("200");
    expect(u.searchParams.get("company_id")).toBe("eq.6650000000000000000000c1");
    expect(rows).toEqual([{ id: "7", at: "2026-11-11T10:00:00Z", actor: "nico@x.test", action: "card_link_created", targetType: "user", targetId: "u1", targetLabel: "Ana", companyId: "c1", detail: {} }]);
  });
});
