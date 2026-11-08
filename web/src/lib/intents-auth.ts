import "server-only";
import { randomBytes } from "node:crypto";
import { b58decode, b58encode, base64ToBytes, bytesToHex, hexToBytes } from "./base58";
import { authenticate, type Session } from "./oneclick";

// Wallet sign-in through NEAR Intents.
// The wallet signs an empty intent ("intents": []). It moves no money; it only proves who owns the account.
// NEAR Intents checks the signature for us (POST /v0/auth/authenticate), so every wallet it supports works:
// Ethereum-style wallets (MetaMask…), Solana wallets (Phantom…) and NEAR wallets.

export type WalletKind = "evm" | "solana" | "near";

const RPC = process.env.NEAR_RPC_URL ?? "https://rpc.mainnet.near.org";
const MAGIC = [0x56, 0x28, 0xf6, 0xc6];

let saltCache: { at: number; salt: string } | null = null;

/** The intents.near contract's current nonce salt. (The docs' value is out of date, so read it live.) */
export async function currentSalt(): Promise<string> {
  if (saltCache && Date.now() - saltCache.at < 10 * 60_000) return saltCache.salt;
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "query",
        params: { request_type: "call_function", finality: "final", account_id: "intents.near", method_name: "current_salt", args_base64: "e30=" },
      }),
      cache: "no-store",
    });
    const json = await res.json();
    const salt = JSON.parse(Buffer.from(json.result.result).toString()) as string;
    saltCache = { at: Date.now(), salt };
    return salt;
  } catch {
    return saltCache?.salt ?? "252812b3";
  }
}

/** A "versioned" nonce: magic prefix, version 0, salt, deadline and a start time + random bytes. */
async function versionedNonce(deadline: Date): Promise<string> {
  const salt = Buffer.from(await currentSalt(), "hex");
  const out = Buffer.alloc(32);
  Buffer.from(MAGIC).copy(out, 0);
  out[4] = 0;
  salt.copy(out, 5);
  out.writeBigUInt64LE(BigInt(deadline.getTime()) * 1_000_000n, 9);
  out.writeBigInt64LE(BigInt(Date.now()) * 1_000_000n, 17);
  randomBytes(7).copy(out, 25);
  return out.toString("base64");
}

export type SignRequest =
  | { kind: "evm"; signerId: string; text: string }
  | { kind: "solana"; signerId: string; text: string; publicKey: string }
  | { kind: "near"; signerId: string; nep413: { message: string; nonce: string; recipient: string } };

/** Builds the exact text the wallet must sign. */
export async function signRequest(kind: WalletKind, who: string): Promise<SignRequest> {
  const deadline = new Date(Date.now() + 5 * 60_000);
  const nonce = await versionedNonce(deadline);
  if (kind === "evm") {
    if (!/^0x[0-9a-fA-F]{40}$/.test(who)) throw new Error("That isn't a wallet address.");
    const signerId = who.toLowerCase();
    const text = JSON.stringify({ signer_id: signerId, verifying_contract: "intents.near", deadline: deadline.toISOString(), nonce, intents: [] });
    return { kind, signerId, text };
  }
  if (kind === "solana") {
    const pub = b58decode(who);
    if (pub.length !== 32) throw new Error("That isn't a Solana address.");
    const signerId = bytesToHex(pub);
    const text = JSON.stringify({ signer_id: signerId, verifying_contract: "intents.near", deadline: deadline.toISOString(), nonce, intents: [] });
    return { kind, signerId, text, publicKey: `ed25519:${who}` };
  }
  const account = who.trim().toLowerCase();
  if (!/^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(account) || account.length < 2 || account.length > 64) {
    throw new Error("That isn't a NEAR account name.");
  }
  const message = JSON.stringify({ deadline: deadline.toISOString(), intents: [], signer_id: account });
  return { kind, signerId: account, nep413: { message, nonce, recipient: "intents.near" } };
}

export type SignResult =
  | { kind: "evm"; text: string; signature: string }
  | { kind: "solana"; text: string; publicKey: string; signature: string }
  | { kind: "near"; message: string; nonce: string; recipient: string; publicKey: string; signature: string };

/** Turns what the wallet returned into NEAR Intents' format and asks NEAR Intents to check it. */
export async function verifyWithIntents(r: SignResult): Promise<{ signerId: string; session: Session }> {
  let signedData: Record<string, unknown>;
  let signerId: string;
  if (r.kind === "evm") {
    // personal_sign returns 0x + r(32) s(32) v(1). NEAR Intents wants v as 0/1, base58-encoded.
    const sig = hexToBytes(r.signature);
    if (sig.length !== 65) throw new Error("Unexpected signature from wallet.");
    if (sig[64] >= 27) sig[64] -= 27;
    signedData = { standard: "erc191", payload: r.text, signature: `secp256k1:${b58encode(sig)}` };
    signerId = JSON.parse(r.text).signer_id;
  } else if (r.kind === "solana") {
    const sig = r.signature.startsWith("ed25519:") ? r.signature.slice(8) : r.signature;
    signedData = { standard: "raw_ed25519", payload: r.text, public_key: r.publicKey, signature: `ed25519:${sig}` };
    signerId = JSON.parse(r.text).signer_id;
  } else {
    // NEAR wallets return the signature in base64.
    const sig = r.signature.startsWith("ed25519:") ? r.signature.slice(8) : b58encode(base64ToBytes(r.signature));
    signedData = {
      standard: "nep413",
      payload: { message: r.message, nonce: r.nonce, recipient: r.recipient },
      public_key: r.publicKey,
      signature: `ed25519:${sig}`,
    };
    signerId = JSON.parse(r.message).signer_id;
  }
  const session = await authenticate(signedData);
  return { signerId, session };
}

