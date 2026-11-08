"use client";

import { useState } from "react";
import { Modal, ModalHead } from "./Modal";
import { CoinIcon, ShieldIcon, cx } from "./ui";
import { b58encode } from "@/lib/base58";
import { useSingleFlight } from "./useSingleFlight";

// Sign in with a wallet. The wallet signs an empty request that moves no money.
// NEAR Intents checks the signature, so the same flow works for Ethereum-style, Solana and NEAR wallets.

type Kind = "evm" | "solana" | "near";
type Role = "viewer" | "trader";

type EthereumProvider = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
type SolanaProvider = {
  connect: () => Promise<{ publicKey: { toString(): string } }>;
  signMessage: (m: Uint8Array, enc?: string) => Promise<{ signature: Uint8Array } | Uint8Array>;
  publicKey?: { toString(): string };
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    solana?: SolanaProvider;
    phantom?: { solana?: SolanaProvider };
  }
}

const MNW = "https://app.mynearwallet.com";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
  return json as T;
}

function utf8Hex(s: string) {
  return "0x" + Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, "0")).join("");
}

type Start =
  | { kind: "evm"; signerId: string; text: string }
  | { kind: "solana"; signerId: string; text: string; publicKey: string }
  | { kind: "near"; signerId: string; nep413: { message: string; nonce: string; recipient: string } };

async function signEvm(): Promise<unknown> {
  const eth = window.ethereum;
  if (!eth) throw new Error("No Ethereum wallet found. Install MetaMask, Rabby or Coinbase Wallet.");
  const [address] = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const s = await post<Start & { kind: "evm" }>("/api/auth/start", { kind: "evm", who: address });
  const signature = (await eth.request({ method: "personal_sign", params: [utf8Hex(s.text), address] })) as string;
  return { kind: "evm", text: s.text, signature };
}

async function signSolana(): Promise<unknown> {
  const sol = window.phantom?.solana ?? window.solana;
  if (!sol) throw new Error("No Solana wallet found. Install Phantom or Solflare.");
  const { publicKey } = await sol.connect();
  const who = publicKey.toString();
  const s = await post<Start & { kind: "solana" }>("/api/auth/start", { kind: "solana", who });
  const out = await sol.signMessage(new TextEncoder().encode(s.text), "utf8");
  const sig = out instanceof Uint8Array ? out : out.signature;
  return { kind: "solana", text: s.text, publicKey: s.publicKey, signature: b58encode(sig) };
}

async function signNear(account: string): Promise<unknown> {
  const s = await post<Start & { kind: "near" }>("/api/auth/start", { kind: "near", who: account });
  const url = new URL(`${MNW}/sign-message`);
  url.searchParams.set("message", s.nep413.message);
  url.searchParams.set("nonce", s.nep413.nonce);
  url.searchParams.set("recipient", s.nep413.recipient);
  url.searchParams.set("callbackUrl", `${window.location.origin}/wallet-done`);
  const w = window.open(url.toString(), "MyNearWallet", "width=480,height=640");
  if (!w) throw new Error("Your browser blocked the wallet window. Allow pop-ups and try again.");
  const signed = await new Promise<{ accountId: string; publicKey: string; signature: string }>((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== MNW) return;
      const m = e.data as { status?: string; signedRequest?: { accountId: string; publicKey: string; signature: string }; errorMessage?: string };
      if (m?.status === "success" && m.signedRequest) {
        cleanup();
        w.close();
        resolve(m.signedRequest);
      } else if (m?.status === "failure") {
        cleanup();
        w.close();
        reject(new Error(m.errorMessage ?? "The wallet didn't sign."));
      }
    };
    const timer = setInterval(() => {
      if (w.closed) {
        cleanup();
        reject(new Error("The wallet window was closed."));
      }
    }, 400);
    const cleanup = () => {
      window.removeEventListener("message", onMsg);
      clearInterval(timer);
    };
    window.addEventListener("message", onMsg);
  });
  if (signed.accountId && signed.accountId !== s.signerId) throw new Error(`You signed as ${signed.accountId}. Type that account name and try again.`);
  return { kind: "near", ...s.nep413, publicKey: signed.publicKey, signature: signed.signature };
}

export function WalletDialog({ role, onClose, onDone }: { role: Role; onClose: () => void; onDone: (id: string) => void }) {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nearOpen, setNearOpen] = useState(false);
  const [account, setAccount] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("kh_near_account") ?? "" : ""));

  const once = useSingleFlight();
  const go = (...args: Parameters<typeof goNow>) => once(() => goNow(...args));
  async function goNow(kind: Kind) {
    setError(null);
    setBusy(kind);
    try {
      const result = kind === "evm" ? await signEvm() : kind === "solana" ? await signSolana() : await signNear(account.trim().toLowerCase());
      if (kind === "near") localStorage.setItem("kh_near_account", account.trim().toLowerCase());
      const r = await post<{ id: string }>("/api/auth/verify", { role, result });
      onDone(r.id);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      setError(/User rejected|denied|cancel/i.test(msg) ? "You cancelled in your wallet." : msg);
    } finally {
      setBusy(null);
    }
  }

  const Option = ({ kind, title, sub, icon }: { kind: Kind; title: string; sub: string; icon: React.ReactNode }) => (
    <button
      type="button"
      disabled={busy !== null}
      onClick={() => (kind === "near" ? setNearOpen(true) : go(kind))}
      className={cx("flex w-full items-center gap-3.5 rounded-2xl border border-line bg-surface p-3.5 text-left hover:border-line-strong hover:bg-canvas disabled:opacity-60", busy === kind && "border-accent")}
    >
      {icon}
      <span className="flex flex-1 flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-[13px] text-muted">{sub}</span>
      </span>
      {busy === kind && <span className="kh-spin h-4 w-4 rounded-full border-2 border-accent border-t-transparent" aria-label="Waiting for wallet" />}
    </button>
  );

  return (
    <Modal title="Sign in" onClose={onClose}>
      <ModalHead onClose={onClose}>
        <span className="text-lg font-semibold">{role === "trader" ? "Prove your record" : "Sign in"}</span>
      </ModalHead>
      <div className="flex flex-col gap-3 p-6">
        <p className="m-0 text-[15px] leading-relaxed text-muted">
          {role === "trader"
            ? "Use the wallet you trade with on NEAR. Signing is free and moves no money."
            : "Signing is free and moves no money."}
        </p>
        {!nearOpen ? (
          <>
            <Option kind="near" title="NEAR wallet" sub="MyNearWallet" icon={<CoinIcon sym="NEAR" size={36} />} />
            <Option kind="evm" title="Ethereum wallet" sub="MetaMask, Rabby, Coinbase…" icon={<CoinIcon sym="ETH" size={36} />} />
            <Option kind="solana" title="Solana wallet" sub="Phantom, Solflare…" icon={<CoinIcon sym="SOL" size={36} />} />
          </>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (account.trim()) go("near");
            }}
          >
            <label htmlFor="near-acc" className="text-[13px] font-medium text-muted">Your NEAR account</label>
            <input
              id="near-acc"
              autoFocus
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="name.near"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="h-12 rounded-xl border border-line-strong px-3.5 text-base outline-none focus:border-accent"
            />
            <button type="submit" disabled={busy !== null || !account.trim()} className="h-12 rounded-xl bg-accent font-semibold text-white disabled:opacity-60">
              {busy === "near" ? "Waiting for your wallet…" : "Continue in MyNearWallet"}
            </button>
            <button type="button" onClick={() => setNearOpen(false)} className="h-10 text-sm font-medium text-muted">Other wallets</button>
          </form>
        )}
        {error && <p className="m-0 rounded-xl bg-down-tint px-3.5 py-3 text-sm text-down" role="alert">{error}</p>}
        <p className="m-0 flex items-center justify-center gap-1.5 pt-1 text-[13px] text-muted">
          <ShieldIcon size={14} /> Checked by NEAR Intents
        </p>
      </div>
    </Modal>
  );
}
