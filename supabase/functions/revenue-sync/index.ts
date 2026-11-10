// Métricas de revenue (reemplazo de ChartMogul). Una sola Edge Function con 4 rutas:
//
//   POST …/revenue-sync/stripe     Webhook de Stripe (verifica la firma, ignora duplicados, relee la suscripción).
//   POST …/revenue-sync/reconcile  Carga inicial ({"baseline":true}, una sola vez) y chequeo nocturno de respaldo.
//                                  Lo llama pg_cron con el header x-revenue-cron-secret (o un admin logueado).
//   POST …/revenue-sync/recompute  Recalcula el MRR de todos con lo que ya hay en la base (sin llamar a Stripe).
//                                  Se usa después de clasificar planes o cargar tipos de cambio. Solo admin o cron.
//   POST …/revenue-sync/manual     Alta / edición de suscripciones de clientes que pagan por fuera de Stripe. Solo admin.
//
// DEPLOY (Supabase Dashboard → Edge Functions → Create function → "revenue-sync" → pegar este archivo):
//   1. En los Settings de la función, DESACTIVAR "Enforce JWT Verification": Stripe y pg_cron no mandan un JWT de
//      usuario. La seguridad la dan la firma del webhook, el secret del cron y la verificación de admin (rpc is_admin).
//   2. Edge Functions → Secrets:
//        STRIPE_API_KEY          clave RESTRINGIDA de solo lectura (Customers, Subscriptions, Prices, Products, Coupons)
//        STRIPE_WEBHOOK_SECRET   whsec_… (lo da Stripe al crear el endpoint)
//        REVENUE_CRON_SECRET     un texto largo al azar (el mismo que se usa en el cron de la base)
//      (SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY ya los pone Supabase.)
//   3. Stripe → Developers → Webhooks → Add endpoint → https://<proyecto>.supabase.co/functions/v1/revenue-sync/stripe
//      con los eventos customer.subscription.created / updated / deleted.
// Las tablas y la función rev_apply_mrr están en supabase_revenue.sql.

// ── Cálculo de MRR (todo en USD) ────────────────────────────────────────────────────────────────────────
export const COUNTED_STATUSES = ["active", "past_due"]; // sin auto-churn por pago vencido; trialing no suma
export const LIVE_STATUSES = ["active", "past_due", "trialing"];

export type Item = { priceId: string; unitAmount: number; quantity: number; interval: string; intervalCount: number };
export type Discount = { percentOff?: number | null; amountOff?: number | null; endsAt?: string | Date | null } | null;
export type SubDoc = {
  id: string; customerKey: string; source: "stripe" | "manual"; status: string; currency: string;
  items: Item[]; discount: Discount; canceledAt?: string | null;
};
export type PlanInfo = { countsInMrr: boolean };

const MONTHS: Record<string, number> = { day: 1 / 30, week: 12 / 52, month: 1, year: 12 };
export function monthsOf(interval: string, count = 1): number {
  const m = MONTHS[interval];
  if (!m) throw new Error(`Intervalo desconocido: ${interval}`);
  return m * (count || 1);
}
const round2 = (n: number) => Math.round(n * 100) / 100;

export function subscriptionMrr(sub: Pick<SubDoc, "status" | "currency" | "items" | "discount">,
  plans: Map<string, PlanInfo>, fx: Map<string, number>, now = new Date()): number {
  if (!COUNTED_STATUSES.includes(sub.status)) return 0;
  let mrr = 0;
  for (const it of sub.items) {
    const plan = plans.get(it.priceId);
    if (!plan || !plan.countsInMrr) continue; // sin clasificar o no SaaS: no suma
    mrr += (it.unitAmount * it.quantity) / 100 / monthsOf(it.interval, it.intervalCount);
  }
  // Descuento a nivel suscripción (cupón de Stripe o descuento manual)
  const d = sub.discount;
  if (d && (!d.endsAt || new Date(d.endsAt) > now)) {
    if (d.percentOff) mrr *= 1 - d.percentOff / 100;
    if (d.amountOff) {
      // El monto de un cupón es por factura: se lleva a mensual con el intervalo de cobro (todos los ítems de una
      // suscripción de Stripe comparten intervalo). Mejora respecto del módulo de referencia, que restaba el monto entero.
      const first = sub.items[0];
      const perMonth = first ? d.amountOff / 100 / monthsOf(first.interval, first.intervalCount) : 0;
      mrr = Math.max(0, mrr - perMonth);
    }
  }
  const cur = (sub.currency || "usd").toLowerCase();
  if (cur !== "usd") {
    const rate = fx.get(cur);
    if (!rate) throw new Error(`Falta tipo de cambio para ${cur}`);
    mrr *= rate;
  }
  return round2(mrr);
}

// ── Normalización de una suscripción de Stripe ─────────────────────────────────────────────────────────
// Soporta las dos formas de descuento de la API de Stripe: discount.coupon (clásica) y discount.source.coupon (nueva).
export function couponRefOf(sub: any): { coupon: any; end: number | null } | null {
  const list: any[] = Array.isArray(sub.discounts) ? sub.discounts : [];
  const d = list.find((x) => x && typeof x === "object" && (x.coupon || x.source?.coupon)) || (sub.discount && typeof sub.discount === "object" ? sub.discount : null);
  if (!d) return null;
  const coupon = d.coupon || d.source?.coupon;
  return coupon ? { coupon, end: d.end ?? null } : null;
}

export function customerKeyOf(sub: any): string {
  return `stripe:${typeof sub.customer === "string" ? sub.customer : sub.customer.id}`;
}

// coupons: cupones ya resueltos por id (cuando Stripe devuelve solo el id)
export function normalizeStripeSub(sub: any, coupons: Map<string, any> = new Map()): SubDoc {
  const ref = couponRefOf(sub);
  const coupon = ref ? (typeof ref.coupon === "string" ? coupons.get(ref.coupon) : ref.coupon) : null;
  return {
    id: `stripe:${sub.id}`,
    customerKey: customerKeyOf(sub),
    source: "stripe",
    status: sub.status,
    currency: sub.currency,
    items: (sub.items?.data || []).map((it: any) => ({
      priceId: it.price.id,
      // Precios medidos o escalonados no tienen unit_amount fijo: no se inventa un número (suma 0 y queda a la vista en Planes)
      unitAmount: it.price.unit_amount ?? (it.price.unit_amount_decimal ? Math.round(Number(it.price.unit_amount_decimal)) : 0),
      quantity: it.quantity || 1,
      interval: it.price.recurring?.interval || "month",
      intervalCount: it.price.recurring?.interval_count || 1,
    })),
    discount: coupon ? {
      percentOff: coupon.percent_off ?? null, amountOff: coupon.amount_off ?? null,
      endsAt: ref!.end ? new Date(ref!.end * 1000).toISOString() : null,
    } : null,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
  };
}

// ── Firma del webhook de Stripe (HMAC-SHA256 con WebCrypto) ────────────────────────────────────────────
export async function verifyStripeSignature(payload: string, header: string | null, secret: string,
  nowMs = Date.now(), toleranceSec = 300): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = parts.find((p) => p[0] === "t")?.[1];
  const sigs = parts.filter((p) => p[0] === "v1").map((p) => p[1]);
  if (!t || !sigs.length || !/^\d+$/.test(t)) return false;
  if (Math.abs(nowMs / 1000 - Number(t)) > toleranceSec) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`)));
  const expected = Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(s, expected));
}
function timingSafeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Interfaces (la base y Stripe se inyectan: así la lógica se prueba sin red) ─────────────────────────
export interface Store {
  loadPlans(): Promise<Map<string, PlanInfo>>;
  loadFx(): Promise<Map<string, number>>;
  knownPlanIds(): Promise<Set<string>>;
  registerPlan(priceId: string, name: string | null): Promise<void>;
  upsertCustomer(c: { key: string; source: "stripe" | "manual"; name?: string | null; email?: string | null; country?: string | null; companyId?: string | null }): Promise<void>;
  upsertSubscription(doc: SubDoc): Promise<void>;
  getSubscription(id: string): Promise<SubDoc | null>;
  listSubscriptions(customerKey: string): Promise<SubDoc[]>;
  liveStripeSubscriptionIds(): Promise<string[]>;
  customerKeys(): Promise<string[]>;
  claimEvent(id: string, type: string): Promise<boolean>;
  finishEvent(id: string, result: unknown): Promise<void>;
  releaseEvent(id: string): Promise<void>;
  applyMrr(key: string, after: number, cause: string, baseline: boolean): Promise<{ customerKey: string; before: number; after: number } | null>;
  countUnclassified(): Promise<number>;
  countEvents(): Promise<number>;
  audit(row: { subscriptionId: string; before: SubDoc | null; after: SubDoc; userId: string | null }): Promise<void>;
  logRun(run: { kind: string; fixes: number; stale: number; unclassified: number; errors: unknown[] }): Promise<void>;
  createManualPlan(name: string, category: string, countsInMrr: boolean): Promise<string>;
  planExists(priceId: string): Promise<boolean>;
}
export interface StripeApi {
  getSubscription(id: string): Promise<any | null>; // null si no existe (404)
  listSubscriptions(status: string): AsyncIterable<any>;
  getCoupon(id: string): Promise<any>;
  getProduct(id: string): Promise<any>;
}

type Ctx = { store: Store; stripe: StripeApi; now: () => Date; coupons: Map<string, any>; known: Set<string> | null };
const newCtx = (store: Store, stripe: StripeApi, now: () => Date): Ctx => ({ store, stripe, now, coupons: new Map(), known: null });

// Lee una suscripción de Stripe, registra cliente y planes nuevos y la guarda normalizada
export async function saveStripeSubscription(ctx: Ctx, sub: any): Promise<SubDoc> {
  const customer = typeof sub.customer === "object" ? sub.customer : null;
  await ctx.store.upsertCustomer({
    key: customerKeyOf(sub), source: "stripe",
    name: customer?.name ?? undefined, email: customer?.email ?? undefined, country: customer?.address?.country ?? undefined,
  });
  // Planes nuevos: entran SIN CLASIFICAR y no suman al MRR hasta que alguien los clasifique
  if (!ctx.known) ctx.known = await ctx.store.knownPlanIds();
  for (const it of sub.items?.data || []) {
    if (ctx.known.has(it.price.id)) continue;
    let name: string | null = typeof it.price.product === "object" ? it.price.product?.name ?? null : null;
    if (!name && typeof it.price.product === "string") { try { name = (await ctx.stripe.getProduct(it.price.product))?.name ?? null; } catch { name = null; } }
    await ctx.store.registerPlan(it.price.id, name || it.price.nickname || null);
    ctx.known.add(it.price.id);
  }
  const ref = couponRefOf(sub);
  if (ref && typeof ref.coupon === "string" && !ctx.coupons.has(ref.coupon)) ctx.coupons.set(ref.coupon, await ctx.stripe.getCoupon(ref.coupon));
  const doc = normalizeStripeSub(sub, ctx.coupons);
  await ctx.store.upsertSubscription(doc);
  return doc;
}

export async function recomputeCustomer(ctx: Ctx, key: string, opts: { cause?: string; baseline?: boolean; plans?: Map<string, PlanInfo>; fx?: Map<string, number> } = {}) {
  const plans = opts.plans || await ctx.store.loadPlans();
  const fx = opts.fx || await ctx.store.loadFx();
  const subs = await ctx.store.listSubscriptions(key);
  const now = ctx.now();
  const after = round2(subs.reduce((s, x) => s + subscriptionMrr(x, plans, fx, now), 0));
  return ctx.store.applyMrr(key, after, opts.cause || "sync", !!opts.baseline);
}

async function recomputeAll(ctx: Ctx, cause: string, baseline: boolean) {
  const plans = await ctx.store.loadPlans(), fx = await ctx.store.loadFx();
  const fixes: unknown[] = [], errors: { customerKey: string; error: string }[] = [];
  for (const key of await ctx.store.customerKeys()) {
    // Un cliente con problema (ej. falta el tipo de cambio) no frena al resto
    try { const r = await recomputeCustomer(ctx, key, { cause, baseline, plans, fx }); if (r) fixes.push(r); }
    catch (e) { errors.push({ customerKey: key, error: String((e as Error).message || e) }); }
  }
  return { fixes, errors, unclassified: await ctx.store.countUnclassified() };
}

// Carga inicial (baseline) y chequeo nocturno
export async function reconcile(ctx: Ctx, { baseline = false } = {}) {
  const seen = new Set<string>();
  for (const status of ["active", "past_due", "trialing"]) {
    for await (const sub of ctx.stripe.listSubscriptions(status)) {
      const doc = await saveStripeSubscription(ctx, sub);
      seen.add(doc.id);
    }
  }
  // Suscripciones que teníamos vivas y ya no aparecen: se perdió el webhook de baja
  let staleCount = 0;
  for (const id of await ctx.store.liveStripeSubscriptionIds()) {
    if (seen.has(id)) continue;
    staleCount++;
    const sub = await ctx.stripe.getSubscription(id.replace(/^stripe:/, ""));
    if (sub) { await saveStripeSubscription(ctx, sub); continue; }
    const prev = await ctx.store.getSubscription(id); // Stripe ya no la tiene: se da por cancelada
    if (prev) await ctx.store.upsertSubscription({ ...prev, status: "canceled", canceledAt: ctx.now().toISOString() });
  }
  const r = await recomputeAll(ctx, baseline ? "carga_inicial" : "reconciliacion", baseline);
  await ctx.store.logRun({ kind: baseline ? "baseline" : "reconcile", fixes: r.fixes.length, stale: staleCount, unclassified: r.unclassified, errors: r.errors });
  return { ...r, staleCount };
}

// ── Carga manual ───────────────────────────────────────────────────────────────────────────────────────
export type ManualInput = {
  customerKey?: string; customerName?: string; email?: string; companyId?: string;
  planPriceId?: string; newPlan?: { name: string; category: string; countsInMrr?: boolean };
  amount: number; currency?: string; interval?: string; status?: string;
  discount?: { percentOff?: number; amountOff?: number; endsAt?: string } | null;
  subscriptionId?: string;
};
export async function saveManualSubscription(ctx: Ctx, data: ManualInput, userId: string | null, newId: () => string = () => crypto.randomUUID()) {
  if (!Number.isFinite(data.amount) || data.amount < 0) throw new Error("monto_invalido");
  const interval = data.interval || "month";
  if (!["month", "year"].includes(interval)) throw new Error("intervalo_invalido");
  const status = data.status || "active";
  if (!["active", "canceled"].includes(status)) throw new Error("estado_invalido");
  if (!data.customerKey && !String(data.customerName || "").trim()) throw new Error("cliente_requerido");
  if (data.customerKey && !/^(manual|stripe):/.test(data.customerKey)) throw new Error("cliente_invalido");

  let priceId = data.planPriceId;
  if (!priceId && data.newPlan?.name) priceId = await ctx.store.createManualPlan(data.newPlan.name, data.newPlan.category || "saas", data.newPlan.countsInMrr ?? true);
  if (!priceId || !(await ctx.store.planExists(priceId))) throw new Error("plan_inexistente");

  const customerKey = data.customerKey || `manual:${newId()}`;
  await ctx.store.upsertCustomer({ key: customerKey, source: customerKey.startsWith("stripe:") ? "stripe" : "manual",
    name: data.customerName?.trim() || undefined, email: data.email || undefined, companyId: data.companyId || undefined });

  const id = data.subscriptionId || `manual:${newId()}`;
  if (!id.startsWith("manual:")) throw new Error("suscripcion_invalida"); // las de Stripe no se editan a mano
  const prev = await ctx.store.getSubscription(id);
  const doc: SubDoc = {
    id, customerKey, source: "manual", status, currency: (data.currency || "usd").toLowerCase(),
    items: [{ priceId, unitAmount: Math.round(data.amount * 100), quantity: 1, interval, intervalCount: 1 }],
    discount: data.discount || null, canceledAt: status === "canceled" ? ctx.now().toISOString() : null,
  };
  await ctx.store.upsertSubscription(doc);
  await ctx.store.audit({ subscriptionId: id, before: prev, after: doc, userId });
  const result = await recomputeCustomer(ctx, customerKey, { cause: prev ? "manual_edicion" : "manual_alta" });
  return { customerKey, subscriptionId: id, result };
}

// ── HTTP ───────────────────────────────────────────────────────────────────────────────────────────────
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-revenue-cron-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS } });
export function userIdOf(req: Request): string | null {
  try { const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").split(".")[1]; return JSON.parse(atob(t.replace(/-/g, "+").replace(/_/g, "/"))).sub || null; } catch { return null; }
}
const HANDLED = ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"];
const MAX_BODY = 1_000_000;

export type Deps = {
  store: Store; stripe: StripeApi;
  webhookSecret?: string; cronSecret?: string;
  isAdmin: (req: Request) => Promise<boolean>;
  now?: () => Date;
};

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  const route = new URL(req.url).pathname.replace(/\/+$/, "").split("/").pop();
  const now = deps.now || (() => new Date());
  const ctx = newCtx(deps.store, deps.stripe, now);
  const raw = await req.text();
  if (raw.length > MAX_BODY) return reply({ error: "too_large" }, 413);

  // ── Webhook de Stripe
  if (route === "stripe") {
    if (!deps.webhookSecret) return reply({ error: "no_webhook_secret" }, 500);
    if (!(await verifyStripeSignature(raw, req.headers.get("stripe-signature"), deps.webhookSecret, now().getTime()))) return reply({ error: "firma_invalida" }, 400);
    let event: any;
    try { event = JSON.parse(raw); } catch { return reply({ error: "bad_request" }, 400); }
    if (!HANDLED.includes(event.type)) return reply({ ignored: true });
    // Idempotencia: Stripe puede mandar el mismo evento más de una vez
    if (!(await deps.store.claimEvent(event.id, event.type))) return reply({ duplicate: true });
    try {
      // Se relee la suscripción desde Stripe: los eventos pueden llegar desordenados
      const sub = await deps.stripe.getSubscription(event.data.object.id);
      let result: unknown = null;
      if (sub) {
        const doc = await saveStripeSubscription(ctx, sub);
        result = await recomputeCustomer(ctx, doc.customerKey, { cause: event.type });
      } else {
        const prev = await deps.store.getSubscription(`stripe:${event.data.object.id}`);
        if (prev) { await deps.store.upsertSubscription({ ...prev, status: "canceled", canceledAt: now().toISOString() }); result = await recomputeCustomer(ctx, prev.customerKey, { cause: event.type }); }
      }
      await deps.store.finishEvent(event.id, result);
      return reply({ ok: true });
    } catch (e) {
      await deps.store.releaseEvent(event.id).catch(() => {}); // para que el reintento de Stripe lo vuelva a procesar
      console.error("Error procesando webhook", event.id, e);
      return reply({ error: "error" }, 500);
    }
  }

  // ── Resto de las rutas: cron (secret) o admin logueado
  const cronHeader = req.headers.get("x-revenue-cron-secret") || "";
  const cronOk = !!deps.cronSecret && cronHeader.length === deps.cronSecret.length && timingSafeEqual(cronHeader, deps.cronSecret);
  const adminOk = cronOk ? false : await deps.isAdmin(req);
  if (!cronOk && !adminOk) return reply({ error: "forbidden" }, 403);
  let body: any = {};
  if (raw.trim()) { try { body = JSON.parse(raw); } catch { return reply({ error: "bad_request" }, 400); } }

  try {
    if (route === "reconcile") {
      const baseline = body.baseline === true;
      // La carga inicial es de una sola vez: si ya hay movimientos, no se permite (evita marcar todo como baseline de nuevo)
      if (baseline && (await deps.store.countEvents()) > 0) return reply({ error: "baseline_ya_hecho" }, 409);
      return reply(await reconcile(ctx, { baseline }));
    }
    if (route === "recompute") {
      const r = await recomputeAll(ctx, "recalculo", false);
      await ctx.store.logRun({ kind: "recompute", fixes: r.fixes.length, stale: 0, unclassified: r.unclassified, errors: r.errors });
      return reply(r);
    }
    if (route === "manual") {
      if (!adminOk) return reply({ error: "forbidden" }, 403); // la carga manual necesita saber QUIÉN la hizo
      return reply(await saveManualSubscription(ctx, body, userIdOf(req)));
    }
  } catch (e) {
    const msg = String((e as Error).message || e);
    const known = /^(monto_invalido|intervalo_invalido|estado_invalido|cliente_requerido|cliente_invalido|plan_inexistente|suscripcion_invalida)$/.test(msg);
    if (!known) console.error("revenue-sync", route, e);
    return reply({ error: known ? msg : "error", detail: known ? undefined : msg }, known ? 400 : 500);
  }
  return reply({ error: "not_found" }, 404);
}

// ── Implementaciones reales (solo corren dentro de Supabase; en los tests no existe Deno) ───────────────
export function makeStripeApi(apiKey: string, fetchFn: typeof fetch = fetch): StripeApi {
  const get = async (path: string, params: Record<string, string | string[]> = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) (Array.isArray(v) ? v : [v]).forEach((x) => q.append(Array.isArray(v) ? `${k}[]` : k, x));
    const res = await fetchFn(`https://api.stripe.com/v1/${path}?${q}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Stripe ${res.status} en ${path}`);
    return res.json();
  };
  return {
    getSubscription: (id) => get(`subscriptions/${id}`, { expand: ["customer", "discounts"] }),
    async *listSubscriptions(status) {
      let after: string | undefined;
      for (;;) {
        const page = await get("subscriptions", { status, limit: "100", expand: ["data.customer", "data.discounts"], ...(after ? { starting_after: after } : {}) });
        for (const s of page.data) yield s;
        if (!page.has_more || !page.data.length) return;
        after = page.data[page.data.length - 1].id;
      }
    },
    getCoupon: (id) => get(`coupons/${id}`),
    getProduct: (id) => get(`products/${id}`),
  };
}

export function makeStore(sb: any): Store {
  const check = (r: { error: any; data?: any }) => { if (r.error) throw new Error(r.error.message || String(r.error)); return r.data; };
  const fetchAll = async (build: (from: number, to: number) => any) => {
    const out: any[] = [];
    for (let from = 0; ; from += 1000) { const rows = check(await build(from, from + 999)) || []; out.push(...rows); if (rows.length < 1000) return out; }
  };
  const toDoc = (r: any): SubDoc => ({ id: r.id, customerKey: r.customer_key, source: r.source, status: r.status, currency: r.currency, items: r.items, discount: r.discount, canceledAt: r.canceled_at });
  const toRow = (d: SubDoc) => ({ id: d.id, customer_key: d.customerKey, source: d.source, status: d.status, currency: d.currency, items: d.items, discount: d.discount, canceled_at: d.canceledAt || null, updated_at: new Date().toISOString() });
  return {
    async loadPlans() { return new Map((await fetchAll((a, b) => sb.from("rev_plans").select("price_id,counts_in_mrr").order("price_id").range(a, b))).map((p: any) => [p.price_id, { countsInMrr: p.counts_in_mrr }])); },
    async loadFx() { return new Map((check(await sb.from("rev_fx_rates").select("currency,rate")) || []).map((r: any) => [String(r.currency).toLowerCase(), Number(r.rate)])); },
    async knownPlanIds() { return new Set((await fetchAll((a, b) => sb.from("rev_plans").select("price_id").order("price_id").range(a, b))).map((p: any) => p.price_id)); },
    async registerPlan(priceId, name) { check(await sb.from("rev_plans").upsert({ price_id: priceId, name }, { onConflict: "price_id", ignoreDuplicates: true })); },
    async upsertCustomer(c) {
      const row: Record<string, unknown> = { key: c.key, source: c.source };
      if (c.name) row.name = c.name; if (c.email) row.email = c.email; if (c.country) row.country = c.country; if (c.companyId) row.company_id = c.companyId;
      check(await sb.from("rev_customers").upsert(row, { onConflict: "key" })); // solo pisa las columnas que mandamos
    },
    async upsertSubscription(doc) { check(await sb.from("rev_subscriptions").upsert(toRow(doc), { onConflict: "id" })); },
    async getSubscription(id) { const r = check(await sb.from("rev_subscriptions").select("*").eq("id", id).maybeSingle()); return r ? toDoc(r) : null; },
    async listSubscriptions(key) { return (check(await sb.from("rev_subscriptions").select("*").eq("customer_key", key)) || []).map(toDoc); },
    async liveStripeSubscriptionIds() { return (await fetchAll((a, b) => sb.from("rev_subscriptions").select("id").eq("source", "stripe").in("status", LIVE_STATUSES).order("id").range(a, b))).map((r: any) => r.id); },
    async customerKeys() { return [...new Set((await fetchAll((a, b) => sb.from("rev_subscriptions").select("customer_key").order("id").range(a, b))).map((r: any) => r.customer_key))] as string[]; },
    async claimEvent(id, type) { const { error } = await sb.from("rev_stripe_events").insert({ id, type }); if (error) { if (error.code === "23505") return false; throw new Error(error.message); } return true; },
    async finishEvent(id, result) { check(await sb.from("rev_stripe_events").update({ processed_at: new Date().toISOString(), result }).eq("id", id)); },
    async releaseEvent(id) { check(await sb.from("rev_stripe_events").delete().eq("id", id)); },
    async applyMrr(key, after, cause, baseline) { return check(await sb.rpc("rev_apply_mrr", { p_key: key, p_after: after, p_cause: cause, p_baseline: baseline })) ?? null; },
    async countUnclassified() { const r = await sb.from("rev_plans").select("price_id", { count: "exact", head: true }).eq("category", "sin_clasificar"); check(r); return r.count || 0; },
    async countEvents() { const r = await sb.from("rev_mrr_events").select("id", { count: "exact", head: true }); check(r); return r.count || 0; },
    async audit(a) { check(await sb.from("rev_manual_audit").insert({ subscription_id: a.subscriptionId, before: a.before, after: a.after, user_id: a.userId })); },
    async logRun(r) { check(await sb.from("rev_sync_runs").insert({ kind: r.kind, fixes: r.fixes, stale: r.stale, unclassified: r.unclassified, errors: r.errors })); },
    async createManualPlan(name, category, countsInMrr) {
      const price_id = `manual:${crypto.randomUUID()}`;
      check(await sb.from("rev_plans").insert({ price_id, name, category, counts_in_mrr: countsInMrr }));
      return price_id;
    },
    async planExists(priceId) { return !!check(await sb.from("rev_plans").select("price_id").eq("price_id", priceId).maybeSingle()); },
  };
}

declare const Deno: any;
if (typeof Deno !== "undefined" && Deno.serve) {
  Deno.serve(async (req: Request) => {
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    return handle(req, {
      store: makeStore(admin),
      stripe: makeStripeApi(Deno.env.get("STRIPE_API_KEY") || ""),
      webhookSecret: Deno.env.get("STRIPE_WEBHOOK_SECRET"),
      cronSecret: Deno.env.get("REVENUE_CRON_SECRET"),
      isAdmin: async (r: Request) => {
        const auth = r.headers.get("authorization");
        if (!auth) return false;
        const sb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
        const { data, error } = await sb.rpc("is_admin");
        return !error && data === true;
      },
    });
  });
}
