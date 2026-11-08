"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Modal, ModalHead } from "./Modal";
import { Avatar, CoinIcon, KeyIcon, ShieldIcon, cx } from "./ui";
import { CoinPicker, SendBox, usePoll, type Instructions, type PayState, type Picked } from "./Pay";
import { WalletDialog } from "./WalletDialog";
import { dateShort, pct } from "@/lib/format";
import type { Mode, Period } from "@/lib/types";

type TraderInfo = { id: string; name: string; avatar: number; ret: number; period: Period; prices: { 7: number; 30: number; 90: number }; cut: number; isNew?: boolean };
const PLANS = [7, 30, 90] as const;

export function BuyKeyButton({ mode, signedIn, trader, className, children }: { mode: Mode; signedIn: boolean; trader: TraderInfo; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [needSignIn, setNeedSignIn] = useState(false);
  const router = useRouter();
  return (
    <>
      <button type="button" className={className} onClick={() => (mode === "live" && !signedIn ? setNeedSignIn(true) : setOpen(true))}>
        {children}
      </button>
      {needSignIn && (
        <WalletDialog
          role="viewer"
          onClose={() => setNeedSignIn(false)}
          onDone={() => { setNeedSignIn(false); router.refresh(); setOpen(true); }}
        />
      )}
      {open && <BuyKeyDialog mode={mode} trader={trader} onClose={() => setOpen(false)} />}
    </>
  );
}

function BuyKeyDialog({ mode, trader, onClose }: { mode: Mode; trader: TraderInfo; onClose: () => void }) {
  const router = useRouter();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [coin, setCoin] = useState<Picked | null>(null);
  const [step, setStep] = useState<"choose" | "paying" | "pay" | "done">("choose");
  const [ins, setIns] = useState<Instructions | null>(null);
  const [state, setState] = useState<PayState>("waiting");
  const [ends, setEnds] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const price = trader.prices[days];
  const first = trader.name.split(" ")[0];
  const save = Math.round((1 - trader.prices[90] / (trader.prices[30] * 3)) * 100);
  const traderShare = price * trader.cut;

  usePoll(step === "pay" && ins ? `/api/live/keys/${ins.id}` : null, (j) => {
    const s = j.state as PayState;
    if (s) setState(s);
    if (s === "paid") {
      setEnds(Number(j.expiresAt) || null);
      setStep("done");
      return true;
    }
    return s === "refunded" || s === "failed";
  });

  // Refresh the page only when the dialog closes, so the success screen stays up.
  const close = () => {
    if (step === "done") router.refresh();
    onClose();
  };

  async function pay() {
    setError(null);
    setStep("paying");
    try {
      const url = mode === "demo" ? "/api/demo/keys" : "/api/live/keys";
      const body = mode === "demo" ? { trader: trader.id, days } : { trader: trader.id, days, asset: coin?.place.assetId };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Something went wrong.");
      if (mode === "demo") {
        await new Promise((r) => setTimeout(r, 1400));
        setEnds(j.expiresAt);
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
    <Modal title={`Key to ${trader.name}'s trades`} onClose={close}>
      {step !== "done" ? (
        <>
          <ModalHead onClose={close}>
            <Avatar id={trader.id} name={trader.name} idx={trader.avatar} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-lg font-semibold">Key to {first}&apos;s trades</span>
              {trader.isNew ? (
                <span className="text-[13px] font-semibold text-muted">New trader · record starting</span>
              ) : (
                <span className={cx("text-[13px] font-semibold", trader.ret >= 0 ? "text-up" : "text-down")}>{pct(trader.ret)} in {trader.period} days</span>
              )}
            </div>
          </ModalHead>

          {step === "pay" && ins ? (
            <div className="flex flex-col gap-4 p-6">
              <SendBox ins={ins} chainName={coin?.place.chainName ?? ins.chain} state={state} />
              <p className="m-0 text-center text-[13px] text-muted">Send from any wallet or exchange. This page updates by itself.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-[18px] p-6">
              <div className="flex flex-col gap-2" role="radiogroup" aria-label="How long">
                {PLANS.map((d) => {
                  const on = d === days;
                  return (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setDays(d)}
                      className={cx("flex items-center justify-between gap-3 rounded-[14px] bg-surface px-4 py-3.5 text-left text-[15px]", on ? "border-2 border-accent" : "border border-line")}
                    >
                      <span className="flex items-center gap-3">
                        <span className={cx("h-5 w-5 rounded-full", on ? "border-[6px] border-accent" : "border-2 border-[#C9CED6]")} />
                        <span className="font-semibold">{d} days</span>
                        {d === 90 && save > 0 && <span className="rounded-full bg-up-tint px-2 py-0.5 text-xs font-semibold text-up-ink">Save {save}%</span>}
                      </span>
                      <span className="font-semibold">{trader.prices[d]} USDC</span>
                    </button>
                  );
                })}
              </div>

              {mode === "live" ? (
                <CoinPicker value={coin} onChange={setCoin} />
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-medium text-muted">Pay with</span>
                  <div className="flex items-center gap-2.5 rounded-[14px] border border-line bg-canvas px-3.5 py-3">
                    <CoinIcon sym="USDC" size={28} />
                    <span className="font-semibold">Demo USDC</span>
                    <span className="ml-auto rounded-full bg-warn-tint px-2 py-0.5 text-xs font-semibold text-warn">Not real</span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2.5 rounded-[14px] bg-canvas p-4 text-sm">
                <div className="flex justify-between"><span className="text-muted">You pay</span><span className="font-semibold">{price} USDC{mode === "live" && coin && coin.symbol !== "USDC" ? ` in ${coin.symbol}` : ""}</span></div>
                <div className="flex justify-between"><span className="text-muted">{first} gets, right away</span><span className="font-semibold">{traderShare.toFixed(2)} USDC</span></div>
                <div className="flex justify-between"><span className="text-muted">Key ends</span><span className="font-semibold">{dateShort(Date.now() + days * 86_400_000)}</span></div>
              </div>

              {error && <p className="m-0 rounded-xl bg-down-tint px-3.5 py-3 text-sm text-down" role="alert">{error}</p>}

              <button
                type="button"
                onClick={pay}
                disabled={step === "paying" || (mode === "live" && !coin)}
                className="flex h-[54px] items-center justify-center gap-2 rounded-[14px] bg-accent text-base font-semibold text-white hover:bg-accent-ink disabled:opacity-70"
              >
                {step === "paying" ? <><span className="kh-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />{mode === "demo" ? "Paying…" : "Getting your address…"}</> : mode === "demo" ? `Pay ${price} USDC` : "Continue"}
              </button>
              <span className="flex items-center justify-center gap-1.5 pb-1 text-[13px] text-muted">
                <ShieldIcon size={14} /> {mode === "demo" ? "Demo: no real money moves." : "Paid on NEAR. No renewals, no surprises."}
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 px-7 pb-7 pt-10 text-center">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-3xl bg-accent text-white"><KeyIcon size={34} /></span>
          <span className="font-display text-[28px] font-semibold tracking-[-0.02em]">You&apos;re in.</span>
          <span className="text-[15px] leading-normal text-muted">{first}&apos;s trades are open to you until {dateShort(ends ?? Date.now() + days * 86_400_000)}.</span>
          <a href={`/t/${encodeURIComponent(trader.id)}/trades`} className="mt-2 flex h-[54px] w-full items-center justify-center rounded-[14px] bg-ink text-base font-semibold text-white no-underline">
            See {first}&apos;s trades
          </a>
        </div>
      )}
    </Modal>
  );
}
