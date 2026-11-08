import Link from "next/link";
import { Header } from "@/components/Header";
import { TraderCard } from "@/components/TraderCard";
import { Footer } from "@/components/Footer";
import { context, myKeys, parsePeriod, traders } from "@/lib/store";
import { cx } from "@/components/ui";
import { PERIODS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const period = parsePeriod(sp.p);
  const ctx = await context();
  const [list, keys] = await Promise.all([traders(ctx, period), myKeys(ctx)]);
  const held = new Set(keys.filter((k) => k.expiresAt > Date.now()).map((k) => k.trader));

  return (
    <>
      <Header ctx={ctx} active="traders" />
      <main className="mx-auto flex max-w-[1264px] flex-col gap-9 px-4 pb-16 pt-10 sm:px-8 sm:pt-12">
        <section className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex max-w-[640px] flex-col gap-3">
            <h1 className="m-0 font-display text-[36px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[48px]">
              Follow traders who trade in private.
            </h1>
            <p className="m-0 text-lg leading-normal text-muted">Every record comes straight from NEAR, so nobody can fake it. Buy a key to see the trades.</p>
          </div>
          <div className="flex gap-1 rounded-xl border border-line bg-surface p-1" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={`/?p=${p}`}
                scroll={false}
                aria-current={p === period ? "true" : undefined}
                className={cx("flex h-9 items-center rounded-[9px] px-3.5 text-sm no-underline", p === period ? "bg-ink font-semibold text-white" : "font-medium text-muted hover:text-ink")}
              >
                {p} days
              </Link>
            ))}
          </div>
        </section>

        {list.length ? (
          <section className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,330px),1fr))]" aria-label="Traders">
            {list.map((t) => (
              <TraderCard key={t.id} t={t} period={period} hasKey={held.has(t.id)} demo={ctx.mode === "demo"} />
            ))}
          </section>
        ) : (
          <section className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
            <span className="text-lg font-semibold">No live traders yet</span>
            <span className="max-w-md text-[15px] text-muted">Be the first: prove your record from your private NEAR account and start selling keys.</span>
            <Link href="/sell/start" className="mt-2 flex h-11 items-center rounded-full bg-accent px-5 font-semibold text-white no-underline">Start selling keys</Link>
          </section>
        )}

        <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]" aria-label="How it works">
          {[
            ["Pick a trader", "Records come straight from NEAR."],
            ["Buy a key", "The trader is paid instantly."],
            ["See and copy", "Their trades, in private, in one tap."],
          ].map(([title, sub], i) => (
            <div key={title} className="flex items-start gap-3.5 rounded-2xl border border-line bg-surface p-5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-accent-tint font-bold text-accent-ink">{i + 1}</span>
              <div className="flex flex-col gap-1">
                <span className="font-semibold">{title}</span>
                <span className="text-sm leading-snug text-muted">{sub}</span>
              </div>
            </div>
          ))}
        </section>
      </main>
      <Footer mode={ctx.mode} />
    </>
  );
}
