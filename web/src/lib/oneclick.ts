import "server-only";

// NEAR Intents 1Click API (https://docs.near-intents.org). Every real-money step in Live mode goes through here.
const API = process.env.ONECLICK_URL ?? "https://1click.chaindefuser.com/v0";

// USDC on NEAR: what key payments settle in.
export const USDC_NEAR = "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
export const USDC_DECIMALS = 6;

function partnerHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", "User-Agent": "keyhole/0.1" };
  // Optional partner key: lower fees, and (if NEAR enabled it) fully private quotes.
  if (process.env.ONECLICK_API_KEY) h["X-API-Key"] = process.env.ONECLICK_API_KEY;
  return h;
}

/** Fully private (Confidential Intents) quotes need a partner key with confidential access. */
export function confidentialEnabled(): boolean {
  return Boolean(process.env.ONECLICK_API_KEY) && process.env.KEYHOLE_CONFIDENTIAL === "1";
}

async function call<T>(path: string, init: RequestInit & { headers?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, cache: "no-store" });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const msg = (json as { message?: string } | null)?.message ?? text.slice(0, 200) ?? `HTTP ${res.status}`;
    const err = new Error(`${path}: ${msg}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return json as T;
}

export type RawToken = {
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: string;
  price: number;
  priceUpdatedAt?: string;
  contractAddress?: string | null;
};

let tokenCache: { at: number; tokens: RawToken[] } | null = null;

export async function getTokens(): Promise<RawToken[]> {
  if (tokenCache && Date.now() - tokenCache.at < 60_000) return tokenCache.tokens;
  const tokens = await call<RawToken[]>("/tokens", { headers: partnerHeaders() });
  tokenCache = { at: Date.now(), tokens };
  return tokens;
}

// ---------- Quotes and status ----------

export type QuoteRequest = {
  dry: boolean;
  swapType: "EXACT_INPUT" | "EXACT_OUTPUT";
  originAsset: string;
  destinationAsset: string;
  amount: string;
  recipient: string;
  recipientType: "DESTINATION_CHAIN" | "INTENTS";
  refundTo: string;
  refundType: "ORIGIN_CHAIN" | "INTENTS";
  depositType?: "ORIGIN_CHAIN" | "INTENTS";
  customRecipientMsg?: string;
  minutesValid?: number;
  slippageBps?: number;
};

export type Quote = {
  amountIn: string;
  amountInFormatted: string;
  amountInUsd?: string;
  minAmountIn?: string;
  amountOut: string;
  amountOutFormatted: string;
  amountOutUsd?: string;
  minAmountOut?: string;
  timeEstimate?: number;
  depositAddress?: string;
  depositMemo?: string;
  deadline?: string;
};

export type QuoteResponse = { quote: Quote; quoteRequest: Record<string, unknown>; signature: string; timestamp: string };

export async function getQuote(q: QuoteRequest): Promise<QuoteResponse> {
  const body: Record<string, unknown> = {
    dry: q.dry,
    swapType: q.swapType,
    slippageTolerance: q.slippageBps ?? 100,
    originAsset: q.originAsset,
    depositType: q.depositType ?? "ORIGIN_CHAIN",
    destinationAsset: q.destinationAsset,
    amount: q.amount,
    recipient: q.recipient,
    recipientType: q.recipientType,
    refundTo: q.refundTo,
    refundType: q.refundType,
    deadline: new Date(Date.now() + (q.minutesValid ?? 30) * 60_000).toISOString(),
    referral: "keyhole",
  };
  if (q.customRecipientMsg) body.customRecipientMsg = q.customRecipientMsg;
  if (confidentialEnabled()) body.confidentiality = "basic";
  return call<QuoteResponse>("/quote", { method: "POST", headers: partnerHeaders(), body: JSON.stringify(body) });
}

export type SwapStatus =
  | "PENDING_DEPOSIT"
  | "KNOWN_DEPOSIT_TX"
  | "PROCESSING"
  | "SUCCESS"
  | "INCOMPLETE_DEPOSIT"
  | "REFUNDED"
  | "FAILED";

export type StatusResponse = {
  status: SwapStatus;
  updatedAt?: string;
  swapDetails?: {
    amountIn?: string;
    amountOut?: string;
    amountOutFormatted?: string;
    refundedAmountFormatted?: string;
    nearTxHashes?: string[];
    originChainTxHashes?: { hash: string; explorerUrl: string }[];
    destinationChainTxHashes?: { hash: string; explorerUrl: string }[];
  };
};

export async function getStatus(depositAddress: string, depositMemo?: string | null): Promise<StatusResponse> {
  const qs = new URLSearchParams({ depositAddress });
  if (depositMemo) qs.set("depositMemo", depositMemo);
  return call<StatusResponse>(`/status?${qs}`, { headers: partnerHeaders() });
}

// ---------- Wallet sign-in (User-Session) and private balances ----------

export type Session = { accessToken: string; refreshToken: string; expiresIn: number; refreshExpiresIn: number };

/** Sends a wallet-signed empty intent to NEAR Intents. Success proves the wallet owns that Intents account. */
export async function authenticate(signedData: Record<string, unknown>): Promise<Session> {
  return call<Session>("/auth/authenticate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedData }),
  });
}

export async function refresh(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  return call("/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
}

export type BalanceEntry = { tokenId: string; available: string; source: string };

/** Private (Confidential Intents) balances of the signed-in account. Nobody else can read these. */
export async function privateBalances(accessToken: string): Promise<BalanceEntry[]> {
  const res = await call<{ balances: BalanceEntry[] }>("/account/balances", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.balances ?? [];
}
