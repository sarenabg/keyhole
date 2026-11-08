// Checks Live mode's wiring against the real NEAR Intents service, with throwaway keys made on the spot.
// Nothing is paid: it signs in (free), reads private balances (empty for a new key) and asks for a real
// one-time payment address, but never sends money to it.
// Needs the app running with KEYHOLE_LIVE=1. Run: node scripts/live-check.mjs
import crypto from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://localhost:3310";
const CRON_SECRET = process.env.CRON_SECRET;

let passed = 0;
function check(name, cond, detail = "") {
  if (!cond) {
    console.error(`✗ ${name}${detail ? ` (${detail})` : ""}`);
    process.exit(1);
  }
  passed++;
  console.log(`✓ ${name}`);
}

const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(buf) {
  let n = BigInt("0x" + (Buffer.from(buf).toString("hex") || "0"));
  let s = "";
  while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; }
  for (const b of buf) { if (b === 0) s = "1" + s; else break; }
  return s;
}

function wallet() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pub = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  return { pub, privateKey, solana: b58(pub), implicit: Buffer.from(pub).toString("hex") };
}

function client() {
  const jar = new Map([["kh_mode", "live"]]);
  return async function req(path, opts = {}) {
    const headers = { ...(opts.headers ?? {}), cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") };
    if (opts.json !== undefined) headers["content-type"] = "application/json";
    const res = await fetch(BASE + path, { method: opts.json !== undefined ? "POST" : "GET", headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined, redirect: "manual" });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, text, json };
  };
}

// Solana-style wallet (raw ed25519 over the text).
async function signInSolana(req, w, role) {
  const s = await req("/api/auth/start", { json: { kind: "solana", who: w.solana } });
  if (s.status !== 200) return s;
  const sig = crypto.sign(null, Buffer.from(s.json.text), w.privateKey);
  return req("/api/auth/verify", { json: { role, result: { kind: "solana", text: s.json.text, publicKey: s.json.publicKey, signature: b58(sig) } } });
}

// NEAR wallet (NEP-413) for an implicit account, signed the way NEAR wallets do.
async function signInNear(req, w, role) {
  const s = await req("/api/auth/start", { json: { kind: "near", who: w.implicit } });
  if (s.status !== 200) return s;
  const { message, nonce, recipient } = s.json.nep413;
  const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
  const str = (x) => { const b = Buffer.from(x, "utf8"); return Buffer.concat([u32(b.length), b]); };
  const payload = Buffer.concat([u32(2 ** 31 + 413), str(message), Buffer.from(nonce, "base64"), str(recipient), Buffer.from([0])]);
  const hash = crypto.createHash("sha256").update(payload).digest();
  const sig = crypto.sign(null, hash, w.privateKey);
  return req("/api/auth/verify", { json: { role, result: { kind: "near", message, nonce, recipient, publicKey: `ed25519:${w.solana}`, signature: sig.toString("base64") } } });
}

try {
  await fetch(BASE);
} catch {
  console.error(`✗ The app isn't running at ${BASE}. Start it with KEYHOLE_LIVE=1: npm run dev`);
  process.exit(1);
}

const trader = client();
const viewer = client();
const stranger = client();

const mode = await trader("/api/mode", { json: { mode: "live" } });
if (mode.status === 409) {
  console.log("– Live mode is off on this server (KEYHOLE_LIVE is not 1). Skipping live checks.");
  process.exit(0);
}
check("live mode switches on", mode.status === 200);
const home = await trader("/");
check("live pages say real money", home.text.includes("payments use real money"));

// A trader proves their record with a NEAR wallet (NEP-413).
const tw = wallet();
const t = await signInNear(trader, tw, "trader");
check("trader signs in with a NEAR wallet, checked by NEAR Intents", t.status === 200 && t.json.id === tw.implicit, JSON.stringify(t.json));
check("a wrong signature is refused", (await trader("/api/auth/verify", { json: { role: "viewer", result: { kind: "solana", text: '{"signer_id":"00","verifying_contract":"intents.near","deadline":"2026-01-01T00:00:00Z","nonce":"x","intents":[]}', publicKey: `ed25519:${tw.solana}`, signature: "1111" } } })).status === 401);

const settings = await trader("/api/live/seller", { json: { name: "Check bot", prices: [2, 5, 12], maxKeys: 50, allowCopy: true, listed: true } });
check("trader sets prices and lists", settings.status === 200, JSON.stringify(settings.json));
check("silly prices are refused", (await trader("/api/live/seller", { json: { prices: [0, 5, 12] } })).status === 400);
const read = await trader("/api/live/seller", { json: { refresh: true } });
check("private balances read from NEAR Intents", read.status === 200);
const sell = await trader("/sell");
check("earnings page shows for the trader", sell.status === 200 && sell.text.includes("Your earnings") && sell.text.includes("Your record is live"));
const own = await trader(`/api/traders/${tw.implicit}/trades`);
check("a trader sees their own trades", own.status === 200);

const list = await stranger("/api/traders");
check("listed trader appears in Live mode", list.json.mode === "live" && list.json.traders.some((x) => x.id === tw.implicit));

// A follower signs in with a Solana-style wallet.
const vw = wallet();
const v = await signInSolana(viewer, vw, "viewer");
check("follower signs in with a Solana wallet, checked by NEAR Intents", v.status === 200 && v.json.id === vw.implicit, JSON.stringify(v.json));
check("no key, no trades (403)", (await viewer(`/api/traders/${tw.implicit}/trades`)).status === 403);
check("signed-out visitors can't buy", (await stranger("/api/live/keys", { json: { trader: tw.implicit, days: 7, asset: "x" } })).status === 401);
check("you can't buy your own key", (await trader("/api/live/keys", { json: { trader: tw.implicit, days: 7, asset: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1" } })).status === 400);

// Real payment address for a key (nothing is sent to it).
const coins = await viewer("/api/coins");
check("coin list is live from NEAR Intents", coins.json.coins.length > 50, String(coins.json.coins.length));
const usdcBase = coins.json.coins.find((c) => c.symbol === "USDC").places.find((p) => p.chain === "base") ?? coins.json.coins.find((c) => c.symbol === "USDC").places[0];
const buy = await viewer("/api/live/keys", { json: { trader: tw.implicit, days: 7, asset: usdcBase.assetId } });
check("real NEAR Intents payment address for a 2 USDC key", buy.status === 200 && buy.json.depositAddress && Number(buy.json.amountIn) >= 2, JSON.stringify(buy.json));
console.log(`  (send ${buy.json.amountIn} ${buy.json.symbol} on ${buy.json.chain} → ${buy.json.depositAddress}; not sent)`);
const buyAgain = await viewer("/api/live/keys", { json: { trader: tw.implicit, days: 7, asset: usdcBase.assetId } });
check("asking again within a minute reuses the same payment address", buyAgain.json.depositAddress === buy.json.depositAddress && buyAgain.json.id === buy.json.id);
const status = await viewer(`/api/live/keys/${buy.json.id}`);
check("payment status is tracked (waiting)", status.status === 200 && status.json.state === "waiting", JSON.stringify(status.json));
check("someone else can't read your payment", (await stranger(`/api/live/keys/${buy.json.id}`)).status === 401);

// The scheduler endpoint is locked.
check("record refresher needs its secret", (await stranger("/api/cron/snapshot")).status === 401);
if (CRON_SECRET) {
  const cron = await fetch(`${BASE}/api/cron/snapshot`, { headers: { authorization: `Bearer ${CRON_SECRET}` } }).then((r) => r.json());
  check("record refresher runs with its secret", typeof cron.read === "number", JSON.stringify(cron));
}

// Tidy up: take the check trader off the list.
await trader("/api/live/seller", { json: { listed: false } });
check("check trader unlisted again", !(await stranger("/api/traders")).json.traders.some((x) => x.id === tw.implicit));

await trader("/api/auth/signout", { json: {} });
check("sign out works", (await trader("/sell")).text.includes("Prove your record"));

console.log(`\n✓ all ${passed} live checks passed (no money moved)`);
