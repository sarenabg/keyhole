import { body, fail, friendly, ok } from "@/lib/api";
import { getMode, liveSession } from "@/lib/session";
import { startPurchase } from "@/lib/live";

// Live: buy a key. Returns a real one-time NEAR Intents payment address for exactly the key price.
export async function POST(req: Request) {
  if ((await getMode()) !== "live") return fail("Switch to Live mode first.", 409);
  const me = await liveSession();
  if (!me) return fail("Sign in first.", 401);
  const { trader, days, asset } = await body<{ trader?: string; days?: number; asset?: string }>(req);
  if (!trader || !asset || (days !== 7 && days !== 30 && days !== 90)) return fail("Pick a key and a coin.");
  try {
    return ok(await startPurchase(trader, me.id, days, asset));
  } catch (e) {
    return fail(friendly(e));
  }
}
