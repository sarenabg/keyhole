import "server-only";
import { DEMO_TRADERS, simulateTrader, rand } from "./sim.mjs";
import { analyse, holdings, record, tradeResult, tradeTitle, isStable } from "./stats.mjs";
import { priceMap } from "./prices";
import { shortId } from "./format";
import type { DemoState } from "./session";
import type { Holding, Period, TradeView, TraderCard } from "./types";

// Demo mode: six simulated traders. Prices are today's real prices from NEAR Intents.

type Snap = { t: number; balances: Record<string, number>; prices: Record<string, number> };

async function snapshotsFor(id: string, now = Date.now()): Promise<Snap[] | null> {
  const tr = DEMO_TRADERS.find((t) => t.id === id);
  if (!tr) return null;
  return simulateTrader(tr, await priceMap(), now) as Snap[];
}

function card(tr: (typeof DEMO_TRADERS)[number], snaps: Snap[], period: Period, extraHolders = 0): TraderCard {
  const rec = record(snaps, period);
  return {
    id: tr.id,
    name: tr.name,
    handle: shortId(tr.id),
    avatar: tr.color,
    record: rec,
    prices: { 7: tr.prices[0], 30: tr.prices[1], 90: tr.prices[2] },
    holders: tr.holders + extraHolders,
    maxKeys: tr.maxKeys,
    coins: tr.coins,
    since: tr.since,
    updatedAt: snaps[snaps.length - 1].t,
    allowCopy: true,
  };
}

export async function demoTraders(period: Period, state?: DemoState): Promise<TraderCard[]> {
  const prices = await priceMap();
  const now = Date.now();
  const cards = DEMO_TRADERS.map((tr) => {
    const mine = state?.keys.some((k) => k.trader === tr.id && k.expiresAt > now) ? 1 : 0;
    return card(tr, simulateTrader(tr, prices, now) as Snap[], period, mine);
  });
  return cards.sort((a, b) => b.record.ret - a.record.ret);
}

export async function demoTrader(id: string, period: Period, state?: DemoState): Promise<TraderCard | null> {
  const tr = DEMO_TRADERS.find((t) => t.id === id);
  const snaps = await snapshotsFor(id);
  if (!tr || !snaps) return null;
  const mine = state?.keys.some((k) => k.trader === id && k.expiresAt > Date.now()) ? 1 : 0;
  return card(tr, snaps, period, mine);
}

export function toTradeViews(trades: ReturnType<typeof analyse>["trades"], nowPrices: Record<string, number>): TradeView[] {
  return trades
    .slice()
    .reverse()
    .map((t) => {
      const priceSym = isStable(t.to) ? t.from : t.to;
      return {
        id: t.id,
        t: t.t,
        title: tradeTitle(t),
        from: t.from,
        to: t.to,
        fromAmount: t.fromAmount,
        toAmount: t.toAmount,
        share: t.share,
        price: priceSym === t.to ? t.priceTo : t.priceFrom,
        priceSym,
        since: tradeResult(t, nowPrices),
      };
    });
}

/** The private part: trades and holdings. Only for someone holding a key. */
export async function demoPrivate(id: string, limit = 40): Promise<{ trades: TradeView[]; holdings: Holding[] } | null> {
  const snaps = await snapshotsFor(id);
  if (!snaps) return null;
  const { trades } = analyse(snaps);
  const now = snaps[snaps.length - 1];
  return { trades: toTradeViews(trades, now.prices).slice(0, limit), holdings: holdings(now) };
}

/** Demo seller dashboard: Mara's earnings from simulated key sales over the last 30 days. */
export function demoSales(traderId = "maralin.near") {
  const tr = DEMO_TRADERS.find((t) => t.id === traderId) ?? DEMO_TRADERS[0];
  const names = ["alex.near", "0x8f2a…4c1d", "priya.near", "tomas.near", "hana.near", "ivo.near", "7c1e…9a02", "lea.near", "omar.near", "0x31bd…77e0", "noor.near", "ben.near"];
  const now = Date.now();
  const sales: { who: string; days: number; amount: number; at: number }[] = [];
  const dayMs = 86_400_000;
  for (let d = 0; d < 30; d++) {
    const growth = 0.55 + (d / 30) * 0.9;
    const n = Math.round(2 + rand(`${tr.id}:sales:${d}`) * 5 * growth);
    for (let i = 0; i < n; i++) {
      const r = rand(`${tr.id}:sale:${d}:${i}`);
      const days = r < 0.2 ? 7 : r < 0.85 ? 30 : 90;
      const price = days === 7 ? tr.prices[0] : days === 30 ? tr.prices[1] : tr.prices[2];
      sales.push({
        who: names[Math.floor(rand(`${tr.id}:who:${d}:${i}`) * names.length)],
        days,
        amount: price * 0.95,
        at: now - (29 - d) * dayMs - Math.floor(rand(`${tr.id}:at:${d}:${i}`) * dayMs * 0.9),
      });
    }
  }
  sales.sort((a, b) => b.at - a.at);
  const perDay = Array.from({ length: 30 }, (_, i) => {
    const start = now - (30 - i) * dayMs;
    return sales.filter((s) => s.at >= start && s.at < start + dayMs).reduce((s, x) => s + x.amount, 0);
  });
  const earned30 = sales.reduce((s, x) => s + x.amount, 0);
  const week = sales.filter((s) => s.at > now - 7 * dayMs).length;
  return { trader: tr, sales, perDay, earned30, newThisWeek: week, renewRate: 0.72 };
}
