import { describe, it, expect, vi } from "vitest";
import { makeCalendarStore } from "./calendarStore.js";

const ok = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });

describe("calendarStore: claves de Supabase", () => {
  it("la clave nueva (sb_secret_…) va solo en apikey, sin Bearer", async () => {
    const f = vi.fn(async () => ok([]));
    await makeCalendarStore({ serviceKey: "sb_secret_abc", url: "https://x.supabase.co", fetchImpl: f }).listTasks();
    const h = f.mock.calls[0][1].headers;
    expect(h.apikey).toBe("sb_secret_abc");
    expect(h.Authorization).toBeUndefined();
  });
  it("la clave vieja (JWT service_role) va también como Bearer", async () => {
    const f = vi.fn(async () => ok([]));
    await makeCalendarStore({ serviceKey: "eyJhbGciOi.x.y", url: "https://x.supabase.co", fetchImpl: f }).listTasks();
    expect(f.mock.calls[0][1].headers.Authorization).toBe("Bearer eyJhbGciOi.x.y");
  });
  it("sin clave no está configurado y no llama a nada", async () => {
    const f = vi.fn();
    const s = makeCalendarStore({ serviceKey: "", fetchImpl: f });
    expect(s.configured).toBe(false);
    await expect(s.listTasks()).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(f).not.toHaveBeenCalled();
  });
  it("un error de Supabase no filtra la clave en el mensaje", async () => {
    const s = makeCalendarStore({ serviceKey: "sb_secret_abc", url: "https://x.supabase.co", fetchImpl: async () => ({ ok: false, status: 401, text: async () => "" }) });
    const e = await s.listTasks().catch((x) => x);
    expect(e.message).toMatch(/401/);
    expect(e.message).not.toContain("sb_secret_abc");
  });
});
