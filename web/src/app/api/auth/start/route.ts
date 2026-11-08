import { body, fail, friendly, ok } from "@/lib/api";
import { signRequest, type WalletKind } from "@/lib/intents-auth";

// Step 1 of wallet sign-in: the exact text for the wallet to sign (an empty request that moves no money).
export async function POST(req: Request) {
  const { kind, who } = await body<{ kind?: WalletKind; who?: string }>(req);
  if (!kind || !["evm", "solana", "near"].includes(kind) || !who) return fail("Pick a wallet.");
  try {
    return ok(await signRequest(kind, who));
  } catch (e) {
    return fail(friendly(e));
  }
}
