"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { ChevronDown, CoinIcon, CopyIcon, CheckIcon, cx } from "./ui";

// Pieces for real (Live mode) payments through NEAR Intents: pick a coin, then send it to a one-time address.

export type CoinPlace = { assetId: string; chain: string; chainName: string; chainLogo: string | null; decimals: number };
export type Coin = { symbol: string; name: string; logo: string | null; price: number; places: CoinPlace[] };
export type Picked = { symbol: string; place: CoinPlace; price: number };

let coinsPromise: Promise<Coin[]> | null = null;
function loadCoins(): Promise<Coin[]> {
  if (!coinsPromise) coinsPromise = fetch("/api/coins").then((r) => r.json()).then((j) => j.coins as Coin[]).catch(() => { coinsPromise = null; return []; });
  return coinsPromise;
}

export function CoinPicker({ value, onChange, label = "Pay with" }: { value: Picked | null; onChange: (p: Picked) => void; label?: string }) {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [coin, setCoin] = useState<Coin | null>(null);
  useEffect(() => {
    loadCoins().then((c) => {
      setCoins(c);
      if (!value) {
        const usdc = c.find((x) => x.symbol === "USDC") ?? c[0];
        if (usdc) onChange({ symbol: usdc.symbol, place: usdc.places[0], price: usdc.price });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const list = useMemo(() => coins.filter((c) => !q || c.symbol.toLowerCase().includes(q.toLowerCase()) || c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40), [coins, q]);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-muted">{label}</span>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setCoin(null); }}
        aria-expanded={open}
        className="flex items-center justify-between rounded-[14px] border border-line bg-canvas px-3.5 py-3 text-left"
      >
        {value ? (
          <span className="flex items-center gap-2.5">
            <span className="relative">
              <CoinIcon sym={value.symbol} size={28} />
              {value.place.chainLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value.place.chainLogo} alt="" className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full ring-2 ring-canvas" />
              )}
            </span>
            <span className="font-semibold">{value.symbol}</span>
            <span className="text-[13px] text-muted">on {value.place.chainName}</span>
          </span>
        ) : (
          <span className="text-muted">Loading coins…</span>
        )}
        <ChevronDown size={16} className="text-muted" />
      </button>
      {open && (
        <div className="kh-pop flex max-h-72 flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
          {!coin ? (
            <>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search coins" aria-label="Search coins" className="h-11 border-b border-line-soft px-3.5 text-[15px] outline-none" />
              <div className="overflow-y-auto">
                {list.map((c) => (
                  <button
                    key={c.symbol}
                    type="button"
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-canvas"
                    onClick={() => {
                      if (c.places.length === 1) { onChange({ symbol: c.symbol, place: c.places[0], price: c.price }); setOpen(false); }
                      else setCoin(c);
                    }}
                  >
                    <CoinIcon sym={c.symbol} size={26} />
                    <span className="flex-1 font-semibold">{c.symbol}</span>
                    <span className="text-[13px] text-muted">{c.name}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="overflow-y-auto">
              <div className="border-b border-line-soft px-3.5 py-2.5 text-[13px] font-medium text-muted">Where is your {coin.symbol}?</div>
              {coin.places.map((p) => (
                <button key={p.assetId} type="button" className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-canvas" onClick={() => { onChange({ symbol: coin.symbol, place: p, price: coin.price }); setOpen(false); }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.chainLogo ? <img src={p.chainLogo} alt="" className="h-6 w-6 rounded-full" /> : <span className="h-6 w-6 rounded-full bg-subtle" />}
                  <span className="font-semibold">{p.chainName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type Instructions = { id: string; depositAddress: string; depositMemo?: string; amountIn: string; symbol: string; chain: string; deadline?: string };
export type PayState = "waiting" | "arriving" | "paid" | "refunded" | "failed";

/** "Send exactly X to this address", with a QR code, a countdown and live status. */
export function SendBox({ ins, chainName, state }: { ins: Instructions; chainName: string; state: PayState }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    QRCode.toDataURL(ins.depositAddress, { margin: 1, width: 360 }).then(setQr).catch(() => setQr(null));
  }, [ins.depositAddress]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = ins.deadline ? Math.max(0, Date.parse(ins.deadline) - now) : null;
  // Short windows count down; long ones (NEAR Intents often allows days) just say how long.
  const mm =
    left === null ? null
    : left < 3_600_000 ? `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")} left`
    : left < 48 * 3_600_000 ? `valid for ${Math.floor(left / 3_600_000)} h`
    : `valid for ${Math.floor(left / 86_400_000)} days`;
  const copy = (v: string, k: string) => { navigator.clipboard?.writeText(v); setCopied(k); setTimeout(() => setCopied(null), 1500); };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 rounded-2xl bg-canvas p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr ? <img src={qr} alt="Payment address as a QR code" className="h-[112px] w-[112px] flex-none rounded-lg bg-white p-1" /> : <span className="h-[112px] w-[112px] flex-none rounded-lg bg-white" />}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] text-muted">Send exactly</span>
          <button type="button" onClick={() => copy(ins.amountIn, "amt")} className="flex items-center gap-2 text-left font-display text-2xl font-semibold">
            {ins.amountIn} {ins.symbol}
            {copied === "amt" ? <CheckIcon size={16} className="text-up" /> : <CopyIcon size={16} className="text-muted" />}
          </button>
          <span className="text-[13px] text-muted">on {chainName}{mm && state === "waiting" ? ` · ${mm}` : ""}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-muted">To this address</span>
        <button type="button" onClick={() => copy(ins.depositAddress, "addr")} className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-3 text-left">
          <span className="min-w-0 flex-1 break-all font-mono text-[13px]">{ins.depositAddress}</span>
          {copied === "addr" ? <CheckIcon size={16} className="text-up" /> : <CopyIcon size={16} className="text-muted" />}
        </button>
        {ins.depositMemo && (
          <button type="button" onClick={() => copy(ins.depositMemo!, "memo")} className="flex items-center gap-2 rounded-xl border border-warn-tint bg-warn-tint px-3.5 py-3 text-left text-warn">
            <span className="flex-1 text-[13px]">Include this memo: <b className="font-mono">{ins.depositMemo}</b></span>
            <CopyIcon size={16} />
          </button>
        )}
      </div>
      <StatusLine state={state} />
    </div>
  );
}

export function StatusLine({ state }: { state: PayState }) {
  const steps: [PayState, string][] = [["waiting", "Waiting"], ["arriving", "Arriving"], ["paid", "Done"]];
  if (state === "refunded" || state === "failed") {
    return <p className="m-0 rounded-xl bg-down-tint px-3.5 py-3 text-sm text-down">{state === "refunded" ? "It didn't go through. Your money was sent back." : "It didn't go through. Any money sent comes back automatically."}</p>;
  }
  const at = steps.findIndex(([s]) => s === state);
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      {steps.map(([s, label], i) => (
        <div key={s} className="flex flex-1 flex-col gap-1.5">
          <span className={cx("h-1.5 rounded-full", i < at ? "bg-up" : i === at ? "kh-pulse bg-accent" : "bg-line")} />
          <span className={cx("text-xs", i <= at ? "font-semibold text-ink" : "text-muted")}>{label}</span>
        </div>
      ))}
    </div>
  );
}

export function usePoll(url: string | null, onUpdate: (j: Record<string, unknown>) => boolean, ms = 4000) {
  useEffect(() => {
    if (!url) return;
    let stop = false;
    const tick = async () => {
      try {
        const j = await fetch(url, { cache: "no-store" }).then((r) => r.json());
        if (onUpdate(j)) stop = true;
      } catch { /* try again */ }
      if (!stop) timer = setTimeout(tick, ms);
    };
    let timer = setTimeout(tick, 1500);
    return () => { stop = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
}
