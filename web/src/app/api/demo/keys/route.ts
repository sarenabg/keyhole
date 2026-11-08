import { body, fail, ok } from "@/lib/api";
import { demoState, getMode, saveDemoState } from "@/lib/session";
import { demoTrader } from "@/lib/demo";

// Demo: "buy" a key with demo money. Nothing real moves.
export async function POST(req: Request) {
  if ((await getMode()) !== "demo") return fail("This is the demo endpoint.", 409);
  const { trader, days } = await body<{ trader?: string; days?: number }>(req);
  if (days !== 7 && days !== 30 && days !== 90) return fail("Pick 7, 30 or 90 days.");
  const t = trader ? await demoTrader(trader, 30) : null;
  if (!t) return fail("Trader not found.", 404);
  const s = await demoState();
  const now = Date.now();
  const current = s.keys.find((k) => k.trader === t.id);
  // A repeat of the same purchase within a few seconds (double click, retry) returns the first one.
  if (current && current.days === days && now - current.boughtAt < 5000) return ok(current);
  const start = current && current.expiresAt > now ? current.expiresAt : now;
  const key = { trader: t.id, days, expiresAt: start + days * 86_400_000, paid: t.prices[days], boughtAt: now };
  s.keys = [...s.keys.filter((k) => k.trader !== t.id), key];
  await saveDemoState(s);
  return ok(key);
}
