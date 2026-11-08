// Turns NEAR Intents' raw token list into friendly "coins" for the UI.
// One coin (e.g. USDC) can live in several places (Base, Solana, Ethereum…).
import { chainLogo, coinLogo } from "./logos";

export type RawToken = {
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: string;
  price: number;
  contractAddress?: string | null;
};

export type CoinPlace = {
  assetId: string;
  chain: string;
  chainName: string;
  chainColor: string;
  chainLogo: string | null;
  decimals: number;
  native: boolean;
};

export type Coin = {
  symbol: string;
  name: string;
  logo: string | null;
  color: string;
  price: number;
  places: CoinPlace[];
};

const CHAINS: Record<string, { name: string; color: string }> = {
  eth: { name: "Ethereum", color: "#5F72D9" },
  base: { name: "Base", color: "#0052FF" },
  arb: { name: "Arbitrum", color: "#2D9CDB" },
  op: { name: "Optimism", color: "#E5303A" },
  pol: { name: "Polygon", color: "#7B3FE4" },
  bsc: { name: "BNB Chain", color: "#D9A400" },
  avax: { name: "Avalanche", color: "#E84142" },
  gnosis: { name: "Gnosis", color: "#3E6957" },
  sol: { name: "Solana", color: "#8A4DF0" },
  btc: { name: "Bitcoin", color: "#E8891A" },
  near: { name: "NEAR", color: "#1B1D22" },
  tron: { name: "Tron", color: "#D9263B" },
  ton: { name: "TON", color: "#1E88D6" },
  sui: { name: "Sui", color: "#3C8FE0" },
  aptos: { name: "Aptos", color: "#2B2F38" },
  xrp: { name: "XRP Ledger", color: "#3B4250" },
  doge: { name: "Dogecoin", color: "#B8962E" },
  ltc: { name: "Litecoin", color: "#5C7EA8" },
  bch: { name: "Bitcoin Cash", color: "#4C9A54" },
  zec: { name: "Zcash", color: "#C99A1D" },
  dash: { name: "Dash", color: "#1C75BC" },
  cardano: { name: "Cardano", color: "#2A5ADA" },
  stellar: { name: "Stellar", color: "#2B2F38" },
  starknet: { name: "Starknet", color: "#EC796B" },
  scroll: { name: "Scroll", color: "#C79B5B" },
  monad: { name: "Monad", color: "#6E54FF" },
  bera: { name: "Berachain", color: "#814625" },
  xlayer: { name: "X Layer", color: "#2B2F38" },
  plasma: { name: "Plasma", color: "#1F8F6E" },
  hypercore: { name: "Hyperliquid", color: "#3BB59A" },
  abs: { name: "Abstract", color: "#2DBE6C" },
  hood: { name: "Robinhood Chain", color: "#7AB648" },
  movement: { name: "Movement", color: "#C9A227" },
  aleo: { name: "Aleo", color: "#2B2F38" },
  miden: { name: "Miden", color: "#E0592A" },
};

const COINS: Record<string, { name: string; glyph: string; color: string }> = {
  USDC: { name: "USD Coin", glyph: "$", color: "#2775CA" },
  USDT: { name: "Tether", glyph: "₮", color: "#1F8F6E" },
  BTC: { name: "Bitcoin", glyph: "₿", color: "#E8891A" },
  ETH: { name: "Ether", glyph: "Ξ", color: "#5F72D9" },
  SOL: { name: "Solana", glyph: "S", color: "#8A4DF0" },
  NEAR: { name: "NEAR", glyph: "N", color: "#1B1D22" },
  wNEAR: { name: "NEAR", glyph: "N", color: "#1B1D22" },
  XRP: { name: "XRP", glyph: "X", color: "#3B4250" },
  DOGE: { name: "Dogecoin", glyph: "Ð", color: "#B8962E" },
  ZEC: { name: "Zcash", glyph: "Z", color: "#C99A1D" },
  LTC: { name: "Litecoin", glyph: "Ł", color: "#5C7EA8" },
  BCH: { name: "Bitcoin Cash", glyph: "B", color: "#4C9A54" },
  TRX: { name: "Tron", glyph: "T", color: "#D9263B" },
  TON: { name: "Toncoin", glyph: "T", color: "#1E88D6" },
  SUI: { name: "Sui", glyph: "S", color: "#3C8FE0" },
  APT: { name: "Aptos", glyph: "A", color: "#2B2F38" },
  ADA: { name: "Cardano", glyph: "A", color: "#2A5ADA" },
  XLM: { name: "Stellar", glyph: "X", color: "#2B2F38" },
  BNB: { name: "BNB", glyph: "B", color: "#D9A400" },
  POL: { name: "Polygon", glyph: "P", color: "#7B3FE4" },
  AVAX: { name: "Avalanche", glyph: "A", color: "#E84142" },
  DAI: { name: "Dai", glyph: "D", color: "#C9962A" },
  WBTC: { name: "Wrapped Bitcoin", glyph: "₿", color: "#E8891A" },
  XAUT: { name: "Tether Gold", glyph: "G", color: "#B8962E" },
  ARB: { name: "Arbitrum", glyph: "A", color: "#2D9CDB" },
  OP: { name: "Optimism", glyph: "O", color: "#E5303A" },
};

// The order beginners most likely want to see first.
const POPULAR = ["USDC", "USDT", "BTC", "ETH", "SOL", "NEAR", "XRP", "DOGE", "ZEC", "TRX", "TON", "LTC"];

// Where a coin most naturally lives, so it is offered first.
const HOME: Record<string, string> = { USDC: "base", USDT: "tron", ETH: "eth", NEAR: "near", wNEAR: "near" };

function fallbackColor(symbol: string): string {
  const palette = ["#5F72D9", "#1F8F6E", "#8A4DF0", "#C99A1D", "#2775CA", "#D9263B", "#3B4250", "#E8891A"];
  let h = 0;
  for (const ch of symbol) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

/** Logo for a coin symbol (for lists where only the symbol is known). */
export function coinLook(symbol: string) {
  return { logo: coinLogo(symbol) };
}

export function chainInfo(chain: string) {
  return CHAINS[chain] ?? { name: chain.charAt(0).toUpperCase() + chain.slice(1), color: "#8D8A80" };
}

export function groupCoins(tokens: RawToken[]): Coin[] {
  const bySymbol = new Map<string, Coin>();
  for (const t of tokens) {
    if (!t.price || t.price <= 0) continue;
    const symbol = t.symbol === "wNEAR" ? "NEAR" : t.symbol;
    const meta = COINS[symbol];
    let coin = bySymbol.get(symbol);
    if (!coin) {
      coin = {
        symbol,
        name: meta?.name ?? symbol,
        logo: coinLogo(symbol),
        color: meta?.color ?? fallbackColor(symbol),
        price: t.price,
        places: [],
      };
      bySymbol.set(symbol, coin);
    }
    const info = chainInfo(t.blockchain);
    coin.places.push({
      assetId: t.assetId,
      chain: t.blockchain,
      chainName: info.name,
      chainColor: info.color,
      chainLogo: chainLogo(t.blockchain),
      decimals: t.decimals,
      native: !t.contractAddress,
    });
  }

  for (const coin of bySymbol.values()) {
    const home = HOME[coin.symbol];
    coin.places.sort((a, b) => {
      const score = (p: CoinPlace) => (p.chain === home ? 0 : p.native ? 1 : 2);
      return score(a) - score(b) || a.chainName.localeCompare(b.chainName);
    });
  }

  return [...bySymbol.values()].sort((a, b) => {
    const ia = POPULAR.indexOf(a.symbol);
    const ib = POPULAR.indexOf(b.symbol);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.symbol.localeCompare(b.symbol);
  });
}

export function isPopular(symbol: string) {
  return POPULAR.includes(symbol);
}

/** Rough amount of a coin worth `usd`, for instant display before an exact quote. */
export function approxAmount(usd: number, price: number): string {
  return formatAmount(usd / price);
}

export function formatAmount(n: number): string {
  if (!isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 100) return n.toFixed(2);
  if (n >= 1) return n.toPrecision(4).replace(/\.?0+$/, "");
  return n.toPrecision(3).replace(/\.?0+$/, "");
}
