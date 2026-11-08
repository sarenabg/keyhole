# Keyhole

**Trade in private. Sell the view.**

Keyhole is copy trading for traders who keep their trades private on NEAR. A trader's **record** (return, win rate, biggest dip) is public and comes straight from their private NEAR Intents account, so nobody can fake it. Their **trades** stay private. Followers buy a time-limited **key** to see the trades and copy them in one tap, and the trader is paid instantly.

Built at the NEAR HACKATHON (November 2026). Tracks: **Privacy & Private AI** (`privacy`) and **Unstoppable DeFi** (`defi`).

- Hosted app: **https://keyhole-near.vercel.app** (Demo mode needs nothing; switch to Live in the header)
- Videos: [45 s promo](submission/media/keyhole-promo-16x9.mp4) · [2-minute walkthrough](submission/media/keyhole-walkthrough.mp4)

## The problem

Good traders don't want to trade in public: anyone can copy or front-run them for free. So on most copy-trading sites, the only records you can see are the ones traders choose to show, and many are faked or cherry-picked.

NEAR Intents now has a private mode (Confidential Intents): trades don't show on the public chain. That fixes the first half, but it makes the second half worse: how do you prove you're good if nobody can see your trades?

## What Keyhole does

| | Who sees it | Where it comes from |
|---|---|---|
| **Record**: return over 7/30/90 days, win rate, biggest dip, trades a week | Everyone | Worked out by Keyhole from the trader's **private NEAR Intents balances**, read every few minutes. The trader can't type it in or hide losing trades. |
| **Trades and holdings** | Only people holding a **key** | The same balance readings: each change in holdings is a trade. |
| **Key** (7, 30 or 90 days) | Recorded on NEAR | Paid with any coin through NEAR Intents. The keys contract pays the trader 95% instantly. |
| **Copy** | You | A real NEAR Intents swap into the same coin, landing in your own balance. |

### How NEAR is used

- **NEAR Intents user sign-in** (`/v0/auth/authenticate`): the wallet signs an empty intent (moves no money), and NEAR Intents checks it. Works for NEAR, Ethereum-style and Solana wallets.
- **Private balances** (`/v0/account/balances`): with the trader's sign-in, Keyhole reads their Confidential Intents balances. That's the only input to the record.
- **1Click swaps**: key payments (any coin → USDC delivered to the keys contract with `customRecipientMsg`) and copies (any coin → the coin the trader bought).
- **Keys contract on NEAR** (`contracts/keys`, Rust): records each key publicly and forwards 95% to the trader's NEAR Intents account with `ft_transfer_call`.

```
trader wallet ──sign (free)──▶ NEAR Intents ──session──▶ Keyhole server
                                                          │ reads private balances every few minutes
                                                          ▼
                         public record (return, win rate, dip)   private trades (key holders only)
follower ──any coin──▶ NEAR Intents 1Click ──USDC + msg──▶ keys contract ──95%──▶ trader's Intents balance
follower ──Copy──▶ NEAR Intents 1Click swap ──▶ same coin in the follower's own Intents balance
```

## Try it in 2 minutes (Demo mode: no wallet, no money)

Needs Node.js 20+.

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3310. Demo mode is the default; a yellow **Demo** label is always visible.

| Do this | You'll see |
|---|---|
| Open the home page | Six demo traders ranked by return, each with return, win rate, biggest dip, trades a week, a sparkline and a key price. Switch **7 / 30 / 90 days** and the numbers change. One trader is losing money: records aren't cherry-picked. |
| Open **Mara Lin** | Her record and chart. The **Trades** card is blurred and locked: "Mara's trades are private". |
| `curl localhost:3310/api/traders/maralin.near/trades` | `403`: trades really are private without a key. |
| Press **Get a key**, pick 30 days, **Pay 25 USDC** (demo money) | "You're in." The key card now says "Yours until …". |
| Press **See trades** | The private feed: each trade (e.g. "Bought NEAR with ZEC"), its size as a share of her account, the price, and how it has done since. Plus what she holds now. |
| Press **Copy** on a buy | The amount you'd get comes from a **live NEAR Intents price check** (a real 1Click quote with `dry: true`). Press **Copy trade**: "Copied", and the trade is marked **Copied**. |
| Open **My keys** | Your key with days left, and your copies. |
| Open **Sell keys** | A trader's earnings dashboard: earned in 30 days, people with a key, earnings per day, recent sales, price settings. |
| Open **Sell keys → Try becoming a trader** | The three-step onboarding: connect wallet, prove your record (sign once), set your price. |

Demo traders are simulated, but on **today's real prices** from NEAR Intents, and their records go through exactly the same code as live records (`web/src/lib/stats.mjs`).

## Automated checks

With the app running (`npm run dev`), in a second terminal:

```bash
cd web
npm test
```

It runs three scripts. Expected endings:

| Script | What it checks | Ends with |
|---|---|---|
| `scripts/stats-check.mjs` | The record maths: money added or withdrawn isn't profit, trades are detected and sized, returns follow prices, biggest dip, periods, win rate. And the demo simulation is repeatable and believable. No server needed. | `✓ all 22 record checks passed` |
| `scripts/e2e-demo.mjs` | A visitor plays the whole Demo: privacy (`403` without a key), buying and extending a key, the private feed, a live price check, copying, auto-copy, bad input refused, forged cookies refused. | `✓ all 37 demo checks passed` |
| `scripts/live-check.mjs` | Live mode against the **real NEAR Intents service**, with throwaway keys made on the spot: a trader signs in with a NEAR wallet (NEP-413), their private balances are read, a follower signs in with a Solana wallet, gets a **real one-time payment address** for a key, and its status is tracked. **No money is sent.** Skips itself if Live mode is off. | `✓ all 21 live checks passed (no money moved)` (22 with `CRON_SECRET` set) |

Type checks and lint: `npm run typecheck` and `npm run lint`.

### Contract tests

```bash
cd contracts/keys
cargo test        # 46 tests
cargo near build non-reproducible-wasm --skip-rust-version-check
```

See [contracts/keys/README.md](contracts/keys/README.md) for methods, events and deploy steps.

## Live mode (NEAR mainnet, real money)

Live mode is a switch in the header when the server enables it. It uses real wallets and real money; every payment is approved by the person in their own wallet.

```bash
cd web
cp .env.example .env.local   # set KEYHOLE_LIVE=1, KEYHOLE_SECRET, CRON_SECRET
npm run dev
```

| Do this | What happens for real |
|---|---|
| **Sell keys → Connect and sign** with the wallet you trade with on near.com | Your wallet signs an empty intent; NEAR Intents checks it. Keyhole stores your NEAR Intents sign-in (encrypted) and reads your private balances. |
| Set prices, **Start selling** | You're listed. Your record updates every few minutes (and every page view). Sign again once a week to keep it live. |
| As a follower: **Sign in**, **Get a key**, pick a coin | A real one-time NEAR Intents address and exact amount (QR code, countdown). Send from any wallet or exchange; the page turns to "You're in" when it lands. |
| **See trades → Copy**, pick a coin | A real NEAR Intents swap into the same coin, delivered to your NEAR Intents balance. |

Settings (all in `web/.env.example`): `KEYHOLE_LIVE`, `KEYHOLE_SECRET`, `CRON_SECRET`, `DATABASE_URL` (+ `DATABASE_AUTH_TOKEN` for Turso), `KEYHOLE_KEYS_CONTRACT` (without it, key payments go straight to the trader), `ONECLICK_API_KEY` and `KEYHOLE_CONFIDENTIAL` (optional partner key).

**Mainnet proof:** _[transaction links added after our real-money test]_

## What's real and what's simulated

| | Demo | Live |
|---|---|---|
| Traders and records | Simulated traders, real maths, real prices | Real traders; records from their private NEAR Intents balances |
| Prices and copy quotes | Real (NEAR Intents) | Real |
| Buying a key | Demo money | Real payment through NEAR Intents; key recorded by the contract |
| Trades | Simulated | Real changes in private balances |
| Copying | Demo money at a real quoted price | Real swap |
| Copy automatically | Works (simulated) | Not yet: today each copy needs the follower's OK |

## Honest limits

- **NEAR's own "view keys" aren't live yet.** NEAR has announced account view keys for auditors, but they're not available, and they'd reveal a whole account to one person. Keyhole's key is a paid, time-limited pass enforced by the app, recorded on NEAR. When NEAR ships view keys, Keyhole could hand them out instead.
- **Keyhole's server sees the trader's holdings** in order to show them to key holders. Next step: run that service inside a TEE (NEAR AI Cloud) so nobody, us included, can look.
- **Fully private copies need a partner key** with confidential access (invite-only). Without it, copies are ordinary NEAR Intents swaps: since 27 Oct 2026 they settle on NEAR's private shard, but they're listed on the public Intents explorer. With `ONECLICK_API_KEY` + `KEYHOLE_CONFIDENTIAL=1`, Keyhole asks for `confidentiality: "basic"`.
- **Trade history in NEAR Intents is invite-only**, so Keyhole builds history from balance readings every few minutes. Two trades between readings look like one.
- **Records only count money inside NEAR Intents.**
- **The trader's 95% lands in their public NEAR Intents balance** (earnings are visible; trades aren't).
- **Key holders could share what they see.** Keys are short and cheap on purpose.

## How we differ from similar entries

- **Privue** (private copy trading, testnet): trades are paper fills by bots and passes are on testnet. Keyhole reads **real private balances on mainnet** and sells keys with real money.
- **NOVA Copy-Trading**: AI agents selling access to a self-reported encrypted journal, run from a terminal. Keyhole is for people, with records read from NEAR Intents rather than reported by the trader.

## Project layout

```
web/                  Next.js 15 app (Tailwind v4)
  src/lib/stats.mjs     record maths (shared by Demo and Live)
  src/lib/sim.mjs       demo traders (simulation on today's prices)
  src/lib/oneclick.ts   NEAR Intents 1Click API client
  src/lib/intents-auth.ts  wallet sign-in through NEAR Intents
  src/lib/live.ts       live records, keys and copies (libSQL / Turso)
  scripts/              automated checks
contracts/keys/       keys contract (Rust, near-sdk 5.27), 46 tests
docs/RESEARCH.md      what's real in NEAR Intents today, and the hackathon rules
docs/LIVE_TEST.md     step-by-step real-money test on mainnet
submission/           pitch, form answers, X post draft, screenshots, videos
video/                the videos, rendered from code over real screenshots
```

## Hackathon disclosures

- **Built during the hackathon.** This repository was started on 8 Nov 2026; there is no pre-hackathon code. Tags: `hackathon-submission` marks the submitted version.
- **Libraries:** Next.js, React, Tailwind CSS, `@libsql/client`, `qrcode`, `server-only`; near-sdk (Rust). No wallet SDKs: wallet sign-in uses the wallets' own browser APIs (MetaMask-style `personal_sign`, Phantom `signMessage`, MyNearWallet's sign-message page).
- **Reused from our own project:** coin and chain logos and the coin-grouping helper (`web/public/icons`, `web/src/lib/coins.ts`, `logos.ts`) come from our other entry, **Harbor** (any-coin checkout on NEAR Intents).
- **AI-generated code:** most of the code, tests and docs were written with Claude Code (Anthropic) and reviewed by the team.
- **Other chains:** none deployed; NEAR Intents lets people pay from other chains.

## License

[MIT](LICENSE)
