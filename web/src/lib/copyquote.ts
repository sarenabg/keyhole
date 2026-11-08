import "server-only";
import { getQuote, USDC_NEAR } from "./oneclick";
import { nearAssetFor, priceMap, tokens } from "./prices";
import type { TradeView } from "./types";

/** How much of the coin a copy would get: a real NEAR Intents quote with dry: true (moves no money). */
export async function copyQuote(trade: TradeView, usd: number, originAsset = USDC_NEAR): Promise<{ amountOut: number; price: number; real: boolean }> {
  const prices = await priceMap();
  const price = prices[trade.to] ?? trade.price;
  const fallback = { amountOut: (usd * 0.999) / price, price, real: false };
  try {
    const list = await tokens();
    const origin = list.find((t) => t.assetId === originAsset);
    const dest = trade.toAssetId ?? (await nearAssetFor(trade.to));
    if (!origin || !dest || origin.assetId === dest) return fallback;
    const q = await getQuote({
      dry: true,
      swapType: "EXACT_INPUT",
      originAsset,
      destinationAsset: dest,
      amount: String(Math.floor((usd / origin.price) * 10 ** origin.decimals)),
      recipient: "keyhole.near",
      recipientType: "INTENTS",
      refundTo: "keyhole.near",
      refundType: "INTENTS",
    });
    const out = Number(q.quote.amountOutFormatted);
    return out > 0 ? { amountOut: out, price: usd / out, real: true } : fallback;
  } catch {
    return fallback;
  }
}
