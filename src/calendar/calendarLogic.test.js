import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { explainReturn, connectionBadge, timeAgo, withoutCalendarParam } from "./calendarLogic.js";
import { configureCalendarApi, calendarStatus, calendarConnectUrl, calendarDisconnect, calendarSyncNow, requestCalendarSync } from "./calendarApi.js";

describe("explainReturn", () => {
  it("ok es verde; cada error explica qué hacer", () => {
    expect(explainReturn("ok").tone).toBe("ok");
    for (const c of ["denegado", "sin_permiso_calendar", "sin_refresh_token", "state_invalido", "google_fallo", "no_configurado", "algo_raro"]) {
      const r = explainReturn(c);
      expect(r.tone).toBe("bad");
      expect(r.text.length).toBeGreaterThan(20);
    }
  });
  it("sin código no muestra nada", () => {
    expect(explainReturn("")).toBeNull();
    expect(explainReturn(null)).toBeNull();
  });
});

describe("connectionBadge", () => {
  it("verde si está conectado, ámbar si hay que reconectar, gris si no", () => {
    expect(connectionBadge({ configured: true, connected: true }).tone).toBe("ok");
    expect(connectionBadge({ configured: true, connected: false, needsReconnect: true })).toEqual({ tone: "warn", label: "Calendar: reconectar" });
    expect(connectionBadge({ configured: true, connected: false }).tone).toBe("off");
    expect(connectionBadge({ configured: false }).tone).toBe("off");
    expect(connectionBadge(null).tone).toBe("off");
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-11-27T12:00:00Z");
  it("traduce a minutos, horas y días", () => {
    expect(timeAgo("2026-11-27T11:59:40Z", now)).toBe("recién");
    expect(timeAgo("2026-11-27T11:55:00Z", now)).toBe("hace 5 min");
    expect(timeAgo("2026-11-27T09:00:00Z", now)).toBe("hace 3 h");
    expect(timeAgo("2026-11-26T09:00:00Z", now)).toBe("ayer");
    expect(timeAgo("2026-11-20T12:00:00Z", now)).toBe("hace 7 días");
  });
  it("sin fecha o con fecha rara", () => {
    expect(timeAgo(null, now)).toBe("todavía no se sincronizó");
    expect(timeAgo("nada", now)).toBe("todavía no se sincronizó");
  });
});

describe("withoutCalendarParam", () => {
  it("saca solo ?calendar y conserva lo demás", () => {
    expect(withoutCalendarParam("?calendar=ok")).toBe("");
    expect(withoutCalendarParam("?calendar=ok&task=t1")).toBe("?task=t1");
    expect(withoutCalendarParam("?task=t1")).toBe("?task=t1");
    expect(withoutCalendarParam("")).toBe("");
  });
});

describe("calendarApi", () => {
  let fetchMock;
  const ok = (body) => ({ ok: true, status: 200, json: async () => body });
  beforeEach(() => { fetchMock = vi.fn(async () => ok({ configured: true })); vi.stubGlobal("fetch", fetchMock); configureCalendarApi(async () => "jwt-1"); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("manda el token de la sesión y usa las rutas del calendario", async () => {
    await calendarStatus();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/calendar/status");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer jwt-1");
    fetchMock.mockResolvedValueOnce(ok({ url: "https://accounts.google.com/x" }));
    expect(await calendarConnectUrl()).toBe("https://accounts.google.com/x");
    expect(fetchMock.mock.calls[1][1].method).toBe("POST");
    await calendarDisconnect(); await calendarSyncNow();
    expect(fetchMock.mock.calls.slice(2).map((c) => c[0])).toEqual(["/api/admin/calendar/disconnect", "/api/admin/calendar/sync"]);
  });

  it("sin sesión no pide nada y avisa", async () => {
    configureCalendarApi(async () => null);
    await expect(calendarStatus()).rejects.toThrow(/sesión/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un error del servidor llega con su mensaje y estado", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ code: "CALENDAR_NO_CONFIGURADO", message: "no está" }) });
    await expect(calendarConnectUrl()).rejects.toMatchObject({ message: "no está", status: 503, code: "CALENDAR_NO_CONFIGURADO" });
  });

  it("requestCalendarSync junta varios pedidos seguidos en uno y no tira error si falla", async () => {
    await calendarStatus(); // configured: true → habilitado
    fetchMock.mockClear();
    fetchMock.mockRejectedValue(new Error("sin red"));
    requestCalendarSync(); requestCalendarSync(); requestCalendarSync();
    await vi.advanceTimersByTimeAsync(2100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/calendar/sync");
  });

  it("si el servidor dice que no está configurado, no vuelve a molestar", async () => {
    fetchMock.mockResolvedValueOnce(ok({ configured: false }));
    await calendarStatus();
    fetchMock.mockClear();
    requestCalendarSync();
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
