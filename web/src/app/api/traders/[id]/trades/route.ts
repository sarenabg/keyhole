import { fail, ok } from "@/lib/api";
import { context, privateView } from "@/lib/store";

// The private feed. 403 unless you hold a key.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await context();
  const view = await privateView(ctx, decodeURIComponent((await params).id));
  if (!view) return fail("This trader's trades are private. Buy a key to see them.", 403);
  return ok(view);
}
