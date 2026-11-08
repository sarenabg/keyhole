import { chromium } from "playwright";
const BASE = process.argv[2] ?? "http://localhost:3310";
const OUT = process.argv[3];
const b = await chromium.launch();
for (const [size, opts] of [["d", { viewport: { width: 1440, height: 900 } }], ["m", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const ctx = await b.newContext(opts);
  await ctx.addCookies([{ name: "kh_mode", value: "demo", url: BASE }]);
  const p = await ctx.newPage();
  const shot = async (name, full = true) => { await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/${size}_${name}.png`, fullPage: full }); };
  for (const [n, path] of [["home", "/"], ["trader", "/t/maralin.near"], ["loser", "/t/rheaq.near"], ["locked", "/t/junovale.near/trades"], ["keys_empty", "/keys"], ["sell", "/sell"], ["start", "/sell/start"], ["how", "/how"]]) { await p.goto(BASE + path, { waitUntil: "networkidle" }); await shot(n); }
  await p.goto(BASE + "/t/maralin.near", { waitUntil: "networkidle" });
  await (size === "m" ? p.getByRole("button", { name: /Get a key/ }).last() : p.locator("aside").getByRole("button", { name: "Get a key" })).click();
  await shot("buy", false);
  await p.getByRole("button", { name: /^Pay / }).click(); await p.getByText("You're in.").waitFor(); await shot("in", false);
  await p.goto(BASE + "/t/maralin.near/trades", { waitUntil: "networkidle" }); await shot("trades");
  await p.getByRole("button", { name: "Copy", exact: true }).first().click();
  await p.waitForFunction(() => !document.querySelector('[role="dialog"]')?.textContent?.includes("…"), null, { timeout: 15000 }).catch(() => {});
  await shot("copy", false);
  await p.getByRole("button", { name: "Copy trade" }).click(); await p.getByText("Copied", { exact: true }).first().waitFor(); await shot("copied", false);
  await p.getByRole("button", { name: "Back to trades" }).click(); await p.waitForTimeout(1500);
  await p.goto(BASE + "/keys", { waitUntil: "networkidle" }); await shot("keys");
  await ctx.close();
}
await b.close();
