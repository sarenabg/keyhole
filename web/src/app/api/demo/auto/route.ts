import { body, fail, ok } from "@/lib/api";
import { demoState, getMode, saveDemoState } from "@/lib/session";

// Demo: switch "copy automatically" on or off for a trader.
export async function POST(req: Request) {
  if ((await getMode()) !== "demo") return fail("Copying automatically is coming soon in Live mode.", 409);
  const { trader, on } = await body<{ trader?: string; on?: boolean }>(req);
  const s = await demoState();
  if (!trader || !s.keys.some((k) => k.trader === trader && k.expiresAt > Date.now())) return fail("You need a key first.", 403);
  s.auto = on ? [...new Set([...s.auto, trader])] : s.auto.filter((x) => x !== trader);
  // Remember when it was switched on: trades after this count as copied.
  s.autoAt = { ...(s.autoAt ?? {}) };
  if (on) s.autoAt[trader] = Date.now();
  else delete s.autoAt[trader];
  await saveDemoState(s);
  return ok({ on: Boolean(on) });
}
