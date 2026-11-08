// Shapes the pages work with, the same in Demo and Live mode.

export type Mode = "demo" | "live";
export type Period = 7 | 30 | 90;
export const PERIODS: Period[] = [7, 30, 90];
export const KEY_DAYS = [7, 30, 90] as const;
export type KeyDays = (typeof KEY_DAYS)[number];

export type TrackRecord = {
  ret: number;
  winRate: number | null;
  maxDip: number;
  perWeek: number;
  holdDays: number | null;
  spark: number[];
  trades: number;
  enoughData: boolean;
};

export type TraderCard = {
  id: string;
  name: string;
  handle: string;
  avatar: number;
  record: TrackRecord;
  prices: { 7: number; 30: number; 90: number };
  holders: number;
  maxKeys: number;
  coins: string[];
  since: string;
  updatedAt: number;
  allowCopy: boolean;
  /** Live mode: the trader's sign-in has lapsed, so the record is paused. */
  paused?: boolean;
};

export type TradeView = {
  id: string;
  t: number;
  title: string;
  from: string;
  to: string;
  fromAmount: number;
  toAmount: number;
  share: number;
  /** Price of the coin that isn't a dollar coin, at the time. */
  price: number;
  priceSym: string;
  /** How the trade has done since (coin bought vs coin sold). */
  since: number;
  /** NEAR Intents asset id of the coin bought (live mode), for copying. */
  toAssetId?: string;
};

export type Holding = { sym: string; share: number };

export type MyKey = { trader: string; days: number; expiresAt: number; paid: number; boughtAt: number; receipt?: string };

export type MyCopy = {
  id: string;
  trader: string;
  tradeId: string;
  sym: string;
  amount: number;
  usdIn: number;
  priceAt: number;
  at: number;
  status: "done" | "waiting" | "failed";
  receipt?: string;
};

export type Viewer = { id: string; label: string; kind: "guest" | "evm" | "solana" | "near" };
