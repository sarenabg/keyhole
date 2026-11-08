import { body, fail, friendly, ok } from "@/lib/api";
import { getMode, liveSession } from "@/lib/session";
import { livePrivate, liveKey, startCopy } from "@/lib/live";

// Live: copy a trade. A real NEAR Intents swap into the same coin, landing in the follower's own balance.
export async function POST(req: Request) {
  if ((await getMode()) !== "live") return fail("Switch to Live mode first.", 409);
  const me = await liveSession();
  if (!me) return fail("Sign in first.", 401);
  const { trader, tradeId, usd, asset } = await body<{ trader?: string; tradeId?: string; usd?: number; asset?: string }>(req);
  if (!trader || !tradeId || !asset || typeof usd !== "number") return fail("Missing details.");
  if (!(await liveKey(trader, me.id))) return fail("You need a key first.", 403);
  const view = await livePrivate(trader, 200);
  const trade = view?.trades.find((t) => t.id === tradeId);
  if (!trade) return fail("Trade not found.", 404);
  try {
    return ok(await startCopy(me.id, trader, trade, usd, asset));
  } catch (e) {
    return fail(friendly(e));
  }
}
