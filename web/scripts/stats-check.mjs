// Checks Keyhole's record maths (src/lib/stats.mjs) and the demo simulation. No server needed.
// Run: node scripts/stats-check.mjs
import { analyse, diff, holdings, record, tradeResult, tradeTitle, valueOf } from "../src/lib/stats.mjs";
import { DEMO_TRADERS, FALLBACK_PRICES, simulateTrader } from "../src/lib/sim.mjs";

let passed = 0;
function check(name, cond, detail = "") {
  if (!cond) {
    console.error(`✗ ${name} ${detail}`);
    process.exit(1);
  }
  passed++;
  console.log(`✓ ${name}`);
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 1);
const snap = (d, balances, prices) => ({ t: T0 + d * DAY, balances, prices: { USDC: 1, ...prices } });

// 1. Value
check("value adds coins × prices", valueOf(snap(0, { USDC: 50, NEAR: 10 }, { NEAR: 5 })) === 100);

// 2. Money added is not profit
{
  const s = [snap(0, { USDC: 100 }, {}), snap(1, { USDC: 300 }, {}), snap(2, { USDC: 300 }, {})];
  const r = record(s, 90, T0 + 2 * DAY);
  check("a deposit is not counted as profit", near(r.ret, 0), `ret=${r.ret}`);
  check("a deposit is not a trade", analyse(s).trades.length === 0);
}

// 3. A trade is detected, sized and titled
{
  const a = snap(0, { USDC: 100 }, { NEAR: 5 });
  const b = snap(1, { USDC: 50, NEAR: 10 }, { NEAR: 5 });
  const d = diff(a, b);
  check("trade detected: USDC → NEAR", d.trade && d.trade.from === "USDC" && d.trade.to === "NEAR");
  check("trade size is half the account", near(analyse([a, b]).trades[0].share, 0.5));
  check("trade title says Bought", tradeTitle(d.trade) === "Bought NEAR with USDC");
  check("sell title says Sold", tradeTitle({ from: "BTC", to: "USDC" }) === "Sold BTC for USDC");
}

// 4. Price moves change the return; withdrawals don't
{
  const s = [
    snap(0, { USDC: 100 }, { NEAR: 5 }),
    snap(1, { USDC: 50, NEAR: 10 }, { NEAR: 5 }),
    snap(2, { USDC: 50, NEAR: 10 }, { NEAR: 6 }), // +10 on 100
    snap(3, { USDC: 0, NEAR: 10 }, { NEAR: 6 }), // took 50 out
    snap(4, { USDC: 0, NEAR: 10 }, { NEAR: 6.6 }), // +10% on 60
  ];
  const r = record(s, 90, T0 + 4 * DAY);
  check("return follows prices: +10% then +10% = +21%", near(r.ret, 0.21, 1e-9), `ret=${r.ret}`);
  check("a withdrawal is not a loss", r.maxDip === 0, `dip=${r.maxDip}`);
  check("win rate counts the NEAR buy as a win", r.winRate === 1);
}

// 5. Biggest dip
{
  const s = [snap(0, { NEAR: 10 }, { NEAR: 10 }), snap(1, { NEAR: 10 }, { NEAR: 12 }), snap(2, { NEAR: 10 }, { NEAR: 9 }), snap(3, { NEAR: 10 }, { NEAR: 11 })];
  const r = record(s, 90, T0 + 3 * DAY);
  check("biggest dip is peak to low (−25%)", near(r.maxDip, -0.25), `dip=${r.maxDip}`);
  check("period return start→end (+10%)", near(r.ret, 0.1));
}

// 6. Periods only look back that far
{
  const s = [snap(0, { NEAR: 10 }, { NEAR: 10 }), snap(80, { NEAR: 10 }, { NEAR: 20 }), snap(88, { NEAR: 10 }, { NEAR: 22 })];
  const r7 = record(s, 7, T0 + 88 * DAY);
  check("7-day return ignores older moves (+10%)", near(r7.ret, 0.1), `ret=${r7.ret}`);
}

// 7. Trade result and holdings
check("trade result: coin bought rose 20% vs coin sold", near(tradeResult({ from: "USDC", to: "NEAR", priceFrom: 1, priceTo: 5 }, { USDC: 1, NEAR: 6 }), 0.2));
{
  const h = holdings(snap(0, { USDC: 25, NEAR: 15 }, { NEAR: 5 }));
  check("holdings are shares, biggest first", h[0].sym === "NEAR" && near(h[0].share, 0.75) && near(h[1].share, 0.25));
}

// 8. Empty and tiny histories don't crash
check("no snapshots → empty record", record([], 30).spark.length === 0);
check("one snapshot → not enough data", record([snap(0, { USDC: 1 }, {})], 30, T0).enoughData === false);

// 9. Demo simulation: repeatable, believable, uses the same maths
{
  const now = Date.now();
  const a = simulateTrader(DEMO_TRADERS[0], FALLBACK_PRICES, now);
  const b = simulateTrader({ ...DEMO_TRADERS[0] }, { ...FALLBACK_PRICES }, now);
  check("simulation is repeatable", JSON.stringify(a.slice(0, 50)) === JSON.stringify(b.slice(0, 50)));
  check("simulation ends at today's price", near(a[a.length - 1].prices.NEAR, FALLBACK_PRICES.NEAR, 1e-6));
  const rets = DEMO_TRADERS.map((t) => record(simulateTrader(t, FALLBACK_PRICES, now), 90, now).ret);
  check("every demo record is believable (−60% to +200%)", rets.every((r) => r > -0.6 && r < 2), rets.map((r) => r.toFixed(2)).join(","));
  check("at least one demo trader is losing money", rets.some((r) => r < 0));
  const trades = analyse(a).trades;
  check("demo trader made trades the maths can see", trades.length > 30, `${trades.length}`);
}

console.log(`\n✓ all ${passed} record checks passed`);
