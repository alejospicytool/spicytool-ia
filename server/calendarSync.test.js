import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeCalendarSync } from "./calendarSync.js";
import { encryptToken, signState } from "./calendarCrypto.js";
import { GoogleError } from "./googleCalendar.js";

const SECRET = "una-frase-larga-para-las-pruebas";
const APP = "https://backoffice.test";
const NICO = "11111111-1111-1111-1111-111111111111", TICI = "22222222-2222-2222-2222-222222222222";

// Base y Google en memoria: se prueba el motor completo sin red.
function world(over = {}) {
  const w = {
    conns: [{ user_id: NICO, email: "nicolas@spicytool.net", google_email: "nicolas@spicytool.net", refresh_token_enc: encryptToken("R-nico", SECRET), status: "active" }],
    links: [],
    tasks: [{ id: "t1", title: "Armar portfolio", start_date: "2026-12-01", end_date: "2026-12-03", priority: "Alta", stage: "En Curso", description: null }],
    asg: [{ entity_id: "t1", user_id: NICO }],
    crmTasks: [], crmDeals: [], crmStages: [{ id: "lead", kind: "open" }, { id: "won", kind: "won" }, { id: "lost", kind: "lost" }],
    onboarding: [{ id: "ob1", client_name: "Miraglia", etapa_actual: "Conectar WhatsApp", proximo_paso: "Llamar", proximo_paso_fecha: "2026-12-04", proximo_paso_quien: "Nico" }],
    people: [{ user_id: NICO, email: "nicolas@spicytool.net", first_name: "Nicolás" }, { user_id: TICI, email: "ticiana@spicytool.net", first_name: "Ticiana" }],
    events: new Map(), nextId: 1, calls: [], revoked: [], synced: [], now: Date.parse("2026-11-27T15:00:00Z"),
    ...over,
  };
  w.store = {
    configured: true,
    listConnections: async () => w.conns.filter((c) => c.status === "active"),
    getConnection: async (id) => w.conns.find((c) => c.user_id === id) || null,
    listLinks: async () => w.links.map((l) => ({ ...l })),
    listLinksOfUser: async (id) => w.links.filter((l) => l.user_id === id).map((l) => ({ ...l })),
    listCrmTasks: async () => w.crmTasks, listCrmDeals: async () => w.crmDeals, getCrmStages: async () => w.crmStages,
    listTasks: async () => w.tasks, listTaskAssignees: async () => w.asg, listOnboarding: async () => w.onboarding, listPeople: async () => w.people,
    saveLink: async (l) => { w.links = w.links.filter((x) => !(x.entity_type === l.entityType && x.entity_id === l.entityId && x.user_id === l.userId)); w.links.push({ entity_type: l.entityType, entity_id: l.entityId, user_id: l.userId, google_event_id: l.eventId, payload_hash: l.hash }); },
    deleteLink: async (l) => { w.links = w.links.filter((x) => !(x.entity_type === l.entityType && x.entity_id === l.entityId && x.user_id === l.userId)); },
    saveConnection: vi.fn(async (c) => { w.conns = w.conns.filter((x) => x.user_id !== c.userId); w.conns.push({ user_id: c.userId, email: c.email, google_email: c.googleEmail, refresh_token_enc: c.refreshTokenEnc, status: "active" }); }),
    deleteConnection: async (id) => { w.conns = w.conns.filter((c) => c.user_id !== id); },
    markRevoked: async (id, why) => { w.revoked.push([id, why]); const c = w.conns.find((x) => x.user_id === id); if (c) c.status = "revoked"; },
    touchSync: async (id, err) => { w.synced.push([id, err]); },
  };
  w.google = {
    configured: true,
    accessToken: vi.fn(async (r) => "AT-" + r),
    insertEvent: vi.fn(async (at, ev) => { const id = "evt" + w.nextId++; w.events.set(id, ev); w.calls.push(["insert", id]); return { id }; }),
    updateEvent: vi.fn(async (at, id, ev) => { if (!w.events.has(id)) throw new GoogleError(404, "NOT_FOUND"); w.events.set(id, ev); w.calls.push(["update", id]); return { id }; }),
    deleteEvent: vi.fn(async (at, id) => { w.events.delete(id); w.calls.push(["delete", id]); }),
    exchangeCode: vi.fn(async () => ({ refreshToken: "R-new", accessToken: "A", googleEmail: "nicolas@spicytool.net", scope: "openid email https://www.googleapis.com/auth/calendar.events" })),
    authUrl: vi.fn((state) => "https://accounts.google.com/x?state=" + state),
    revoke: vi.fn(async () => {}),
  };
  w.sync = makeCalendarSync({ store: w.store, google: w.google, secret: SECRET, appUrl: APP, now: () => w.now, log: () => {} });
  return w;
}

describe("conciliar", () => {
  let w;
  beforeEach(() => { w = world(); });

  it("crea el evento de la tarea y el del paso de Onboarding en el calendario de la persona", async () => {
    const s = await w.sync.reconcile();
    expect(s).toMatchObject({ users: 1, created: 2, updated: 0, deleted: 0, errors: 0 });
    const summaries = [...w.events.values()].map((e) => e.summary).sort();
    expect(summaries).toEqual(["Onboarding · Miraglia: Llamar", "Tarea: Armar portfolio"]);
    expect(w.links).toHaveLength(2);
    expect(w.google.accessToken).toHaveBeenCalledWith("R-nico"); // usó el permiso descifrado
  });

  it("una segunda corrida sin cambios no llama a Google", async () => {
    await w.sync.reconcile();
    w.google.insertEvent.mockClear(); w.google.updateEvent.mockClear();
    const s = await w.sync.reconcile();
    expect(s).toMatchObject({ created: 0, updated: 0, deleted: 0, unchanged: 2 });
    expect(w.google.insertEvent).not.toHaveBeenCalled();
    expect(w.google.updateEvent).not.toHaveBeenCalled();
  });

  it("si cambia la fecha, actualiza ESE evento (no crea otro)", async () => {
    await w.sync.reconcile();
    const before = [...w.events.keys()];
    w.tasks[0].end_date = "2026-12-10";
    const s = await w.sync.reconcile();
    expect(s).toMatchObject({ created: 0, updated: 1, unchanged: 1 });
    expect([...w.events.keys()]).toEqual(before);
    expect([...w.events.values()].find((e) => e.summary.startsWith("Tarea")).end).toEqual({ date: "2026-12-11" });
  });

  it("si se borra la tarea, borra su evento y el vínculo", async () => {
    await w.sync.reconcile();
    w.tasks = [];
    const s = await w.sync.reconcile();
    expect(s.deleted).toBe(1);
    expect(w.links.map((l) => l.entity_type)).toEqual(["onboarding"]);
    expect(w.events.size).toBe(1);
  });

  it("al finalizar una tarea que ya estaba en el calendario queda con ✓; si se archiva, se borra", async () => {
    await w.sync.reconcile();
    w.tasks[0].stage = "Finalizado";
    await w.sync.reconcile();
    expect([...w.events.values()].some((e) => e.summary === "✓ Tarea: Armar portfolio")).toBe(true);
    w.tasks[0].stage = "Archivado";
    const s = await w.sync.reconcile();
    expect(s.deleted).toBe(1);
    expect([...w.events.values()].some((e) => /Tarea/.test(e.summary))).toBe(false);
  });

  it("una tarea ya finalizada (nunca agendada) no se crea al conectar", async () => {
    w.tasks[0].stage = "Finalizado";
    await w.sync.reconcile();
    expect(w.links.map((l) => l.entity_type)).toEqual(["onboarding"]);
  });

  it("al hacer el paso (o quitarlo) se borra el evento del Onboarding", async () => {
    await w.sync.reconcile();
    w.onboarding = [];
    const s = await w.sync.reconcile();
    expect(s.deleted).toBe(1);
    expect(w.links.map((l) => l.entity_type)).toEqual(["task"]);
  });

  it("si cambia el responsable, el evento se va de un calendario y pasa al otro", async () => {
    w.conns.push({ user_id: TICI, email: "ticiana@spicytool.net", refresh_token_enc: encryptToken("R-tici", SECRET), status: "active" });
    await w.sync.reconcile();
    w.asg = [{ entity_id: "t1", user_id: TICI }];
    const s = await w.sync.reconcile();
    expect(s).toMatchObject({ created: 1, deleted: 1 });
    expect(w.links.filter((l) => l.entity_type === "task").map((l) => l.user_id)).toEqual([TICI]);
  });

  it("solo agenda para quien conectó su calendario", async () => {
    w.asg = [{ entity_id: "t1", user_id: TICI }]; // Ticiana no conectó
    w.onboarding[0].proximo_paso_quien = "Ticiana";
    const s = await w.sync.reconcile();
    expect(s.created).toBe(0);
    expect(w.google.insertEvent).not.toHaveBeenCalled();
  });

  it("un responsable ambiguo no agenda a nadie y lo avisa", async () => {
    w.people.push({ user_id: "33333333-3333-3333-3333-333333333333", email: "nicole@spicytool.net", first_name: "Nicole" });
    const s = await w.sync.reconcile();
    expect(s.created).toBe(1); // solo la tarea
    expect(s.skipped[0]).toMatch(/más de una persona/);
  });

  it("si borraron el evento a mano en Google (404), lo vuelve a crear", async () => {
    await w.sync.reconcile();
    const id = w.links.find((l) => l.entity_type === "task").google_event_id;
    w.events.delete(id);
    w.tasks[0].title = "Cambió el título";
    const s = await w.sync.reconcile();
    expect(s.created).toBe(1);
    expect(w.links.find((l) => l.entity_type === "task").google_event_id).not.toBe(id);
  });

  it("si Google falla con una cosa, sigue con las demás y cuenta el error", async () => {
    w.google.insertEvent.mockImplementationOnce(async () => { throw new GoogleError(500, "backend_error", "boom"); });
    const s = await w.sync.reconcile();
    expect(s).toMatchObject({ errors: 1, created: 1 });
    expect(w.synced[0][1]).toMatch(/boom/);
  });

  it("si la persona sacó el permiso (invalid_grant) la marca para reconectar y no insiste", async () => {
    w.google.accessToken.mockImplementation(async () => { throw new GoogleError(400, "invalid_grant", "revoked"); });
    const s = await w.sync.reconcile();
    expect(w.revoked).toHaveLength(1);
    expect(w.revoked[0][0]).toBe(NICO);
    expect(s.created).toBe(0);
    expect(w.google.accessToken).toHaveBeenCalledTimes(1); // una vez por corrida, no por cada evento
  });

  it("un permiso que no se puede descifrar (clave cambiada) también pide reconectar", async () => {
    w.conns[0].refresh_token_enc = encryptToken("R", "otra-frase-larga-distinta-1234");
    await w.sync.reconcile();
    expect(w.revoked).toHaveLength(1);
    expect(w.google.insertEvent).not.toHaveBeenCalled();
  });

  it("dos pedidos juntos no corren en paralelo (el segundo se repite una vez al final)", async () => {
    let active = 0, maxActive = 0;
    const orig = w.store.listTasks;
    w.store.listTasks = async () => { active++; maxActive = Math.max(maxActive, active); await new Promise((r) => setTimeout(r, 5)); const t = await orig(); active--; return t; };
    await Promise.all([w.sync.reconcile(), w.sync.reconcile(), w.sync.reconcile()]);
    expect(maxActive).toBe(1);
    expect(w.events.size).toBe(2); // y sin duplicados
  });

  it("lo vencido se arrastra: cada día el evento se estira hasta hoy, y al hacerlo desaparece", async () => {
    w.onboarding[0].proximo_paso_fecha = "2026-11-25"; // venció hace 2 días
    w.tasks[0].start_date = "2026-11-24"; w.tasks[0].end_date = "2026-11-26"; // Alta y vencida
    await w.sync.reconcile();
    const ob = () => [...w.events.values()].find((e) => /Onboarding/.test(e.summary));
    const tk = () => [...w.events.values()].find((e) => /Tarea/.test(e.summary));
    expect(ob().summary).toMatch(/^Vencido · Onboarding/);
    expect(ob().start).toEqual({ date: "2026-11-25" });
    expect(ob().end).toEqual({ date: "2026-11-28" }); // hasta hoy (27) inclusive
    expect(tk().summary).toMatch(/^Vencida · Tarea/);
    expect(tk().end).toEqual({ date: "2026-11-28" });
    // misma fecha: no vuelve a llamar a Google
    w.google.updateEvent.mockClear();
    expect((await w.sync.reconcile()).unchanged).toBe(2);
    // pasa un día: se estira (actualiza el mismo evento, no crea otro)
    w.now = Date.parse("2026-11-28T15:00:00Z");
    const s2 = await w.sync.reconcile();
    expect(s2).toMatchObject({ updated: 2, created: 0 });
    expect(ob().end).toEqual({ date: "2026-11-29" });
    // se hace el paso: se va; la tarea se finaliza: queda con ✓ en su rango original
    w.onboarding = []; w.tasks[0].stage = "Finalizado";
    await w.sync.reconcile();
    expect([...w.events.values()].some((e) => /Onboarding/.test(e.summary))).toBe(false);
    expect(tk().summary).toBe("✓ Tarea: Armar portfolio");
    expect(tk().end).toEqual({ date: "2026-11-27" });
  });

  it("una tarea vencida que NO es de prioridad Alta no se arrastra", async () => {
    w.tasks[0].priority = "Media"; w.tasks[0].start_date = "2026-11-18"; w.tasks[0].end_date = "2026-11-20";
    await w.sync.reconcile();
    const tk = [...w.events.values()].find((e) => /Tarea/.test(e.summary));
    expect(tk.summary).toBe("Tarea: Armar portfolio");
    expect(tk.end).toEqual({ date: "2026-11-21" });
  });

  it("sin nadie conectado no hace nada; sin configurar tampoco", async () => {
    w.conns = [];
    expect(await w.sync.reconcile()).toMatchObject({ users: 0 });
    const off = makeCalendarSync({ store: { configured: false }, google: { configured: true }, secret: SECRET });
    expect(off.configured).toBe(false);
    expect(await off.reconcile()).toEqual({ skipped: "no configurado" });
  });
});

describe("CRM comercial", () => {
  let w;
  const HERNAN = "44444444-4444-4444-4444-444444444444";
  beforeEach(() => {
    w = world();
    w.conns.push({ user_id: HERNAN, email: "hernan@spicytool.net", refresh_token_enc: encryptToken("R-hernan", SECRET), status: "active" });
    w.people.push({ user_id: HERNAN, email: "hernan@spicytool.net", first_name: "Hernan" });
    w.tasks = []; w.onboarding = [];
    w.crmDeals = [{ id: "d1", empresa: "Ngr inmobiliaria", stage: "lead", vendedor: "Hernán", proxima: "Agendar demo", proximaFecha: "2026-12-01", proximaHora: "15:00", proximaTipo: "reunion" }];
    w.crmTasks = [{ id: "k1", titulo: "COBRAR", tipo: "tarea", fecha: "2026-12-02", hora: "12:00", vendedor: "Hernán", dealId: "d1", calOn: true, hecha: false }];
  });

  it("agenda las tareas y la próxima acción del deal en el calendario del vendedor (con y sin tilde)", async () => {
    const s = await w.sync.reconcile();
    expect(s).toMatchObject({ created: 2, errors: 0 });
    expect(w.links.map((l) => [l.entity_type, l.user_id]).sort()).toEqual([["crm_deal", HERNAN], ["crm_task", HERNAN]]);
    const reunion = [...w.events.values()].find((e) => /^Reunión/.test(e.summary));
    expect(reunion.transparency).toBe("opaque");
    expect(reunion.end.dateTime).toBe("2026-12-01T15:30:00");
    expect(reunion.start.dateTime).toBe("2026-12-01T15:00:00");
    expect(w.google.accessToken).toHaveBeenCalledWith("R-hernan");
  });

  it("lo del CRM NO va al calendario de otra persona (Nico no recibe lo de Hernán)", async () => {
    await w.sync.reconcile();
    expect(w.links.some((l) => l.user_id === NICO)).toBe(false);
  });

  it("al hacer la tarea queda con ✓; al borrarla o apagar calOn, el evento se va; al cerrar la próxima acción del deal, también", async () => {
    await w.sync.reconcile();
    w.crmTasks[0].hecha = true;
    await w.sync.reconcile();
    expect([...w.events.values()].some((e) => e.summary.startsWith("✓ Tarea CRM"))).toBe(true);
    w.crmTasks = [];
    w.crmDeals[0].proxima = "";
    const s = await w.sync.reconcile();
    expect(s.deleted).toBe(2);
    expect(w.events.size).toBe(0);
  });

  it("calOn apagado: no se agenda; deals perdidos: tampoco", async () => {
    w.crmTasks[0].calOn = false;
    w.crmDeals[0].stage = "lost";
    const s = await w.sync.reconcile();
    expect(s.created).toBe(0);
  });

  it("si cambia la hora se actualiza el mismo evento; y no hay arrastre de vencidas", async () => {
    await w.sync.reconcile();
    w.crmTasks[0].hora = "16:30";
    const s = await w.sync.reconcile();
    expect(s).toMatchObject({ updated: 1, created: 0 });
    w.now = Date.parse("2026-12-15T15:00:00Z"); // pasaron los días: sigue en su fecha original
    await w.sync.reconcile();
    const k = [...w.events.values()].find((e) => /Tarea CRM/.test(e.summary));
    expect(k.start.dateTime).toBe("2026-12-02T16:30:00");
  });

  it("si el CRM viejo ya había creado el evento (calEventId) y sigue en el calendario, se adopta en vez de duplicarlo", async () => {
    w.events.set("viejo123", { summary: "evento del CRM viejo" });
    w.crmTasks[0].calEventId = "viejo123";
    const s = await w.sync.reconcile();
    expect(s).toMatchObject({ created: 1, updated: 1 }); // la próxima acción del deal se crea; la tarea adopta el viejo
    expect(w.links.find((l) => l.entity_type === "crm_task").google_event_id).toBe("viejo123");
    expect(w.events.get("viejo123").summary).toBe("Tarea CRM · Ngr inmobiliaria: COBRAR");
    expect(w.events.size).toBe(2);
  });

  it("si el evento viejo ya no existe (o es de otra cuenta), se crea uno nuevo", async () => {
    w.crmTasks[0].calEventId = "no-existe";
    const s = await w.sync.reconcile();
    expect(s).toMatchObject({ created: 2, errors: 0 });
    expect(w.links.find((l) => l.entity_type === "crm_task").google_event_id).not.toBe("no-existe");
  });

  it("un vendedor que no conectó su calendario no genera nada", async () => {
    w.conns = w.conns.filter((c) => c.user_id !== HERNAN);
    expect((await w.sync.reconcile()).created).toBe(0);
  });
});

describe("conectar, estado y desconectar", () => {
  let w;
  beforeEach(() => { w = world({ conns: [] }); });

  it("startConnect devuelve la dirección de Google con un state que identifica a la persona", () => {
    const r = w.sync.startConnect({ id: NICO, email: "nicolas@spicytool.net" });
    expect(r.status).toBe(200);
    expect(r.body.url).toContain("state=");
  });

  it("finishConnect guarda el permiso CIFRADO y concilia", async () => {
    const state = signState({ uid: NICO, email: "nicolas@spicytool.net" }, SECRET);
    const r = await w.sync.finishConnect({ code: "C", state });
    expect(r).toEqual({ ok: true });
    const saved = w.store.saveConnection.mock.calls[0][0];
    expect(saved.userId).toBe(NICO);
    expect(saved.refreshTokenEnc).not.toContain("R-new");
    await w.sync.reconcile(); // espera a la corrida que arrancó al conectar
    expect(w.events.size).toBe(2);
  });

  it("finishConnect rechaza un state falso, vencido, sin el permiso de Calendar o sin refresh token", async () => {
    expect(await w.sync.finishConnect({ code: "C", state: "falso" })).toEqual({ error: "state_invalido" });
    expect(await w.sync.finishConnect({ code: "C", state: signState({ uid: NICO }, SECRET, 0) })).toEqual({ error: "state_invalido" });
    const ok = signState({ uid: NICO }, SECRET);
    w.google.exchangeCode.mockResolvedValueOnce({ refreshToken: "R", accessToken: "A", googleEmail: "x", scope: "openid email" });
    expect(await w.sync.finishConnect({ code: "C", state: ok })).toEqual({ error: "sin_permiso_calendar" });
    w.google.exchangeCode.mockResolvedValueOnce({ refreshToken: "", accessToken: "A", googleEmail: "x", scope: "https://www.googleapis.com/auth/calendar.events" });
    expect(await w.sync.finishConnect({ code: "C", state: ok })).toEqual({ error: "sin_refresh_token" });
    w.google.exchangeCode.mockRejectedValueOnce(new Error("google caído"));
    expect(await w.sync.finishConnect({ code: "C", state: ok })).toEqual({ error: "google_fallo" });
    expect(w.store.saveConnection).not.toHaveBeenCalled();
  });

  it("status: no conectado / conectado / hay que reconectar", async () => {
    expect(await w.sync.status(NICO)).toMatchObject({ configured: true, connected: false });
    w.conns.push({ user_id: NICO, google_email: "n@x.com", refresh_token_enc: "x", status: "active", last_sync_at: "2026-11-27T10:00:00Z" });
    expect(await w.sync.status(NICO)).toMatchObject({ connected: true, googleEmail: "n@x.com", lastSyncAt: "2026-11-27T10:00:00Z" });
    w.conns[0].status = "revoked";
    expect(await w.sync.status(NICO)).toMatchObject({ connected: false, needsReconnect: true });
    const off = makeCalendarSync({ store: { configured: false }, google: {}, secret: SECRET });
    expect(await off.status(NICO)).toEqual({ configured: false, connected: false });
  });

  it("desconectar borra los eventos creados, quita el permiso y limpia la base", async () => {
    w.conns.push({ user_id: NICO, refresh_token_enc: encryptToken("R-nico", SECRET), status: "active" });
    await w.sync.reconcile();
    expect(w.events.size).toBe(2);
    expect(await w.sync.disconnect(NICO)).toEqual({ ok: true });
    expect(w.events.size).toBe(0);
    expect(w.links).toHaveLength(0);
    expect(w.conns).toHaveLength(0);
    expect(w.google.revoke).toHaveBeenCalledWith("R-nico");
  });

  it("desconectar limpia la base aunque Google ya no responda", async () => {
    w.conns.push({ user_id: NICO, refresh_token_enc: encryptToken("R-nico", SECRET), status: "active" });
    await w.sync.reconcile();
    w.google.accessToken.mockRejectedValue(new Error("sin red"));
    await w.sync.disconnect(NICO);
    expect(w.links).toHaveLength(0);
    expect(w.conns).toHaveLength(0);
  });
});
