import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Avatar, Card, CoinIcon, KeyIcon, LockIcon, PairIcon, cx } from "@/components/ui";
import { CopyButton, AutoCopyCard } from "@/components/CopyTrade";
import { context, myCopies, myKey, privateView, trader } from "@/lib/store";
import { demoState } from "@/lib/session";
import { priceMap } from "@/lib/prices";
import { isStable } from "@/lib/stats.mjs";
import { amount, money, pct, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const BAR = ["#0D1117", "#5B3DF5", "#F7931A", "#2775CA", "#047857", "#C2410C"];

const FIRST_ROWS = 12;

export default async function TradesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: raw } = await params;
  const showAll = (await searchParams).all === "1";
  const id = decodeURIComponent(raw);
  const ctx = await context();
  const t = await trader(ctx, id, 90);
  if (!t) notFound();
  const own = ctx.viewer?.id === id;
  const key = await myKey(ctx, id);
  const view = await privateView(ctx, id);
  const first = t.name.split(" ")[0];

  if (!view) {
    return (
      <>
        <Header ctx={ctx} active="keys" />
        <main className="mx-auto flex max-w-[560px] flex-col items-center gap-4 px-4 py-24 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-white"><LockIcon size={24} /></span>
          <h1 className="m-0 text-2xl font-semibold">{first}&apos;s trades are private</h1>
          <p className="m-0 text-muted">You need a key to see them.</p>
          <Link href={`/t/${encodeURIComponent(id)}`} className="mt-2 flex h-12 items-center rounded-full bg-accent px-6 font-semibold text-white no-underline">Get a key</Link>
        </main>
      </>
    );
  }

  const copies = (await myCopies(ctx)).filter((c) => c.trader === id);
  const copied = new Set(copies.map((c) => c.tradeId));
  const demo = ctx.mode === "demo" ? await demoState() : null;
  const autoOn = Boolean(demo?.auto.includes(id));
  // Demo: with auto-copy on, every trade since you switched it on counts as copied.
  const autoSince = autoOn ? demo?.autoAt?.[id] ?? Date.now() : 0;
  const prices = await priceMap();
  const done = copies.filter((c) => c.status === "done");
  const spent = done.reduce((s, c) => s + c.usdIn, 0);
  // What your copies are worth today: coins received × today's price.
  const worth = done.reduce((s, c) => s + (c.amount > 0 && prices[c.sym] ? c.amount * prices[c.sym] : c.usdIn), 0);
  const copyRet = spent > 0 ? worth / spent - 1 : 0;

  return (
    <>
      <Header ctx={ctx} active="keys" />
      <main className="mx-auto flex max-w-[1264px] flex-col gap-6 px-4 pb-16 pt-8 sm:px-8">
        <section className="flex flex-wrap items-center gap-4">
          <Avatar id={t.id} name={t.name} idx={t.avatar} size={52} />
          <div className="flex min-w-[220px] flex-1 flex-col gap-0.5">
            <h1 className="m-0 font-display text-[28px] font-semibold tracking-[-0.02em]">{own ? "Your trades" : `${first}'s trades`}</h1>
            <span className="text-sm text-muted">Only key holders see this</span>
          </div>
          {key && !own && (
            <span className="flex items-center gap-2 rounded-full bg-ink px-3.5 py-2.5 text-sm font-semibold text-white">
              <KeyIcon size={16} className="text-accent-light" /> Your key · {Math.max(0, Math.ceil((key.expiresAt - Date.now()) / 86_400_000))} days left
            </span>
          )}
        </section>

        <div className="flex flex-wrap items-start gap-6">
          <Card className="min-w-0 flex-[999_1_560px] overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line-soft px-6 py-[18px]">
              <span className="flex items-center gap-2 text-sm font-semibold"><span className="kh-pulse h-2 w-2 rounded-full bg-up" />Live</span>
              <span className="text-[13px] text-muted">Size = share of {own ? "your" : `${first}'s`} account</span>
            </div>
            {view.trades.length === 0 && (
              <div className="px-6 py-16 text-center text-muted">No trades yet. New ones show up here within a few minutes.</div>
            )}
            {(showAll ? view.trades : view.trades.slice(0, FIRST_ROWS)).map((tr) => {
              const isCopied = copied.has(tr.id) || (autoOn && tr.t >= autoSince);
              return (
                <div key={tr.id} data-trade-row="1" className="flex flex-wrap items-center gap-4 border-b border-line-soft px-6 py-4 last:border-0">
                  <PairIcon from={tr.from} to={tr.to} />
                  <div className="flex min-w-[180px] flex-1 flex-col gap-[3px]">
                    <span className="text-[15px] font-semibold">{tr.title}</span>
                    <span className="text-[13px] text-muted">
                      {timeAgo(tr.t)} · {pct(tr.share, 0, false)} of account · {tr.priceSym} at {money(tr.price, tr.price >= 1000 ? 0 : 2)}
                    </span>
                  </div>
                  <span className={cx("min-w-16 text-right text-sm font-semibold", tr.since >= 0 ? "text-up" : "text-down")} title="How this trade has done since">{pct(tr.since)}</span>
                  {own ? null : isCopied ? (
                    <span className="flex h-10 items-center rounded-full bg-up-tint px-[18px] text-sm font-semibold text-up-ink">Copied</span>
                  ) : t.allowCopy && !isStable(tr.to) ? (
                    <CopyButton mode={ctx.mode} trader={{ id: t.id, name: t.name }} trade={tr} />
                  ) : isStable(tr.to) ? (
                    <span className="flex h-10 min-w-[76px] items-center justify-center rounded-full bg-subtle px-4 text-sm font-medium text-muted" title="A sale into dollars: nothing to copy">Sold</span>
                  ) : null}
                </div>
              );
            })}
            {!showAll && view.trades.length > FIRST_ROWS && (
              <Link href={`/t/${encodeURIComponent(id)}/trades?all=1`} scroll={false} className="flex h-14 items-center justify-center text-sm font-semibold text-accent-ink no-underline hover:bg-canvas">
                Show all {view.trades.length} trades
              </Link>
            )}
          </Card>

          <aside className="flex w-full flex-[1_1_320px] flex-col gap-4 sm:max-w-[380px]">
            {!own && <AutoCopyCard mode={ctx.mode} traderId={id} on={autoOn} />}

            <Card className="flex flex-col gap-3.5 p-[22px]">
              <span className="font-semibold">What {own ? "you hold" : `${first} holds`} now</span>
              {view.holdings.length ? (
                <>
                  <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={view.holdings.map((h) => `${h.sym} ${Math.round(h.share * 100)}%`).join(", ")}>
                    {view.holdings.map((h, i) => <span key={h.sym} style={{ flex: h.share, background: BAR[i % BAR.length] }} />)}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 text-sm">
                    {view.holdings.slice(0, 6).map((h) => (
                      <span key={h.sym} className="flex items-center gap-2"><CoinIcon sym={h.sym} size={20} />{h.sym}<b className="ml-auto">{Math.round(h.share * 100)}%</b></span>
                    ))}
                  </div>
                </>
              ) : (
                <span className="text-sm text-muted">Nothing yet.</span>
              )}
            </Card>

            {!own && (
              <section className="flex flex-col gap-1.5 rounded-[20px] bg-night p-[22px] text-white">
                <span className="text-sm text-night-muted">Your copies</span>
                <span className={cx("font-display text-[34px] font-semibold", copyRet >= 0 ? "text-up-light" : "text-[#FF9B6B]")}>{copies.length ? pct(copyRet) : "—"}</span>
                <span className="text-[13px] text-night-muted">
                  {copies.length ? `${copies.length} ${copies.length === 1 ? "trade" : "trades"} copied · ${money(spent)} in` : "Tap Copy on any trade."}
                </span>
              </section>
            )}
            {copies.length > 0 && (
              <Card className="flex flex-col gap-2 p-5">
                <span className="text-sm font-semibold">Latest copies</span>
                {copies.slice(0, 4).map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <CoinIcon sym={c.sym} size={20} />
                    <span className="flex-1">{amount(c.amount)} {c.sym}</span>
                    <span className="text-muted">{c.status === "done" ? timeAgo(c.at) : c.status === "waiting" ? "Waiting" : "Didn't go through"}</span>
                  </div>
                ))}
              </Card>
            )}
          </aside>
        </div>
      </main>
      <Footer mode={ctx.mode} />
    </>
  );
}
