import "server-only";
import { NextResponse } from "next/server";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

/** Turns errors into friendly messages; never leaks internals. */
export function friendly(e: unknown): string {
  const m = (e as Error)?.message ?? "";
  if (/fetch failed|ENOTFOUND|ECONNRESET|timeout/i.test(m)) return "NEAR Intents didn't answer. Try again in a moment.";
  if (/signature verification failed/i.test(m)) return "Your wallet's signature wasn't accepted. If this is a NEAR account, use it once on near.com first, then try again.";
  if (/timestamp validation failed/i.test(m)) return "Your computer's clock looks off. Check the time and try again.";
  if (/Amount is too low|too low/i.test(m)) return "That amount is too small for this coin. Try a bigger amount or another coin.";
  if (m.length && m.length < 160 && !/^\/|Error:|at /.test(m)) return m;
  return "Something went wrong. Try again.";
}
