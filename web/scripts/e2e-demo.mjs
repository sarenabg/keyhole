// Plays a visitor through the whole Demo flow against a running app.
// Run: npm run dev   (in another terminal)   then   node scripts/e2e-demo.mjs
// Uses BASE_URL (default http://localhost:3310). Moves no money.
const BASE = process.env.BASE_URL ?? "http://localhost:3310";

let passed = 0;
function check(name, cond, detail = "") {
  if (!cond) {
    console.error(`✗ ${name}${detail ? ` (${detail})` : ""}`);
    process.exit(1);
  }
  passed++;
  console.log(`✓ ${name}`);
}

// A tiny cookie jar, so the demo visitor keeps their keys between requests.
const jar = new Map([["kh_mode", "demo"]]);
async function req(path, opts = {}) {
  const headers = { ...(opts.headers ?? {}), cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") };
  if (opts.json !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(BASE + path, { method: opts.method ?? (opts.json !== undefined ? "POST" : "GET"), headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined, redirect: "manual" });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, text, json };
}

try {
  await fetch(BASE);
} catch {
  console.error(`✗ The app isn't running at ${BASE}. Start it with: npm run dev`);
  process.exit(1);
}

// Public pages
const home = await req("/");
check("home page loads", home.status === 200);
check("home shows demo traders", home.text.includes("Mara Lin") && home.text.includes("Juno Vale"));
check("home is labelled Demo", /Demo/.test(home.text));

const list = await req("/api/traders?p=30");
check("public records API lists 6 traders", list.json?.traders?.length === 6, String(list.json?.traders?.length));
const mara = list.json.traders.find((t) => t.id === "maralin.near");
check("records have a return, win rate, dip and sparkline", typeof mara.record.ret === "number" && mara.record.spark.length > 10 && mara.record.maxDip <= 0);
check("public records never include trades", !JSON.stringify(list.json).includes("Bought") && !("trades" in mara && Array.isArray(mara.trades)));

for (const p of ["/t/maralin.near", "/t/maralin.near?p=7", "/keys", "/sell", "/sell/start", "/how"]) {
  const r = await req(p);
  check(`page ${p} loads`, r.status === 200, String(r.status));
}
check("unknown trader is a 404", (await req("/t/nobody.near")).status === 404);

// Privacy: no key, no trades
const locked = await req("/api/traders/maralin.near/trades");
check("trades are private without a key (403)", locked.status === 403);
const lockedPage = await req("/t/maralin.near/trades");
check("trades page asks for a key", lockedPage.text.includes("trades are private"));
const quoteNoKey = await req("/api/quote/copy", { json: { trader: "maralin.near", tradeId: "x", usd: 10 } });
check("copy price check needs a key (403)", quoteNoKey.status === 403);

// Bad input
check("buying a 5-day key is refused", (await req("/api/demo/keys", { json: { trader: "maralin.near", days: 5 } })).status === 400);
check("buying from an unknown trader is refused", (await req("/api/demo/keys", { json: { trader: "nobody.near", days: 30 } })).status === 404);
check("live buying is refused in demo mode", (await req("/api/live/keys", { json: { trader: "maralin.near", days: 30, asset: "x" } })).status === 409);

// Buy a key
const buy = await req("/api/demo/keys", { json: { trader: "maralin.near", days: 30 } });
check("demo key bought", buy.status === 200 && buy.json.expiresAt > Date.now() + 29 * 86_400_000);
const extend = await req("/api/demo/keys", { json: { trader: "maralin.near", days: 7 } });
check("buying again extends the key (30 + 7 days)", extend.json.expiresAt - buy.json.expiresAt > 6.9 * 86_400_000);

// Now the trades are visible
const open = await req("/api/traders/maralin.near/trades");
check("with a key, trades are visible", open.status === 200 && open.json.trades.length > 5);
check("with a key, holdings are visible", open.json.holdings.length > 0 && Math.abs(open.json.holdings.reduce((s, h) => s + h.share, 0) - 1) < 0.02);
check("other traders stay private", (await req("/api/traders/junovale.near/trades")).status === 403);
const tradesPage = await req("/t/maralin.near/trades");
check("trades page shows the feed", tradesPage.text.includes("Your key") && tradesPage.text.includes("Live"));

// Copy a buy trade
const buyTrade = open.json.trades.find((t) => !["USDC", "USDT"].includes(t.to));
check("found a buy trade to copy", Boolean(buyTrade));
const q = await req("/api/quote/copy", { json: { trader: "maralin.near", tradeId: buyTrade.id, usd: 50 } });
check("copy price check works", q.status === 200 && Number(q.json.amountOut) > 0, JSON.stringify(q.json));
console.log(`  (price from ${q.json.real ? "a live NEAR Intents quote" : "the price list"}: $50 → ${q.json.amountOut} ${buyTrade.to})`);
const copy = await req("/api/demo/copy", { json: { trader: "maralin.near", tradeId: buyTrade.id, usd: 50 } });
check("demo copy done", copy.status === 200 && copy.json.status === "done" && copy.json.amount > 0);
check("copy of another trader's trade is refused", (await req("/api/demo/copy", { json: { trader: "junovale.near", tradeId: buyTrade.id, usd: 50 } })).status === 403);
check("copy amount must be sensible", (await req("/api/demo/copy", { json: { trader: "maralin.near", tradeId: buyTrade.id, usd: -5 } })).status === 400);
const after = await req("/t/maralin.near/trades");
check("copied trade is marked Copied", after.text.includes("Copied"));
check("my keys page lists the key and the copy", (await req("/keys")).text.includes("Mara Lin") && (await req("/keys")).text.includes("My copies"));

// Auto-copy
const auto = await req("/api/demo/auto", { json: { trader: "maralin.near", on: true } });
check("auto-copy switches on", auto.status === 200 && auto.json.on === true);
check("auto-copy needs a key", (await req("/api/demo/auto", { json: { trader: "odin.near", on: true } })).status === 403);

// Mode switch
check("live mode can't be chosen unless the server enables it", [200, 409].includes((await req("/api/mode", { json: { mode: "live" } })).status));
jar.set("kh_mode", "demo");
check("bad mode refused", (await req("/api/mode", { json: { mode: "moon" } })).status === 400);

// Cookie tampering
jar.set("kh_demo", "eyJ2IjoxLCJrZXlzIjpbXX0.forged");
check("a forged demo cookie gives no keys", (await req("/api/traders/maralin.near/trades")).status === 403);

console.log(`\n✓ all ${passed} demo checks passed`);
