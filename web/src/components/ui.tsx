// Small building blocks shared by every screen (server-safe: no hooks).
import type { ReactNode } from "react";
import { coinLogo } from "@/lib/logos";
import { avatarFor, initials } from "@/lib/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-[20px] border border-line bg-surface shadow-card", className)}>{children}</section>;
}

export function Avatar({ id, name, idx, size = 44 }: { id: string; name: string; idx?: number; size?: number }) {
  const a = avatarFor(id, idx !== undefined && idx >= 0 ? idx : undefined);
  return (
    <span
      className="flex flex-none items-center justify-center rounded-full font-bold"
      style={{ width: size, height: size, background: a.bg, color: a.fg, fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function CoinIcon({ sym, size = 24, ring }: { sym: string; size?: number; ring?: string }) {
  const src = coinLogo(sym === "wNEAR" ? "NEAR" : sym);
  const style = { width: size, height: size, ...(ring ? { boxShadow: `0 0 0 2px ${ring}` } : {}) };
  if (!src) {
    return (
      <span className="flex flex-none items-center justify-center rounded-full bg-subtle text-[10px] font-bold text-soft" style={style} aria-hidden="true">
        {sym.slice(0, 3)}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="flex-none rounded-full" style={style} />;
}

export function PairIcon({ from, to, size = 44, ring = "#FFFFFF" }: { from: string; to: string; size?: number; ring?: string }) {
  const coin = Math.round(size * 0.68);
  return (
    <span className="relative block flex-none" style={{ width: size, height: size }} aria-hidden="true">
      <span className="absolute left-0 top-0"><CoinIcon sym={from} size={coin} /></span>
      <span className="absolute bottom-0 right-0"><CoinIcon sym={to} size={coin} ring={ring} /></span>
    </span>
  );
}

export function Sparkline({ points, up, className, height = 52, fill = true }: { points: number[]; up: boolean; className?: string; height?: number; fill?: boolean }) {
  if (points.length < 2) {
    return <div className={cx("rounded-lg bg-subtle", className)} style={{ height }} aria-hidden="true" />;
  }
  const w = 240;
  const h = 64;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - 6 - ((p - min) / span) * (h - 12)]);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const color = up ? "#047857" : "#C2410C";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} style={{ height }} aria-hidden="true">
      {fill && <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={up ? "rgba(4,120,87,0.10)" : "rgba(194,65,12,0.10)"} />}
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Verified({ size = 16, label = "Record read from NEAR" }: { size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
      <circle cx="12" cy="12" r="10" fill="#5B3DF5" />
      <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type IconProps = { size?: number; className?: string; stroke?: number };
function I({ size = 16, className, stroke = 2.2, children }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}
export const LockIcon = (p: IconProps) => <I {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></I>;
export const KeyIcon = (p: IconProps) => <I {...p}><circle cx="7.5" cy="15.5" r="4.5" /><path d="M10.7 12.3L20 3M16 7l3 3M14 9l2 2" /></I>;
export const CheckIcon = (p: IconProps) => <I {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></I>;
export const CloseIcon = (p: IconProps) => <I {...p}><path d="M6 6l12 12M18 6L6 18" /></I>;
export const ShieldIcon = (p: IconProps) => <I {...p}><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /></I>;
export const ChevronDown = (p: IconProps) => <I {...p}><path d="M6 9l6 6 6-6" /></I>;
export const ChevronLeft = (p: IconProps) => <I {...p}><path d="M15 6l-6 6 6 6" /></I>;
export const ArrowRight = (p: IconProps) => <I {...p}><path d="M5 12h14M13 6l6 6-6 6" /></I>;
export const CopyIcon = (p: IconProps) => <I {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></I>;
export const ExternalIcon = (p: IconProps) => <I {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></I>;

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-accent">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true">
          <circle cx="12" cy="8.5" r="5" />
          <path d="M9.6 12 L8 21 H16 L14.4 12 Z" />
        </svg>
      </span>
      <span className="font-display text-[19px] font-semibold tracking-[-0.02em]">Keyhole</span>
    </span>
  );
}

export function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-1 rounded-[14px] bg-canvas p-3.5", className)}>
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xl font-semibold">{value}</span>
    </div>
  );
}

export function retColor(x: number) {
  return x >= 0 ? "text-up" : "text-down";
}
