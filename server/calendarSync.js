// Motor de sincronización con Google Calendar. Idea: en vez de enganchar cada botón del backoffice, "concilia": mira qué cosas con fecha existen
// (tareas de Operaciones y próximo paso de Onboarding), decide qué evento le toca a cada persona conectada y deja el calendario igual a eso.
// Crea lo que falta, actualiza lo que cambió (solo si cambió: se compara un hash), borra lo que ya no corresponde. Se puede correr las veces que haga
// falta sin duplicar nada. Nunca toca los eventos que no creó él (solo los que tiene vinculados en calendar_links).
import { decryptToken, encryptToken, signState, verifyState } from "./calendarCrypto.js";
import { GoogleError } from "./googleCalendar.js";
import { taskEvent, onboardingEvent, crmEvent, usersForName, eventHash, todayInBA } from "./calendarEvents.js";

const keyOf = (type, id, userId) => `${type}|${id}|${userId}`;
const NEEDS_CAL = "https://www.googleapis.com/auth/calendar.events";

export function makeCalendarSync({ store, google, secret, appUrl = "https://backoffice.wearespicy.net", now = () => Date.now(), log = console.error } = {}) {
  const configured = !!(store && store.configured && google && google.configured && secret && String(secret).length >= 16);
  let running = null, again = false;

  // Un access token por persona y por corrida. Devuelve null (y lo anota) si la persona sacó el permiso.
  function tokenCache() {
    const cache = new Map();
    return async (conn) => {
      if (cache.has(conn.user_id)) return cache.get(conn.user_id);
      let tok = null;
      const refresh = decryptToken(conn.refresh_token_enc, secret);
      if (!refresh) { await store.markRevoked(conn.user_id, "No se pudo descifrar el permiso guardado: hay que volver a conectar."); }
      else {
        try { tok = await google.accessToken(refresh); }
        catch (e) { if (e instanceof GoogleError && e.revoked) await store.markRevoked(conn.user_id, "Google dice que el permiso ya no vale: hay que volver a conectar."); else throw e; }
      }
      cache.set(conn.user_id, tok);
      return tok;
    };
  }

  async function runOnce() {
    const stats = { users: 0, created: 0, updated: 0, deleted: 0, unchanged: 0, errors: 0, skipped: [] };
    const conns = await store.listConnections();
    stats.users = conns.length;
    if (!conns.length) return stats;
    const connOf = new Map(conns.map((c) => [c.user_id, c]));
    const [tasks, taskAsg, onboarding, people, links, crmTasks, crmDeals, crmStages] = await Promise.all([store.listTasks(), store.listTaskAssignees(), store.listOnboarding(), store.listPeople(), store.listLinks(), store.listCrmTasks(), store.listCrmDeals(), store.getCrmStages()]);
    const linkOf = new Map(links.map((l) => [keyOf(l.entity_type, l.entity_id, l.user_id), l]));

    // 1) Lo que tiene que haber: clave → { type, id, userId, event }
    const today = todayInBA(now()); // lo vencido se arrastra hasta hoy (ver calendarEvents.js)
    const wanted = new Map();
    const want = (type, id, userId, event, adopt = "") => { if (event) wanted.set(keyOf(type, id, userId), { type, id, userId, event, adopt }); };
    for (const t of tasks) {
      for (const a of taskAsg.filter((x) => x.entity_id === t.id)) if (connOf.has(a.user_id)) want("task", t.id, a.user_id, taskEvent(t, { appUrl, hasLink: linkOf.has(keyOf("task", t.id, a.user_id)), today }));
    }
    for (const o of onboarding) {
      if (!o.proximo_paso_quien) continue;
      const r = usersForName(o.proximo_paso_quien, people);
      if (r.ambiguous) { stats.skipped.push(`Onboarding ${o.client_name}: "${o.proximo_paso_quien}" coincide con más de una persona`); continue; }
      for (const u of r.users) if (connOf.has(u.user_id)) want("onboarding", o.id, u.user_id, onboardingEvent(o, { appUrl, today }));
    }

    // CRM comercial: tareas + próxima acción de cada deal (como la pestaña "Tareas" del CRM). Van al calendario del vendedor.
    const dealOf = new Map(crmDeals.map((d) => [d.id, d]));
    const stageKind = new Map(crmStages.map((st) => [st.id, st.kind]));
    const crmItems = [
      ...crmTasks.map((t) => ({ k: "task", id: t.id, titulo: t.titulo, fecha: t.fecha, hora: t.hora, tipo: t.tipo, done: !!t.hecha, calOn: t.calOn, dealId: t.dealId, empresa: (dealOf.get(t.dealId) || {}).empresa, vendedor: t.vendedor, notas: t.notas, oldEventId: t.calEventId })),
      ...crmDeals.filter((d) => d.proxima && d.proximaFecha && stageKind.get(d.stage) !== "lost").map((d) => ({ k: "deal", id: d.id, titulo: d.proxima, fecha: d.proximaFecha, hora: d.proximaHora, tipo: d.proximaTipo === "reunion" ? "reunion" : "followup", done: false, calOn: d.calOn, dealId: d.id, empresa: d.empresa, vendedor: d.vendedor, notas: "", oldEventId: d.calEventId })),
    ];
    for (const it of crmItems) {
      if (!it.vendedor) continue;
      const type = it.k === "deal" ? "crm_deal" : "crm_task";
      const r = usersForName(it.vendedor, people);
      if (r.ambiguous) { stats.skipped.push(`CRM ${it.empresa || it.titulo}: "${it.vendedor}" coincide con más de una persona`); continue; }
      for (const u of r.users) if (connOf.has(u.user_id)) want(type, it.id, u.user_id, crmEvent(it, { appUrl, today, hasLink: linkOf.has(keyOf(type, it.id, u.user_id)) }), it.oldEventId || "");
    }

    const token = tokenCache();
    const errorOf = new Map(); // userId → primer error
    const fail = (userId, e) => { stats.errors++; if (!errorOf.has(userId)) errorOf.set(userId, (e && e.message) || String(e)); log("Calendar:", e && e.message); };

    // 2) Crear o actualizar
    for (const w of wanted.values()) {
      const conn = connOf.get(w.userId), key = keyOf(w.type, w.id, w.userId), link = linkOf.get(key), hash = eventHash(w.event);
      if (link && link.payload_hash === hash) { stats.unchanged++; continue; }
      try {
        const at = await token(conn);
        if (!at) continue; // permiso revocado: se avisa en la pantalla
        let eventId = link && link.google_event_id, created = !link;
        if (link) {
          try { await google.updateEvent(at, link.google_event_id, w.event); }
          catch (e) { if (e instanceof GoogleError && (e.status === 404 || e.status === 410)) created = true; else throw e; } // lo borraron a mano en Google: se vuelve a crear
        }
        // El CRM viejo ya había creado un evento para esta tarea y guardó su id (calEventId): si sigue existiendo en el calendario de esta persona se ADOPTA
        // (se actualiza ese mismo evento) en vez de crear uno repetido. Si no existe o no se puede tocar, se crea uno nuevo.
        if (created && w.adopt) {
          try { await google.updateEvent(at, w.adopt, w.event); eventId = w.adopt; created = false; }
          catch (e) { if (!(e instanceof GoogleError)) throw e; }
        }
        if (created) eventId = (await google.insertEvent(at, w.event)).id;
        await store.saveLink({ entityType: w.type, entityId: w.id, userId: w.userId, eventId, hash });
        stats[created ? "created" : "updated"]++;
      } catch (e) { fail(w.userId, e); }
    }

    // 3) Borrar lo que ya no corresponde (tarea archivada o borrada, paso hecho, cambió el responsable…)
    for (const l of links) {
      const key = keyOf(l.entity_type, l.entity_id, l.user_id);
      const conn = connOf.get(l.user_id);
      if (wanted.has(key) || !conn) continue; // sin conexión activa: se deja como está hasta que vuelva a conectar
      try {
        const at = await token(conn);
        if (!at) continue;
        await google.deleteEvent(at, l.google_event_id);
        await store.deleteLink({ entityType: l.entity_type, entityId: l.entity_id, userId: l.user_id });
        stats.deleted++;
      } catch (e) { fail(l.user_id, e); }
    }

    for (const c of conns) await store.touchSync(c.user_id, errorOf.get(c.user_id) || null).catch(() => {});
    return stats;
  }

  // Si ya hay una corrida en curso no se lanza otra en paralelo: se anota que hay que repetir una vez al terminar (así no se pisan).
  function reconcile() {
    if (!configured) return Promise.resolve({ skipped: "no configurado" });
    if (running) { again = true; return running; }
    running = (async () => {
      try { let s = await runOnce(); while (again) { again = false; s = await runOnce(); } return s; }
      finally { running = null; again = false; }
    })();
    return running;
  }

  return {
    configured,
    reconcile,
    startSchedule(intervalMs = 10 * 60_000) { const t = setInterval(() => reconcile().catch((e) => log("Calendar (programado):", e && e.message)), intervalMs); t.unref?.(); return t; },

    async status(userId) {
      if (!configured) return { configured: false, connected: false };
      const c = await store.getConnection(userId);
      return { configured: true, connected: !!c && c.status === "active", needsReconnect: !!c && c.status === "revoked", googleEmail: (c && c.google_email) || "", lastSyncAt: (c && c.last_sync_at) || null, lastError: (c && c.last_error) || null };
    },

    // El front pide la dirección de Google a la que mandar a la persona. El "state" firmado dice quién es (la vuelta no trae sesión).
    startConnect(admin) {
      if (!configured) return { status: 503, body: { code: "CALENDAR_NO_CONFIGURADO", message: "Google Calendar todavía no está configurado en el servidor." } };
      return { status: 200, body: { url: google.authUrl(signState({ uid: admin.id, email: admin.email }, secret), admin.email) } };
    },

    // Vuelta de Google: guarda el permiso (cifrado) y concilia en segundo plano. Devuelve { ok } o { error } con un texto para mostrar.
    async finishConnect({ code, state }) {
      if (!configured) return { error: "no_configurado" };
      const st = verifyState(state, secret);
      if (!st || !st.uid) return { error: "state_invalido" };
      try {
        const r = await google.exchangeCode(code);
        if (!r.scope.split(/\s+/).includes(NEEDS_CAL)) return { error: "sin_permiso_calendar" };
        if (!r.refreshToken) return { error: "sin_refresh_token" };
        await store.saveConnection({ userId: st.uid, email: st.email, googleEmail: r.googleEmail, refreshTokenEnc: encryptToken(r.refreshToken, secret) });
        reconcile().catch((e) => log("Calendar (al conectar):", e && e.message));
        return { ok: true };
      } catch (e) { log("Calendar (conectar):", e && e.message); return { error: "google_fallo" }; }
    },

    // Desconectar: borra de Google los eventos que creamos, quita el permiso y limpia lo guardado. Todo a mejor esfuerzo salvo la base.
    async disconnect(userId) {
      if (!configured) return { ok: true };
      const conn = await store.getConnection(userId);
      if (conn) {
        const refresh = decryptToken(conn.refresh_token_enc, secret);
        let at = null;
        if (refresh) { try { at = await google.accessToken(refresh); } catch { /* ya no vale: no hay nada que borrar allá */ } }
        const mine = await store.listLinksOfUser(userId);
        if (at) for (const l of mine) { try { await google.deleteEvent(at, l.google_event_id); } catch { /* mejor esfuerzo */ } }
        if (refresh) await google.revoke(refresh);
      }
      for (const l of await store.listLinksOfUser(userId)) await store.deleteLink({ entityType: l.entity_type, entityId: l.entity_id, userId });
      await store.deleteConnection(userId);
      return { ok: true };
    },
  };
}
