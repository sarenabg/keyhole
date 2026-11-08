import { body, fail, friendly, ok } from "@/lib/api";
import { liveSession } from "@/lib/session";
import { snapshot, updateTraderSettings } from "@/lib/live";

// Live: a trader sets their name, key prices and limits, and lists or unlists themselves.
export async function POST(req: Request) {
  const me = await liveSession();
  if (!me) return fail("Sign in first.", 401);
  const v = await body<{ name?: string; prices?: [number, number, number]; maxKeys?: number; allowCopy?: boolean; listed?: boolean; refresh?: boolean }>(req);
  try {
    if (v.refresh) {
      await snapshot(me.id, true);
      return ok({ ok: true });
    }
    await updateTraderSettings(me.id, v);
    return ok({ ok: true });
  } catch (e) {
    return fail(friendly(e));
  }
}
