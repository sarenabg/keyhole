import { body, fail, friendly, ok } from "@/lib/api";
import { verifyWithIntents, type SignResult } from "@/lib/intents-auth";
import { liveEnabled, setLiveSession } from "@/lib/session";
import { isTrader, saveTraderSignIn } from "@/lib/live";

// Step 2: NEAR Intents checks the signature. Viewers get a sign-in cookie.
// Traders also hand us their (encrypted) NEAR Intents sign-in, so we can read their private record.
export async function POST(req: Request) {
  if (!liveEnabled()) return fail("Live mode isn't set up on this server.", 409);
  const { role, result } = await body<{ role?: "viewer" | "trader"; result?: SignResult }>(req);
  if (!result || !["evm", "solana", "near"].includes(result.kind)) return fail("Missing signature.");
  try {
    const { signerId, session } = await verifyWithIntents(result);
    if (role === "trader") await saveTraderSignIn(signerId, result.kind, session);
    await setLiveSession({ id: signerId, kind: result.kind, at: Date.now() });
    return ok({ id: signerId, trader: role === "trader" || (await isTrader(signerId)) });
  } catch (e) {
    return fail(friendly(e), 401);
  }
}
