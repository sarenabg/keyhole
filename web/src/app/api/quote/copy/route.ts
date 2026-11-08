import { body, fail, ok } from "@/lib/api";
import { context, privateView } from "@/lib/store";
import { copyQuote } from "@/lib/copyquote";

// Price check for a copy (no money moves). Only for key holders, since it reveals the trade.
export async function POST(req: Request) {
  const { trader, tradeId, usd, asset } = await body<{ trader?: string; tradeId?: string; usd?: number; asset?: string }>(req);
  if (!trader || !tradeId || !(typeof usd === "number" && usd > 0)) return fail("Missing details.");
  const ctx = await context();
  const view = await privateView(ctx, trader);
  if (!view) return fail("You need a key first.", 403);
  const trade = view.trades.find((t) => t.id === tradeId);
  if (!trade) return fail("Trade not found.", 404);
  const q = await copyQuote(trade, usd, asset || undefined);
  return ok({ amountOut: q.amountOut.toPrecision(6), real: q.real });
}
