import { fail, ok } from "@/lib/api";
import { liveEnabled } from "@/lib/session";
import { snapshotAll } from "@/lib/live";

// Keeps every live record fresh. Called by a scheduler with the CRON_SECRET.
async function run(req: Request) {
  if (!liveEnabled()) return ok({ skipped: "live mode off" });
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) return fail("Not allowed.", 401);
  return ok(await snapshotAll());
}

export const GET = run;
export const POST = run;
