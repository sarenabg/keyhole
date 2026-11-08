import "server-only";
import { createHmac, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { Mode, MyCopy, MyKey, Viewer } from "./types";

// Small signed cookies. Demo mode keeps each visitor's demo keys and copies here (no database needed);
// Live mode keeps who signed in with their wallet.

function secret(): string {
  const s = process.env.KEYHOLE_SECRET;
  if (!s && process.env.NODE_ENV === "production" && liveEnabled()) throw new Error("KEYHOLE_SECRET is not set");
  return s ?? "keyhole-local-dev-secret";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function seal(obj: unknown): string {
  const body = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function unseal<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  const [body, mac] = raw.split(".");
  if (!body || !mac) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

/** Encrypts a secret (a trader's NEAR Intents sign-in) before it goes into the database. */
export function encrypt(plain: string): string {
  const key = createHash("sha256").update(`enc:${secret()}`).digest();
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const out = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), out].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(sealed: string): string {
  const [iv, tag, data] = sealed.split(".").map((s) => Buffer.from(s, "base64url"));
  const key = createHash("sha256").update(`enc:${secret()}`).digest();
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}

// ---------- Mode ----------

/** Live mode is offered only when the server is set up for it (database + secret). */
export function liveEnabled(): boolean {
  return process.env.KEYHOLE_LIVE === "1";
}

export async function getMode(): Promise<Mode> {
  if (!liveEnabled()) return "demo";
  const jar = await cookies();
  const m = jar.get("kh_mode")?.value;
  if (m === "live" || m === "demo") return m;
  return process.env.KEYHOLE_DEFAULT_MODE === "live" ? "live" : "demo";
}

// ---------- Demo visitor state ----------

export type DemoState = {
  v: 1;
  id: string;
  keys: MyKey[];
  copies: MyCopy[];
  auto: string[];
  /** When auto-copy was switched on, per trader. */
  autoAt?: Record<string, number>;
  seller?: { name: string; prices: [number, number, number]; listed: boolean };
};

const DEMO_COOKIE = "kh_demo";

export async function demoState(): Promise<DemoState> {
  const jar = await cookies();
  const s = unseal<DemoState>(jar.get(DEMO_COOKIE)?.value);
  if (s && s.v === 1) return s;
  return { v: 1, id: `guest-${randomBytes(3).toString("hex")}`, keys: [], copies: [], auto: [] };
}

export async function saveDemoState(s: DemoState) {
  const jar = await cookies();
  // Keep the cookie small.
  s.copies = s.copies.slice(-30);
  jar.set(DEMO_COOKIE, seal(s), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

// ---------- Live sign-in ----------

export type LiveSession = { id: string; kind: "evm" | "solana" | "near"; at: number };
const LIVE_COOKIE = "kh_live";

export async function liveSession(): Promise<LiveSession | null> {
  const jar = await cookies();
  const s = unseal<LiveSession>(jar.get(LIVE_COOKIE)?.value);
  if (!s || Date.now() - s.at > 30 * 86_400_000) return null;
  return s;
}

export async function setLiveSession(s: LiveSession | null) {
  const jar = await cookies();
  if (!s) jar.delete(LIVE_COOKIE);
  else jar.set(LIVE_COOKIE, seal(s), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30, secure: process.env.NODE_ENV === "production" });
}

export async function currentViewer(mode: Mode): Promise<Viewer | null> {
  if (mode === "demo") {
    const s = await demoState();
    return { id: s.id, label: "You (demo)", kind: "guest" };
  }
  const s = await liveSession();
  if (!s) return null;
  const { shortId } = await import("./format");
  return { id: s.id, label: shortId(s.id), kind: s.kind };
}
