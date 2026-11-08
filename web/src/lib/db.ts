import "server-only";
import { createClient, type Client } from "@libsql/client";

// Live mode's database. Locally a file (keyhole.db); hosted, a Turso (libSQL) database:
// set DATABASE_URL + DATABASE_AUTH_TOKEN (or the TURSO_* variables Vercel's Turso integration adds).
let client: Client | null = null;
let ready: Promise<void> | null = null;

export function db(): Client {
  if (!client) {
    client = createClient({
      url: process.env.DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? "file:keyhole.db",
      authToken: process.env.DATABASE_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

export async function ensureDb(): Promise<Client> {
  if (!ready) ready = migrate().catch((e) => {
    ready = null;
    throw e;
  });
  await ready;
  return db();
}

async function migrate() {
  await db().batch(
    [
      `CREATE TABLE IF NOT EXISTS traders (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        refresh_enc TEXT,
        refresh_expires_at INTEGER NOT NULL DEFAULT 0,
        access_enc TEXT,
        access_expires_at INTEGER NOT NULL DEFAULT 0,
        price7 REAL NOT NULL DEFAULT 5,
        price30 REAL NOT NULL DEFAULT 15,
        price90 REAL NOT NULL DEFAULT 36,
        max_keys INTEGER NOT NULL DEFAULT 300,
        allow_copy INTEGER NOT NULL DEFAULT 1,
        listed INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_snap_at INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS snapshots (
        trader_id TEXT NOT NULL,
        t INTEGER NOT NULL,
        balances TEXT NOT NULL,
        prices TEXT NOT NULL,
        assets TEXT NOT NULL,
        PRIMARY KEY (trader_id, t)
      )`,
      `CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY,
        trader_id TEXT NOT NULL,
        holder_id TEXT NOT NULL,
        days INTEGER NOT NULL,
        price REAL NOT NULL,
        via TEXT NOT NULL,
        origin_asset TEXT NOT NULL,
        deposit_address TEXT NOT NULL,
        deposit_memo TEXT,
        amount_in TEXT NOT NULL,
        deadline TEXT,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        paid_at INTEGER,
        expires_at INTEGER,
        receipt TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS purchases_holder ON purchases(holder_id, status)`,
      `CREATE INDEX IF NOT EXISTS purchases_trader ON purchases(trader_id, status)`,
      `CREATE TABLE IF NOT EXISTS copies (
        id TEXT PRIMARY KEY,
        holder_id TEXT NOT NULL,
        trader_id TEXT NOT NULL,
        trade_id TEXT NOT NULL,
        to_sym TEXT NOT NULL,
        to_asset TEXT NOT NULL,
        usd_in REAL NOT NULL,
        price_at REAL NOT NULL,
        origin_asset TEXT NOT NULL,
        deposit_address TEXT NOT NULL,
        deposit_memo TEXT,
        amount_in TEXT NOT NULL,
        amount_out TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        done_at INTEGER,
        receipt TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS copies_holder ON copies(holder_id)`,
    ],
    "write",
  );
}
