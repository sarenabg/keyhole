"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { WalletDialog } from "./WalletDialog";
import { KeyIcon, ShieldIcon } from "./ui";

export function SignInPrompt({ title, sub, role = "viewer", cta = "Sign in", next }: { title: string; sub: string; role?: "viewer" | "trader"; cta?: string; next?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toDemo = () =>
    start(async () => {
      await fetch("/api/mode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "demo" }) });
      router.refresh();
    });
  return (
    <main className="mx-auto flex max-w-[520px] flex-col items-center gap-4 px-4 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-tint text-accent-ink">
        <KeyIcon size={26} />
      </span>
      <h1 className="m-0 font-display text-[30px] font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="m-0 text-[15px] text-muted">{sub}</p>
      <button type="button" onClick={() => setOpen(true)} className="mt-2 h-12 rounded-full bg-accent px-6 font-semibold text-white hover:bg-accent-ink">{cta}</button>
      <button type="button" onClick={toDemo} disabled={pending} className="h-10 px-3 text-sm font-medium text-muted hover:text-ink disabled:opacity-60">
        {pending ? "Switching…" : "Or try the demo, no wallet needed"}
      </button>
      <p className="m-0 flex items-center gap-1.5 text-[13px] text-muted"><ShieldIcon size={14} /> Signing is free and moves no money</p>
      {open && (
        <WalletDialog
          role={role}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            if (next) router.push(next);
            router.refresh();
          }}
        />
      )}
    </main>
  );
}
