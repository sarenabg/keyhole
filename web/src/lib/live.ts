import "server-only";
import { randomBytes } from "node:crypto";
import { ensureDb } from "./db";
import { decrypt, encrypt } from "./session";
import { getQuote, getStatus, privateBalances, refresh, USDC_NEAR, USDC_DECIMALS, type Session } from "./oneclick";
import { assetIndex, nearAssetFor, priceMap, symbolOf, tokens } from "./prices";
import { analyse, holdings, record } from "./stats.mjs";
import { toTradeViews } from "./demo";
import { keysContract, onChainKey } from "./near";
import { shortId } from "./format";
import type { Holding, MyCopy, MyKey, Period, TradeView, TraderCard } from "./types";

// Live mode: real traders, real private balances, real payments on NEAR mainnet.

type Snap = { t: number; balances: Record<string, number>; prices: Record<string, number>; assets: Record<string, string> };

type TraderRow = {
  id: string;
  kind: string;
  name: string;
  refresh_enc: string | null;
  refresh_expires_at: number;
  access_enc: string | null;
  access_expires_at: number;
  price7: number;
  price30: number;
  price90: number;
  max_keys: number;
  allow_copy: number;
  listed: number;
  created_at: number;
  last_snap_at: number;
  last_error: string | null;
};

const SNAP_EVERY_MS = 2 * 60_000;
const KEEP_FLAT_MS = 30 * 60_000;

function newId(prefix: string) {
  return `${prefix}_${randomBytes(9).toString("base64url")}`;
}

async function traderRow(id: string): Promise<TraderRow | null> {
  const d = await ensureDb();
  const r = await d.execute({ sql: "SELECT * FROM traders WHERE id = ?", args: [id] });
  return (r.rows[0] as unknown as TraderRow) ?? null;
}

// ---------- Traders signing in ----------

/** A trader proved their wallet: keep their NEAR Intents sign-in (encrypted) so we can read their record. */
export async function saveTraderSignIn(id: string, kind: string, s: Session) {
  const d = await ensureDb();
  const now = Date.now();
  await d.execute({
    sql: `INSERT INTO traders (id, kind, name, refresh_enc, refresh_expires_at, access_enc, access_expires_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET refresh_enc = excluded.refresh_enc, refresh_expires_at = excluded.refresh_expires_at,
            access_enc = excluded.access_enc, access_expires_at = excluded.access_expires_at, last_error = NULL`,
    args: [id, kind, shortId(id), encrypt(s.refreshToken), now + s.refreshExpiresIn * 1000, encrypt(s.accessToken), now + s.expiresIn * 1000, now],
  });
  await snapshot(id, true);
}

export async function updateTraderSettings(
  id: string,
  v: { name?: string; prices?: [number, number, number]; maxKeys?: number; allowCopy?: boolean; listed?: boolean },
) {
  const d = await ensureDb();
  const row = await traderRow(id);
  if (!row) throw new Error("Sign in as a trader first.");
  const name = (v.name ?? row.name).trim().slice(0, 40) || row.name;
  const [p7, p30, p90] = v.prices ?? [row.price7, row.price30, row.price90];
  for (const p of [p7, p30, p90]) if (!(p >= 1 && p <= 10_000)) throw new Error("Prices must be between 1 and 10,000 USDC.");
  const maxKeys = Math.max(1, Math.min(100_000, Math.round(v.maxKeys ?? row.max_keys)));
  await d.execute({
    sql: "UPDATE traders SET name = ?, price7 = ?, price30 = ?, price90 = ?, max_keys = ?, allow_copy = ?, listed = ? WHERE id = ?",
    args: [name, p7, p30, p90, maxKeys, v.allowCopy === undefined ? row.allow_copy : Number(v.allowCopy), v.listed === undefined ? row.listed : Number(v.listed), id],
  });
}

async function accessToken(row: TraderRow): Promise<string | null> {
  const now = Date.now();
  if (row.access_enc && row.access_expires_at > now + 30_000) return decrypt(row.access_enc);
  if (!row.refresh_enc || row.refresh_expires_at < now) return null;
  const d = await ensureDb();
  try {
    const r = await refresh(decrypt(row.refresh_enc));
    await d.execute({
      sql: "UPDATE traders SET access_enc = ?, access_expires_at = ? WHERE id = ?",
      args: [encrypt(r.accessToken), now + r.expiresIn * 1000, row.id],
    });
    return r.accessToken;
  } catch (e) {
    await d.execute({ sql: "UPDATE traders SET last_error = ? WHERE id = ?", args: [String((e as Error).message).slice(0, 200), row.id] });
    return null;
  }
}

/** Reads the trader's private balances from NEAR Intents and stores them (the only input to their record). */
export async function snapshot(id: string, force = false): Promise<boolean> {
  const row = await traderRow(id);
  if (!row) return false;
  const now = Date.now();
  if (!force && now - row.last_snap_at < SNAP_EVERY_MS) return false;
  const token = await accessToken(row);
  if (!token) return false;
  const d = await ensureDb();
  const [entries, index, prices] = await Promise.all([privateBalances(token), assetIndex(), priceMap()]);
  const balances: Record<string, number> = {};
  const assets: Record<string, string> = {};
  const best: Record<string, number> = {};
  for (const e of entries) {
    const t = index.get(e.tokenId);
    if (!t) continue;
    const sym = symbolOf(t);
    const amt = Number(e.available) / 10 ** t.decimals;
    if (!(amt > 0)) continue;
    balances[sym] = (balances[sym] ?? 0) + amt;
    if (!(amt <= (best[sym] ?? 0))) {
      best[sym] = amt;
      assets[sym] = e.tokenId;
    }
  }
  const snapPrices: Record<string, number> = {};
  for (const sym of Object.keys(balances)) snapPrices[sym] = prices[sym] ?? 0;

  const last = await d.execute({ sql: "SELECT t, balances FROM snapshots WHERE trader_id = ? ORDER BY t DESC LIMIT 1", args: [id] });
  const lastRow = last.rows[0] as unknown as { t: number; balances: string } | undefined;
  const same = lastRow && lastRow.balances === JSON.stringify(balances);
  // Store every change; when nothing changed, one point every 30 minutes keeps the value curve.
  if (!lastRow || !same || now - Number(lastRow.t) >= KEEP_FLAT_MS || force) {
    await d.execute({
      sql: "INSERT OR REPLACE INTO snapshots (trader_id, t, balances, prices, assets) VALUES (?, ?, ?, ?, ?)",
      args: [id, now, JSON.stringify(balances), JSON.stringify(snapPrices), JSON.stringify(assets)],
    });
  }
  await d.execute({ sql: "UPDATE traders SET last_snap_at = ?, last_error = NULL WHERE id = ?", args: [now, id] });
  return true;
}

async function snapshots(id: string): Promise<Snap[]> {
  const d = await ensureDb();
  const r = await d.execute({ sql: "SELECT t, balances, prices, assets FROM snapshots WHERE trader_id = ? ORDER BY t ASC", args: [id] });
  const prices = await priceMap();
  const snaps = r.rows.map((x) => ({
    t: Number(x.t),
    balances: JSON.parse(String(x.balances)),
    prices: JSON.parse(String(x.prices)),
    assets: JSON.parse(String(x.assets)),
  })) as Snap[];
  // Value the latest holdings at today's prices, so the record moves with the market between reads.
  if (snaps.length) {
    const last = snaps[snaps.length - 1];
    const nowPrices: Record<string, number> = {};
    for (const sym of Object.keys(last.balances)) nowPrices[sym] = prices[sym] ?? last.prices[sym] ?? 0;
    snaps.push({ ...last, t: Math.max(Date.now(), last.t + 1), prices: nowPrices });
  }
  return snaps;
}

async function holdersCount(id: string): Promise<number> {
  const d = await ensureDb();
  const r = await d.execute({
    sql: "SELECT COUNT(DISTINCT holder_id) AS n FROM purchases WHERE trader_id = ? AND status = 'paid' AND expires_at > ?",
    args: [id, Date.now()],
  });
  return Number(r.rows[0]?.n ?? 0);
}

async function toCard(row: TraderRow, period: Period): Promise<TraderCard> {
  const snaps = await snapshots(row.id);
  const rec = record(snaps, period);
  const coins = new Set<string>();
  for (const s of snaps) for (const sym of Object.keys(s.balances)) if (sym !== "USDC") coins.add(sym);
  return {
    id: row.id,
    name: row.name,
    handle: shortId(row.id),
    avatar: -1,
    record: rec,
    prices: { 7: row.price7, 30: row.price30, 90: row.price90 },
    holders: await holdersCount(row.id),
    maxKeys: row.max_keys,
    coins: [...coins].slice(0, 4),
    since: new Date(row.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
    updatedAt: row.last_snap_at,
    allowCopy: Boolean(row.allow_copy),
    paused: row.refresh_expires_at < Date.now(),
  };
}

/** Refresh records that are a few minutes old (bounded, so pages stay fast). */
async function refreshStale(rows: TraderRow[]) {
  const stale = rows.filter((r) => Date.now() - r.last_snap_at > 5 * 60_000 && r.refresh_expires_at > Date.now()).slice(0, 6);
  await Promise.race([
    Promise.allSettled(stale.map((r) => snapshot(r.id))),
    new Promise((res) => setTimeout(res, 3500)),
  ]);
}

export async function liveTraders(period: Period): Promise<TraderCard[]> {
  const d = await ensureDb();
  const r = await d.execute("SELECT * FROM traders WHERE listed = 1");
  const rows = r.rows as unknown as TraderRow[];
  await refreshStale(rows);
  const fresh = (await d.execute("SELECT * FROM traders WHERE listed = 1")).rows as unknown as TraderRow[];
  const cards = await Promise.all(fresh.map((row) => toCard(row, period)));
  return cards.sort((a, b) => b.record.ret - a.record.ret);
}

export async function liveTrader(id: string, period: Period): Promise<TraderCard | null> {
  const row = await traderRow(id);
  if (!row) return null;
  await refreshStale([row]);
  return toCard((await traderRow(id))!, period);
}

export async function isTrader(id: string) {
  return Boolean(await traderRow(id));
}

export async function traderSettings(id: string) {
  const row = await traderRow(id);
  if (!row) return null;
  return {
    name: row.name,
    prices: [row.price7, row.price30, row.price90] as [number, number, number],
    maxKeys: row.max_keys,
    allowCopy: Boolean(row.allow_copy),
    listed: Boolean(row.listed),
    renewBy: row.refresh_expires_at,
    lastRead: row.last_snap_at,
    lastError: row.last_error,
  };
}

/** Trades and holdings: only for key holders (and the trader). */
export async function livePrivate(id: string, limit = 40): Promise<{ trades: TradeView[]; holdings: Holding[] } | null> {
  const snaps = await snapshots(id);
  if (!snaps.length) return { trades: [], holdings: [] };
  const { trades } = analyse(snaps);
  const now = snaps[snaps.length - 1];
  const views = toTradeViews(trades, now.prices).slice(0, limit);
  // Attach the exact NEAR Intents asset bought, so a copy buys the same thing.
  const byT = new Map(snaps.map((s) => [s.t, s]));
  for (const v of views) {
    const s = byT.get(v.t);
    v.toAssetId = s?.assets?.[v.to] ?? undefined;
  }
  return { trades: views, holdings: holdings(now) };
}

// ---------- Keys ----------

export async function liveKey(trader: string, holder: string): Promise<MyKey | null> {
  if (trader === holder) return { trader, days: 0, expiresAt: Date.now() + 365 * 86_400_000, paid: 0, boughtAt: 0 };
  const d = await ensureDb();
  const r = await d.execute({
    sql: "SELECT * FROM purchases WHERE trader_id = ? AND holder_id = ? AND status = 'paid' ORDER BY expires_at DESC LIMIT 1",
    args: [trader, holder],
  });
  const row = r.rows[0];
  if (!row || Number(row.expires_at) < Date.now()) return null;
  return { trader, days: Number(row.days), expiresAt: Number(row.expires_at), paid: Number(row.price), boughtAt: Number(row.paid_at), receipt: row.receipt ? String(row.receipt) : undefined };
}

export async function liveMyKeys(holder: string): Promise<MyKey[]> {
  const d = await ensureDb();
  const r = await d.execute({
    sql: "SELECT trader_id, MAX(expires_at) AS exp, days, price, paid_at, receipt FROM purchases WHERE holder_id = ? AND status = 'paid' GROUP BY trader_id",
    args: [holder],
  });
  return r.rows.map((x) => ({ trader: String(x.trader_id), days: Number(x.days), expiresAt: Number(x.exp), paid: Number(x.price), boughtAt: Number(x.paid_at), receipt: x.receipt ? String(x.receipt) : undefined }));
}

export type PayInstructions = {
  id: string;
  depositAddress: string;
  depositMemo?: string;
  amountIn: string;
  symbol: string;
  chain: string;
  deadline?: string;
  amountOut?: string;
};

async function originToken(assetId: string) {
  const t = (await tokens()).find((x) => x.assetId === assetId);
  if (!t) throw new Error("That coin isn't available.");
  return t;
}

/** Buyer picked a key and a coin: get a real NEAR Intents payment address for exactly the key price in USDC. */
export async function startPurchase(trader: string, holder: string, days: 7 | 30 | 90, originAsset: string): Promise<PayInstructions> {
  const row = await traderRow(trader);
  if (!row || !row.listed) throw new Error("This trader isn't selling keys.");
  if (trader === holder) throw new Error("You can't buy your own key.");
  const price = days === 7 ? row.price7 : days === 30 ? row.price30 : row.price90;
  const d0 = await ensureDb();
  // The same request again within a minute (double click, retry) gets the same payment address.
  const again = await d0.execute({
    sql: "SELECT * FROM purchases WHERE trader_id = ? AND holder_id = ? AND days = ? AND origin_asset = ? AND status = 'waiting' AND created_at > ? ORDER BY created_at DESC LIMIT 1",
    args: [trader, holder, days, originAsset, Date.now() - 60_000],
  });
  const prev = again.rows[0];
  if (prev) {
    const pt = await originToken(String(prev.origin_asset));
    return { id: String(prev.id), depositAddress: String(prev.deposit_address), depositMemo: prev.deposit_memo ? String(prev.deposit_memo) : undefined, amountIn: String(prev.amount_in), symbol: symbolOf(pt), chain: pt.blockchain, deadline: prev.deadline ? String(prev.deadline) : undefined };
  }
  const contract = keysContract();
  const t = await originToken(originAsset);
  const q = await getQuote({
    dry: false,
    swapType: "EXACT_OUTPUT",
    originAsset,
    destinationAsset: USDC_NEAR,
    amount: String(Math.round(price * 10 ** USDC_DECIMALS)),
    ...(contract
      ? { recipient: contract, recipientType: "DESTINATION_CHAIN" as const, customRecipientMsg: JSON.stringify({ trader, holder, days }) }
      : { recipient: trader, recipientType: "INTENTS" as const }),
    // Any refund goes back to the buyer's own NEAR Intents balance.
    refundTo: holder,
    refundType: "INTENTS",
  });
  if (!q.quote.depositAddress) throw new Error("No payment address came back. Try again.");
  const id = newId("key");
  const d = await ensureDb();
  await d.execute({
    sql: `INSERT INTO purchases (id, trader_id, holder_id, days, price, via, origin_asset, deposit_address, deposit_memo, amount_in, deadline, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?)`,
    args: [id, trader, holder, days, price, contract ? "contract" : "direct", originAsset, q.quote.depositAddress, q.quote.depositMemo ?? null, q.quote.amountInFormatted, q.quote.deadline ?? null, Date.now()],
  });
  return { id, depositAddress: q.quote.depositAddress, depositMemo: q.quote.depositMemo, amountIn: q.quote.amountInFormatted, symbol: symbolOf(t), chain: t.blockchain, deadline: q.quote.deadline };
}

export type PayState = "waiting" | "arriving" | "paid" | "refunded" | "failed";

function mapStatus(s: string): PayState {
  if (s === "SUCCESS") return "paid";
  if (s === "KNOWN_DEPOSIT_TX" || s === "PROCESSING") return "arriving";
  if (s === "REFUNDED") return "refunded";
  if (s === "FAILED" || s === "INCOMPLETE_DEPOSIT") return "failed";
  return "waiting";
}

export async function checkPurchase(id: string, holder: string): Promise<{ state: PayState; expiresAt?: number; receipt?: string }> {
  const d = await ensureDb();
  const r = await d.execute({ sql: "SELECT * FROM purchases WHERE id = ? AND holder_id = ?", args: [id, holder] });
  const row = r.rows[0];
  if (!row) throw new Error("Not found");
  if (row.status === "paid") return { state: "paid", expiresAt: Number(row.expires_at), receipt: row.receipt ? String(row.receipt) : undefined };
  const st = await getStatus(String(row.deposit_address), row.deposit_memo ? String(row.deposit_memo) : null);
  const state = mapStatus(st.status);
  if (state === "paid") {
    const prev = await liveKey(String(row.trader_id), holder);
    let expiresAt = Math.max(prev?.expiresAt ?? 0, Date.now()) + Number(row.days) * 86_400_000;
    if (row.via === "contract") {
      // The contract is the source of truth for when the key ends.
      const k = await onChainKey(String(row.trader_id), holder);
      if (k?.expires_at_ms) expiresAt = Number(k.expires_at_ms);
    }
    const receipt = st.swapDetails?.nearTxHashes?.[st.swapDetails.nearTxHashes.length - 1] ?? null;
    await d.execute({
      sql: "UPDATE purchases SET status = 'paid', paid_at = ?, expires_at = ?, receipt = ? WHERE id = ?",
      args: [Date.now(), expiresAt, receipt, id],
    });
    return { state, expiresAt, receipt: receipt ?? undefined };
  }
  if (state === "refunded" || state === "failed") {
    await d.execute({ sql: "UPDATE purchases SET status = ? WHERE id = ?", args: [state, id] });
  }
  return { state };
}

export async function sellerStats(trader: string) {
  const d = await ensureDb();
  const r = await d.execute({
    sql: "SELECT holder_id, days, price, via, paid_at FROM purchases WHERE trader_id = ? AND status = 'paid' ORDER BY paid_at DESC LIMIT 200",
    args: [trader],
  });
  const now = Date.now();
  const dayMs = 86_400_000;
  const sales = r.rows.map((x) => ({
    who: shortId(String(x.holder_id)),
    days: Number(x.days),
    amount: Number(x.price) * (x.via === "contract" ? 0.95 : 1),
    at: Number(x.paid_at),
  }));
  const in30 = sales.filter((s) => s.at > now - 30 * dayMs);
  const perDay = Array.from({ length: 30 }, (_, i) => {
    const start = now - (30 - i) * dayMs;
    return in30.filter((s) => s.at >= start && s.at < start + dayMs).reduce((a, x) => a + x.amount, 0);
  });
  return {
    sales,
    perDay,
    earned30: in30.reduce((a, x) => a + x.amount, 0),
    newThisWeek: sales.filter((s) => s.at > now - 7 * dayMs).length,
    holders: await holdersCount(trader),
  };
}

// ---------- Copies ----------

/** Follower copies a trade: a real NEAR Intents swap into the same coin, landing in their own Intents balance. */
export async function startCopy(holder: string, trader: string, trade: TradeView, usd: number, originAsset: string): Promise<PayInstructions & { amountOut: string }> {
  if (!(usd >= 1 && usd <= 50_000)) throw new Error("Pick an amount between $1 and $50,000.");
  const origin = await originToken(originAsset);
  const d0 = await ensureDb();
  const again = await d0.execute({
    sql: "SELECT * FROM copies WHERE holder_id = ? AND trade_id = ? AND origin_asset = ? AND usd_in = ? AND status = 'waiting' AND created_at > ? ORDER BY created_at DESC LIMIT 1",
    args: [holder, trade.id, originAsset, usd, Date.now() - 60_000],
  });
  const prev = again.rows[0];
  if (prev) {
    return { id: String(prev.id), depositAddress: String(prev.deposit_address), depositMemo: prev.deposit_memo ? String(prev.deposit_memo) : undefined, amountIn: String(prev.amount_in), amountOut: String(prev.amount_out), symbol: symbolOf(origin), chain: origin.blockchain };
  }
  const toAsset = trade.toAssetId ?? (await nearAssetFor(trade.to));
  if (!toAsset) throw new Error("That coin can't be copied right now.");
  const amountIn = Math.floor((usd / origin.price) * 10 ** origin.decimals);
  const q = await getQuote({
    dry: false,
    swapType: "EXACT_INPUT",
    originAsset,
    destinationAsset: toAsset,
    amount: String(amountIn),
    recipient: holder,
    recipientType: "INTENTS",
    refundTo: holder,
    refundType: "INTENTS",
  });
  if (!q.quote.depositAddress) throw new Error("No payment address came back. Try again.");
  const id = newId("copy");
  const prices = await priceMap();
  const d = await ensureDb();
  await d.execute({
    sql: `INSERT INTO copies (id, holder_id, trader_id, trade_id, to_sym, to_asset, usd_in, price_at, origin_asset, deposit_address, deposit_memo, amount_in, amount_out, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?)`,
    args: [id, holder, trader, trade.id, trade.to, toAsset, usd, prices[trade.to] ?? 0, originAsset, q.quote.depositAddress, q.quote.depositMemo ?? null, q.quote.amountInFormatted, q.quote.amountOutFormatted, Date.now()],
  });
  return {
    id,
    depositAddress: q.quote.depositAddress,
    depositMemo: q.quote.depositMemo,
    amountIn: q.quote.amountInFormatted,
    amountOut: q.quote.amountOutFormatted,
    symbol: symbolOf(origin),
    chain: origin.blockchain,
    deadline: q.quote.deadline,
  };
}

export async function checkCopy(id: string, holder: string): Promise<{ state: PayState; amountOut?: string }> {
  const d = await ensureDb();
  const r = await d.execute({ sql: "SELECT * FROM copies WHERE id = ? AND holder_id = ?", args: [id, holder] });
  const row = r.rows[0];
  if (!row) throw new Error("Not found");
  if (row.status === "done") return { state: "paid", amountOut: String(row.amount_out) };
  const st = await getStatus(String(row.deposit_address), row.deposit_memo ? String(row.deposit_memo) : null);
  const state = mapStatus(st.status);
  if (state === "paid") {
    const out = st.swapDetails?.amountOutFormatted ?? String(row.amount_out);
    const receipt = st.swapDetails?.nearTxHashes?.[st.swapDetails.nearTxHashes.length - 1] ?? null;
    await d.execute({ sql: "UPDATE copies SET status = 'done', done_at = ?, amount_out = ?, receipt = ? WHERE id = ?", args: [Date.now(), out, receipt, id] });
    return { state, amountOut: out };
  }
  if (state === "refunded" || state === "failed") await d.execute({ sql: "UPDATE copies SET status = ? WHERE id = ?", args: [state, id] });
  return { state };
}

export async function liveMyCopies(holder: string): Promise<MyCopy[]> {
  const d = await ensureDb();
  const r = await d.execute({ sql: "SELECT * FROM copies WHERE holder_id = ? ORDER BY created_at DESC LIMIT 50", args: [holder] });
  return r.rows.map((x) => ({
    id: String(x.id),
    trader: String(x.trader_id),
    tradeId: String(x.trade_id),
    sym: String(x.to_sym),
    amount: Number(x.amount_out) || 0,
    usdIn: Number(x.usd_in),
    priceAt: Number(x.price_at),
    at: Number(x.created_at),
    status: x.status === "done" ? "done" : x.status === "waiting" ? "waiting" : "failed",
    receipt: x.receipt ? String(x.receipt) : undefined,
  }));
}

/** Called by a scheduler: keep every live record fresh. */
export async function snapshotAll(): Promise<{ read: number; skipped: number }> {
  const d = await ensureDb();
  const rows = (await d.execute({ sql: "SELECT id FROM traders WHERE refresh_expires_at > ?", args: [Date.now()] })).rows;
  let read = 0;
  for (const r of rows) if (await snapshot(String(r.id)).catch(() => false)) read++;
  return { read, skipped: rows.length - read };
}
