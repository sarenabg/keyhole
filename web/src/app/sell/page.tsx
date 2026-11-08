import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui";
import { SellerSettings, RecordStatus } from "@/components/Seller";
import { SignInPrompt } from "@/components/SignInPrompt";
import { context } from "@/lib/store";
import { demoSales } from "@/lib/demo";
import { sellerStats, traderSettings } from "@/lib/live";
import { keysContract } from "@/lib/near";
import { timeAgo, usdc } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SellPage() {
  const ctx = await context();
  let view: {
    id: string;
    name: string;
    earned30: number;
    holders: number;
    maxKeys: number;
    newThisWeek: number;
    renew: string;
    perDay: number[];
    sales: { who: string; days: number; amount: number; at: number }[];
    settings: { name: string; prices: [number, number, number]; maxKeys: number; allowCopy: boolean; listed: boolean };
    renewBy: number;
    lastRead: number;
    lastError: string | null;
    cut: number;
  };

  if (ctx.mode === "demo") {
    const d = demoSales();
    const tr = d.trader;
    view = {
      id: tr.id,
      name: tr.name,
      earned30: d.earned30,
      holders: tr.holders,
      maxKeys: tr.maxKeys,
      newThisWeek: d.newThisWeek,
      renew: "72%",
      perDay: d.perDay,
      sales: d.sales,
      settings: { name: tr.name, prices: tr.prices as [number, number, number], maxKeys: tr.maxKeys, allowCopy: true, listed: true },
      renewBy: Date.now() + 6 * 86_400_000,
      lastRead: Date.now() - 2 * 60_000,
      lastError: null,
      cut: 0.95,
    };
  } else {
    if (!ctx.viewer) {
      return (
        <>
          <Header ctx={ctx} active="sell" />
          <SignInPrompt title="Sell keys to your trades" sub="Sign in with the wallet you trade with on NEAR." role="trader" cta="Prove your record" next="/sell/start" />
        </>
      );
    }
    const s = await traderSettings(ctx.viewer.id);
    if (!s) redirect("/sell/start");
    const st = await sellerStats(ctx.viewer.id);
    view = {
      id: ctx.viewer.id,
      name: s.name,
      earned30: st.earned30,
      holders: st.holders,
      maxKeys: s.maxKeys,
      newThisWeek: st.newThisWeek,
      renew: "—",
      perDay: st.perDay,
      sales: st.sales,
      settings: { name: s.name, prices: s.prices, maxKeys: s.maxKeys, allowCopy: s.allowCopy, listed: s.listed },
      renewBy: s.renewBy,
      lastRead: s.lastRead,
      lastError: s.lastError,
      cut: keysContract() ? 0.95 : 1,
    };
  }

  const max = Math.max(1, ...view.perDay);
  return (
    <>
      <Header ctx={ctx} active="sell" />
      <main className="mx-auto flex max-w-[1264px] flex-col gap-6 px-4 pb-16 pt-8 sm:px-8">
        {ctx.mode === "demo" && (
          <div className="rounded-2xl bg-warn-tint px-4 py-3 text-sm text-warn">Demo: you&apos;re seeing Mara Lin&apos;s dashboard. <Link href="/sell/start" className="font-semibold text-warn">Try becoming a trader</Link></div>
        )}
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 font-display text-[34px] font-semibold tracking-[-0.02em]">Your earnings</h1>
            <span className="text-[15px] text-muted">Paid straight to you on NEAR. Nothing to withdraw.</span>
          </div>
          <Link href={`/t/${encodeURIComponent(view.id)}`} className="flex h-[42px] items-center rounded-full border border-line bg-surface px-[18px] text-sm font-semibold text-ink no-underline">See my public page</Link>
        </section>

        <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
          <div className="flex flex-col gap-1.5 rounded-[18px] bg-night p-5 text-white">
            <span className="text-[13px] text-night-muted">Earned, 30 days</span>
            <span className="font-display text-[34px] font-semibold">{usdc(view.earned30 >= 100 ? Math.round(view.earned30) : Math.round(view.earned30 * 100) / 100)}</span>
            <span className="text-[13px] text-night-muted">You keep {Math.round(view.cut * 100)}%</span>
          </div>
          <Card className="flex flex-col gap-1.5 p-5"><span className="text-[13px] text-muted">People with a key</span><span className="font-display text-[34px] font-semibold">{view.holders}</span><span className="text-[13px] text-muted">of {view.maxKeys}</span></Card>
          <Card className="flex flex-col gap-1.5 p-5"><span className="text-[13px] text-muted">New this week</span><span className="font-display text-[34px] font-semibold">+{view.newThisWeek}</span><span className="text-[13px] text-muted">keys sold</span></Card>
          <Card className="flex flex-col gap-1.5 p-5"><span className="text-[13px] text-muted">Bought again</span><span className="font-display text-[34px] font-semibold">{view.renew}</span><span className="text-[13px] text-muted">after their key ended</span></Card>
        </section>

        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
            <Card className="flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between"><span className="font-semibold">Earnings per day</span><span className="text-[13px] text-muted">Last 30 days</span></div>
              <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Daily earnings over the last 30 days">
                {view.perDay.map((v, i) => (
                  <span key={i} className="flex-1 rounded-t-md rounded-b-sm" style={{ height: `${Math.max(2, (v / max) * 100)}%`, background: i === view.perDay.length - 1 ? "#5B3DF5" : "#D9D2FF" }} title={`${v.toFixed(2)} USDC`} />
                ))}
              </div>
            </Card>
            <Card className="overflow-hidden">
              <div className="border-b border-line-soft px-6 py-[18px] font-semibold">Recent keys sold</div>
              {view.sales.length === 0 && <div className="px-6 py-10 text-center text-muted">No keys sold yet. Share your page to get your first buyer.</div>}
              {view.sales.slice(0, 8).map((s, i) => (
                <div key={i} className="flex items-center gap-3.5 border-b border-line-soft px-6 py-3.5 last:border-0">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-subtle text-[13px] font-bold text-soft">{s.who.replace(/^0x/, "").slice(0, 1).toUpperCase()}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="truncate text-sm font-semibold">{s.who}</span><span className="text-[13px] text-muted">{s.days} days · {timeAgo(s.at)}</span></div>
                  <span className="text-sm font-semibold text-up">+{s.amount.toFixed(2)} USDC</span>
                </div>
              ))}
            </Card>
          </div>
          <aside className="flex w-full flex-[1_1_320px] flex-col gap-4 sm:max-w-[380px]">
            <SellerSettings mode={ctx.mode} initial={view.settings} cut={view.cut} />
            <RecordStatus mode={ctx.mode} renewBy={view.renewBy} lastRead={view.lastRead} lastError={view.lastError} />
          </aside>
        </div>
      </main>
      <Footer mode={ctx.mode} />
    </>
  );
}
