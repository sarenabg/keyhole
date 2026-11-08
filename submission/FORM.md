# Submission form: drafted answers

Form: https://nearhackathon.com/#apply (one submission only; fix mistakes later at https://nearhackathon.com/request-changes). **Deadline 14 Nov 2026, 23:59 UTC.** Plan: submit on 13 Nov.

⚠️ **Limit: at most 2 projects per person and 2 submissions per email.** With Harbor and Elias's other ideas, decide who leads this one (for example, Elias) before submitting.

| Field | Answer | Notes |
|---|---|---|
| Project name | **Keyhole** | 2–80 characters |
| Lead name | _[you or Elias]_ | See the limit above |
| Email | _[lead's email]_ | Max 2 submissions per email |
| Team size | **2 - 4** | Elias (idea) + you. Use `1` if you submit alone |
| Tracks | **Privacy & Private AI** (`privacy`), **Unstoppable DeFi** (`defi`) | Optional third: Open Innovation (`open`) |
| NEAR account (payout) | _[your mainnet account, e.g. name.near]_ | Lowercase |
| Project URL (repo) | **https://github.com/sarenabg/keyhole** | Public, MIT licence |
| Demo URL | _[link to the X post, once posted]_ | The rules want the X post here |
| Consent | Tick it yourself after reading the contact notice | |

## Idea (20–2000 characters)

Paste this (1,888 characters):

> Keyhole is copy trading for traders who keep their trades private on NEAR.
>
> Problem: good traders don't trade in public, because anyone can copy or front-run them for free. So copy-trading sites only show the records traders choose to share, and many are faked or cherry-picked. NEAR Intents' Confidential Intents makes trades private, but then how does anyone prove they're good?
>
> Product: a trader signs once with their wallet (an empty NEAR Intents intent; it moves no money). Keyhole then reads their private NEAR Intents balances every few minutes and works out a public record (return over 7/30/90 days, win rate, biggest dip) from those readings. The trader can't type it in, edit it or hide losing trades. The trades themselves stay private. Followers buy a time-limited key (7, 30 or 90 days) with any coin: NEAR Intents 1Click turns it into USDC and delivers it, with a message, to our keys contract on NEAR, which records the key and forwards 95% to the trader's NEAR Intents account at once. Key holders see every trade (size as a share of the account, price, how it has done since) and can copy it in one tap: a real NEAR Intents swap into the same coin, landing in their own balance.
>
> How NEAR is used: NEAR Intents user sign-in (/v0/auth/authenticate) for NEAR, EVM and Solana wallets; private balances (/v0/account/balances) as the only input to records; 1Click for key payments (customRecipientMsg → ft_transfer_call into our contract) and for copies; a Rust keys contract (near-sdk 5.27, 46 tests).
>
> Demo mode runs the whole flow with no wallet (simulated traders on today's real NEAR Intents prices). Live mode runs on NEAR mainnet. Honest limits are in the README: NEAR's own view keys aren't live yet, so the key is enforced by the app and recorded on NEAR; our server sees holdings (running it in a TEE is next); fully private copies need an invite-only partner key.

_After the real-money test, add one line with the mainnet transaction links if there's room (or keep them in the README)._
