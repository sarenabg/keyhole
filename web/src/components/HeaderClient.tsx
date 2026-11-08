"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cx } from "./ui";
import { WalletDialog } from "./WalletDialog";
import type { Mode, Viewer } from "@/lib/types";

export function ModeSwitch({ mode, available }: { mode: Mode; available: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!available) {
    return <span className="rounded-full bg-warn-tint px-2.5 py-1.5 text-xs font-semibold text-warn">Demo · no real money</span>;
  }
  const set = (m: Mode) =>
    start(async () => {
      await fetch("/api/mode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: m }) });
      router.refresh();
    });
  return (
    <div className={cx("flex rounded-full border border-line bg-surface p-0.5", pending && "opacity-60")} role="group" aria-label="Demo or live">
      {(["demo", "live"] as Mode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => set(m)}
          aria-pressed={mode === m}
          className={cx(
            "h-8 rounded-full px-3 text-xs font-semibold",
            mode === m ? (m === "demo" ? "bg-warn-tint text-warn" : "bg-ink text-white") : "text-muted hover:text-ink",
          )}
        >
          {m === "demo" ? "Demo" : "Live"}
        </button>
      ))}
    </div>
  );
}

export function AccountButton({ mode, viewer }: { mode: Mode; viewer: Viewer | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  if (mode === "demo") {
    return (
      <span className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-semibold">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#DDEBFF] text-[11px] font-bold text-[#1E4FD8]">Y</span>
        You
      </span>
    );
  }
  if (!viewer) {
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} className="h-10 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-black">
          Sign in
        </button>
        {open && <WalletDialog role="viewer" onClose={() => setOpen(false)} onDone={() => { setOpen(false); router.refresh(); }} />}
      </>
    );
  }
  return (
    <div className="relative">
      <button type="button" onClick={() => setMenu((v) => !v)} aria-expanded={menu} className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-semibold">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#DDEBFF] text-[11px] font-bold text-[#1E4FD8]">{viewer.label.slice(0, 1).toUpperCase()}</span>
        {viewer.label}
      </button>
      {menu && (
        <div className="kh-pop absolute right-0 top-12 z-40 w-48 rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
          <button
            type="button"
            className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-subtle"
            onClick={async () => {
              await fetch("/api/auth/signout", { method: "POST" });
              setMenu(false);
              router.refresh();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
