import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Avatar, Card, CoinIcon, KeyIcon, cx } from "@/components/ui";
import { SignInPrompt } from "@/components/SignInPrompt";
import { context, myCopies, myKeys, trader } from "@/lib/store";
import { amount, dateShort, money, pct, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const ctx = await context();
  if (ctx.mode === "live" && !ctx.viewer) {
    return (
      <>
        <Header ctx={ctx} active="keys" />
        <SignInPrompt title="Your keys" sub="Sign in with the wallet you bought keys with." />
      </>
    );
  }
  const now = Date.now();
  const keys = (await myKeys(ctx)).sort((a, b) => b.expiresAt - a.expiresAt);
  const copies = (await myCopies(ctx)).filter((c) => c.tradeId);
  const cards = await Promise.all(keys.map(async (k) => ({ k, t: await trader(ctx, k.trader, 90) })));

  return (
    <>
      <Header ctx={ctx} active="keys" />
      <main className="mx-auto flex max-w-[1000px] flex-col gap-8 px-4 pb-16 pt-10 sm:px-8">
        <h1 className="m-0 font-display text-[34px] font-semibold tracking-[-0.02em]">My keys</h1>
        {cards.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-tint text-accent-ink"><KeyIcon size={24} /></span>
            <span className="text-lg font-semibold">No keys yet</span>
            <span className="text-[15px] text-muted">Pick a trader and buy a key to see their trades.</span>
            <Link href="/" className="mt-2 flex h-11 items-center rounded-full bg-accent px-5 font-semibold text-white no-underline">See traders</Link>
          </Card>
        ) : (
          <section className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
            {cards.map(({ k, t }) => {
              const live = k.expiresAt > now;
              const left = Math.ceil((k.expiresAt - now) / 86_400_000);
              return (
                <Card key={k.trader} className="flex flex-col gap-4 p-5">
                  <div className="flex items-center gap-3">
                    <Avatar id={k.trader} name={t?.name ?? k.trader} idx={t?.avatar} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold">{t?.name ?? k.trader}</span>
                      <span className={cx("text-[13px]", live ? "text-accent-ink" : "text-muted")}>{live ? `${left} ${left === 1 ? "day" : "days"} left` : `Ended ${dateShort(k.expiresAt)}`}</span>
                    </div>
                    {t && (
                      <span className="flex flex-col items-end">
                        <span className={cx("text-sm font-semibold", t.record.ret >= 0 ? "text-up" : "text-down")}>{pct(t.record.ret)}</span>
                        <span className="text-xs text-muted">90 days</span>
                      </span>
                    )}
                  </div>
                  <Link
                    href={live ? `/t/${encodeURIComponent(k.trader)}/trades` : `/t/${encodeURIComponent(k.trader)}`}
                    className={cx("flex h-11 items-center justify-center rounded-xl font-semibold no-underline", live ? "bg-ink text-white" : "border border-line text-ink")}
                  >
                    {live ? "See trades" : "Get a new key"}
                  </Link>
                </Card>
              );
            })}
          </section>
        )}

        {copies.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="m-0 text-lg font-semibold">My copies</h2>
            <Card className="overflow-hidden">
              {copies.slice().reverse().map((c) => (
                <div key={c.id} className="flex items-center gap-3 border-b border-line-soft px-5 py-3.5 last:border-0">
                  <CoinIcon sym={c.sym} size={28} />
                  <div className="flex flex-1 flex-col">
                    <span className="font-semibold">{amount(c.amount)} {c.sym}</span>
                    <span className="text-[13px] text-muted">{money(c.usdIn)} · {timeAgo(c.at)}</span>
                  </div>
                  <span className={cx("text-sm font-medium", c.status === "done" ? "text-up" : c.status === "waiting" ? "text-muted" : "text-down")}>
                    {c.status === "done" ? "Done" : c.status === "waiting" ? "Waiting" : "Didn't go through"}
                  </span>
                </div>
              ))}
            </Card>
          </section>
        )}
      </main>
      <Footer mode={ctx.mode} />
    </>
  );
}
