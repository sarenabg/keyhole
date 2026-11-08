import "server-only";
import { currentViewer, demoState, getMode, liveEnabled } from "./session";
import { demoPrivate, demoTrader, demoTraders } from "./demo";
import { liveKey, liveMyCopies, liveMyKeys, livePrivate, liveTrader, liveTraders } from "./live";
import { keysContract } from "./near";
import type { Holding, Mode, MyCopy, MyKey, Period, TradeView, TraderCard, Viewer } from "./types";

// One place the pages ask for data. Demo and Live answer the same questions.

export type Ctx = { mode: Mode; viewer: Viewer | null; liveAvailable: boolean };

export async function context(): Promise<Ctx> {
  const mode = await getMode();
  return { mode, viewer: await currentViewer(mode), liveAvailable: liveEnabled() };
}

export function parsePeriod(v: string | string[] | undefined): Period {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return n === 7 || n === 30 ? n : 90;
}

export async function traders(ctx: Ctx, period: Period): Promise<TraderCard[]> {
  if (ctx.mode === "demo") return demoTraders(period, await demoState());
  try {
    return await liveTraders(period);
  } catch (e) {
    console.error("live traders", e);
    return [];
  }
}

export async function trader(ctx: Ctx, id: string, period: Period): Promise<TraderCard | null> {
  if (ctx.mode === "demo") return demoTrader(id, period, await demoState());
  return liveTrader(id, period);
}

export async function myKey(ctx: Ctx, traderId: string): Promise<MyKey | null> {
  if (!ctx.viewer) return null;
  if (ctx.mode === "demo") {
    const s = await demoState();
    return s.keys.find((k) => k.trader === traderId && k.expiresAt > Date.now()) ?? null;
  }
  return liveKey(traderId, ctx.viewer.id);
}

/** Trades and holdings. Returns null unless the viewer holds a valid key. */
export async function privateView(ctx: Ctx, traderId: string): Promise<{ trades: TradeView[]; holdings: Holding[] } | null> {
  const key = await myKey(ctx, traderId);
  if (!key) return null;
  return ctx.mode === "demo" ? demoPrivate(traderId) : livePrivate(traderId);
}

export async function myKeys(ctx: Ctx): Promise<MyKey[]> {
  if (!ctx.viewer) return [];
  if (ctx.mode === "demo") return (await demoState()).keys;
  return liveMyKeys(ctx.viewer.id);
}

export async function myCopies(ctx: Ctx): Promise<MyCopy[]> {
  if (!ctx.viewer) return [];
  if (ctx.mode === "demo") return (await demoState()).copies;
  return liveMyCopies(ctx.viewer.id);
}

/** Share of a key price the trader receives: 95% through the keys contract (5% fee), 100% when paid directly. */
export function traderCut(mode: Mode): number {
  if (mode === "demo") return 0.95;
  return keysContract() ? 0.95 : 1;
}
