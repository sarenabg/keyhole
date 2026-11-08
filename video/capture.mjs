// Captures real screens of Keyhole for the videos and the submission, by clicking through the Demo.
// Run from video/: node capture.mjs [baseUrl] [outDir]
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.argv[2] ?? "https://keyhole-near.vercel.app";
const OUT = process.argv[3] ?? "shots";
fs.mkdirSync(OUT, { recursive: true });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function settle(page, ms = 700) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await pause(ms);
}

async function shot(page, name, opts = {}) {
  await page.screenshot({ path: `${OUT}/${name}.png`, ...opts });
  console.log(`${OUT}/${name}.png`);
}

async function el(page, selector, name) {
  const loc = page.locator(selector).first();
  await loc.scrollIntoViewIfNeeded();
  await pause(250);
  await loc.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`${OUT}/${name}.png`);
}

// The copy dialog shows "…" until the live NEAR Intents price arrives.
async function waitQuote(page) {
  await page.waitForFunction(() => {
    const d = document.querySelector('[role="dialog"]');
    return d && !d.textContent.includes("…") && d.textContent.includes("Live price from NEAR Intents");
  }, null, { timeout: 20000 }).catch(() => console.log("  (no live quote in time)"));
  await pause(500);
}

const browser = await chromium.launch();

// ---------- Desktop ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "kh_mode", value: "demo", url: BASE }]);
  const page = await ctx.newPage();

  await page.goto(`${BASE}/?p=90`);
  await settle(page);
  await shot(page, "d01_home");
  await shot(page, "d01_home_full", { fullPage: true });
  await el(page, 'a[href^="/t/maralin.near"]', "d01_card_mara");
  await el(page, 'section[aria-label="Traders"]', "d01_grid");

  await page.goto(`${BASE}/t/maralin.near?p=90`);
  await settle(page);
  await shot(page, "d02_trader");
  await el(page, "aside section", "d02_keycard");
  await page.locator("h2", { hasText: "Trades" }).scrollIntoViewIfNeeded();
  await pause(300);
  await shot(page, "d02_trader_locked");

  await page.locator("aside").getByRole("button", { name: "Get a key" }).click();
  await pause(900);
  await shot(page, "d03_buy");
  await el(page, '[role="dialog"]', "d03_buy_dialog");
  await page.getByRole("radio", { name: /90 days/ }).click();
  await pause(300);
  await el(page, '[role="dialog"]', "d03_buy_dialog_90");
  await page.getByRole("radio", { name: /30 days/ }).click();
  await page.getByRole("button", { name: /Pay 25 USDC/ }).click();
  await pause(500);
  await el(page, '[role="dialog"]', "d03_buy_paying");
  await page.getByText("You're in.").waitFor({ timeout: 20000 });
  await pause(500);
  await shot(page, "d04_youre_in");
  await el(page, '[role="dialog"]', "d04_youre_in_dialog");

  await page.goto(`${BASE}/t/maralin.near/trades`);
  await settle(page);
  await shot(page, "d05_trades");
  await el(page, 'section:has(> div > span:text("Live"))', "d05_feed");

  const copyBtn = page.getByRole("button", { name: "Copy", exact: true }).first();
  await copyBtn.click();
  await waitQuote(page);
  await shot(page, "d06_copy");
  await el(page, '[role="dialog"]', "d06_copy_dialog");
  await page.getByRole("radio", { name: /25%/ }).click();
  await pause(400);
  await waitQuote(page);
  await el(page, '[role="dialog"]', "d06_copy_dialog_25");
  await page.getByRole("radio", { name: /Same as/ }).click();
  await pause(1200);
  await page.getByRole("button", { name: "Copy trade" }).click();
  await page.getByText("Copied", { exact: true }).first().waitFor({ timeout: 20000 });
  await pause(500);
  await shot(page, "d07_copied");
  await el(page, '[role="dialog"]', "d07_copied_dialog");
  await page.getByRole("button", { name: "Back to trades" }).click();
  await pause(2500);
  await settle(page);
  await shot(page, "d08_trades_after");

  await page.getByRole("switch", { name: "Copy automatically" }).click();
  await pause(1500);
  await el(page, "aside section", "d08_autocopy_on");

  await page.goto(`${BASE}/keys`);
  await settle(page);
  await shot(page, "d09_keys");

  await page.goto(`${BASE}/sell`);
  await settle(page);
  await shot(page, "d10_sell");
  await shot(page, "d10_sell_full", { fullPage: true });

  await page.goto(`${BASE}/sell/start`);
  await settle(page);
  await shot(page, "d11_start");
  await page.getByRole("button", { name: "Connect demo wallet" }).click();
  await pause(400);
  await shot(page, "d11_start_2");
  await page.getByRole("button", { name: "Sign with wallet" }).click();
  await pause(1500);
  await shot(page, "d11_start_3");

  await page.goto(`${BASE}/how`);
  await settle(page);
  await shot(page, "d12_how");
  await shot(page, "d12_how_full", { fullPage: true });

  // Privacy proof: the API refuses trades without a key.
  const anon = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const p2 = await anon.newPage();
  await p2.goto(`${BASE}/api/traders/junovale.near/trades`);
  await pause(400);
  await shot(p2, "d13_api_403");
  await anon.close();
  await ctx.close();
}

// ---------- Phone ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addCookies([{ name: "kh_mode", value: "demo", url: BASE }]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`);
  await settle(page);
  await shot(page, "m01_home");
  await page.goto(`${BASE}/t/odin.near`);
  await settle(page);
  await shot(page, "m02_trader");
  await page.getByRole("button", { name: /Get a key/ }).last().click();
  await pause(900);
  await shot(page, "m03_buy");
  await page.getByRole("button", { name: /Pay 15 USDC/ }).click();
  await page.getByText("You're in.").waitFor({ timeout: 20000 });
  await pause(400);
  await shot(page, "m04_youre_in");
  await page.goto(`${BASE}/t/odin.near/trades`);
  await settle(page);
  await shot(page, "m05_trades");
  await page.getByRole("button", { name: "Copy", exact: true }).first().click();
  await waitQuote(page);
  await shot(page, "m06_copy");
  await ctx.close();
}

await browser.close();
console.log("done");
