import { ok } from "@/lib/api";
import { context, parsePeriod, traders } from "@/lib/store";

// Public records, as data. No trades in here: those are private.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ctx = await context();
  const list = await traders(ctx, parsePeriod(url.searchParams.get("p") ?? undefined));
  return ok({ mode: ctx.mode, traders: list });
}
