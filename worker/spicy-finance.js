/**
 * SpicyTool Finance Worker v4 — con referidos + Azure + MongoDB + Mercury Webhook
 * ─────────────────────────────────────────────────────────────────────
 * SECRETS en Cloudflare (Settings → Variables → Secrets) — configurar ahí,
 * NUNCA hardcodear valores acá (este archivo está versionado en git):
 *   MERCURY_TOKEN          → API token de Mercury (read-only)
 *   STRIPE_KEY             → Stripe secret key (sk_live_...)
 *   ALLOWED_ORIGIN         → URL del frontend, o "*" para dev
 *   COMMISSION_RATE        → porcentaje de comisión (default: "20")
 *   AZURE_TENANT_ID        → tenant ID de Azure AD
 *   AZURE_CLIENT_ID        → client ID de la app registrada en Azure AD
 *   AZURE_CLIENT_SECRET    → client secret de esa app
 *   AZURE_SUBSCRIPTION_ID  → subscription ID de Azure
 *   AZURE_RESOURCE_GROUP   → resource group (ej: "Spicytool")
 *   MONGO_PUBLIC_KEY       → public key de la API de MongoDB Atlas
 *   MONGO_PRIVATE_KEY      → private key de la API de MongoDB Atlas
 *   MONGO_ORG_ID           → org ID de MongoDB Atlas
 *   SUPABASE_URL           → https://khuavhbraikzreyhptog.supabase.co
 *   SUPABASE_SERVICE_KEY   → service_role key de Supabase (Settings → API)
 *   MERCURY_WEBHOOK_SECRET → secret para verificar firma del webhook
 *
 * ENDPOINTS:
 *   GET /health     → estado de las keys
 *   GET /mercury    → transacciones Mercury
 *   GET /stripe     → transacciones Stripe
 *   GET /referrals  → comisiones por referidor
 *   GET /sync       → mercury + stripe + referrals
 *   GET /azure      → costos Azure por servicio (mes actual vs anterior)
 *   GET /mongodb              → costos MongoDB Atlas por proyecto/cluster
 *   POST /webhook/mercury     → recibe transacciones nuevas de Mercury
 *   GET /mongo      → costos MongoDB Atlas por proyecto (mes actual vs anterior)
 *   GET /services   → azure + mongo en una sola llamada
 *
 * METADATA en Stripe:
 *   Customer metadata:  referrer_id   → ID del socio que refirió (ej: "socio_nico")
 *                       referrer_name → Nombre legible (ej: "Nicolás López")
 *
 * Para agregar metadata en Stripe:
 *   Dashboard → Customers → [cliente] → Edit → Metadata → Add
 *   O via API: stripe.customers.update(id, { metadata: { referrer_id: "socio_xyz", referrer_name: "Nombre" } })
 */

const CORS = (origin) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
});

function err(msg, origin, status = 500) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: CORS(origin) });
}

// Paginar todos los resultados de Stripe automáticamente
async function stripeGetAll(url, key) {
  const results = [];
  let startingAfter = null;
  do {
    const u = new URL(url);
    u.searchParams.set("limit", "100");
    if (startingAfter) u.searchParams.set("starting_after", startingAfter);
    const res = await fetch(u.toString(), { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) break;
    const data = await res.json();
    results.push(...(data.data || []));
    if (!data.has_more) break;
    startingAfter = data.data[data.data.length - 1].id;
  } while (true);
  return results;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";
    const allowed = env.ALLOWED_ORIGIN || "*";
    if (allowed !== "*" && origin !== allowed) {
      return err("Origin not allowed", origin, 403);
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS(origin) });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const COMMISSION = parseFloat(env.COMMISSION_RATE || "20") / 100;

    try {

      // ── /health ──────────────────────────────────────────────────
      if (path === "/health") {
        return new Response(JSON.stringify({
          ok: true,
          mercury: !!env.MERCURY_TOKEN,
          stripe: !!env.STRIPE_KEY,
          azure: !!env.AZURE_CLIENT_ID,
          mongodb: !!env.MONGO_PUBLIC_KEY,
          commission_rate: `${parseFloat(env.COMMISSION_RATE || "20")}%`,
        }), { headers: CORS(origin) });
      }

      // ── /mercury ─────────────────────────────────────────────────
      if (path === "/mercury") {
        if (!env.MERCURY_TOKEN) return err("MERCURY_TOKEN no configurado", origin);
        const accountsRes = await fetch("https://api.mercury.com/api/v1/accounts", {
          headers: { Authorization: `Bearer ${env.MERCURY_TOKEN}`, Accept: "application/json" },
        });
        if (!accountsRes.ok) return err("Mercury error " + accountsRes.status, origin);
        const { accounts = [] } = await accountsRes.json();
        const allTxns = [];
        for (const account of accounts) {
          const params = new URLSearchParams({ limit: "500", status: "sent" });
          const start = url.searchParams.get("start");
          if (start) params.set("start", start);
          const res = await fetch(`https://api.mercury.com/api/v1/account/${account.id}/transactions?${params}`, {
            headers: { Authorization: `Bearer ${env.MERCURY_TOKEN}`, Accept: "application/json" },
          });
          if (!res.ok) continue;
          const { transactions = [] } = await res.json();
          transactions.forEach(t => {
            allTxns.push({
              id: "mercury_" + t.id,
              source: "mercury",
              date: (t.postedAt || t.createdAt).split("T")[0],
              description: t.counterpartyName || t.bankDescription || t.note || "",
              amount: Math.abs(t.amount),
              type: t.amount > 0 ? "income" : "expense",
              account: account.name || account.id,
            });
          });
        }
        return new Response(JSON.stringify({ transactions: allTxns, count: allTxns.length }), { headers: CORS(origin) });
      }

      // ── /stripe ──────────────────────────────────────────────────
      // Enriquece cada transacción con el referidor del customer
      if (path === "/stripe") {
        if (!env.STRIPE_KEY) return err("STRIPE_KEY no configurado", origin);

        // Traer balance transactions con el customer del charge ya expandido en la
        // misma llamada (expand[]=data.source.customer). Antes se traía la lista
        // completa de customers + un fetch por cada charge para resolver el
        // customer_id, lo que hacía cientos de subrequests y tiraba "Too many
        // subrequests by single Worker invocation" apenas había volumen real.
        const baseUrl = "https://api.stripe.com/v1/balance_transactions";
        const startTs = url.searchParams.get("start");
        const btUrl = new URL(baseUrl);
        if (startTs) btUrl.searchParams.set("created[gte]", Math.floor(new Date(startTs).getTime() / 1000));
        btUrl.searchParams.set("expand[]", "data.source.customer");
        const balanceTxns = await stripeGetAll(btUrl.toString(), env.STRIPE_KEY);

        // Mapear balance transactions → formato SpicyTool
        const txns = balanceTxns
          .filter(t => t.type !== "payout")
          .map(t => {
            const customer = (t.source && typeof t.source === "object") ? t.source.customer : null;
            const customerObj = (customer && typeof customer === "object") ? customer : null;
            const customerId = customerObj?.id || (typeof customer === "string" ? customer : null);
            const meta = customerObj?.metadata || {};
            return {
              id: "stripe_" + t.id,
              source: "stripe",
              date: new Date(t.created * 1000).toISOString().split("T")[0],
              description: t.description || t.type || "",
              amount: Math.abs(t.net) / 100,
              type: t.net > 0 ? "income" : "expense",
              rawType: t.type,
              fee: Math.abs(t.fee) / 100,
              customer_id: customerId,
              customer_email: customerObj?.email ? customerObj.email.toLowerCase().trim() : null,
              referrer_id: meta.referrer_id || null,
              referrer_name: meta.referrer_name || meta.referrer_id || null,
            };
          });

        return new Response(JSON.stringify({ transactions: txns, count: txns.length }), { headers: CORS(origin) });
      }

      // ── /referrals ─────────────────────────────────────────────
      // Devuelve transacciones Stripe agrupadas por referidor.
      // SIN aplicar tasa — la app calcula con tasa variable por socio.
      if (path === "/referrals") {
        if (!env.STRIPE_KEY) return err("STRIPE_KEY no configurado", origin);

        const stripeReq = new Request(new URL("/stripe" + url.search, url.origin), request);
        const stripeRes = await fetch(stripeReq);
        const { transactions = [] } = await stripeRes.json();

        // Solo ingresos con referidor en metadata
        const referred = transactions.filter(t => t.type === "income" && t.referrer_id);

        const byReferrer = {};
        for (const t of referred) {
          const mk = t.date.slice(0, 7);
          const key = t.referrer_id;
          if (!byReferrer[key]) byReferrer[key] = {
            id: key, name: t.referrer_name || key,
            months: {}, totalRevenue: 0, transactions: [],
          };
          if (!byReferrer[key].months[mk]) byReferrer[key].months[mk] = { revenue: 0, txCount: 0 };
          byReferrer[key].months[mk].revenue += t.amount;
          byReferrer[key].months[mk].txCount++;
          byReferrer[key].totalRevenue += t.amount;
          byReferrer[key].transactions.push({ id: t.id, date: t.date, amount: t.amount, description: t.description, customer_email: t.customer_email || null });
        }

        const referrers = Object.values(byReferrer).map(r => ({
          ...r,
          months: Object.entries(r.months).sort(([a],[b]) => b.localeCompare(a)).map(([month, data]) => ({ month, ...data })),
        })).sort((a, b) => b.totalRevenue - a.totalRevenue);

        return new Response(JSON.stringify({
          referrers,
          totalReferredRevenue: referrers.reduce((s, r) => s + r.totalRevenue, 0),
        }), { headers: CORS(origin) });
      }

      // ── /sync       // ── /sync ────────────────────────────────────────────────────
      if (path === "/sync") {
        const results = { transactions: [], referrals: null, errors: [] };

        if (env.MERCURY_TOKEN) {
          try {
            const r = await fetch(new URL("/mercury" + url.search, url.origin));
            const d = await r.json();
            results.transactions.push(...(d.transactions || []));
          } catch (e) { results.errors.push("mercury: " + e.message); }
        }

        if (env.STRIPE_KEY) {
          try {
            const r = await fetch(new URL("/stripe" + url.search, url.origin));
            const d = await r.json();
            results.transactions.push(...(d.transactions || []));
          } catch (e) { results.errors.push("stripe: " + e.message); }

          try {
            const r = await fetch(new URL("/referrals" + url.search, url.origin));
            results.referrals = await r.json();
          } catch (e) { results.errors.push("referrals: " + e.message); }
        }

        results.transactions.sort((a, b) => b.date.localeCompare(a.date));
        return new Response(JSON.stringify(results), { headers: CORS(origin) });
      }

      // ── /azure ───────────────────────────────────────────────────
      // Devuelve costos de Azure por servicio del mes actual y anterior
      if (path === "/azure") {
        if (!env.AZURE_CLIENT_ID || !env.AZURE_CLIENT_SECRET || !env.AZURE_TENANT_ID || !env.AZURE_SUBSCRIPTION_ID) {
          return err("Faltan credenciales de Azure (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID)", origin);
        }

        // 1. Get access token
        const tokenRes = await fetch(
          `https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type:    "client_credentials",
              client_id:     env.AZURE_CLIENT_ID,
              client_secret: env.AZURE_CLIENT_SECRET,
              scope:         "https://management.azure.com/.default",
            }),
          }
        );
        if (!tokenRes.ok) return err("Azure auth error: " + tokenRes.status, origin);
        const { access_token } = await tokenRes.json();

        // 2. Query Cost Management for current and previous month
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        const thisMonthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
        const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

        // Try subscription scope first, fall back to resource group scope
        const scopeSub = `/subscriptions/${env.AZURE_SUBSCRIPTION_ID}`;
        const scopeRG  = `/subscriptions/${env.AZURE_SUBSCRIPTION_ID}/resourceGroups/${env.AZURE_RESOURCE_GROUP || "Spicytool"}`;

        async function queryCosts(from, to, scope) {
          const res = await fetch(
            `https://management.azure.com${scope}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${access_token}`,
                "Content-Type":  "application/json",
              },
              body: JSON.stringify({
                type: "ActualCost",
                dataSet: {
                  granularity: "None",
                  aggregation: { totalCost: { name: "Cost", function: "Sum" } },
                  grouping: [{ type: "Dimension", name: "ServiceName" }],
                },
                timeframe: "Custom",
                timePeriod: { from, to },
              }),
            }
          );
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Cost query failed ${res.status}: ${txt}`);
          }
          const data = await res.json();
          const rows = data.properties?.rows || [];
          return rows.map(r => ({ service: r[1] || "Unknown", cost: Math.round(r[0] * 100) / 100 }))
                     .filter(r => r.cost > 0)
                     .sort((a, b) => b.cost - a.cost);
        }

        // Try subscription scope, fall back to resource group if 400/403
        async function queryCostsFallback(from, to) {
          try {
            return await queryCosts(from, to, scopeSub);
          } catch(e) {
            if (e.message.includes("400") || e.message.includes("403") || e.message.includes("not supported")) {
              return await queryCosts(from, to, scopeRG);
            }
            throw e;
          }
        }

        const [currentMonth, prevMonth] = await Promise.all([
          queryCostsFallback(thisMonthStart, thisMonthEnd),
          queryCostsFallback(prevMonthStart, prevMonthEnd),
        ]);

        // 3. Build comparison — flag services that grew > 20%
        const prevMap = {};
        prevMonth.forEach(r => prevMap[r.service] = r.cost);

        const services = currentMonth.map(r => {
          const prev    = prevMap[r.service] || 0;
          const change  = prev > 0 ? ((r.cost - prev) / prev) * 100 : null;
          const alert   = change !== null && change > 20;
          return { service: r.service, current: r.cost, prev, change: change ? Math.round(change) : null, alert };
        });

        const totalCurrent = currentMonth.reduce((s, r) => s + r.cost, 0);
        const totalPrev    = prevMonth.reduce((s, r) => s + r.cost, 0);

        return new Response(JSON.stringify({
          services,
          totalCurrent: Math.round(totalCurrent * 100) / 100,
          totalPrev:    Math.round(totalPrev * 100) / 100,
          period:       { current: `${thisMonthStart} → ${thisMonthEnd}`, prev: `${prevMonthStart} → ${prevMonthEnd}` },
        }), { headers: CORS(origin) });
      }

      // ── /mongo ───────────────────────────────────────────────────
      // Costos MongoDB Atlas por proyecto (Digest Auth)
      if (path === "/mongo") {
        if (!env.MONGO_PUBLIC_KEY || !env.MONGO_PRIVATE_KEY || !env.MONGO_ORG_ID) {
          return err("Faltan credenciales de MongoDB (MONGO_PUBLIC_KEY, MONGO_PRIVATE_KEY, MONGO_ORG_ID)", origin);
        }

        const now = new Date();
        const thisYear  = now.getFullYear();
        const thisMonth = now.getMonth() + 1; // 1-12
        const prevYear  = thisMonth === 1 ? thisYear - 1 : thisYear;
        const prevMonth = thisMonth === 1 ? 12 : thisMonth - 1;

        // MongoDB Atlas API uses HTTP Digest Auth
        async function mongoGet(urlPath) {
          // First request to get the nonce
          const uri = `https://cloud.mongodb.com/api/atlas/v1.0${urlPath}`;
          const r1 = await fetch(uri, { headers: { "Accept": "application/json" } });
          const wwwAuth = r1.headers.get("www-authenticate") || "";

          // Parse digest params
          const realm   = (wwwAuth.match(/realm="([^"]+)"/)    || [])[1] || "";
          const nonce   = (wwwAuth.match(/nonce="([^"]+)"/)    || [])[1] || "";
          const qop     = (wwwAuth.match(/qop="([^"]+)"/)      || [])[1] || "auth";

          const nc      = "00000001";
          const cnonce  = crypto.randomUUID().replace(/-/g,"").slice(0,8);
          const method  = "GET";

          // MD5 helpers via SubtleCrypto (hex)
          async function md5(str) {
            const buf = await crypto.subtle.digest("MD5", new TextEncoder().encode(str));
            return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
          }

          const ha1 = await md5(`${env.MONGO_PUBLIC_KEY}:${realm}:${env.MONGO_PRIVATE_KEY}`);
          const ha2 = await md5(`${method}:${new URL(uri).pathname}`);
          const response = await md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);

          const authHeader = `Digest username="${env.MONGO_PUBLIC_KEY}", realm="${realm}", nonce="${nonce}", uri="${new URL(uri).pathname}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;

          const r2 = await fetch(uri, {
            headers: { "Accept": "application/json", "Authorization": authHeader }
          });
          if (!r2.ok) throw new Error(`MongoDB API ${r2.status}: ${await r2.text()}`);
          return r2.json();
        }

        // Get pending invoices (current month)
        async function getMonthCosts(year, month) {
          try {
            // Try invoices endpoint first
            const data = await mongoGet(`/orgs/${env.MONGO_ORG_ID}/invoices/pending`);
            const lineItems = data.lineItems || [];
            // Group by cluster/project
            const byProject = {};
            lineItems.forEach(item => {
              const key = item.clusterName || item.groupName || "Unknown";
              if (!byProject[key]) byProject[key] = 0;
              byProject[key] += (item.totalPriceCents || 0) / 100;
            });
            return Object.entries(byProject)
              .map(([name, cost]) => ({ name, cost: Math.round(cost * 100) / 100 }))
              .filter(x => x.cost > 0)
              .sort((a, b) => b.cost - a.cost);
          } catch {
            // Fallback: try invoice list
            const data = await mongoGet(`/orgs/${env.MONGO_ORG_ID}/invoices`);
            const invoices = (data.results || []).filter(inv => {
              const d = new Date(inv.startDate);
              return d.getFullYear() === year && d.getMonth() + 1 === month;
            });
            if (!invoices.length) return [];
            const inv = invoices[0];
            return [{ name: "Total Atlas", cost: (inv.totalBilled || inv.amountBilledCents || 0) / 100 }];
          }
        }

        const [current, prev] = await Promise.all([
          getMonthCosts(thisYear, thisMonth),
          getMonthCosts(prevYear, prevMonth),
        ]);

        const prevMap = {};
        prev.forEach(r => prevMap[r.name] = r.cost);

        const services = current.map(r => {
          const prevCost = prevMap[r.name] || 0;
          const change   = prevCost > 0 ? Math.round(((r.cost - prevCost) / prevCost) * 100) : null;
          return { service: r.name, current: r.cost, prev: prevCost, change, alert: change !== null && change > 20 };
        });

        return new Response(JSON.stringify({
          services,
          totalCurrent: Math.round(current.reduce((s,r)=>s+r.cost,0) * 100) / 100,
          totalPrev:    Math.round(prev.reduce((s,r)=>s+r.cost,0) * 100) / 100,
          period: { current: `${thisYear}-${String(thisMonth).padStart(2,"0")}`, prev: `${prevYear}-${String(prevMonth).padStart(2,"0")}` },
        }), { headers: CORS(origin) });
      }

      // ── /services ────────────────────────────────────────────────
      // Azure + MongoDB en una sola llamada
      if (path === "/services") {
        const results = { azure: null, mongo: null, errors: [] };
        await Promise.all([
          fetch(new URL("/azure", url.origin)).then(r=>r.json()).then(d=>{ results.azure=d; }).catch(e=>results.errors.push("azure: "+e.message)),
          fetch(new URL("/mongo",  url.origin)).then(r=>r.json()).then(d=>{ results.mongo=d;  }).catch(e=>results.errors.push("mongo: "+e.message)),
        ]);
        return new Response(JSON.stringify(results), { headers: CORS(origin) });
      }

      // ── /mongodb ─────────────────────────────────────────────────
      // Costos de MongoDB Atlas por proyecto del mes actual y anterior
      if (path === "/mongodb") {
        if (!env.MONGO_PUBLIC_KEY || !env.MONGO_PRIVATE_KEY || !env.MONGO_ORG_ID) {
          return err("Faltan credenciales MongoDB (MONGO_PUBLIC_KEY, MONGO_PRIVATE_KEY, MONGO_ORG_ID)", origin);
        }

        // MongoDB Atlas API usa Digest Auth
        async function mongoDigest(url) {
          // First request to get nonce
          const r1 = await fetch(url, { headers: { "Accept": "application/json" } });
          const wwwAuth = r1.headers.get("WWW-Authenticate") || "";

          // Parse digest params
          const realm   = (wwwAuth.match(/realm="([^"]+)"/)   || [])[1] || "";
          const nonce   = (wwwAuth.match(/nonce="([^"]+)"/)   || [])[1] || "";
          const qop     = (wwwAuth.match(/qop="([^"]+)"/)     || [])[1] || "auth";

          const uri     = new URL(url).pathname + new URL(url).search;
          const nc      = "00000001";
          const cnonce  = Math.random().toString(36).slice(2, 10);

          // MD5 helpers using SubtleCrypto (Cloudflare Workers support)
          async function md5(str) {
            const buf = new TextEncoder().encode(str);
            const hash = await crypto.subtle.digest("MD5", buf);
            return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
          }

          const ha1 = await md5(`${env.MONGO_PUBLIC_KEY}:${realm}:${env.MONGO_PRIVATE_KEY}`);
          const ha2 = await md5(`GET:${uri}`);
          const response = await md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);

          const authHeader = `Digest username="${env.MONGO_PUBLIC_KEY}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;

          const r2 = await fetch(url, {
            headers: { "Accept": "application/json", "Authorization": authHeader }
          });
          if (!r2.ok) {
            const txt = await r2.text();
            throw new Error(`MongoDB API ${r2.status}: ${txt.slice(0,200)}`);
          }
          return r2.json();
        }

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().split("T")[0];
        const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

        // Get invoices for current and previous month
        const [invoicesCurrent, invoicesPrev] = await Promise.all([
          mongoDigest(`https://cloud.mongodb.com/api/atlas/v2/orgs/${env.MONGO_ORG_ID}/invoices?fromDate=${thisMonthStart}&toDate=${now.toISOString().split("T")[0]}`),
          mongoDigest(`https://cloud.mongodb.com/api/atlas/v2/orgs/${env.MONGO_ORG_ID}/invoices?fromDate=${prevMonthStart}&toDate=${prevMonthEnd}`),
        ]);

        function summarizeInvoices(invoiceData) {
          const results = [];
          const invoices = invoiceData.results || [];
          for (const inv of invoices) {
            for (const lineItem of (inv.lineItems || [])) {
              const key = lineItem.groupName || lineItem.sku || "Unknown";
              const existing = results.find(r => r.service === key);
              const cost = (lineItem.totalPriceCents || 0) / 100;
              if (existing) existing.cost += cost;
              else results.push({ service: key, cost });
            }
          }
          return results.filter(r => r.cost > 0).sort((a,b) => b.cost - a.cost);
        }

        const current = summarizeInvoices(invoicesCurrent);
        const prev    = summarizeInvoices(invoicesPrev);
        const prevMap = {};
        prev.forEach(r => prevMap[r.service] = r.cost);

        const services = current.map(r => {
          const p      = prevMap[r.service] || 0;
          const change = p > 0 ? Math.round(((r.cost - p) / p) * 100) : null;
          return {
            service: r.service,
            current: Math.round(r.cost * 100) / 100,
            prev:    Math.round(p * 100) / 100,
            change,
            alert:   change !== null && change > 20,
          };
        });

        return new Response(JSON.stringify({
          services,
          totalCurrent: Math.round(current.reduce((s,r)=>s+r.cost,0) * 100) / 100,
          totalPrev:    Math.round(prev.reduce((s,r)=>s+r.cost,0) * 100) / 100,
          period: { current: `${thisMonthStart} → hoy`, prev: `${prevMonthStart} → ${prevMonthEnd}` },
        }), { headers: CORS(origin) });
      }


      // ── /webhook/mercury ─────────────────────────────────────────
      // Mercury hace GET para verificar el endpoint antes de activarlo
      if (path === "/webhook/mercury" && request.method === "GET") {
        return new Response(JSON.stringify({ ok: true, service: "SpicyTool Finance" }), { headers: CORS(origin) });
      }

      // Recibe transacciones nuevas desde Mercury webhooks
      if (path === "/webhook/mercury" && request.method === "POST") {
        if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
          return err("Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY", origin);
        }

        // Mercury sends empty POST for endpoint verification — return 200
        const contentLength = parseInt(request.headers.get("content-length") || "0");
        if (contentLength === 0) {
          return new Response(JSON.stringify({ ok: true }), { headers: CORS(origin) });
        }

        let body;
        try {
          const text = await request.text();
          if (!text || text.trim() === "") {
            return new Response(JSON.stringify({ ok: true }), { headers: CORS(origin) });
          }
          body = JSON.parse(text);
        } catch(e) {
          return new Response(JSON.stringify({ ok: true, skipped: "empty or invalid body" }), { headers: CORS(origin) });
        }

        // Mercury webhook format: { resourceType, operationType, resourceId, mergePatch: { amount, bankDescription, status, ... } }
        // Also support legacy: { data: { transaction: { id, amount, ... } } }
        let txn;
        if (body?.resourceType === "transaction" && body?.resourceId) {
          // New Mercury webhook format
          txn = {
            id:              body.resourceId,
            amount:          body.mergePatch?.amount,
            status:          body.mergePatch?.status || "sent",
            bankDescription: body.mergePatch?.bankDescription || "",
            counterpartyName:body.mergePatch?.counterpartyName || "",
            mercuryCategory: body.mergePatch?.mercuryCategory || "",
            category:        body.mergePatch?.category || "",
            createdAt:       body.occurredAt || new Date().toISOString(),
            postedAt:        body.mergePatch?.postedAt || body.occurredAt,
          };
        } else {
          // Legacy format
          txn = body?.data?.transaction || body?.transaction || body;
        }

        if (!txn || !txn.id) {
          return new Response(JSON.stringify({ ok: true, skipped: "no transaction data" }), { headers: CORS(origin) });
        }

        // Mercury webhooks siguen JSON Merge Patch: cada evento trae solo los campos
        // que cambiaron, no el objeto completo. Por eso NO alcanza con ignorar el
        // evento "pending" — ahí suele venir la descripción completa. Guardamos
        // también los eventos pending, y los eventos posteriores hacen UPDATE en vez
        // de INSERT, preservando lo que ya se guardó (descripción, categoría).
        const status = (txn.status || "").toLowerCase();
        if (status === "failed" || status === "cancelled") {
          return new Response(JSON.stringify({ ok: true, skipped: "status: " + status }), { headers: CORS(origin) });
        }

        // Detect internal transfers — register as "Movimiento Cuenta" instead of skipping
        const desc       = (txn.bankDescription || txn.description || txn.counterpartyName || "").toLowerCase();
        const mercuryCat = (txn.mercuryCategory || txn.merchantCategory || "").toLowerCase();
        const isTransfer = mercuryCat === "transfer" ||
          desc.includes("transfer between your mercury") ||
          desc.includes("mercury savings") ||
          desc.includes("mercury checking");

        const amount    = parseFloat(txn.amount) || 0;
        if (amount === 0) {
          return new Response(JSON.stringify({ ok: true, skipped: "zero amount" }), { headers: CORS(origin) });
        }

        const type      = amount > 0 ? "income" : "expense";
        const absAmount = Math.abs(amount);
        const rawDesc   = txn.bankDescription || txn.counterpartyName || txn.description || "";
        const date      = (txn.postedAt || txn.createdAt || new Date().toISOString()).split("T")[0];

        async function sbFetch(endpoint, options = {}) {
          const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${endpoint}`, {
            ...options,
            headers: {
              "apikey":        env.SUPABASE_SERVICE_KEY,
              "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
              "Content-Type":  "application/json",
              "Prefer":        options.prefer || "",
              ...(options.headers || {}),
            },
          });
          return res;
        }

        // ── Buscar si ya existe una fila para esta transacción (evento previo) ──
        let existingTxn = null;
        const existingRes = await sbFetch(`transactions?id=eq.${encodeURIComponent(txn.id)}&select=description,category`);
        if (existingRes.ok) {
          const rows = await existingRes.json();
          if (rows?.length > 0) existingTxn = rows[0];
        }

        // Preferir la descripción nueva (no vacía); si el patch no la trae, conservar la ya guardada
        const description = rawDesc || existingTxn?.description || "";

        // ── Categoría: reusar la ya guardada, o resolverla ────────────
        let category = existingTxn?.category || null;

        if (!category) {
          // Buscar categoría de una transacción previa con la misma descripción
          const descEncoded = encodeURIComponent(description);
          const lookupRes = await sbFetch(
            `transactions?description=ilike.*${descEncoded}*&type=eq.${type}&order=date.desc&limit=1&select=category`
          );
          if (lookupRes.ok) {
            const matches = await lookupRes.json();
            if (matches?.length > 0 && matches[0].category) category = matches[0].category;
          }
        }

        // Fallback a las reglas de auto-categorización
        if (!category) {
          if (isTransfer) {
            category = "Movimiento Cuenta";
          } else {
            const d  = description.toLowerCase();
            const mc = mercuryCat;
            const manualCat = (txn.category || "").toLowerCase();

            if (type === "income") {
              if (manualCat === "revenue" || d.includes("stripe") || d.includes("spicy house")) category = "SaaS MRR";
              else if (d.includes("invest") || d.includes("capital")) category = "Inversión";
              else category = "Otro ingreso";
            } else {
              if (mc === "payroll" || manualCat === "payroll" || manualCat === "employee benefits") category = "Salarios";
              else if (["franco cabrera","lucas escobedo","marcela c borner","payoneer"].some(n => d.includes(n))) category = "Salarios";
              else if (mc === "software" || manualCat === "software & subscriptions") category = "SaaS Tools";
              else if (["github","notion","openai","mongodb","google cloud","nango","make","n8n",
                        "mailersend","gupshup","brizy","asana","leomoves","cloudflare","anthropic",
                        "claude","kapso","vercel","aws"].some(t => d.includes(t))) category = "SaaS Tools";
              else if (mc === "advertising" || ["facebook","meta","cf*tks"].some(t => d.includes(t))) category = "Marketing / Ads";
              else if (mc === "financialinstitutionsandfees" || d.includes("intl. transaction fee")) category = "Legal / Admin";
              else if (["othertravel","groundtransportation","fuelandgas"].includes(mc)) category = "Viajes";
              else category = "Otro gasto";
            }
          }
        }

        // ── Guardar en Supabase: UPDATE si ya existía, INSERT si es nueva ──
        const record = {
          id:          txn.id,
          type,
          amount:      absAmount,
          description,
          category,
          date,
          source:      "mercury",
          account_id:  "mercury",
        };

        let writeRes;
        if (existingTxn) {
          writeRes = await sbFetch(`transactions?id=eq.${encodeURIComponent(txn.id)}`, {
            method: "PATCH",
            body:   JSON.stringify(record),
          });
        } else {
          writeRes = await sbFetch("transactions", {
            method:  "POST",
            prefer:  "resolution=ignore-duplicates",  // por si dos eventos llegan casi al mismo tiempo
            body:    JSON.stringify(record),
            headers: { "Prefer": "resolution=ignore-duplicates" },
          });
        }

        if (!writeRes.ok) {
          const errBody = await writeRes.text();
          if (writeRes.status === 409 || errBody.includes("duplicate")) {
            return new Response(JSON.stringify({ ok: true, skipped: "duplicate" }), { headers: CORS(origin) });
          }
          return err(`Supabase write error ${writeRes.status}: ${errBody}`, origin);
        }

        return new Response(JSON.stringify({
          ok: true,
          [existingTxn ? "updated" : "inserted"]: { id: record.id, type, amount: absAmount, category, date, description }
        }), { headers: CORS(origin) });
      }


      // ── /k8s ─────────────────────────────────────────────────────
      // Métricas de CPU y memoria de clusters AKS via Azure Monitor
      if (path === "/k8s") {
        if (!env.AZURE_CLIENT_ID || !env.AZURE_CLIENT_SECRET || !env.AZURE_TENANT_ID || !env.AZURE_SUBSCRIPTION_ID) {
          return err("Faltan credenciales de Azure", origin);
        }

        // Get access token
        const tokenRes = await fetch(
          `https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type:    "client_credentials",
              client_id:     env.AZURE_CLIENT_ID,
              client_secret: env.AZURE_CLIENT_SECRET,
              scope:         "https://management.azure.com/.default",
            }),
          }
        );
        if (!tokenRes.ok) return err("Azure auth error: " + tokenRes.status, origin);
        const { access_token } = await tokenRes.json();

        const headers = { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json" };
        const subId = env.AZURE_SUBSCRIPTION_ID;

        // List all AKS clusters in subscription
        const clustersRes = await fetch(
          `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.ContainerService/managedClusters?api-version=2024-02-01`,
          { headers }
        );
        if (!clustersRes.ok) {
          const txt = await clustersRes.text();
          return err(`AKS list error ${clustersRes.status}: ${txt.slice(0,200)}`, origin);
        }
        const { value: clusters = [] } = await clustersRes.json();

        // For each cluster get CPU and memory metrics (last 24h, hourly)
        const now = new Date();
        const endTime   = now.toISOString();
        const startTime = new Date(now - 24 * 60 * 60 * 1000).toISOString();

        async function getMetric(resourceId, metricName) {
          const url = `https://management.azure.com${resourceId}/providers/microsoft.insights/metrics?` +
            `api-version=2024-02-01&metricnames=${metricName}&aggregation=Average&interval=PT1H` +
            `&timespan=${startTime}/${endTime}`;
          const res = await fetch(url, { headers });
          if (!res.ok) return [];
          const data = await res.json();
          const timeseries = data.value?.[0]?.timeseries?.[0]?.data || [];
          return timeseries.map(p => Math.round((p.average || 0) * 10) / 10).filter((_, i) => i >= timeseries.length - 24);
        }

        const clusterData = await Promise.all(clusters.map(async cluster => {
          const resourceId = cluster.id;
          const rg = resourceId.split("/resourceGroups/")[1]?.split("/")[0] || "";

          // Get node count
          const nodeCount = cluster.properties?.agentPoolProfiles?.reduce((s, p) => s + (p.count || 0), 0) || 0;

          // CPU and memory metrics
          const [cpuHistory, memHistory] = await Promise.allSettled([
            getMetric(resourceId, "node_cpu_usage_percentage"),
            getMetric(resourceId, "node_memory_working_set_percentage"),
          ]);

          const cpuVals = cpuHistory.status === "fulfilled" ? cpuHistory.value : [];
          const memVals = memHistory.status === "fulfilled" ? memHistory.value : [];

          const cpuPercent = cpuVals.length > 0 ? cpuVals[cpuVals.length - 1] : 0;
          const memPercent = memVals.length > 0 ? memVals[memVals.length - 1] : 0;

          return {
            name:          cluster.name,
            resourceGroup: rg,
            location:      cluster.location,
            status:        cluster.properties?.powerState?.code || "Running",
            version:       cluster.properties?.kubernetesVersion || "—",
            nodeCount,
            podCount:      0, // requires kubectl, skip for now
            cpuPercent,
            memPercent,
            cpuHistory:    cpuVals,
            memHistory:    memVals,
            cpuAlert:      cpuPercent > 80,
            memAlert:      memPercent > 85,
          };
        }));

        return new Response(JSON.stringify({
          clusters: clusterData,
          alerts: clusterData.filter(c => c.cpuAlert || c.memAlert).length,
        }), { headers: CORS(origin) });
      }


      // ── POST /import ─────────────────────────────────────────────
      // Importa un array de transacciones directamente a Supabase
      if (path === "/import" && request.method === "POST") {
        if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
          return err("Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY", origin);
        }
        let records;
        try { records = await request.json(); }
        catch(e) { return err("Body inválido", origin, 400); }

        if (!Array.isArray(records)) return err("Se esperaba un array", origin, 400);

        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/transactions`, {
          method: "POST",
          headers: {
            "apikey":        env.SUPABASE_SERVICE_KEY,
            "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            "Content-Type":  "application/json",
            "Prefer":        "resolution=ignore-duplicates",
          },
          body: JSON.stringify(records),
        });

        if (!res.ok) {
          const e = await res.text();
          return err(`Supabase error ${res.status}: ${e}`, origin);
        }
        return new Response(JSON.stringify({ ok: true, imported: records.length }), { headers: CORS(origin) });
      }


      return err("Ruta no encontrada", origin, 404);

    } catch (e) {
      return err("Error interno: " + e.message, origin);
    }
  }
};
