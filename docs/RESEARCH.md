# Private trading with paid "keys": what's real today

_Researched 8 Nov 2026 against NEAR's docs, the live 1Click API and the hackathon rules. Nothing third-party was installed or run; competitor code was read as text only._

## Elias's idea

> Private trading where you sell your viewing keys for people to follow/copy trade. NEAR Intents confidential trading is all private, so you can have a social trading app where people sell "keys" for only select people to see. PnL can be publicly displayed so people can choose to buy in.

## What is real today

| Piece | Status | Evidence |
|---|---|---|
| **Confidential Intents** (private trading on NEAR) | ✅ Live since early 2026, generally available since 7 Jul 2026. Trades settle on NEAR's private shard; order size, timing and counterparties are not public | near.org blog "General availability of Confidential Intents"; docs.near-intents.org "Confidential Swaps" |
| **Private balances** readable by their owner | ✅ Live. A wallet signs an empty message → 1Click returns a "User-Session" token → `GET /v0/account/balances` returns that account's private balances | **We tested this live** on 8 Nov with a throwaway key: sign-in `201`, balances `200` |
| Sign-in lifetime | 15 min access token, **7 days** refresh token | live response |
| Private trade **history** | 🔒 Invite-only (`403 History is invite-only for now`) | live response |
| **Private (confidential) quotes and swaps** via the API | 🔒 Needs a 1Click **partner key with confidential access** (invite-only, requested via the Partner Portal). Without it: `401 User authentication is required for confidential intent quotes` | live response; docs |
| Ordinary 1Click swaps | ✅ Work without a key (0.25% extra fee). Since 27 Oct 2026 they **settle confidentially** too, but swap data still shows on the public Intents Explorer | changelog 27 Oct 2026 |
| **"Viewing keys"** (NEAR's own) | ❌ **Not live.** NEAR says it *plans* an account-level view key you can share with an auditor or tax advisor for a limited time | near.org GA blog: "plans to roll out" |
| near.com Confidential Mode | ✅ Live for consumers (about 40% of near.com volume) | near.org blog |

Doc gotcha we hit: the docs say the nonce "salt" is `e110f317`, but the live `intents.near` contract returns `252812b3` (`current_salt`). Using the docs' value fails.

## So what can't be built literally

- You **can't sell a NEAR viewing key** yet. It doesn't exist. And when it ships it's designed for auditors: one key that reveals the whole account, not a per-buyer, revocable pass.
- Handing a buyer the trader's sign-in token would work technically, but it can't be limited per buyer, and it would expose the trader's whole account. Not acceptable.

## What we do instead (the honest version)

**Our app is the "key".** The trader signs in once with their wallet. Our server uses that sign-in to read their **private balances straight from NEAR Intents** every few minutes. From that it computes:

1. a **public profit-and-loss record**, read from NEAR Intents, not typed in by the trader, and not paper trading;
2. a **private trade feed** (each change in holdings = a trade), shown only to people holding a **key**.

**Keys are real on NEAR mainnet:** a small contract sells time-limited keys. The buyer pays, the contract pays the trader immediately (95%), and anyone can check who holds a valid key.

**Copy-trading:** a follower taps **Copy** → a real 1Click quote for the same trade, sized to their balance → they approve in their wallet. With a confidential partner key, the copy is fully private; without one it's an ordinary 1Click swap (settles privately, but visible on the Intents Explorer). Auto-copy without a tap needs the follower to delegate signing; that's a stated next step.

**Trust, said plainly:** our server sees the trader's holdings in order to compute the feed. Next step is running that service inside a TEE (NEAR AI Cloud / Phala), so nobody, us included, can read it.

## Demo vs Live

| | Demo | Live (NEAR mainnet) |
|---|---|---|
| Traders and their records | Simulated, clearly labelled | Real traders who signed in; records from their private NEAR Intents balances |
| Prices | Real (1Click token prices) | Real |
| Buying a key | Simulated, no wallet | Real NEAR payment to the keys contract; trader paid instantly |
| Private trade feed | Simulated | Real changes in the trader's private balances |
| Copy a trade | Simulated fill at the live price | Real 1Click quote; follower approves in wallet |

## Competition (as of 8 Nov, 280 projects submitted)

| Project | What it is | How we differ |
|---|---|---|
| **Privue** ([repo](https://github.com/PinnacleCryptNG/privue), privue-app.vercel.app, created 6 Nov; not in the directory yet) | Almost exactly this idea: public stats, frosted trade list, view pass / blind-copy pass, testnet pass contract | Their trades are **paper fills by bots**; passes on **testnet**; confidential settlement "next". Ours reads **real private balances on mainnet**, and keys are paid on mainnet |
| **NOVA Copy-Trading** (in directory; tracks privacy, security, agents) | Agent-to-agent: a trading agent sells time-limited access to an encrypted trade journal (NOVA + TEE), follower agent copies within owner limits; recorded mainnet run | Agents only, terminal demo, **self-reported** journal. Ours is for people, with a consumer app and records read from NEAR Intents |
| NEAR Private OTC, PipTradeDex Private Intent | Private trading/OTC, not social | Not copy-trading |

**Our one-line difference:** *the only copy-trading app whose track records come straight from traders' real private NEAR Intents balances on mainnet, so nobody can fake a record, and nobody sees the trades without a key.*

## Hackathon rules that matter (nearhackathon.com/HACKATHON.md)

- Deadline **14 Nov 2026 23:59 UTC**. Window opened 19 Oct (baseline). Judging 16–18 Nov.
- Repo public with a LICENSE; README for humans **and machines** ("do X → see Y"); disclose libraries and AI-written code; tags `pre-hackathon` / `hackathon-submission` or a branch.
- A public **X post** (says built at NEAR HACKATHON, tags @NEARProtocol and #NEARHackathon, video or screenshots). Screenshots alone aren't enough if the demo is local-only.
- Hosted demo is a plus; keep it up to 18 Nov (ideally 25 Nov).
- AI first screen: Claude Code and Codex clone, follow the README, verify features, score. Humans decide.
- Form fields: `projectName`, `leadName`, `email`, `size`, `tracks`, `nearAddress` (mainnet payout), `projectUrl` (repo), `demoUrl` (X post), `idea` (20–2000 chars), `consent`. One submission, fix via /request-changes.
- ⚠️ **At most 2 projects per person and 2 submissions per email.** Four projects need at least two different leads/emails.
- Tracks we fit: **`privacy`** (Privacy & Private AI: private finance), **`defi`** (trading settled through NEAR Intents). Optional: `nfts` if keys become transferable NFTs.
- No testnet for Intents: use mainnet with tiny amounts and `dry: true` quotes.

## Sources

- https://nearhackathon.com/HACKATHON.md
- https://www.near.org/blog/announcing-general-availability-of-confidential-intents
- https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/confidential-swaps.md
- https://docs.near-intents.org/api-reference/user-auth/authenticate-user-with-signed-data.md
- https://docs.near-intents.org/integration/distribution-channels/1click-api/authentication.md
- https://docs.near-intents.org/changelog/entries/2026-10-27-1click-confidential.md
- https://1click.chaindefuser.com/docs/v0/openapi.yaml
- Our live check: `scripts/research/confidential_auth_check.mjs`
