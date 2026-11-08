"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Modal, ModalHead } from "./Modal";
import { CheckIcon, CoinIcon, LockIcon, PairIcon, cx } from "./ui";
import { CoinPicker, SendBox, usePoll, type Instructions, type PayState, type Picked } from "./Pay";
import { amount, money, pct, timeAgo } from "@/lib/format";
import type { Mode, TradeView } from "@/lib/types";
import { useSingleFlight } from "./useSingleFlight";
import { radioKeys } from "./radioKeys";

type TraderInfo = { id: string; name: string };

export function CopyButton({ mode, trader, trade }: { mode: Mode; trader: TraderInfo; trade: TradeView }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex h-10 items-center rounded-full bg-accent px-[18px] text-sm font-semibold text-white hover:bg-accent-ink">
        Copy
      </button>
      {open && <CopyDialog mode={mode} trader={trader} trade={trade} onClose={() => setOpen(false)} />}
    </>
  );
}

const DEMO_BALANCE = 1000;

function CopyDialog({ mode, trader, trade, onClose }: { mode: Mode; trader: TraderInfo; trade: TradeView; onClose: () => void }) {
  const router = useRouter();
  const first = trader.name.split(" ")[0];
  const same = Math.max(1, Math.round(trade.share * 100));
  const demoChoices = [
    { label: "5%", hint: "Careful", usd: DEMO_BALANCE * 0.05 },
    { label: `${same}%`, hint: `Same as ${first}`, usd: (DEMO_BALANCE * same) / 100 },
    { label: "25%", hint: "Bold", usd: DEMO_BALANCE * 0.25 },
  ];
  const liveChoices = [
    { label: "$5", hint: "Try it", usd: 5 },
    { label: "$25", hint: "Small", usd: 25 },
    { label: "$100", hint: "Bigger", usd: 100 },
  ];
  const choices = mode === "demo" ? demoChoices : liveChoices;
  const [pick, setPick] = useState(1);
  const usd = choices[pick].usd;
  const [coin, setCoin] = useState<Picked | null>(null);
  const [quote, setQuote] = useState<{ amountOut: string; real: boolean } | null>(null);
  const [step, setStep] = useState<"choose" | "working" | "pay" | "done">("choose");
  const [ins, setIns] = useState<(Instructions & { amountOut?: string }) | null>(null);
  const [state, setState] = useState<PayState>("waiting");
  const [got, setGot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live price check (a real NEAR Intents quote that moves no money).
  useEffect(() => {
    let off = false;
    setQuote(null);
    const t = setTimeout(async () => {
      const r = await fetch("/api/quote/copy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trader: trader.id, tradeId: trade.id, usd, asset: coin?.place.assetId }) })
        .then((x) => x.json())
        .catch(() => null);
      if (off) return;
      if (r?.amountOut) {
        setQuote({ amountOut: r.amountOut, real: Boolean(r.real) });
        setError(null);
      } else setError(r?.error ?? "Couldn't get today's price. Close this and try again.");
    }, 250);
    return () => { off = true; clearTimeout(t); };
  }, [usd, coin, trade.id, trader.id]);

  usePoll(step === "pay" && ins ? `/api/live/copy/${ins.id}` : null, (j) => {
    const s = j.state as PayState;
    if (s) setState(s);
    if (s === "paid") {
      setGot(String(j.amountOut ?? ins?.amountOut ?? ""));
      setStep("done");
      return true;
    }
    return s === "refunded" || s === "failed";
  });

  const close = () => {
    if (step === "done") router.refresh();
    onClose();
  };

  const once = useSingleFlight();
  const confirm = (...args: Parameters<typeof confirmNow>) => once(() => confirmNow(...args));
  async function confirmNow() {
    setError(null);
    setStep("working");
    try {
      const url = mode === "demo" ? "/api/demo/copy" : "/api/live/copy";
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trader: trader.id, tradeId: trade.id, usd, asset: coin?.place.assetId }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Something went wrong.");
      if (mode === "demo") {
        await new Promise((r) => setTimeout(r, 1200));
        setGot(amount(j.amount));
        setStep("done");
      } else {
        setIns(j);
        setStep("pay");
      }
    } catch (e) {
      setError((e as Error).message);
      setStep("choose");
    }
  }

  return (
    <Modal title={`Copy ${first}'s trade`} onClose={close}>
      {step === "done" ? (
        <div className="flex flex-col items-center gap-3.5 px-7 pb-7 pt-10 text-center">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-up-tint text-up"><CheckIcon size={34} stroke={2.6} /></span>
          <span className="font-display text-[28px] font-semibold tracking-[-0.02em]">Copied</span>
          <span className="flex items-center gap-2 text-base font-semibold"><CoinIcon sym={trade.to} size={24} />{got} {trade.to} is yours</span>
          <span className="flex items-center gap-1.5 text-sm text-muted"><LockIcon size={14} />{mode === "demo" ? "Demo copy · no real money" : "In your NEAR Intents balance"}</span>
          <button type="button" onClick={close} className="mt-2.5 flex h-[54px] w-full items-center justify-center rounded-[14px] bg-ink text-base font-semibold text-white">Back to trades</button>
        </div>
      ) : (
        <>
          <ModalHead onClose={close}>
            <span className="text-lg font-semibold">Copy {first}&apos;s trade</span>
          </ModalHead>
          <div className="flex flex-col gap-[18px] p-6">
            <div className="flex items-center gap-3.5 rounded-2xl bg-canvas p-3.5">
              <PairIcon from={trade.from} to={trade.to} ring="#F5F6F8" />
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">{trade.title}</span>
                <span className="text-[13px] text-muted">{timeAgo(trade.t)} · {pct(trade.share, 0, false)} of {first}&apos;s account</span>
              </div>
            </div>

            {step === "pay" && ins ? (
              <>
                <SendBox ins={ins} chainName={coin?.place.chainName ?? ins.chain} state={state} />
                <p className="m-0 text-center text-[13px] text-muted">You&apos;ll get about {ins.amountOut} {trade.to}. This page updates by itself.</p>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2.5">
                  <span className="text-[13px] font-medium text-muted">{mode === "demo" ? `How much of your ${DEMO_BALANCE.toLocaleString()} demo USDC?` : "How much?"}</span>
                  <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Amount" onKeyDown={radioKeys(choices.length, pick, setPick)}>
                    {choices.map((c, i) => (
                      <button
                        key={c.label}
                        type="button"
                        role="radio"
                        aria-checked={i === pick}
                        tabIndex={i === pick ? 0 : -1}
                        onClick={() => setPick(i)}
                        className={cx("flex flex-col items-center gap-0.5 rounded-[14px] px-1.5 py-3 text-base font-semibold", i === pick ? "border-2 border-accent bg-accent-tint text-accent-deep" : "border border-line bg-surface")}
                      >
                        {c.label}
                        <span className="text-xs font-medium opacity-80">{c.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {mode === "live" && <CoinPicker value={coin} onChange={setCoin} />}

                <div className="flex flex-col overflow-hidden rounded-2xl border border-line">
                  <div className="flex items-center justify-between p-4">
                    <span className="flex flex-col gap-0.5"><span className="text-[13px] text-muted">You pay</span><span className="font-display text-[26px] font-semibold">{money(usd)}</span></span>
                    <span className="flex items-center gap-2 font-semibold"><CoinIcon sym={mode === "live" && coin ? coin.symbol : "USDC"} size={26} />{mode === "live" && coin ? coin.symbol : "USDC"}</span>
                  </div>
                  <div className="h-px bg-line-soft" />
                  <div className="flex items-center justify-between bg-[#FAFAFB] p-4">
                    <span className="flex flex-col gap-0.5"><span className="text-[13px] text-muted">You get about</span>{quote ? <span className="font-display text-[26px] font-semibold">{amount(Number(quote.amountOut))}</span> : <span className="kh-pulse my-[7px] block h-6 w-28 rounded-md bg-line" role="status" aria-label="Getting the live price" />}</span>
                    <span className="flex items-center gap-2 font-semibold"><CoinIcon sym={trade.to} size={26} />{trade.to}</span>
                  </div>
                </div>

                {error && <p className="m-0 rounded-xl bg-down-tint px-3.5 py-3 text-sm text-down" role="alert">{error}</p>}

                <button type="button" onClick={confirm} disabled={step === "working" || !quote || (mode === "live" && !coin)} className="flex h-[54px] items-center justify-center gap-2 rounded-[14px] bg-accent text-base font-semibold text-white hover:bg-accent-ink disabled:opacity-70">
                  {step === "working" ? <><span className="kh-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />{mode === "demo" ? "Copying…" : "Getting your address…"}</> : mode === "demo" ? "Copy trade" : "Continue"}
                </button>
                <span className="text-center text-[13px] text-muted">{!quote ? "Getting the live price…" : quote.real ? "Live price from NEAR Intents · money back if the price jumps" : "Today's price · money back if the price jumps"}</span>
              </>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

export function AutoCopyCard({ mode, traderId, on }: { mode: Mode; traderId: string; on: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(on);
  const live = mode === "live";
  const toggle = () =>
    start(async () => {
      const next = !value;
      setValue(next);
      await fetch("/api/demo/auto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trader: traderId, on: next }) });
      router.refresh();
    });
  return (
    <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-[22px]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">Copy automatically</span>
          <span className="text-[13px] text-muted">{live ? "Coming soon: needs your OK for each trade today" : "Mirror each new trade"}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          aria-label="Copy automatically"
          disabled={live || pending}
          onClick={toggle}
          className={cx("relative h-8 w-[52px] flex-none rounded-full transition-colors disabled:opacity-50", value ? "bg-accent" : "bg-line-strong")}
        >
          <span className={cx("absolute top-1 h-6 w-6 rounded-full bg-white transition-all", value ? "right-1" : "left-1")} />
        </button>
      </div>
      <div className="flex flex-col gap-2.5 rounded-[14px] bg-canvas p-3.5 text-sm">
        <div className="flex justify-between"><span className="text-muted">Money to use</span><span className="font-semibold">{live ? "—" : "200 USDC"}</span></div>
        <div className="flex justify-between"><span className="text-muted">Most per trade</span><span className="font-semibold">20%</span></div>
        <div className="flex justify-between"><span className="text-muted">Keep my copies private</span><span className="font-semibold">On</span></div>
      </div>
    </section>
  );
}
