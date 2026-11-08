import { ok } from "@/lib/api";
import { setLiveSession } from "@/lib/session";

export async function POST() {
  await setLiveSession(null);
  return ok({ ok: true });
}
