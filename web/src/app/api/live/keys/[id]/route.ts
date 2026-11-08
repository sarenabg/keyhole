import { fail, friendly, ok } from "@/lib/api";
import { liveSession } from "@/lib/session";
import { checkPurchase } from "@/lib/live";

// Live: has the key payment arrived? (Asks NEAR Intents.)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await liveSession();
  if (!me) return fail("Sign in first.", 401);
  try {
    return ok(await checkPurchase((await params).id, me.id));
  } catch (e) {
    return fail(friendly(e), 404);
  }
}
