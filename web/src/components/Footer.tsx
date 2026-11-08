import Link from "next/link";
import type { Mode } from "@/lib/types";

export function Footer({ mode }: { mode: Mode }) {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-[1264px] flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted sm:px-8">
        <span>
          {mode === "demo" ? "Demo: simulated traders, today's real prices. No real money moves." : "Live on NEAR mainnet. Records are read from NEAR Intents."}
        </span>
        <nav className="flex gap-5" aria-label="Footer">
          <Link href="/how" className="font-medium text-muted no-underline hover:text-ink">How it works</Link>
          {process.env.NEXT_PUBLIC_REPO_URL && (
            <a href={process.env.NEXT_PUBLIC_REPO_URL} className="font-medium text-muted no-underline hover:text-ink">Code</a>
          )}
        </nav>
      </div>
    </footer>
  );
}
