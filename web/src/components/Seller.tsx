"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WalletDialog } from "./WalletDialog";
import { cx } from "./ui";
import { timeAgo } from "@/lib/format";
import type { Mode } from "@/lib/types";
import { useSingleFlight } from "./useSingleFlight";

type Settings = { name: string; prices: [number, number, number]; maxKeys: number; allowCopy: boolean; listed: boolean };

async function save(v: Partial<Settings> & { refresh?: boolean }) {
  const res = await fetch("/api/live/seller", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ?? "Couldn't save.");
}

export function SellerSettings({ mode, initial, cut, onSaved, cta = "Save" }: { mode: Mode; initial: Settings; cut: number; onSaved?: () => void; cta?: string }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = "flex h-[46px] items-center gap-2 rounded-xl border border-line-strong bg-surface px-3.5 focus-within:border-accent";
  const input = "min-w-0 flex-1 border-0 bg-transparent text-base font-semibold outline-none";
  const setPrice = (i: number, n: number) => setV((s) => ({ ...s, prices: s.prices.map((p, j) => (j === i ? n : p)) as [number, number, number] }));

  const once = useSingleFlight();
  const submit = (...args: Parameters<typeof submitNow>) => once(() => submitNow(...args));
  async function submitNow(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      if (mode === "demo") await new Promise((r) => setTimeout(r, 500));
      else await save(v);
      setMsg(mode === "demo" ? "Saved (demo)" : "Saved");
      onSaved?.();
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-surface p-[22px]">
      <span className="font-semibold">Your key</span>
      <label className="flex flex-col gap-2 text-[13px] text-muted">
        Name people see
        <span className={field}><input className={input} value={v.name} maxLength={40} onChange={(e) => setV({ ...v, name: e.target.value })} /></span>
      </label>
      <div className="grid grid-cols-3 gap-2">
        {(["7 days", "30 days", "90 days"] as const).map((label, i) => (
          <label key={label} className="flex flex-col gap-2 text-[13px] text-muted">
            {label}
            <span className={field}>
              <input className={input} inputMode="decimal" value={String(v.prices[i])} onChange={(e) => setPrice(i, Number(e.target.value.replace(/[^\d.]/g, "")) || 0)} aria-label={`Price for ${label} in USDC`} />
            </span>
          </label>
        ))}
      </div>
      <span className="-mt-1 text-xs text-muted">Prices in USDC</span>
      <label className="flex flex-col gap-2 text-[13px] text-muted">
        Most keys at once
        <span className={field}><input className={input} inputMode="numeric" value={String(v.maxKeys)} onChange={(e) => setV({ ...v, maxKeys: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></span>
      </label>
      <Toggle label="Let key holders copy" on={v.allowCopy} onChange={(b) => setV({ ...v, allowCopy: b })} />
      <Toggle label="Show me on Keyhole" on={v.listed} onChange={(b) => setV({ ...v, listed: b })} />
      <button type="submit" disabled={busy} className="h-[46px] rounded-xl bg-ink font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : cta}</button>
      {msg && <span className={cx("text-sm", /Saved/.test(msg) ? "text-up" : "text-down")} role="status">{msg}</span>}
      <span className="text-[13px] leading-snug text-muted">You keep {Math.round(cut * 100)}%{cut < 1 ? `. Keyhole keeps ${Math.round((1 - cut) * 100)}%.` : "."}</span>
    </form>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (b: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx("relative h-8 w-[52px] flex-none rounded-full transition-colors", on ? "bg-accent" : "bg-line-strong")}>
        <span className={cx("absolute top-1 h-6 w-6 rounded-full bg-white transition-all", on ? "right-1" : "left-1")} />
      </button>
    </div>
  );
}

export function RecordStatus({ mode, renewBy, lastRead, lastError }: { mode: Mode; renewBy: number; lastRead: number; lastError: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const days = Math.max(0, Math.ceil((renewBy - Date.now()) / 86_400_000));
  const live = renewBy > Date.now();
  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-[22px]">
      <div className="flex items-center gap-2">
        <span className={cx("h-2.5 w-2.5 rounded-full", live ? "bg-up" : "bg-down")} />
        <span className="font-semibold">{live ? "Your record is live" : "Your record is paused"}</span>
      </div>
      <span className="text-sm leading-normal text-muted">Read from your private NEAR account every few minutes. Sign once a week to keep it going.</span>
      <div className="flex items-center justify-between rounded-xl bg-canvas px-3.5 py-3 text-sm"><span>Last read</span><span className="font-semibold">{lastRead ? timeAgo(lastRead) : "—"}</span></div>
      <div className="flex items-center justify-between rounded-xl bg-canvas px-3.5 py-3 text-sm"><span>Sign again in</span><span className="font-semibold">{live ? `${days} ${days === 1 ? "day" : "days"}` : "Now"}</span></div>
      {lastError && mode === "live" && <span className="text-[13px] text-down">Last read failed. Sign again to fix it.</span>}
      <div className="flex gap-2">
        <button type="button" onClick={() => (mode === "demo" ? undefined : setOpen(true))} className="h-11 flex-1 rounded-xl border border-line bg-surface text-sm font-semibold">Sign again</button>
        {mode === "live" && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => { setBusy(true); try { await save({ refresh: true }); } finally { setBusy(false); router.refresh(); } }}
            className="h-11 flex-1 rounded-xl border border-line bg-surface text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Reading…" : "Read now"}
          </button>
        )}
      </div>
      {open && <WalletDialog role="trader" onClose={() => setOpen(false)} onDone={() => { setOpen(false); router.refresh(); }} />}
    </section>
  );
}
