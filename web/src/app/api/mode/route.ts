import { cookies } from "next/headers";
import { body, fail, ok } from "@/lib/api";
import { liveEnabled } from "@/lib/session";

export async function POST(req: Request) {
  const { mode } = await body<{ mode?: string }>(req);
  if (mode !== "demo" && mode !== "live") return fail("Pick demo or live.");
  if (mode === "live" && !liveEnabled()) return fail("Live mode isn't set up on this server.", 409);
  (await cookies()).set("kh_mode", mode, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 90 });
  return ok({ mode });
}
