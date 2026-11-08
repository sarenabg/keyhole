import "server-only";

// Read-only calls to NEAR mainnet (no keys, no signing).
const RPC = process.env.NEAR_RPC_URL ?? "https://rpc.mainnet.near.org";

export function keysContract(): string | null {
  return process.env.KEYHOLE_KEYS_CONTRACT || null;
}

export async function view<T>(contract: string, method: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "query",
      params: {
        request_type: "call_function",
        finality: "optimistic",
        account_id: contract,
        method_name: method,
        args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
      },
    }),
    cache: "no-store",
  });
  const json = await res.json();
  if (json.error || json.result?.error) throw new Error(JSON.stringify(json.error ?? json.result.error).slice(0, 200));
  return JSON.parse(Buffer.from(json.result.result).toString()) as T;
}

export type OnChainKey = { trader: string; holder: string; expires_at_ms: number; total_paid: string; purchases: number; last_days: number };

export async function onChainKey(trader: string, holder: string): Promise<OnChainKey | null> {
  const c = keysContract();
  if (!c) return null;
  try {
    return await view<OnChainKey | null>(c, "get_key", { trader, holder });
  } catch {
    return null;
  }
}

export function explorerAccount(id: string): string {
  return `https://nearblocks.io/address/${id}`;
}
