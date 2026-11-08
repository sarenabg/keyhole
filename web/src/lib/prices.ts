import "server-only";
import { getTokens, type RawToken } from "./oneclick";
import { FALLBACK_PRICES } from "./sim.mjs";

// Today's prices, live from NEAR Intents. Coins are grouped by symbol (USDC on Base and USDC on NEAR are both "USDC").

export function symbolOf(t: Pick<RawToken, "symbol">): string {
  return t.symbol === "wNEAR" ? "NEAR" : t.symbol;
}

export async function tokens(): Promise<RawToken[]> {
  try {
    return await getTokens();
  } catch {
    return [];
  }
}

/** Price per coin symbol (USD). Falls back to recent fixed prices if NEAR Intents can't be reached. */
export async function priceMap(): Promise<Record<string, number>> {
  const out: Record<string, number> = { ...FALLBACK_PRICES };
  const list = await tokens();
  // Prefer the NEAR-native listing of each coin, then any other.
  const ranked = [...list].sort((a, b) => Number(b.blockchain === "near") - Number(a.blockchain === "near"));
  const seen = new Set<string>();
  for (const t of ranked) {
    const sym = symbolOf(t);
    if (seen.has(sym) || !t.price) continue;
    seen.add(sym);
    out[sym] = t.price;
  }
  out.USDC = 1;
  return out;
}

export async function pricesLive(): Promise<boolean> {
  return (await tokens()).length > 0;
}

/** NEAR Intents asset id → token info. */
export async function assetIndex(): Promise<Map<string, RawToken>> {
  return new Map((await tokens()).map((t) => [t.assetId, t]));
}

/** The NEAR-side asset id for a coin symbol (what lands in an Intents balance when you buy it). */
export async function nearAssetFor(sym: string): Promise<string | null> {
  const list = await tokens();
  const want = sym === "NEAR" ? "wNEAR" : sym;
  const onNear = list.find((t) => t.symbol === want && t.blockchain === "near");
  if (onNear) return onNear.assetId;
  return list.find((t) => symbolOf(t) === sym)?.assetId ?? null;
}
