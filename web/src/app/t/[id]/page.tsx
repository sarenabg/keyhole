import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Avatar, Card, CheckIcon, CoinIcon, KeyIcon, LockIcon, Sparkline, Stat, Verified, cx, retColor } from "@/components/ui";
import { BuyKeyButton } from "@/components/BuyKey";
import { context, myKey, parsePeriod, trader, traderCut } from "@/lib/store";
import { dateShort, pct, timeAgo } from "@/lib/format";
import { PERIODS } from "@/lib/types";

export const dynamic = "force-dynamic";

const BLURRED = [
  ["Bought ZEC with NEAR", "12% · $58.40"],
  ["Sold BTC for USDC", "8% · $98,210"],
  ["Bought NEAR with USDC", "15% · $3.69"],
  ["Sold ZEC for NEAR", "6% · $61.10"],
];

export default async function TraderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const period = parsePeriod((await searchParams).p);
  const ctx = await context();
  const t = await trader(ctx, id, period);
  if (!t) notFound();
  const key = await myKey(ctx, id);
  const own = ctx.viewer?.id === id;
  const r = t.record;
  const left = Math.max(0, t.maxKeys - t.holders);
  const cut = traderCut(ctx.mode);

  return (
    <>
      <Header ctx={ctx} active="traders" />
      <main className="mx-auto flex max-w-[1264px] flex-wrap items-start gap-6 px-4 pb-16 pt-8 sm:px-8">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <Card className="flex flex-col gap-6 p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar id={t.id} name={t.name} idx={t.avatar} size={64} />
              <div className="flex min-w-[200px] flex-1 flex-col gap-1">
                <h1 className="m-0 font-display text-[30px] font-semibold tracking-[-0.02em]">{t.name}</h1>
                <span className="text-sm text-muted">{t.handle} · trading since {t.since}</span>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-accent-tint px-3 py-2 text-[13px] font-semibold text-accent-ink">
                <Verified size={15} label={ctx.mode === "demo" ? "Simulated demo record" : "Record read from NEAR"} /> {ctx.mode === "demo" ? "Demo record" : t.paused ? "Record paused" : "Record from NEAR"}
              </span>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className={cx("font-display text-[48px] font-semibold leading-none tracking-[-0.03em] sm:text-[56px]", r.enoughData ? retColor(r.ret) : "text-muted")}>
                  {r.enoughData ? pct(r.ret) : "New"}
                </span>
                <span className="text-sm text-muted">{r.enoughData ? `Last ${period} days` : "Record starting · check back tomorrow"}</span>
              </div>
              <div className="flex gap-1 rounded-xl bg-canvas p-1" role="group" aria-label="Period">
                {PERIODS.map((p) => (
                  <Link
                    key={p}
                    href={`/t/${encodeURIComponent(t.id)}?p=${p}`}
                    scroll={false}
                    aria-current={p === period ? "true" : undefined}
                    className={cx("flex h-[34px] items-center rounded-[9px] px-3 text-[13px] no-underline", p === period ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(13,17,23,0.08)]" : "font-medium text-muted")}
                  >
                    {p}D
                  </Link>
                ))}
              </div>
            </div>

            <Sparkline points={r.spark} up={r.ret >= 0} className="w-full" height={220} />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Win rate" value={pct(r.winRate, 0, false)} />
              <Stat label="Biggest dip" value={pct(r.maxDip)} />
              <Stat label="Trades a week" value={r.perWeek < 10 ? r.perWeek.toFixed(1).replace(/\.0$/, "") : Math.round(r.perWeek)} />
              <Stat label="Holds for" value={r.holdDays === null ? "—" : r.holdDays < 1 ? `${Math.max(1, Math.round(r.holdDays * 24))} h` : `${r.holdDays.toFixed(r.holdDays < 3 ? 1 : 0)} days`} />
            </div>
          </Card>

          <Card className="relative overflow-hidden px-5 py-6 sm:px-7">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="m-0 text-lg font-semibold">Trades</h2>
              <span className="text-[13px] text-muted">Updated {timeAgo(t.updatedAt)}</span>
            </div>
            {key || own ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-accent text-white"><KeyIcon size={22} /></span>
                <span className="text-lg font-semibold">{own ? "This is you" : "You have a key"}</span>
                {key && !own && <span className="text-sm text-muted">Open until {dateShort(key.expiresAt)}</span>}
                <Link href={`/t/${encodeURIComponent(t.id)}/trades`} className="flex h-[46px] items-center rounded-full bg-accent px-6 text-[15px] font-semibold text-white no-underline">
                  See {own ? "your" : `${t.name.split(" ")[0]}'s`} trades
                </Link>
              </div>
            ) : (
              <>
                <div className="pointer-events-none flex select-none flex-col opacity-55 blur-[6px]" aria-hidden="true">
                  {BLURRED.map(([a, b]) => (
                    <div key={a} className="flex items-center justify-between border-b border-line-soft py-3.5 last:border-0"><span className="font-semibold">{a}</span><span>{b}</span></div>
                  ))}
                </div>
                <div className="absolute inset-x-0 bottom-0 top-14 flex flex-col items-center justify-center gap-3 p-4 text-center">
                  <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-ink text-white"><LockIcon size={22} /></span>
                  <span className="text-lg font-semibold">{t.name.split(" ")[0]}&apos;s trades are private</span>
                  <span className="text-sm text-muted">{t.holders} {t.holders === 1 ? "person has" : "people have"} a key</span>
                  <BuyKeyButton
                    mode={ctx.mode}
                    signedIn={Boolean(ctx.viewer)}
                    trader={{ id: t.id, name: t.name, avatar: t.avatar, ret: r.ret, period, prices: t.prices, cut, isNew: !r.enoughData }}
                    className="flex h-[46px] items-center rounded-full bg-accent px-6 text-[15px] font-semibold text-white"
                  >
                    Get a key
                  </BuyKeyButton>
                </div>
              </>
            )}
          </Card>
        </div>

        <aside className="flex w-full flex-[1_1_320px] flex-col gap-4 sm:max-w-[380px]">
          <section className="flex flex-col gap-[18px] rounded-[20px] bg-night p-6 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent"><KeyIcon size={20} /></span>
              <span className="text-[17px] font-semibold">Key to {t.name.split(" ")[0]}&apos;s trades</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[40px] font-semibold tracking-[-0.02em]">{t.prices[30]} USDC</span>
              <span className="text-[15px] text-night-muted">/ 30 days</span>
            </div>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-sm text-[#D9DEE7]">
              {["Every trade, as it happens", "Copy any trade in one tap", "No subscription. It just ends."].map((x) => (
                <li key={x} className="flex items-center gap-2.5"><CheckIcon size={16} stroke={2.6} className="text-accent-light" />{x}</li>
              ))}
            </ul>
            {key ? (
              <Link href={`/t/${encodeURIComponent(t.id)}/trades`} className="flex h-[50px] items-center justify-center rounded-[14px] bg-white font-semibold text-ink no-underline">
                See trades
              </Link>
            ) : own ? (
              <Link href="/sell" className="flex h-[50px] items-center justify-center rounded-[14px] bg-white font-semibold text-ink no-underline">Your earnings</Link>
            ) : (
              <BuyKeyButton
                mode={ctx.mode}
                signedIn={Boolean(ctx.viewer)}
                trader={{ id: t.id, name: t.name, avatar: t.avatar, ret: r.ret, period, prices: t.prices, cut, isNew: !r.enoughData }}
                className="flex h-[50px] w-full items-center justify-center rounded-[14px] bg-white font-semibold text-ink"
              >
                Get a key
              </BuyKeyButton>
            )}
            <span className="text-center text-[13px] text-night-muted">{key ? `Yours until ${dateShort(key.expiresAt)}` : `${left} of ${t.maxKeys} keys left`}</span>
          </section>

          <Card className="flex flex-col gap-3 p-5">
            <span className="text-[15px] font-semibold">Why you can trust this record</span>
            <p className="m-0 text-sm leading-normal text-muted">
              {ctx.mode === "demo"
                ? "In Live mode we read the trader's private NEAR account every few minutes. They can't edit it, and can't hide losing trades. This demo trader is simulated."
                : `We read ${t.name.split(" ")[0]}'s private NEAR account every few minutes. They can't edit it, and can't hide losing trades.`}
            </p>
            <Link href="/how" className="text-sm font-semibold text-accent-ink no-underline">See how</Link>
          </Card>

          {t.coins.length > 0 && (
            <Card className="flex flex-col gap-3 p-5">
              <span className="text-[15px] font-semibold">Trades in</span>
              <div className="flex flex-wrap gap-2">
                {t.coins.map((c) => (
                  <span key={c} className="flex items-center gap-1.5 rounded-full bg-canvas py-1.5 pl-1.5 pr-2.5 text-[13px] font-semibold"><CoinIcon sym={c} size={22} />{c}</span>
                ))}
              </div>
            </Card>
          )}
        </aside>
      </main>
      {!key && !own && (
        <div className="sticky bottom-0 z-20 flex items-center gap-3 border-t border-line bg-surface px-4 pb-6 pt-3.5 sm:hidden">
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-[17px] font-semibold">{t.prices[30]} USDC</span>
            <span className="text-xs text-muted">30 days · no renewals</span>
          </div>
          <BuyKeyButton
            mode={ctx.mode}
            signedIn={Boolean(ctx.viewer)}
            trader={{ id: t.id, name: t.name, avatar: t.avatar, ret: r.ret, period, prices: t.prices, cut, isNew: !r.enoughData }}
            className="flex h-[52px] items-center gap-2 rounded-[14px] bg-accent px-6 text-base font-semibold text-white"
          >
            <KeyIcon size={18} /> Get a key
          </BuyKeyButton>
        </div>
      )}
      <Footer mode={ctx.mode} />
    </>
  );
}
