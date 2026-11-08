# Your part: switching on Live mode and the real-money test

You do every sign-in and every payment yourself, in your own wallet. Never share a seed phrase or private key with anyone, including Claude.

About 30–40 minutes in total. Steps A and B can happen in any order.

---

## A. Add the database to the hosted site (2 minutes)

1. Open https://vercel.com/dappdesigners-projects/keyhole-near
2. Click **Storage** (top menu) → **Create Database** (or **Browse Marketplace**) → pick **Turso**.
3. Sign in to Turso when asked, keep the free plan, create a database (any name, e.g. `keyhole`), and **connect it to the `keyhole-near` project** (tick *Production*).
4. Tell Claude "Turso is added". Claude then switches on Live mode and redeploys.

---

## B. Put the keys contract on NEAR (about 15 minutes, about 4.1 NEAR)

You need a NEAR mainnet account with **at least 4.2 NEAR**. The contract account keeps about 2.2 NEAR locked for its code and storage; the rest pays for storing keys.

Open the **Terminal** app on your Mac and paste these one at a time. Replace `YOURNAME.near` with your account everywhere.

**1. Let the `near` tool sign as you.** This opens your browser. Approve it in your NEAR wallet:

```bash
near account import-account using-web-wallet network-config mainnet
```

**2. Create the contract's account** (`keys.YOURNAME.near`, funded with 4 NEAR):

```bash
near account create-account fund-myself keys.YOURNAME.near '4 NEAR' autogenerate-new-keypair save-to-keychain sign-as YOURNAME.near network-config mainnet sign-with-keychain send
```

**3. Put the contract on it**, with you as the owner:

```bash
cd ~/Desktop/Projects/near-private-trading/contracts/keys
```

```bash
near contract deploy keys.YOURNAME.near use-file target/near/keyhole_keys.wasm with-init-call new json-args '{"owner":"YOURNAME.near","usdc":"17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' network-config mainnet sign-with-keychain send
```

**4. Let the contract receive USDC** (costs 0.00125 NEAR). Don't skip this: without it, payments to the contract can be lost.

```bash
near contract call-function as-transaction 17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1 storage_deposit json-args '{"account_id":"keys.YOURNAME.near","registration_only":true}' prepaid-gas '30 Tgas' attached-deposit '0.00125 NEAR' sign-as YOURNAME.near network-config mainnet sign-with-keychain send
```

**5. Check it:**

```bash
near contract call-function as-read-only keys.YOURNAME.near config json-args '{}' network-config mainnet now
```

You should see your account as `owner` and `min_amount: "1000000"`.

6. Tell Claude the contract name (`keys.YOURNAME.near`). Claude connects the site to it.

---

## C. The real-money test (about 15 minutes, about $10)

You'll play two people: a **trader** and a **follower**. Use two different wallets, for example **MetaMask** for the trader and **Phantom** for the follower (or two MetaMask accounts).

### As the trader (MetaMask)

1. Go to **near.com**, connect **MetaMask**, turn on **private (Confidential) mode**, and add about **$5 of USDC** (from Base, for example).
2. Do one small private trade on near.com, e.g. **$2 USDC → NEAR**.
3. Open **https://keyhole-near.vercel.app**, switch the header to **Live**.
4. **Sell keys → Connect and sign** → choose **Ethereum wallet** → approve the signature in MetaMask (free, moves no money).
5. Set your name and prices: **7 days = 1 USDC** (the lowest allowed), then **Start selling**.
6. Open your public page. Your record should say "Record from NEAR". If it shows nothing, tell Claude: it means near.com keeps your private balance under a different account than your MetaMask address, and we'll adjust.

### As the follower (Phantom or a second wallet)

7. In a **private browser window**, open the site, switch to **Live**, **Sign in** with the other wallet.
8. Open your trader page → **Get a key** → **7 days** → pay with **USDC on Base** (or any coin you have) → **Continue**.
9. Send exactly the amount shown to the address shown, from your wallet or an exchange. The page turns to **"You're in."** by itself (usually under a minute).
10. **See trades**: your near.com trade from step 2 should be there. Press **Copy** → **$5** → pay with USDC → send → **"Copied"**.
11. Tell Claude it's done. Claude collects the transaction links for the README and the submission.

### What it costs

| | About |
|---|---|
| Contract account (locked, not spent; recoverable later) | 4 NEAR |
| Gas for the setup steps | < 0.05 NEAR |
| Trader's test deposit on near.com | $5 (stays yours) |
| One 7-day key | 1 USDC (+ a few cents in fees). 95% comes back to you as the trader |
| One copy | $5 (stays yours, as NEAR) |
