import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PreviewCard, StartFlow, TradeOn } from "@/components/StartFlow";
import { context, traderCut } from "@/lib/store";
import { isTrader } from "@/lib/live";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  const ctx = await context();
  const signedInAs = ctx.mode === "live" && ctx.viewer && (await isTrader(ctx.viewer.id).catch(() => false)) ? ctx.viewer.id : null;
  return (
    <>
      <Header ctx={ctx} active="sell" />
      <main className="mx-auto flex max-w-[1100px] flex-wrap items-start gap-10 px-4 pb-16 pt-12 sm:px-8">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-7">
          <div className="flex flex-col gap-2.5">
            <h1 className="m-0 font-display text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[40px]">Get paid for your trades. Keep them private.</h1>
            <p className="m-0 text-[17px] text-muted">Three steps. About a minute.</p>
          </div>
          <StartFlow mode={ctx.mode} signedInAs={signedInAs} cut={traderCut(ctx.mode)} />
          <TradeOn />
        </div>
        <aside className="flex w-full flex-[1_1_340px] flex-col gap-3 sm:max-w-[400px]">
          <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">What people will see</span>
          <PreviewCard />
        </aside>
      </main>
      <Footer mode={ctx.mode} />
    </>
  );
}
