// API del backoffice (solo lectura). Cada pedido exige un admin autenticado; los errores nunca devuelven detalles internos.
// "queries" y "authenticate" se inyectan: así se prueba sin Mongo ni Supabase (app.test.js).
import express from "express";

const ID_RE = /^[0-9a-f]{24}$/i;
const int = (v, def, min, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : def; };
const text = (v) => String(v ?? "").slice(0, 100);
const flag = (v) => v === "1" || v === "true";

export function createApp({ queries, authenticate, log = console.error }) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

  app.use("/api/admin", async (req, res, next) => {
    try {
      const admin = await authenticate(req.headers.authorization);
      if (!admin) return res.status(401).json({ error: "No autorizado" });
      req.admin = admin;
      next();
    } catch (e) { next(e); }
  });

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

  // Todo lo demás (incluido cualquier POST/PATCH/DELETE) no existe: esta API es de solo lectura.
  app.use("/api/admin", (req, res) => res.status(404).json({ error: "No existe" }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => { log("Error en la API:", err && err.message); res.status(500).json({ error: "Error del servidor" }); });
  return app;
}
