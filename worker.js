const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const BASE = "https://restapi.e-conomic.com";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/health") return json({ ok: true });

    if (path === "/api/invoices-period") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const compare = url.searchParams.get("compare") === "true";
      const curr = await fetchAll(`${BASE}/invoices/booked?filter=date$gte:${from}$and:date$lte:${to}`, env);
      const result = { current: { collection: curr } };
      if (compare) {
        const f2 = shiftYear(from, -1), t2 = shiftYear(to, -1);
        result.previous = { collection: await fetchAll(`${BASE}/invoices/booked?filter=date$gte:${f2}$and:date$lte:${t2}`, env) };
      }
      return json(result);
    }

    if (path === "/api/invoices-booked")
      return json({ collection: await fetchAll(`${BASE}/invoices/booked`, env) });

    if (path === "/api/invoices-drafts")
      return json(await fetchE(`${BASE}/invoices/drafts?skippages=0&pagesize=100`, env));

    if (path === "/api/customers")
      return json(await fetchE(`${BASE}/customers?skippages=0&pagesize=1000`, env));

    if (path === "/api/supplier-invoices") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const compare = url.searchParams.get("compare") === "true";
      const filter = from && to ? `&filter=date$gte:${from}$and:date$lte:${to}` : "";
      const curr = await fetchAll(`${BASE}/supplier-invoices/booked?${filter}`, env);
      const result = { collection: curr };
      if (compare && from && to) {
        const f2 = shiftYear(from, -1), t2 = shiftYear(to, -1);
        result.previous = await fetchAll(`${BASE}/supplier-invoices/booked?filter=date$gte:${f2}$and:date$lte:${t2}`, env);
      }
      return json(result);
    }

    if (path === "/api/accounts")
      return json(await fetchE(`${BASE}/accounts?skippages=0&pagesize=1000`, env));

    return json({ error: "Endpoint ikki funnin: " + path }, 404);
  },
};

async function fetchAll(baseUrl, env, page = 0, collected = []) {
  const sep = baseUrl.includes('?') ? '&' : '?';
  const res = await fetchE(`${baseUrl}${sep}skippages=${page}&pagesize=200`, env);
  const items = res.collection || [];
  collected.push(...items);
  if (res.pagination?.nextPage) return fetchAll(baseUrl, env, page + 1, collected);
  return collected;
}

async function fetchE(url, env) {
  try {
    const res = await fetch(url, {
      headers: {
        "X-AppSecretToken": env.APP_SECRET_TOKEN,
        "X-AgreementGrantToken": env.AGREEMENT_GRANT_TOKEN,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) { const t = await res.text(); return { error: `Villa ${res.status}`, detail: t, collection: [] }; }
    return await res.json();
  } catch(e) { return { error: e.message, collection: [] }; }
}

function shiftYear(d, y) {
  const dt = new Date(d); dt.setFullYear(dt.getFullYear() + y);
  return dt.toISOString().split("T")[0];
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}
