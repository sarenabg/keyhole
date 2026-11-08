"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WalletDialog } from "./WalletDialog";

export function SignInPrompt({ title, sub, role = "viewer", cta = "Sign in", next }: { title: string; sub: string; role?: "viewer" | "trader"; cta?: string; next?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <main className="mx-auto flex max-w-[520px] flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="m-0 font-display text-[30px] font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="m-0 text-[15px] text-muted">{sub}</p>
      <button type="button" onClick={() => setOpen(true)} className="mt-2 h-12 rounded-full bg-accent px-6 font-semibold text-white">{cta}</button>
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
