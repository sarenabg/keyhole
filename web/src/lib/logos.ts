// Real logos for coins and chains, collected by research/build_logos.py (sources listed in logos.json).
import manifest from "./logos.json";

const coins = manifest.coins as Record<string, string>;
const chains = manifest.chains as Record<string, string>;

export function coinLogo(symbol: string): string | null {
  return coins[symbol] ?? coins[symbol.toUpperCase()] ?? null;
}

export function chainLogo(chain: string): string | null {
  return chains[chain] ?? null;
}
