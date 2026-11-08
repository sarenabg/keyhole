import { ok } from "@/lib/api";
import { groupCoins } from "@/lib/coins";
import { tokens } from "@/lib/prices";

// Coins people can pay with, live from NEAR Intents (most popular first).
export async function GET() {
  const coins = groupCoins(await tokens()).map((c) => ({
    symbol: c.symbol,
    name: c.name,
    logo: c.logo,
    price: c.price,
    places: c.places.map((p) => ({ assetId: p.assetId, chain: p.chain, chainName: p.chainName, chainLogo: p.chainLogo, decimals: p.decimals })),
  }));
  return ok({ coins });
}
