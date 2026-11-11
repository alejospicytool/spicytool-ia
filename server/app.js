// API del backoffice. Casi todo es LECTURA; lo único que escribe es el cambio de suscripción y el link de tarjeta (billing.js),
// que pasan por los webhooks de Spicytool. Cada pedido exige un admin autenticado; los errores nunca devuelven detalles internos.
// "queries" y "authenticate" se inyectan: así se prueba sin Mongo ni Supabase (app.test.js).
import express from "express";

const ID_RE = /^[0-9a-f]{24}$/i;
const int = (v, def, min, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : def; };
const text = (v) => String(v ?? "").slice(0, 100);
const flag = (v) => v === "1" || v === "true";

export function createApp({ queries, authenticate, billing, audit, prices = [], log = console.error }) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

  app.use("/api/admin", async (req, res, next) => {
    try {
      const admin = await authenticate(req.headers.authorization);
      if (!admin) return res.status(401).json({ error: "No autorizado" });
      req.admin = admin;
      req.token = String(req.headers.authorization).trim().replace(/^Bearer\s+/, ""); // el mismo token del admin, para escribir la auditoría a su nombre
      next();
    } catch (e) { next(e); }
  });
  app.use("/api/admin", express.json({ limit: "10kb" }));

  const route = (handler) => async (req, res, next) => { try { await handler(req, res); } catch (e) { next(e); } };
  const needId = (req, res) => { if (!ID_RE.test(req.params.id)) { res.status(400).json({ error: "Id inválido" }); return false; } return true; };
  const orNotFound = (res, v) => (v == null ? res.status(404).json({ error: "No encontrado" }) : res.json(v));

  app.get("/api/admin/health", route(async (req, res) => res.json(await queries.health())));

  app.get("/api/admin/users", route(async (req, res) => res.json(await queries.listUsers({
    search: text(req.query.search), page: int(req.query.page, 1, 1, 100000), pageSize: int(req.query.pageSize, 8, 1, 50), owners: flag(req.query.owners), activeOnly: flag(req.query.activeOnly),
  }))));
  app.get("/api/admin/users/:id", route(async (req, res) => { if (needId(req, res)) orNotFound(res, await queries.getUser(req.params.id)); }));

  app.get("/api/admin/companies", route(async (req, res) => res.json(await queries.listCompanies({
    status: req.query.status === "paused" ? "paused" : "active", search: text(req.query.search), page: int(req.query.page, 1, 1, 100000), pageSize: int(req.query.pageSize, 8, 1, 50),
  }))));
  app.get("/api/admin/companies/:id", route(async (req, res) => { if (needId(req, res)) orNotFound(res, await queries.getCompanyBundle(req.params.id)); }));
  app.get("/api/admin/companies/:id/users", route(async (req, res) => { if (needId(req, res)) orNotFound(res, await queries.listCompanyUsers(req.params.id)); }));

  app.get("/api/admin/pipelines/:id/stages", route(async (req, res) => { if (needId(req, res)) res.json(await queries.getPipelineStages(req.params.id)); }));

  app.get("/api/admin/support-sessions", route(async (req, res) => res.json(await queries.listSupportSessions({
    search: text(req.query.search), page: int(req.query.page, 1, 1, 100000), pageSize: int(req.query.pageSize, 10, 1, 50),
  }))));

  // Precios estándar de los planes (los negociados se pegan a mano en el formulario)
  app.get("/api/admin/prices", route(async (req, res) => res.json(prices)));

  // Registro de auditoría (acciones hechas desde el backoffice)
  app.get("/api/admin/audit", route(async (req, res) => {
    const companyId = req.query.companyId ? String(req.query.companyId) : null;
    if (companyId && !ID_RE.test(companyId)) return res.status(400).json({ error: "Id inválido" });
    res.json(await audit.list(req.token, { companyId, limit: int(req.query.limit, 50, 1, 200) }));
  }));

  // ÚNICAS escrituras: cambian la suscripción (COBRA) o generan el link de tarjeta, vía webhooks de Spicytool.
  const billed = (fn) => route(async (req, res) => { if (!needId(req, res)) return; const r = await fn(req); res.status(r.status).json(r.body); });
  app.post("/api/admin/users/:id/subscription", billed((req) => billing.assignPlan(req.admin, req.token, req.params.id, req.body)));
  app.post("/api/admin/users/:id/payment-method-url", billed((req) => billing.paymentMethodUrl(req.admin, req.token, req.params.id)));

  // Todo lo demás (cualquier otro POST/PATCH/PUT/DELETE) no existe.
  app.use("/api/admin", (req, res) => res.status(404).json({ error: "No existe" }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "Cuerpo inválido" });
    log("Error en la API:", err && err.message);
    res.status(500).json({ error: "Error del servidor" });
  });
  return app;
}
