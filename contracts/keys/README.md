# Keyhole keys contract

A small NEAR smart contract that sells **keys**. A key lets a follower (the
**holder**) see a **trader**'s private trades for 7, 30 or 90 days.

## What it does

1. A buyer pays in USDC through the NEAR Intents 1Click API. 1Click sends the
   USDC to this contract with `ft_transfer_call`, and passes our `msg`
   (1Click field `customRecipientMsg`):

   ```json
   {"trader": "alice.near", "holder": "0x8ba1f109551bd432803012645ac136ddd64dba72", "days": 30}
   ```

2. The contract records the key on-chain. This is a public, permanent receipt.
   - If the holder's key is still valid, the new days are added on top.
   - If it has expired (or is new), it starts from now.
3. It keeps the platform fee (5% by default) and **immediately** sends the rest
   to the trader's NEAR Intents account on `intents.near`.
4. If that transfer fails, the money is kept as **owed** to the trader. Anyone
   can retry with `pay_owed`. Nothing is lost.

Bad payments are never kept. The full amount goes back to the sender if:
the token is not USDC, the `msg` is not valid JSON, an account id is invalid,
trader and holder are the same, `days` is not 7, 30 or 90, the amount is 0, or
the amount is below the minimum payment (`min_amount`, 1 USDC to start). The
minimum stops people from spamming tiny payments, because every key and sale
uses storage that the contract pays for.

The contract does **not** check prices. The Keyhole web server decides if a key
is good enough by comparing `total_paid` with the trader's listed price.

Account ids can be NEAR accounts (`alice.near`), 64-character implicit accounts,
or EVM addresses (`0x` + 40 **lowercase** hex characters). Uppercase is refused,
so the web app must lowercase EVM addresses before building the `msg`.

Amounts are in USDC's smallest unit: 1 USDC = `1000000`. Times are milliseconds.

## Methods

**Payments**

| Method | Who | What |
| - | - | - |
| `ft_on_transfer(sender_id, amount, msg)` | USDC contract | Receives a payment. Returns `"0"` when a key is recorded, or the full amount to refund. |
| `pay_owed(trader)` | anyone (attach ~100 TGas) | Retries sending a trader's owed money. |

**Owner only** (attach exactly 1 yoctoNEAR)

| Method | What |
| - | - |
| `withdraw_fees(to, amount?)` | Sends platform fees (all, if `amount` is left out) to `to`. `to` must be registered with USDC. |
| `set_fee(fee_bps)` | Changes the fee for future sales. 100 = 1%, max 2000 (20%). |
| `set_min_amount(min_amount)` | Changes the smallest payment accepted, in USDC units (`"1000000"` = 1 USDC). |
| `set_owner(owner)` | Hands the contract to a new owner. |

**Views** (free)

| Method | Returns |
| - | - |
| `has_key(trader, holder)` | `true` while the key has not expired |
| `get_key(trader, holder)` | the key, or `null` |
| `keys_of_holder(holder)` | all keys a holder ever bought |
| `holders_of(trader, from_index?, limit?)` | keys to one trader, 100 at most per page |
| `trader_stats(trader)` | `keys_sold`, `earned`, `owed`, `holders` |
| `sales(from_index?, limit?)` | every purchase, oldest first, 100 at most per page |
| `sales_count()` | number of purchases |
| `config()` | `owner`, `usdc`, `intents`, `fee_bps`, `fees`, `min_amount` |

A key looks like this:

```json
{"trader":"alice.near","holder":"bob.near","expires_at_ms":1702592000000,
 "total_paid":"25000000","purchases":1,"last_days":30}
```

## Events

Logged as `EVENT_JSON:{"standard":"keyhole","version":"1.0.0","event":...,"data":[...]}`.

| Event | When |
| - | - |
| `key_bought` | A key was bought or extended (trader, holder, days, amount, fee, trader_share, expires_at_ms, sale_index, sender_id). |
| `payment_refused` | A payment was sent back (sender_id, token, amount, reason). Reasons: `wrong_token`, `bad_msg`, `bad_trader`, `bad_holder`, `trader_is_holder`, `bad_days`, `zero_amount`, `too_small`. |
| `payout_sent` | The trader's share reached their NEAR Intents account. |
| `payout_owed` | The trader's share could not be sent yet (reason `transfer_failed` or `low_gas`). |
| `fees_withdrawn` | The owner withdrew fees. |

## Build and test

```bash
cd contracts/keys
cargo test
cargo near build non-reproducible-wasm --skip-rust-version-check
```

The contract file is `target/near/keyhole_keys.wasm`.

## Deploy (you run these, not the assistant)

These commands use your own wallet. `near` (near-cli-rs) will sign with the key
in your keychain. Replace `<your-account>.near` with your NEAR account.

**Before you start:** the contract pays for its own storage (buyers only send
USDC). The contract code itself is about 214 KB, which locks about 2.2 NEAR.
Give the account **4 NEAR** in total; the rest pays for keys and sales (each
new key and sale uses roughly 0.005 NEAR at most). Top it up if it runs low.

**1. Create the contract account** (`keys.<your-account>.near`, funded with 4 NEAR):

```bash
near account create-account fund-myself keys.<your-account>.near '4 NEAR' \
  autogenerate-new-keypair save-to-keychain \
  sign-as <your-account>.near network-config mainnet sign-with-keychain send
```

**2. Deploy and set it up** (you are the owner; mainnet USDC is the token):

```bash
near contract deploy keys.<your-account>.near \
  use-file target/near/keyhole_keys.wasm \
  with-init-call new \
  json-args '{"owner":"<your-account>.near","usdc":"17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"}' \
  prepaid-gas '30 Tgas' attached-deposit '0 NEAR' \
  network-config mainnet sign-with-keychain send
```

`intents` defaults to `intents.near` and the fee to 5% (`500`). To change them,
add `"intents":"...","fee_bps":...` to the JSON. The minimum payment starts at
1 USDC; change it later with `set_min_amount`.

**3. Register the contract with USDC** (so it can hold USDC; costs 0.00125 NEAR):

```bash
near contract call-function as-transaction \
  17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1 storage_deposit \
  json-args '{"account_id":"keys.<your-account>.near","registration_only":true}' \
  prepaid-gas '30 Tgas' attached-deposit '0.00125 NEAR' \
  sign-as <your-account>.near network-config mainnet sign-with-keychain send
```

Without this step, USDC cannot be delivered to the contract.

**4. Check it:**

```bash
near contract call-function as-read-only keys.<your-account>.near config \
  json-args '{}' network-config mainnet now

near contract call-function as-read-only keys.<your-account>.near sales_count \
  json-args '{}' network-config mainnet now
```

`config` should show your account as `owner`, the USDC id, `intents.near`,
`fee_bps: 500`, `fees: "0"` and `min_amount: "1000000"`. `sales_count` should be `0`.

## Good to know

- **Refunds go to the sender.** With 1Click the sender is the NEAR Intents
  contract delivering the payment, not the buyer. 1Click handles what happens
  next.
- **Gas.** Forwarding needs about 65 TGas left after the purchase is recorded.
  If the payment arrives with less, the key is still recorded and the trader's
  share is kept as owed; call `pay_owed` (with ~100 TGas) to send it.
- **Owed money.** `trader_stats(trader).owed` shows money waiting for a trader.
- **Fees.** To withdraw fees, the `to` account must be registered with USDC.
