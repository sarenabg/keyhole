// Keyhole's record maths. Plain JavaScript so the app (TypeScript) and the check scripts (Node) share it.
//
// Input: a time-ordered list of snapshots of one account's private NEAR Intents balances:
//   { t: ms, balances: { SYMBOL: amount }, prices: { SYMBOL: usd } }
// Live mode reads these from NEAR Intents every few minutes. Demo mode simulates them.
// Everything else (trades, returns, win rate, biggest dip) is worked out from those snapshots,
// so a trader can't type in their own numbers.

const STABLE = new Set(["USDC", "USDT", "DAI", "USDe", "USD1", "FRAX"]);
export const DAY = 86_400_000;

/** @param {{balances: Record<string, number>, prices: Record<string, number>}} s */
export function valueOf(s) {
  let v = 0;
  for (const [sym, amt] of Object.entries(s.balances)) v += amt * (s.prices[sym] ?? 0);
  return v;
}

export function isStable(sym) {
  return STABLE.has(sym);
}

/**
 * Compare two snapshots. Coins that went up and coins that went down at the same time are a trade;
 * whatever is left over is money added or taken out (a "flow"), which must not count as profit.
 */
export function diff(prev, cur) {
  const syms = new Set([...Object.keys(prev.balances), ...Object.keys(cur.balances)]);
  let ups = 0;
  let downs = 0;
  let maxUp = null;
  let maxDown = null;
  for (const sym of syms) {
    const d = (cur.balances[sym] ?? 0) - (prev.balances[sym] ?? 0);
    if (Math.abs(d) < 1e-12) continue;
    const price = cur.prices[sym] ?? prev.prices[sym] ?? 0;
    const usd = d * price;
    if (usd > 0) {
      ups += usd;
      if (!maxUp || usd > maxUp.usd) maxUp = { sym, amount: d, usd };
    } else if (usd < 0) {
      downs += -usd;
      if (!maxDown || -usd > maxDown.usd) maxDown = { sym, amount: -d, usd: -usd };
    }
  }
  const prevValue = valueOf(prev);
  const traded = Math.min(ups, downs);
  const flow = ups - downs;
  const minTrade = Math.max(1, prevValue * 0.002);
  const trade =
    maxUp && maxDown && traded >= minTrade
      ? { from: maxDown.sym, to: maxUp.sym, fromAmount: maxDown.amount, toAmount: maxUp.amount, usd: traded }
      : null;
  return { flow, trade, prevValue };
}

/** Builds the growth index (1.0 = start), trades and flows from a list of snapshots. */
export function analyse(snapshots) {
  const points = [];
  const trades = [];
  let index = 1;
  if (!snapshots.length) return { points, trades, flows: 0 };
  points.push({ t: snapshots[0].t, index, value: valueOf(snapshots[0]) });
  let flows = 0;
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const cur = snapshots[i];
    const { flow, trade, prevValue } = diff(prev, cur);
    const value = valueOf(cur);
    // Growth from prices and trades only: take out money added or withdrawn in between.
    const base = prevValue;
    if (base > 0.01) {
      const r = (value - flow) / base;
      if (isFinite(r) && r > 0) index *= r;
    }
    flows += flow;
    points.push({ t: cur.t, index, value });
    if (trade) {
      const priceFrom = cur.prices[trade.from] ?? 0;
      const priceTo = cur.prices[trade.to] ?? 0;
      trades.push({
        id: `${cur.t}-${trade.from}-${trade.to}`,
        t: cur.t,
        ...trade,
        share: base > 0 ? trade.usd / base : 0,
        priceFrom,
        priceTo,
      });
    }
  }
  return { points, trades, flows };
}

function indexAt(points, t) {
  // Last point at or before t (or the first point).
  let lo = 0;
  let hi = points.length - 1;
  if (t <= points[0].t) return points[0].index;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return points[lo].index;
}

/** How a trade has done since: did the coin bought beat the coin sold? */
export function tradeResult(trade, nowPrices) {
  const toNow = nowPrices[trade.to] ?? trade.priceTo;
  const fromNow = nowPrices[trade.from] ?? trade.priceFrom;
  if (!trade.priceTo || !trade.priceFrom || !toNow || !fromNow) return 0;
  return toNow / trade.priceTo / (fromNow / trade.priceFrom) - 1;
}

/**
 * The public record for a period (days). Only numbers, never which coins or when:
 * return, win rate, biggest dip, trades per week, typical hold time and a sparkline.
 */
export function record(snapshots, days, now = Date.now()) {
  const { points, trades } = analyse(snapshots);
  if (points.length < 2) {
    return { ret: 0, winRate: null, maxDip: 0, perWeek: 0, holdDays: null, spark: [], trades: 0, enoughData: false };
  }
  const start = now - days * DAY;
  const startIndex = indexAt(points, start);
  const endIndex = points[points.length - 1].index;
  const inPeriod = points.filter((p) => p.t >= start);
  const series = [{ t: start, index: startIndex }, ...inPeriod];

  let peak = -Infinity;
  let maxDip = 0;
  for (const p of series) {
    peak = Math.max(peak, p.index);
    maxDip = Math.min(maxDip, p.index / peak - 1);
  }

  const nowPrices = snapshots[snapshots.length - 1].prices;
  const periodTrades = trades.filter((t) => t.t >= start);
  const wins = periodTrades.filter((t) => tradeResult(t, nowPrices) > 0).length;

  // Typical hold: time from buying a coin to the next time it was sold.
  const holds = [];
  for (let i = 0; i < periodTrades.length; i++) {
    const buy = periodTrades[i];
    if (isStable(buy.to)) continue;
    const sell = periodTrades.slice(i + 1).find((t) => t.from === buy.to);
    if (sell) holds.push((sell.t - buy.t) / DAY);
  }
  holds.sort((a, b) => a - b);

  const firstT = points[0].t;
  const spanDays = Math.max(1, Math.min(days, (now - firstT) / DAY));
  return {
    ret: endIndex / startIndex - 1,
    winRate: periodTrades.length ? wins / periodTrades.length : null,
    maxDip,
    perWeek: periodTrades.length / (spanDays / 7),
    holdDays: holds.length ? holds[Math.floor(holds.length / 2)] : null,
    spark: sample(series, 48).map((p) => p.index / startIndex),
    trades: periodTrades.length,
    enoughData: now - firstT > DAY,
  };
}

function sample(series, n) {
  if (series.length <= n) return series;
  const out = [];
  for (let i = 0; i < n; i++) out.push(series[Math.round((i * (series.length - 1)) / (n - 1))]);
  return out;
}

/** What the account holds now, as shares of its value (for key holders only). */
export function holdings(snapshot) {
  const v = valueOf(snapshot);
  if (v <= 0) return [];
  return Object.entries(snapshot.balances)
    .map(([sym, amt]) => ({ sym, share: (amt * (snapshot.prices[sym] ?? 0)) / v }))
    .filter((h) => h.share >= 0.005)
    .sort((a, b) => b.share - a.share);
}

/** Plain-English title for a trade, e.g. "Bought ZEC with NEAR" or "Sold BTC for USDC". */
export function tradeTitle(trade) {
  if (isStable(trade.to) && !isStable(trade.from)) return `Sold ${trade.from} for ${trade.to}`;
  return `Bought ${trade.to} with ${trade.from}`;
}
