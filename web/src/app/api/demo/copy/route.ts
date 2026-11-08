import { randomBytes } from "node:crypto";
import { body, fail, ok } from "@/lib/api";
import { demoState, getMode, saveDemoState } from "@/lib/session";
import { demoPrivate } from "@/lib/demo";
import { copyQuote } from "@/lib/copyquote";

// Demo: copy a trade with demo money at today's real price (a NEAR Intents price check that moves nothing).
export async function POST(req: Request) {
  if ((await getMode()) !== "demo") return fail("This is the demo endpoint.", 409);
  const { trader, tradeId, usd } = await body<{ trader?: string; tradeId?: string; usd?: number }>(req);
  const s = await demoState();
  if (!trader || !s.keys.some((k) => k.trader === trader && k.expiresAt > Date.now())) return fail("You need a key first.", 403);
  if (!(typeof usd === "number" && usd >= 1 && usd <= 1000)) return fail("Pick an amount.");
  const view = await demoPrivate(trader, 400);
  const trade = view?.trades.find((t) => t.id === tradeId);
  if (!trade) return fail("Trade not found.", 404);
  const q = await copyQuote(trade, usd);
  const copy = {
    id: `c_${randomBytes(5).toString("hex")}`,
    trader,
    tradeId: trade.id,
    sym: trade.to,
    amount: q.amountOut,
    usdIn: usd,
    priceAt: q.price,
    at: Date.now(),
    status: "done" as const,
  };
  s.copies = [...s.copies, copy];
  await saveDemoState(s);
  return ok(copy);
}
