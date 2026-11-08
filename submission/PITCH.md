# Keyhole: pitch

**One line:** Trade in private. Sell the view.

**One sentence:** Keyhole is copy trading where every trader's record is read straight from their private NEAR account, so it can't be faked, and their trades stay hidden until you buy a key.

## 30 seconds

The best traders don't trade in public: anyone could copy them for free. So on copy-trading sites you only see the records traders choose to show you, and many are faked.

Keyhole fixes both halves. A trader signs once with their wallet. Keyhole reads their private NEAR Intents balances every few minutes and shows a public record (return, win rate, biggest dip) that they can't edit. Their trades stay private. You buy a key with any coin, the trader is paid instantly on NEAR, and you see every trade and copy it in one tap.

## Why NEAR

- **Private trading that already works:** NEAR Intents' Confidential Intents.
- **Proof without exposure:** a wallet signature gives Keyhole read access to the private balances, so the record comes from NEAR, not from the trader.
- **Pay from anything:** NEAR Intents turns any coin into USDC and delivers it to the keys contract with a note saying who bought which key.

## What's real

- Live on NEAR mainnet: wallet sign-in through NEAR Intents (NEAR, EVM and Solana wallets), private balance readings, real payment addresses for keys, real swaps for copies, and a keys contract with 46 tests.
- Demo mode for anyone: the whole flow with simulated traders on today's real prices, no wallet needed.
- Honest limits: NEAR's own "view keys" aren't live yet; Keyhole's server sees holdings (a TEE is next); fully private copies need an invite-only partner key.

## Business model

Keyhole keeps 5% of every key sold; traders keep 95%, paid instantly. Traders set their own prices and limits.

## Links

- App: https://keyhole-near.vercel.app
- Code: https://github.com/sarenabg/keyhole
