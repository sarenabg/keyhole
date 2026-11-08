"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WalletDialog } from "./WalletDialog";
import { SellerSettings } from "./Seller";
import { CheckIcon, CoinIcon, LockIcon, cx } from "./ui";
import type { Mode } from "@/lib/types";
import { shortId } from "@/lib/format";
import { useSingleFlight } from "./useSingleFlight";

export function StartFlow({ mode, signedInAs, cut }: { mode: Mode; signedInAs: string | null; cut: number }) {
  const router = useRouter();
  const [step, setStep] = useState(signedInAs ? 3 : 1);
  const [who, setWho] = useState<string | null>(signedInAs);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const Done = () => (
    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-up-tint text-up"><CheckIcon size={18} stroke={2.6} /></span>
  );
  const Num = ({ n, on }: { n: number; on: boolean }) => (
    <span className={cx("flex h-9 w-9 flex-none items-center justify-center rounded-full font-bold", on ? "bg-accent text-white" : "bg-subtle text-muted")}>{n}</span>
  );

  const once = useSingleFlight();
  const demoSign = (...args: Parameters<typeof demoSignNow>) => once(() => demoSignNow(...args));
  async function demoSignNow() {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 900));
    setBusy(false);
    setStep(3);
  }

  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      <li className={cx("flex flex-col gap-4 rounded-[18px] bg-surface p-5", step === 1 ? "border-2 border-accent shadow-[0_8px_24px_rgba(91,61,245,0.12)]" : "border border-line")}>
        <div className="flex items-center gap-4">
          {step > 1 ? <Done /> : <Num n={1} on />}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-semibold">Connect your wallet</span>
            <span className="truncate text-sm text-muted">{step > 1 ? (who ? shortId(who) : "Demo wallet") : "The one you trade with on NEAR."}</span>
          </div>
        </div>
        {step === 1 && (
          <button
            type="button"
            onClick={() => (mode === "demo" ? (setWho("demo-trader.near"), setStep(2)) : setOpen(true))}
            className="h-[50px] rounded-[14px] bg-accent font-semibold text-white"
          >
            {mode === "demo" ? "Connect demo wallet" : "Connect and sign"}
          </button>
        )}
      </li>

      <li className={cx("flex flex-col gap-4 rounded-[18px] bg-surface p-5", step === 2 ? "border-2 border-accent shadow-[0_8px_24px_rgba(91,61,245,0.12)]" : "border border-line", step < 2 && "opacity-70")}>
        <div className="flex items-center gap-4">
          {step > 2 ? <Done /> : <Num n={2} on={step === 2} />}
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="font-semibold">Prove your record</span>
            <span className="text-sm text-muted">Sign once so Keyhole can read your private trades.</span>
          </div>
        </div>
        {step <= 2 && (
          <div className="flex flex-col gap-2 rounded-[14px] bg-canvas p-3.5 text-sm">
            {["Free. Moves no money.", "Public: your return. Private: what you trade.", "Stop any time. Lasts 7 days per signature."].map((x) => (
              <span key={x} className="flex items-center gap-2.5"><CheckIcon size={16} stroke={2.6} className="text-up" />{x}</span>
            ))}
          </div>
        )}
        {step === 2 && (
          <button type="button" disabled={busy} onClick={demoSign} className="flex h-[50px] items-center justify-center gap-2 rounded-[14px] bg-accent font-semibold text-white disabled:opacity-70">
            {busy ? <><span className="kh-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />Signing…</> : "Sign with wallet"}
          </button>
        )}
      </li>

      <li className={cx("flex flex-col gap-4 rounded-[18px] bg-surface p-5", step === 3 ? "border-2 border-accent shadow-[0_8px_24px_rgba(91,61,245,0.12)]" : "border border-line opacity-70")}>
        <div className="flex items-center gap-4">
          <Num n={3} on={step === 3} />
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="font-semibold">Set your price</span>
            <span className="text-sm text-muted">You keep {Math.round(cut * 100)}% of every key.</span>
          </div>
        </div>
        {step === 3 && (
          <SellerSettings
            mode={mode}
            cut={cut}
            cta="Start selling"
            initial={{ name: mode === "demo" ? "You" : who ? shortId(who) : "", prices: [5, 15, 36], maxKeys: 300, allowCopy: true, listed: true }}
            onSaved={() => router.push(mode === "demo" ? "/sell" : "/sell")}
          />
        )}
      </li>
      {open && (
        <WalletDialog
          role="trader"
          onClose={() => setOpen(false)}
          onDone={(id) => {
            setOpen(false);
            setWho(id);
            setStep(3);
            router.refresh();
          }}
        />
      )}
    </ol>
  );
}

export function PreviewCard() {
  return (
    <div className="flex flex-col gap-[18px] rounded-[18px] border border-line bg-surface p-[22px] shadow-[0_12px_32px_rgba(13,17,23,0.08)]">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-tint font-bold text-accent-ink">Y</span>
        <div className="flex flex-1 flex-col gap-0.5"><span className="font-semibold">You</span><span className="text-[13px] text-muted">your-account.near</span></div>
        <span className="flex items-center gap-1.5 rounded-full bg-subtle px-2.5 py-1.5 text-xs font-semibold text-soft"><LockIcon size={12} stroke={2.4} />Private</span>
      </div>
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-0.5"><span className="font-display text-[34px] font-semibold text-up">+12.4%</span><span className="text-[13px] text-muted">90 days</span></div>
        <svg viewBox="0 0 240 64" preserveAspectRatio="none" className="h-[52px] w-[150px]" aria-hidden="true"><path d="M0 48 L20 46 L40 48 L60 44 L80 45 L100 40 L120 42 L140 38 L160 39 L180 35 L200 36 L220 33 L240 31 L240 64 L0 64 Z" fill="rgba(4,120,87,0.10)" /><path d="M0 48 L20 46 L40 48 L60 44 L80 45 L100 40 L120 42 L140 38 L160 39 L180 35 L200 36 L220 33 L240 31" fill="none" stroke="#047857" strokeWidth="2.5" /></svg>
      </div>
      <div className="flex flex-col gap-2 rounded-xl bg-canvas p-3" aria-hidden="true">
        <span className="h-2.5 w-4/5 rounded-md bg-[#DCDFE5]" /><span className="h-2.5 w-2/3 rounded-md bg-[#DCDFE5]" /><span className="h-2.5 w-3/4 rounded-md bg-[#DCDFE5]" />
      </div>
      <span className="flex items-center gap-1.5 text-[13px] text-muted"><LockIcon size={14} />Trades hidden until someone buys a key</span>
    </div>
  );
}

export function TradeOn() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
      Trade privately on
      <a href="https://near.com" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 font-semibold text-ink no-underline"><CoinIcon sym="NEAR" size={18} />near.com</a>
      with the same wallet.
    </div>
  );
}
