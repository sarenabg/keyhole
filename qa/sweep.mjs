// QA sweep: walks every page and flow of Keyhole like a first-time visitor, at desktop and phone size,
// in Demo and Live mode, and reports problems. Moves no money (Live uses throwaway keys and never pays).
// Run (app running): node qa/sweep.mjs [baseUrl]
import { chromium } from "playwright";
import crypto from "node:crypto";

const BASE = process.argv[2] ?? "http://localhost:3310";
const SIZES = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };
const issues = [];
const links = new Set();
const timings = [];
const note = (where, what) => { issues.push(`${where}: ${what}`); };

const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const b58 = (buf) => { let n = BigInt("0x" + Buffer.from(buf).toString("hex")); let s = ""; while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; } return s; };
async function signIn(request, role) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pub = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const s = await (await request.post(`${BASE}/api/auth/start`, { data: { kind: "solana", who: b58(pub) } })).json();
  const sig = crypto.sign(null, Buffer.from(s.text), privateKey);
  const v = await request.post(`${BASE}/api/auth/verify`, { data: { role, result: { kind: "solana", text: s.text, publicKey: s.publicKey, signature: b58(sig) } } });
  if (!v.ok()) throw new Error(`sign-in failed ${await v.text()}`);
  return (await v.json()).id;
}

// Checks run on every page view.
async function audit(page, where) {
  const r = await page.evaluate(() => {
    const out = { overflowX: 0, offscreen: [], unnamed: [], noAlt: 0, unlabeled: [], links: [], smallText: [], lowContrast: [] };
    const doc = document.documentElement;
    out.overflowX = doc.scrollWidth - doc.clientWidth;
    const vw = doc.clientWidth;
    const inScroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 2) return true; } return false; };
    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" || cs.visibility === "hidden") continue;
      if ((rect.right > vw + 1 || rect.left < -1) && !inScroller(el)) out.offscreen.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} [${Math.round(rect.left)}..${Math.round(rect.right)}]`);
      // text that is cut off without an ellipsis
      if (el.children.length === 0 && el.textContent.trim() && el.scrollWidth > el.clientWidth + 1 && cs.overflow === "hidden" && cs.textOverflow !== "ellipsis") out.offscreen.push(`clipped text: "${el.textContent.trim().slice(0, 30)}"`);
    }
    for (const el of document.querySelectorAll("button, a[href], [role=button], [role=switch], [role=radio]")) {
      const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "").trim();
      if (!name) out.unnamed.push(el.outerHTML.slice(0, 80));
    }
    for (const img of document.querySelectorAll("img")) if (!img.hasAttribute("alt")) out.noAlt++;
    for (const inp of document.querySelectorAll("input, select, textarea")) {
      const id = inp.id; const labelled = inp.getAttribute("aria-label") || (id && document.querySelector(`label[for="${id}"]`)) || inp.closest("label");
      if (!labelled) out.unlabeled.push(inp.outerHTML.slice(0, 80));
    }
    for (const a of document.querySelectorAll("a[href]")) out.links.push(a.getAttribute("href"));
    // tiny text
    for (const el of document.querySelectorAll("body *")) {
      if (el.children.length || !el.textContent.trim()) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 11) out.smallText.push(`${fs}px "${el.textContent.trim().slice(0, 24)}"`);
    }
    return out;
  });
  if (r.overflowX > 1) note(where, `page scrolls sideways by ${r.overflowX}px`);
  for (const o of [...new Set(r.offscreen)].slice(0, 5)) note(where, `off-screen/cut: ${o}`);
  for (const u of r.unnamed.slice(0, 5)) note(where, `control without a name: ${u}`);
  if (r.noAlt) note(where, `${r.noAlt} image(s) without alt`);
  for (const u of r.unlabeled.slice(0, 5)) note(where, `input without a label: ${u}`);
  for (const s of [...new Set(r.smallText)].slice(0, 3)) note(where, `very small text: ${s}`);
  for (const l of r.links) if (l.startsWith("/")) links.add(l.split("#")[0]);
}

function watch(page, where) {
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    // a 404 page legitimately logs its own 404
    if (/status of 404/.test(m.text()) && /nobody/.test(where())) return;
    note(where(), `console ${m.type()}: ${m.text().slice(0, 160)}`);
  });
  page.on("pageerror", (e) => note(where(), `page error: ${e.message.slice(0, 160)}`));
  page.on("response", (res) => {
    const s = res.status();
    const u = res.url();
    if (s >= 400 && !u.includes("/trades") && !/\/t\/nobody/.test(u) && !u.includes("favicon")) note(where(), `HTTP ${s} ${u.replace(BASE, "")}`);
  });
  page.on("requestfailed", (r) => { if (!/_rsc|webpack|hot-update|__nextjs/.test(r.url())) note(where(), `request failed: ${r.url().replace(BASE, "")} ${r.failure()?.errorText}`); });
}

async function visit(page, path, where) {
  const t0 = Date.now();
  const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
  const ms = Date.now() - t0;
  timings.push([`${where} ${path}`, ms]);
  if (ms > 4000) note(where, `${path} slow: ${ms} ms`);
  await page.evaluate(() => document.fonts.ready);
  await audit(page, `${where} ${path}`);
  return res;
}

const browser = await chromium.launch();
let current = "";
for (const [size, opts] of Object.entries(SIZES)) {
  // ---------------- Demo, first-time visitor ----------------
  const ctx = await browser.newContext(opts);
  await ctx.addCookies([{ name: "kh_mode", value: "demo", url: BASE }]);
  const page = await ctx.newPage();
  watch(page, () => current);
  const W = `[demo ${size}]`;
  for (const p of ["/", "/?p=7", "/?p=30", "/t/maralin.near", "/t/rheaq.near?p=7", "/t/junovale.near/trades", "/keys", "/sell", "/sell/start", "/how", "/wallet-done", "/t/nobody.near"]) {
    current = `${W} ${p}`;
    const res = await visit(page, p, W);
    if (p !== "/t/nobody.near" && res.status() !== 200) note(current, `status ${res.status()}`);
  }
  // Buy a key through the UI
  current = `${W} buy key`;
  await visit(page, "/t/odin.near", W);
  const getKey = size === "phone" ? page.getByRole("button", { name: /Get a key/ }).last() : page.locator("aside").getByRole("button", { name: "Get a key" });
  await getKey.click();
  await page.getByRole("dialog").waitFor();
  await audit(page, `${W} buy dialog`);
  // arrow keys move the plan choice and focus follows
  await page.getByRole("radio", { checked: true }).focus();
  await page.keyboard.press("ArrowDown");
  const picked = await page.getByRole("radio", { checked: true }).textContent();
  const focusOk = await page.evaluate(() => document.activeElement?.getAttribute("aria-checked") === "true");
  if (!/90 days/.test(picked ?? "") || !focusOk) note(current, `arrow keys in the plan list: picked "${picked}", focus on choice ${focusOk}`);
  await page.keyboard.press("ArrowUp");
  // Tab stays inside the dialog
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  if (!(await page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement)))) note(current, "Tab left the open dialog");
  // Escape closes and puts focus back on the button that opened it; Enter opens it again
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  if (!(await getKey.evaluate((el) => document.activeElement === el))) note(current, "after closing the dialog, focus didn't return to the button that opened it");
  await getKey.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  // double click on Pay must buy only once
  const pay = page.getByRole("button", { name: /^Pay / });
  await pay.dblclick();
  await page.getByText("You're in.").waitFor({ timeout: 15000 });
  await audit(page, `${W} you're in`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  const keys = await (await page.request.get(`${BASE}/keys`)).text();
  if (!keys.includes("Odin Park")) note(current, "key not listed on My keys after buying");
  // Trades + copy
  current = `${W} trades`;
  await visit(page, "/t/odin.near/trades", W);
  const copyBtn = page.getByRole("button", { name: "Copy", exact: true }).first();
  if (await copyBtn.count()) {
    await copyBtn.click();
    await page.getByRole("dialog").waitFor();
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]')?.textContent?.includes("…"), null, { timeout: 15000 }).catch(() => note(current, "copy price never loaded"));
    await audit(page, `${W} copy dialog`);
    await page.getByRole("button", { name: "Copy trade" }).dblclick();
    await page.getByText("Copied", { exact: true }).first().waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: "Back to trades" }).click();
    await page.waitForTimeout(1500);
    const copiedCount = await page.getByText("Copied", { exact: true }).count();
    if (copiedCount < 1) note(current, "copied trade not marked");
    const kp = await ctx.newPage();
    await kp.goto(`${BASE}/keys`, { waitUntil: "networkidle" });
    const n = await kp.locator("main").getByText("Done", { exact: true }).count();
    await kp.close();
    if (n > 1) note(current, `double click made ${n} copies`);
  } else note(current, "no Copy button on trades page");
  // Refresh mid-flow: open buy dialog, reload
  current = `${W} refresh mid-flow`;
  await visit(page, "/t/sable.near", W);
  await (size === "phone" ? page.getByRole("button", { name: /Get a key/ }).last() : page.locator("aside").getByRole("button", { name: "Get a key" })).click();
  await page.reload({ waitUntil: "networkidle" });
  if (await page.getByRole("dialog").count()) note(current, "dialog still open after reload");
  // Onboarding flow
  current = `${W} onboarding`;
  await visit(page, "/sell/start", W);
  await page.getByRole("button", { name: "Connect demo wallet" }).click();
  await page.getByRole("button", { name: "Sign with wallet" }).click();
  await page.getByRole("button", { name: "Start selling" }).waitFor({ timeout: 5000 });
  await audit(page, `${W} onboarding step 3`);
  await page.getByRole("button", { name: "Start selling" }).click();
  await page.waitForURL(/\/sell$/, { timeout: 8000 }).catch(() => note(current, "Start selling did not go to /sell"));
  await ctx.close();

  // ---------------- Live (throwaway keys, no money) ----------------
  const lctx = await browser.newContext(opts);
  await lctx.addCookies([{ name: "kh_mode", value: "live", url: BASE }]);
  const lp = await lctx.newPage();
  watch(lp, () => current);
  const L = `[live ${size}]`;
  for (const p of ["/", "/keys", "/sell", "/how"]) { current = `${L} ${p}`; await visit(lp, p, L); }
  current = `${L} sign-in dialog`;
  await visit(lp, "/", L);
  await lp.getByRole("button", { name: "Sign in" }).first().click();
  await lp.getByRole("dialog").waitFor();
  await lp.waitForTimeout(400); // let the opening animation finish
  const box = await lp.getByRole("dialog").boundingBox();
  const vh = opts.viewport.height;
  if (!box || box.y < 0 || box.y + box.height > vh + 1) note(current, `sign-in dialog not fully on screen (${JSON.stringify(box)})`);
  await audit(lp, `${L} sign-in dialog`);
  await lp.getByRole("button", { name: /NEAR wallet/ }).click();
  await audit(lp, `${L} NEAR account form`);
  // typing must keep focus in the field (a dialog that re-focuses itself on every change breaks this)
  const acc = lp.getByLabel("Your NEAR account");
  await acc.fill("");
  await acc.pressSequentially("alice.near", { delay: 20 });
  const typed = await acc.inputValue();
  const stillFocused = await acc.evaluate((el) => document.activeElement === el);
  if (typed !== "alice.near" || !stillFocused) note(current, `typing in the NEAR account field broke (value "${typed}", focused ${stillFocused})`);
  await lp.keyboard.press("Escape");

  const tctx = await browser.newContext(opts);
  await tctx.addCookies([{ name: "kh_mode", value: "live", url: BASE }]);
  const traderId = await signIn(tctx.request, "trader");
  await tctx.request.post(`${BASE}/api/live/seller`, { data: { name: `QA trader ${size}`, prices: [2, 5, 12], listed: true } });
  const tp = await tctx.newPage();
  watch(tp, () => current);
  for (const p of ["/sell", `/t/${traderId}`, `/t/${traderId}/trades`, "/sell/start"]) { current = `${L} trader ${p}`; await visit(tp, p, `${L} trader`); }

  await signIn(lctx.request, "viewer");
  current = `${L} buy key (live)`;
  await visit(lp, `/t/${traderId}`, L);
  await (size === "phone" ? lp.getByRole("button", { name: /Get a key/ }).last() : lp.locator("aside").getByRole("button", { name: "Get a key" })).click();
  await lp.getByRole("dialog").waitFor();
  await lp.getByText(/on Base|on NEAR|on /).first().waitFor({ timeout: 15000 }).catch(() => note(current, "coin picker never loaded"));
  await audit(lp, `${L} buy dialog`);
  await lp.getByRole("button", { name: "Continue" }).click();
  await lp.getByText("Send exactly").waitFor({ timeout: 30000 }).catch(() => note(current, "no payment address"));
  await audit(lp, `${L} payment address`);
  current = `${L} locked trades`;
  await visit(lp, `/t/${traderId}/trades`, L);
  await tctx.request.post(`${BASE}/api/live/seller`, { data: { listed: false } });
  await tctx.close();
  await lctx.close();
}

// Dead links
const lctx = await browser.newContext();
await lctx.addCookies([{ name: "kh_mode", value: "demo", url: BASE }]);
for (const l of links) {
  if (l.startsWith("/t/") && /0x|[0-9a-f]{64}/.test(l)) continue;
  const res = await lctx.request.get(BASE + l);
  if (res.status() >= 400) note("[links]", `${l} → ${res.status()}`);
}
await browser.close();

const slow = timings.sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w, ms]) => `${w} ${ms}ms`);
console.log(`slowest pages: ${slow.join(" · ")}`);
const uniq = [...new Set(issues)];
console.log(uniq.length ? uniq.map((i) => "✗ " + i).join("\n") : "✓ no issues found");
console.log(`\n${uniq.length} issue(s), ${links.size} internal links checked`);
