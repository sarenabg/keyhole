// Demo mode only: simulated traders. Same output shape as live mode (balance snapshots),
// so the record maths in stats.mjs is exactly the code live mode uses.
// Prices end at today's real prices (from NEAR Intents); the path before that is simulated.

const HOUR = 3_600_000;
export const SIM_DAYS = 120;
export const START_USD = 10_000;

// Hourly price swings, roughly like the real coins.
const VOL = { BTC: 0.0024, ETH: 0.0032, SOL: 0.0044, NEAR: 0.0048, ZEC: 0.0055 };
export const SIM_COINS = Object.keys(VOL);
export const FALLBACK_PRICES = { BTC: 98000, ETH: 3400, SOL: 180, NEAR: 3.7, ZEC: 58, USDC: 1 };

export const DEMO_TRADERS = [
  { id: "maralin.near", name: "Mara Lin", coins: ["NEAR", "ZEC", "BTC"], skill: 0.6, every: 14, size: 0.14, prices: [8, 25, 60], holders: 214, maxKeys: 300, color: 0, since: "Aug 2026" },
  { id: "junovale.near", name: "Juno Vale", coins: ["BTC", "ETH"], skill: 0.63, every: 34, size: 0.1, prices: [10, 30, 75], holders: 341, maxKeys: 500, color: 1, since: "Jun 2026" },
  { id: "odin.near", name: "Odin Park", coins: ["SOL", "NEAR"], skill: 0.54, every: 9, size: 0.12, prices: [5, 15, 36], holders: 96, maxKeys: 200, color: 2, since: "Sep 2026" },
  { id: "sable.near", name: "Sable", coins: ["ETH", "SOL", "ZEC"], skill: 0.52, every: 5, size: 0.11, prices: [3, 9, 22], holders: 57, maxKeys: 150, color: 3, since: "Sep 2026" },
  { id: "kenji.near", name: "Kenji Mori", coins: ["NEAR", "BTC"], skill: 0.54, every: 20, size: 0.1, prices: [4, 12, 30], holders: 130, maxKeys: 300, color: 4, since: "Jul 2026" },
  { id: "rheaq.near", name: "Rhea Quinn", coins: ["SOL", "ETH"], skill: 0.62, unlucky: true, every: 7, size: 0.15, prices: [2, 5, 12], holders: 12, maxKeys: 100, color: 5, since: "Oct 2026" },
];

function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** A repeatable random number in [0, 1) for a given key. */
export function rand(key) {
  let t = (hash(key) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function gauss(key) {
  const u = Math.max(rand(key + "a"), 1e-9);
  const v = rand(key + "b");
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const pathCache = new Map();

/** Hourly prices for every coin, ending at `nowPrices` in the current hour. */
export function pricePaths(nowPrices, nowMs) {
  const hNow = Math.floor(nowMs / HOUR);
  const key = hNow + JSON.stringify(nowPrices);
  if (pathCache.has(key)) return pathCache.get(key);
  const hours = SIM_DAYS * 24 + 48;
  const paths = {};
  for (const sym of SIM_COINS) {
    const arr = new Array(hours + 1);
    arr[hours] = nowPrices[sym] ?? FALLBACK_PRICES[sym];
    for (let i = hours; i > 0; i--) {
      const h = hNow - (hours - i);
      // Each hour's move is fixed by its absolute hour number, so the chart shape is stable over time.
      const r = VOL[sym] * gauss(`${sym}:${h}`);
      arr[i - 1] = arr[i] / Math.exp(r);
    }
    paths[sym] = arr;
  }
  const out = { hNow, hours, paths };
  pathCache.clear();
  pathCache.set(key, out);
  return out;
}

function priceAt(pp, sym, h) {
  if (sym === "USDC") return 1;
  const i = h - (pp.hNow - pp.hours);
  const arr = pp.paths[sym];
  return arr[Math.max(0, Math.min(pp.hours, i))];
}

function pricesAt(pp, h) {
  const p = { USDC: 1 };
  for (const sym of SIM_COINS) p[sym] = priceAt(pp, sym, h);
  return p;
}

const simCache = new Map();

/** Simulates one demo trader and returns balance snapshots like the live service records. */
export function simulateTrader(trader, nowPrices, nowMs = Date.now()) {
  const pp = pricePaths(nowPrices, nowMs);
  const cacheKey = `${trader.id}:${pp.hNow}:${JSON.stringify(nowPrices)}`;
  if (simCache.has(cacheKey)) return simCache.get(cacheKey);

  const start = pp.hNow - SIM_DAYS * 24;
  const offset = hash(trader.id) % trader.every;
  const bal = { USDC: START_USD };
  const snaps = [];
  const snap = (h) => snaps.push({ t: h * HOUR + (hash(trader.id + h) % 50) * 60_000, balances: { ...bal }, prices: pricesAt(pp, h) });
  snap(start);

  for (let h = start + 1; h <= pp.hNow; h++) {
    if ((h - offset) % trader.every === 0) {
      const prices = pricesAt(pp, h);
      const value = Object.entries(bal).reduce((s, [k, a]) => s + a * prices[k], 0);
      const r = rand(`${trader.id}:${h}`);
      const smart = rand(`${trader.id}:${h}:skill`) < trader.skill;
      const ahead = Math.min(pp.hNow, h + trader.every * 2);
      // An "unlucky" trader reads the market backwards: the demo needs someone losing money too.
      const sign = trader.unlucky ? -1 : 1;
      const fwd = (sym) => sign * (priceAt(pp, sym, ahead) / prices[sym] - 1);
      const held = trader.coins.filter((c) => (bal[c] ?? 0) * prices[c] > value * 0.03);
      const size = value * trader.size * (0.6 + rand(`${trader.id}:${h}:size`) * 0.8);

      let from = null;
      let to = null;
      if (smart) {
        const best = [...trader.coins].sort((a, b) => fwd(b) - fwd(a))[0];
        const worstHeld = [...held].sort((a, b) => fwd(a) - fwd(b))[0];
        if (worstHeld && fwd(worstHeld) < 0) {
          from = worstHeld;
          to = fwd(best) > 0.01 && best !== worstHeld ? best : "USDC";
        } else if (fwd(best) > 0 && (bal.USDC ?? 0) > size * 0.5) {
          from = "USDC";
          to = best;
        }
      } else if (held.length && r < 0.45) {
        from = held[Math.floor(rand(`${trader.id}:${h}:pick`) * held.length)];
        to = "USDC";
      } else if ((bal.USDC ?? 0) > size * 0.5) {
        from = "USDC";
        to = trader.coins[Math.floor(rand(`${trader.id}:${h}:pick`) * trader.coins.length)];
      }

      if (from && to && from !== to) {
        const usd = Math.min(size, (bal[from] ?? 0) * prices[from]);
        if (usd > 5) {
          bal[from] = (bal[from] ?? 0) - usd / prices[from];
          if (bal[from] < 1e-9) delete bal[from];
          bal[to] = (bal[to] ?? 0) + (usd * 0.999) / prices[to];
          snap(h);
          continue;
        }
      }
    }
    if (h % 6 === 0) snap(h);
  }
  snap(pp.hNow);
  // Last snapshot is "now" with today's real prices.
  snaps[snaps.length - 1].t = nowMs;
  if (simCache.size > 40) simCache.clear();
  simCache.set(cacheKey, snaps);
  return snaps;
}
