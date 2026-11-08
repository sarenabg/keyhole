import Link from "next/link";
import { Logo, cx } from "./ui";
import { ModeSwitch, AccountButton } from "./HeaderClient";
import type { Ctx } from "@/lib/store";

export function Header({ ctx, active }: { ctx: Ctx; active?: "traders" | "keys" | "sell" }) {
  const nav = [
    { href: "/", label: "Traders", key: "traders" },
    { href: "/keys", label: "My keys", key: "keys" },
    { href: "/sell", label: "Sell keys", key: "sell" },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1264px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-8">
        <Link href="/" className="text-ink no-underline" aria-label="Keyhole home">
          <Logo />
        </Link>
        <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto" aria-label="Main">
          {nav.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              className={cx(
                "whitespace-nowrap rounded-full px-3.5 py-2 text-sm no-underline",
                active === n.key ? "bg-subtle font-semibold text-ink" : "font-medium text-muted hover:text-ink",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <ModeSwitch mode={ctx.mode} available={ctx.liveAvailable} />
          <AccountButton mode={ctx.mode} viewer={ctx.viewer} />
        </div>
      </div>
      {ctx.mode === "live" && (
        <div className="border-t border-line-soft bg-ink px-4 py-1.5 text-center text-xs font-medium text-night-muted">
          Live on NEAR mainnet · payments use real money
        </div>
      )}
    </header>
  );
}
