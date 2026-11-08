// Display helpers shared by server and browser code.

export function shortId(id: string): string {
  if (/^0x[0-9a-f]{40}$/i.test(id)) return `${id.slice(0, 6)}…${id.slice(-4)}`;
  if (/^[0-9a-f]{64}$/.test(id)) return `${id.slice(0, 6)}…${id.slice(-4)}`;
  return id;
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function pct(x: number | null | undefined, digits = 1, sign = true): string {
  if (x === null || x === undefined || !isFinite(x)) return "—";
  const v = x * 100;
  const s = Math.abs(v).toFixed(digits);
  if (!sign) return `${s}%`;
  if (Math.abs(v) < 0.05) return `${(0).toFixed(digits)}%`;
  return `${v > 0 ? "+" : "−"}${s}%`;
}

export function money(n: number, digits?: number): string {
  if (!isFinite(n)) return "—";
  const d = digits ?? (n >= 1000 ? 0 : 2);
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

export function amount(n: number): string {
  if (!isFinite(n)) return "—";
  if (n >= 10000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 100) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 3 });
  return n.toPrecision(3);
}

export function usdc(n: number): string {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: n % 1 === 0 ? 0 : 2 })} USDC`;
}

export function timeAgo(t: number, now = Date.now()): string {
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)} min ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)} h ago`;
  const d = h / 24;
  if (d < 2) return "Yesterday";
  if (d < 30) return `${Math.floor(d)} days ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function dateShort(t: number): string {
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const AVATARS = [
  { bg: "#EFEBFF", fg: "#4A2FE0" },
  { bg: "#E7F6F0", fg: "#047857" },
  { bg: "#DDEBFF", fg: "#1E4FD8" },
  { bg: "#FFF1EA", fg: "#B4400B" },
  { bg: "#F0F1F4", fg: "#3D4555" },
  { bg: "#FDECEC", fg: "#B42318" },
];

export function avatarFor(id: string, idx?: number) {
  if (idx !== undefined) return AVATARS[idx % AVATARS.length];
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[h % AVATARS.length];
}
