import Link from "next/link";
import { Avatar, CoinIcon, KeyIcon, LockIcon, Sparkline, Verified, cx, retColor } from "./ui";
import { pct } from "@/lib/format";
import type { Period, TraderCard as T } from "@/lib/types";

export function TraderCard({ t, period, hasKey, demo }: { t: T; period: Period; hasKey?: boolean; demo?: boolean }) {
  const r = t.record;
  return (
    <Link
      href={`/t/${encodeURIComponent(t.id)}?p=${period}`}
      className="group flex flex-col gap-[18px] rounded-[18px] border border-line bg-surface p-[22px] text-ink no-underline shadow-card transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_12px_32px_rgba(13,17,23,0.08)]"
    >
      <div className="flex items-center gap-3">
        <Avatar id={t.id} name={t.name} idx={t.avatar} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="truncate">{t.name}</span>
            <Verified label={demo ? "Simulated demo record" : "Record read from NEAR"} />
          </span>
          <span className="truncate text-[13px] text-muted">{t.handle}</span>
        </div>
        {hasKey ? (
          <span className="flex items-center gap-1.5 rounded-full bg-accent-tint px-2.5 py-1.5 text-xs font-semibold text-accent-ink">
            <KeyIcon size={12} stroke={2.4} /> Yours
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-subtle px-2.5 py-1.5 text-xs font-semibold text-soft">
            <LockIcon size={12} stroke={2.4} /> Private
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          {r.enoughData ? (
            <span className={cx("font-display text-[34px] font-semibold tracking-[-0.02em]", retColor(r.ret))}>{pct(r.ret)}</span>
          ) : (
            <span className="font-display text-[26px] font-semibold text-muted">New</span>
          )}
          <span className="text-[13px] text-muted">{r.enoughData ? `${period} days` : "Record starting"}</span>
        </div>
        <Sparkline points={r.spark} up={r.ret >= 0} className="w-[150px]" />
      </div>

      <div className="grid grid-cols-3 gap-2 border-y border-line-soft py-3">
        <div className="flex flex-col gap-0.5"><span className="text-xs text-muted">Win rate</span><span className="text-[15px] font-semibold">{pct(r.winRate, 0, false)}</span></div>
        <div className="flex flex-col gap-0.5"><span className="text-xs text-muted">Biggest dip</span><span className="text-[15px] font-semibold">{pct(r.maxDip)}</span></div>
        <div className="flex flex-col gap-0.5"><span className="text-xs text-muted">Trades a week</span><span className="text-[15px] font-semibold">{r.perWeek < 10 ? r.perWeek.toFixed(1).replace(/\.0$/, "") : Math.round(r.perWeek)}</span></div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center">
          {t.coins.slice(0, 3).map((c, i) => (
            <span key={c} className={i ? "-ml-1.5" : ""}><CoinIcon sym={c} size={24} ring="#FFFFFF" /></span>
          ))}
          <span className="ml-3 text-[13px] text-muted">{t.holders} with a key</span>
        </div>
        <span className="flex h-9 items-center gap-1.5 rounded-full bg-accent-tint px-3.5 text-sm font-semibold text-accent-ink">
          <KeyIcon size={15} /> {t.prices[30]} USDC
        </span>
      </div>
    </Link>
  );
}
