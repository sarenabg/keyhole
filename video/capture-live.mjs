// Captures real Live-mode screens (NEAR mainnet wiring) from a local app with KEYHOLE_LIVE=1.
// Uses throwaway keys made on the spot to sign in through NEAR Intents. Nothing is paid.
// Run from video/: node capture-live.mjs [baseUrl] [outDir]
import { chromium } from "playwright";
import crypto from "node:crypto";
import fs from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3310";
const OUT = process.argv[3] ?? "shots";
fs.mkdirSync(OUT, { recursive: true });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const b58 = (buf) => { let n = BigInt("0x" + Buffer.from(buf).toString("hex")); let s = ""; while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; } return s; };

async function signIn(request, role) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pub = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const s = await (await request.post(`${BASE}/api/auth/start`, { data: { kind: "solana", who: b58(pub) } })).json();
  const sig = crypto.sign(null, Buffer.from(s.text), privateKey);
  const v = await request.post(`${BASE}/api/auth/verify`, { data: { role, result: { kind: "solana", text: s.text, publicKey: s.publicKey, signature: b58(sig) } } });
  if (!v.ok()) throw new Error(`sign-in failed: ${await v.text()}`);
  return (await v.json()).id;
}

async function shot(page, name, opts = {}) { await page.screenshot({ path: `${OUT}/${name}.png`, ...opts }); console.log(`${OUT}/${name}.png`); }
async function settle(page) { await page.waitForLoadState("networkidle").catch(() => {}); await page.evaluate(() => document.fonts.ready); await pause(600); }

const browser = await chromium.launch();
const opts = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };

// A trader lists themselves (throwaway key).
const tctx = await browser.newContext(opts);
await tctx.addCookies([{ name: "kh_mode", value: "live", url: BASE }]);
const traderId = await signIn(tctx.request, "trader");
await tctx.request.post(`${BASE}/api/live/seller`, { data: { name: "Ava (live test)", prices: [2, 5, 12], maxKeys: 50, allowCopy: true, listed: true } });
const tp = await tctx.newPage();
await tp.goto(`${BASE}/sell`); await settle(tp);
await shot(tp, "l04_sell_live");

// A visitor in Live mode.
const ctx = await browser.newContext(opts);
await ctx.addCookies([{ name: "kh_mode", value: "live", url: BASE }]);
const page = await ctx.newPage();
await page.goto(`${BASE}/`); await settle(page);
await shot(page, "l01_home_live");
await page.getByRole("button", { name: "Sign in" }).click(); await pause(700);
await shot(page, "l02_signin");
await page.keyboard.press("Escape"); await pause(300);

await signIn(ctx.request, "viewer");
await page.goto(`${BASE}/t/${traderId}`); await settle(page);
await page.locator("aside").getByRole("button", { name: "Get a key" }).click(); await pause(1500);
await page.getByRole("radio", { name: /7 days/ }).click(); await pause(300);
await shot(page, "l03_buy_live");
await page.getByRole("button", { name: "Continue" }).click();
await page.getByText("Send exactly").waitFor({ timeout: 30000 }); await pause(1200);
await shot(page, "l05_pay_address");
await page.locator('[role="dialog"]').screenshot({ path: `${OUT}/l05_pay_dialog.png` }); console.log(`${OUT}/l05_pay_dialog.png`);

// Tidy up: unlist the test trader.
await tctx.request.post(`${BASE}/api/live/seller`, { data: { listed: false } });
await browser.close();
console.log("done (no money moved)");
