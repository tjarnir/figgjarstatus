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

    // Bóksettar fakturur í tíðarskeiði
    if (path === "/api/invoices-period") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const compare = url.searchParams.get("compare") === "true";
      const curr = await fetchAll(`${BASE}/invoices/booked?skippages=0&pagesize=1000&filter=date$gte:${from}$and:date$lte:${to}`, env);
      const result = { current: { collection: curr } };
      if (compare) {
        const f2 = shiftYear(from, -1), t2 = shiftYear(to, -1);
        result.previous = { collection: await fetchAll(`${BASE}/invoices/booked?skippages=0&pagesize=1000&filter=date$gte:${f2}$and:date$lte:${t2}`, env) };
        result.periodInfo = { prevFrom: f2, prevTo: t2 };
      }
      return json(result);
    }

    // Allar bóksettar fakturur
    if (path === "/api/invoices-booked") {
      const data = await fetchAll(`${BASE}/invoices/booked?skippages=0&pagesize=1000`, env);
      return json({ collection: data });
    }

    // Utkast
    if (path === "/api/invoices-drafts")
      return json(await fetchE(`${BASE}/invoices/drafts?skippages=0&pagesize=100`, env));

    // Kundar
    if (path === "/api/customers")
      return json(await fetchE(`${BASE}/customers?skippages=0&pagesize=1000`, env));

    // Veitarar / supplier invoices
    if (path === "/api/supplier-invoices") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const compare = url.searchParams.get("compare") === "true";
      const filter = from && to ? `&filter=date$gte:${from}$and:date$lte:${to}` : "";
      const curr = await fetchAll(`${BASE}/supplier-invoices/booked?skippages=0&pagesize=1000${filter}`, env);
      const result = { collection: curr };
      if (compare && from && to) {
        const f2 = shiftYear(from, -1), t2 = shiftYear(to, -1);
        const prevFilter = `&filter=date$gte:${f2}$and:date$lte:${t2}`;
        result.previous = await fetchAll(`${BASE}/supplier-invoices/booked?skippages=0&pagesize=1000${prevFilter}`, env);
      }
      return json(result);
    }

    // Konti (accounts) - fyri rakstraruppgerð
    if (path === "/api/accounts")
      return json(await fetchE(`${BASE}/accounts?skippages=0&pagesize=1000`, env));

    // Bókanir á einum konti í tíðarskeiði
    if (path === "/api/account-entries") {
      const account = url.searchParams.get("account");
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      if (!account) return json({ error: "Manglar account" }, 400);
      const filter = from && to ? `&filter=date$gte:${from}$and:date$lte:${to}` : "";
      return json(await fetchE(`${BASE}/accounts/${account}/entries?skippages=0&pagesize=1000${filter}`, env));
    }

    // Allar bókanir í tíðarskeiði (entries across all accounts)
    if (path === "/api/entries") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const compare = url.searchParams.get("compare") === "true";
      const filter = from && to ? `&filter=date$gte:${from}$and:date$lte:${to}` : "";
      const curr = await fetchAll(`${BASE}/journals/entries/booked?skippages=0&pagesize=1000${filter}`, env);
      const result = { collection: curr };
      if (compare && from && to) {
        const f2 = shiftYear(from, -1), t2 = shiftYear(to, -1);
        result.previous = await fetchAll(`${BASE}/journals/entries/booked?skippages=0&pagesize=1000&filter=date$gte:${f2}$and:date$lte:${t2}`, env);
      }
      return json(result);
    }

    // Bankastøður
    if (path === "/api/bank-accounts")
      return json(await fetchE(`${BASE}/accounts?skippages=0&pagesize=1000&filter=accountType$eq:bankAccount`, env));

    return json({ error: "Endpoint ikki funnin: " + path }, 404);
  },
};

// Heinta allar síður automatiskt
async function fetchAll(url, env, page = 0, collected = []) {
  const separator = url.includes('?') ? '&' : '?';
  const pageUrl = `${url}${separator}skippages=${page}&pagesize=200`;
  const res = await fetchE(pageUrl, env);
  const items = res.collection || [];
  collected.push(...items);
  if (res.pagination?.nextPage) {
    return fetchAll(url.replace(/[?&]skippages=\d+&pagesize=\d+/, ''), env, page + 1, collected);
  }
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
    if (!res.ok) {
      const t = await res.text();
      return { error: `E-conomic villa ${res.status}`, detail: t, collection: [] };
    }
    return await res.json();
  } catch(e) {
    return { error: e.message, collection: [] };
  }
}

function shiftYear(d, y) {
  const dt = new Date(d); dt.setFullYear(dt.getFullYear() + y);
  return dt.toISOString().split("T")[0];
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}
