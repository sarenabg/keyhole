//! # Keyhole keys contract
//!
//! Followers buy a time-limited "key" that lets them see a trader's private
//! trades. Payments arrive as USDC through the NEAR Intents 1Click API, which
//! calls `ft_transfer_call` on the USDC contract with this contract as the
//! receiver and a JSON `msg` like:
//!
//! ```json
//! {"trader": "alice.near", "holder": "0x1234...abcd", "days": 30}
//! ```
//!
//! For every good payment this contract:
//! 1. records (or extends) the key on-chain, as a public, permanent receipt,
//! 2. keeps the platform fee (5% by default),
//! 3. forwards the rest straight to the trader's NEAR Intents balance.
//!
//! Bad payments (wrong token, bad `msg`, ...) are never kept: the full amount
//! is returned, which is how NEP-141 refunds the sender.
//!
//! The contract does not check prices. The web server decides whether a key is
//! valid by also comparing `total_paid` with the trader's listed price.
//!
//! Amounts are in USDC's smallest unit (6 decimals, so 1 USDC = 1_000_000).
//! Times are milliseconds since 1970.

use near_sdk::json_types::U128;
use near_sdk::serde_json::{self, json};
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{
    assert_one_yocto, env, ext_contract, near, require, AccountId, BorshStorageKey, CryptoHash,
    Gas, NearToken, PanicOnDefault, Promise, PromiseError, PromiseOrValue,
};

/// Fee used when `new` is called without `fee_bps`: 500 basis points = 5%.
const DEFAULT_FEE_BPS: u16 = 500;
/// Smallest payment accepted when the contract is set up: 1 USDC.
/// Stops tiny payments from eating the contract's storage NEAR.
const DEFAULT_MIN_AMOUNT: u128 = 1_000_000;
/// The fee can never be set above 20%.
const MAX_FEE_BPS: u16 = 2000;
/// The key lengths (in days) a buyer can choose.
const ALLOWED_DAYS: [u32; 3] = [7, 30, 90];
const DAY_MS: u64 = 86_400_000;

/// Gas for forwarding the trader's share with `ft_transfer_call` (the token
/// keeps part of it for itself, the rest runs the deposit on `intents`).
/// Any gas left over at the end of the call is added to this as well.
const GAS_FOR_FT_TRANSFER_CALL: Gas = Gas::from_tgas(50);
/// Gas for a plain `ft_transfer` (fee withdrawals).
const GAS_FOR_FT_TRANSFER: Gas = Gas::from_tgas(10);
/// Gas for our own callbacks that check whether a transfer worked.
const GAS_FOR_CALLBACK: Gas = Gas::from_tgas(10);
/// Gas kept back to finish the current call after scheduling a transfer.
const GAS_RESERVE: Gas = Gas::from_tgas(5);

/// NEP-141 requires exactly 1 yoctoNEAR on `ft_transfer` / `ft_transfer_call`.
const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);

/// Largest page size for the paginated views.
const MAX_PAGE: u32 = 100;

/// Event standard name and version for NEP-297 logs.
const EVENT_STANDARD: &str = "keyhole";
const EVENT_VERSION: &str = "1.0.0";

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

/// A follower's key to one trader. Also what the key views return.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Key {
    pub trader: AccountId,
    pub holder: AccountId,
    /// The key works while the current time is before this.
    pub expires_at_ms: u64,
    /// Everything this holder has ever paid for this trader's key.
    pub total_paid: U128,
    /// How many times the key was bought or extended.
    pub purchases: u32,
    /// Length (in days) of the most recent purchase.
    pub last_days: u32,
}

/// One purchase, in the order they happened.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Sale {
    pub trader: AccountId,
    pub holder: AccountId,
    pub days: u32,
    /// What the buyer paid.
    pub amount: U128,
    /// The part sent on to the trader (amount minus the platform fee).
    pub trader_share: U128,
    pub at_ms: u64,
}

/// Running totals for one trader (stored).
#[near(serializers = [borsh])]
#[derive(Clone, Debug, Default)]
struct Totals {
    keys_sold: u32,
    /// Trader shares that actually reached the trader.
    earned: u128,
}

/// What `trader_stats` returns.
#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TraderStats {
    /// Every purchase counts, including extensions of an existing key.
    pub keys_sold: u32,
    /// Trader shares successfully delivered to the trader's Intents balance.
    pub earned: U128,
    /// Trader shares that could not be delivered yet (see `pay_owed`).
    pub owed: U128,
    /// Number of different holders who ever bought this trader's key.
    pub holders: u32,
}

/// What `config` returns.
#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Config {
    pub owner: AccountId,
    pub usdc: AccountId,
    pub intents: AccountId,
    pub fee_bps: u16,
    /// Platform fees collected and not yet withdrawn.
    pub fees: U128,
    /// Smallest payment accepted (USDC units).
    pub min_amount: U128,
}

/// The JSON a buyer (1Click `customRecipientMsg`) puts in `msg`.
#[near(serializers = [json])]
struct BuyMsg {
    trader: String,
    holder: String,
    days: u32,
}

/// A checked, valid purchase.
struct Purchase {
    trader: AccountId,
    holder: AccountId,
    days: u32,
}

#[near]
#[derive(BorshStorageKey)]
enum StorageKey {
    Keys,
    Sales,
    Totals,
    Owed,
    HolderIndex,
    HolderTraders { account_hash: CryptoHash },
    TraderIndex,
    TraderHolders { account_hash: CryptoHash },
}

// ---------------------------------------------------------------------------
// Contract state
// ---------------------------------------------------------------------------

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    /// May change the fee, the owner, and withdraw fees.
    owner: AccountId,
    /// The only token accepted (USDC).
    usdc: AccountId,
    /// The NEAR Intents contract that trader shares are deposited into.
    intents: AccountId,
    /// Platform fee in basis points (100 = 1%).
    fee_bps: u16,
    /// Platform fees collected and not yet withdrawn.
    fees: u128,
    /// Payments below this are refunded.
    min_amount: u128,
    /// Every key, by (trader, holder).
    keys: LookupMap<(AccountId, AccountId), Key>,
    /// Every purchase, oldest first. Never changes once written.
    sales: Vector<Sale>,
    /// Per-trader totals.
    totals: LookupMap<AccountId, Totals>,
    /// Trader shares that failed to send. Anyone can retry with `pay_owed`.
    owed: LookupMap<AccountId, u128>,
    /// holder -> traders they hold keys for.
    holder_index: LookupMap<AccountId, Vector<AccountId>>,
    /// trader -> holders of their keys.
    trader_index: LookupMap<AccountId, Vector<AccountId>>,
}

/// The token's transfer methods.
#[ext_contract(ext_ft)]
#[allow(dead_code)]
trait FungibleToken {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> U128;
}

/// Our own callbacks, called after a transfer finishes.
#[ext_contract(ext_self)]
#[allow(dead_code)]
trait SelfCallbacks {
    fn on_payout(&mut self, trader: AccountId, amount: U128) -> U128;
    fn on_fees_withdrawn(&mut self, to: AccountId, amount: U128) -> bool;
}

#[near]
impl Contract {
    /// Set up the contract. Called once, at deployment.
    #[init]
    pub fn new(
        owner: AccountId,
        usdc: AccountId,
        intents: Option<AccountId>,
        fee_bps: Option<u16>,
    ) -> Self {
        let fee_bps = fee_bps.unwrap_or(DEFAULT_FEE_BPS);
        require!(fee_bps <= MAX_FEE_BPS, "Fee can be at most 2000 (20%)");
        Self {
            owner,
            usdc,
            intents: intents.unwrap_or_else(|| "intents.near".parse().unwrap()),
            fee_bps,
            fees: 0,
            min_amount: DEFAULT_MIN_AMOUNT,
            keys: LookupMap::new(StorageKey::Keys),
            sales: Vector::new(StorageKey::Sales),
            totals: LookupMap::new(StorageKey::Totals),
            owed: LookupMap::new(StorageKey::Owed),
            holder_index: LookupMap::new(StorageKey::HolderIndex),
            trader_index: LookupMap::new(StorageKey::TraderIndex),
        }
    }

    // -----------------------------------------------------------------------
    // Receiving payments (NEP-141 receiver)
    // -----------------------------------------------------------------------

    /// Called by the token contract when someone sends tokens here with
    /// `ft_transfer_call`. Returns how many tokens go back to the sender:
    /// the full amount for anything we refuse, 0 for a recorded purchase.
    /// Never panics on bad input.
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        let token = env::predecessor_account_id();
        if token != self.usdc {
            refuse(&sender_id, &token, amount, "wrong_token");
            return PromiseOrValue::Value(amount);
        }
        let purchase = match parse_purchase(&msg, amount.0, self.min_amount) {
            Ok(p) => p,
            Err(reason) => {
                refuse(&sender_id, &token, amount, reason);
                return PromiseOrValue::Value(amount);
            }
        };
        self.record_purchase(sender_id, purchase, amount.0);
        // All tokens are used. Forwarding to the trader is a separate promise,
        // so once a key is recorded the buyer is never refunded.
        PromiseOrValue::Value(U128(0))
    }

    // -----------------------------------------------------------------------
    // Getting money out
    // -----------------------------------------------------------------------

    /// Retry sending a trader's owed money to their NEAR Intents balance.
    /// Anyone may call (attach at least 70 TGas; 100 TGas is safe).
    /// The owed amount is cleared first and put back if the transfer fails.
    pub fn pay_owed(&mut self, trader: AccountId) -> Promise {
        let amount = self.owed.get(&trader).copied().unwrap_or(0);
        require!(amount > 0, "Nothing owed to this trader");
        require!(
            has_gas_for(GAS_FOR_FT_TRANSFER_CALL),
            "Not enough gas attached: use at least 70 TGas"
        );
        self.owed.remove(&trader);
        self.transfer_to_intents(trader, amount)
    }

    /// Owner only, attach exactly 1 yoctoNEAR: send platform fees (all of
    /// them when `amount` is empty) to `to`. `to` must be registered with USDC.
    #[payable]
    pub fn withdraw_fees(&mut self, to: AccountId, amount: Option<U128>) -> Promise {
        assert_one_yocto();
        self.assert_owner();
        let amount = amount.map(|a| a.0).unwrap_or(self.fees);
        require!(amount > 0, "No fees to withdraw");
        require!(amount <= self.fees, "Amount is more than the collected fees");
        require!(
            has_gas_for(GAS_FOR_FT_TRANSFER),
            "Not enough gas attached: use at least 30 TGas"
        );
        self.fees -= amount;
        ext_ft::ext(self.usdc.clone())
            .with_attached_deposit(ONE_YOCTO)
            .with_static_gas(GAS_FOR_FT_TRANSFER)
            .ft_transfer(to.clone(), U128(amount), Some("Keyhole fees".to_string()))
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .on_fees_withdrawn(to, U128(amount)),
            )
    }

    // -----------------------------------------------------------------------
    // Owner settings
    // -----------------------------------------------------------------------

    /// Owner only, attach exactly 1 yoctoNEAR. Applies to future purchases.
    #[payable]
    pub fn set_fee(&mut self, fee_bps: u16) {
        assert_one_yocto();
        self.assert_owner();
        require!(fee_bps <= MAX_FEE_BPS, "Fee can be at most 2000 (20%)");
        self.fee_bps = fee_bps;
    }

    /// Owner only, attach exactly 1 yoctoNEAR. Payments below `min_amount`
    /// are refunded. Applies to future purchases.
    #[payable]
    pub fn set_min_amount(&mut self, min_amount: U128) {
        assert_one_yocto();
        self.assert_owner();
        self.min_amount = min_amount.0;
    }

    /// Owner only, attach exactly 1 yoctoNEAR. Hands the contract to a new owner.
    #[payable]
    pub fn set_owner(&mut self, owner: AccountId) {
        assert_one_yocto();
        self.assert_owner();
        self.owner = owner;
    }

    // -----------------------------------------------------------------------
    // Callbacks (only this contract may call them)
    // -----------------------------------------------------------------------

    /// After forwarding a trader's share. `ft_transfer_call` returns how much
    /// the receiver kept; anything not delivered becomes `owed`.
    /// Returns the amount delivered.
    #[private]
    pub fn on_payout(&mut self, trader: AccountId, amount: U128) -> U128 {
        let delivered = delivered_amount(amount.0);
        let unpaid = amount.0 - delivered;
        if delivered > 0 {
            let mut totals = self.totals.get(&trader).cloned().unwrap_or_default();
            totals.earned += delivered;
            self.totals.insert(trader.clone(), totals);
            emit(
                "payout_sent",
                json!({ "trader": trader, "amount": U128(delivered) }),
            );
        }
        if unpaid > 0 {
            self.add_owed(&trader, unpaid, "transfer_failed");
        }
        U128(delivered)
    }

    /// After a fee withdrawal: if it failed, put the fees back.
    #[private]
    pub fn on_fees_withdrawn(&mut self, to: AccountId, amount: U128) -> bool {
        if transfer_succeeded() {
            emit("fees_withdrawn", json!({ "to": to, "amount": amount }));
            return true;
        }
        self.fees += amount.0;
        false
    }

    // -----------------------------------------------------------------------
    // Views (free to call, change nothing)
    // -----------------------------------------------------------------------

    /// True while `holder` has an unexpired key to `trader`.
    pub fn has_key(&self, trader: AccountId, holder: AccountId) -> bool {
        self.keys
            .get(&(trader, holder))
            .is_some_and(|k| k.expires_at_ms > env::block_timestamp_ms())
    }

    /// The key (expired or not), or nothing if it was never bought.
    pub fn get_key(&self, trader: AccountId, holder: AccountId) -> Option<Key> {
        self.keys.get(&(trader, holder)).cloned()
    }

    /// Every key `holder` ever bought (expired ones included).
    pub fn keys_of_holder(&self, holder: AccountId) -> Vec<Key> {
        let Some(traders) = self.holder_index.get(&holder) else {
            return vec![];
        };
        traders
            .iter()
            .filter_map(|t| self.keys.get(&(t.clone(), holder.clone())).cloned())
            .collect()
    }

    /// Keys to `trader`, `limit` at a time (max 100), oldest holder first.
    pub fn holders_of(
        &self,
        trader: AccountId,
        from_index: Option<u32>,
        limit: Option<u32>,
    ) -> Vec<Key> {
        let Some(holders) = self.trader_index.get(&trader) else {
            return vec![];
        };
        page(holders.len(), from_index, limit)
            .filter_map(|i| holders.get(i))
            .filter_map(|h| self.keys.get(&(trader.clone(), h.clone())).cloned())
            .collect()
    }

    /// Totals for one trader.
    pub fn trader_stats(&self, trader: AccountId) -> TraderStats {
        let totals = self.totals.get(&trader).cloned().unwrap_or_default();
        TraderStats {
            keys_sold: totals.keys_sold,
            earned: U128(totals.earned),
            owed: U128(self.owed.get(&trader).copied().unwrap_or(0)),
            holders: self.trader_index.get(&trader).map_or(0, |v| v.len()),
        }
    }

    /// Purchases, oldest first, `limit` at a time (max 100).
    pub fn sales(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<Sale> {
        page(self.sales.len(), from_index, limit)
            .filter_map(|i| self.sales.get(i).cloned())
            .collect()
    }

    /// How many purchases have been made.
    pub fn sales_count(&self) -> u32 {
        self.sales.len()
    }

    /// Settings and collected fees.
    pub fn config(&self) -> Config {
        Config {
            owner: self.owner.clone(),
            usdc: self.usdc.clone(),
            intents: self.intents.clone(),
            fee_bps: self.fee_bps,
            fees: U128(self.fees),
            min_amount: U128(self.min_amount),
        }
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

impl Contract {
    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner,
            "Only the owner can do this"
        );
    }

    /// Record a valid purchase, take the fee and forward the trader's share.
    fn record_purchase(&mut self, sender_id: AccountId, p: Purchase, amount: u128) {
        let now_ms = env::block_timestamp_ms();
        let fee = fee_of(amount, self.fee_bps);
        let trader_share = amount - fee;
        let id = (p.trader.clone(), p.holder.clone());

        let existing = self.keys.get(&id).cloned();
        let is_new = existing.is_none();
        let mut key = existing.unwrap_or(Key {
            trader: p.trader.clone(),
            holder: p.holder.clone(),
            expires_at_ms: 0,
            total_paid: U128(0),
            purchases: 0,
            last_days: 0,
        });
        // A still-valid key is extended; an expired (or new) one starts now.
        let start = key.expires_at_ms.max(now_ms);
        key.expires_at_ms = start + u64::from(p.days) * DAY_MS;
        key.total_paid = U128(key.total_paid.0 + amount);
        key.purchases += 1;
        key.last_days = p.days;
        let expires_at_ms = key.expires_at_ms;
        self.keys.insert(id, key);

        if is_new {
            push_index(&mut self.holder_index, &p.holder, p.trader.clone(), |h| {
                StorageKey::HolderTraders { account_hash: h }
            });
            push_index(&mut self.trader_index, &p.trader, p.holder.clone(), |h| {
                StorageKey::TraderHolders { account_hash: h }
            });
        }

        let mut totals = self.totals.get(&p.trader).cloned().unwrap_or_default();
        totals.keys_sold += 1;
        self.totals.insert(p.trader.clone(), totals);
        self.fees += fee;

        let sale_index = self.sales.len();
        self.sales.push(Sale {
            trader: p.trader.clone(),
            holder: p.holder.clone(),
            days: p.days,
            amount: U128(amount),
            trader_share: U128(trader_share),
            at_ms: now_ms,
        });

        emit(
            "key_bought",
            json!({
                "trader": p.trader,
                "holder": p.holder,
                "days": p.days,
                "amount": U128(amount),
                "fee": U128(fee),
                "trader_share": U128(trader_share),
                "expires_at_ms": expires_at_ms,
                "sale_index": sale_index,
                "sender_id": sender_id,
            }),
        );

        if trader_share > 0 {
            self.pay_trader(p.trader, trader_share);
        }
    }

    /// Forward a trader's share now, or record it as owed if this call does
    /// not have enough gas left to send it safely.
    fn pay_trader(&mut self, trader: AccountId, amount: u128) {
        if has_gas_for(GAS_FOR_FT_TRANSFER_CALL) {
            self.transfer_to_intents(trader, amount).detach();
        } else {
            self.add_owed(&trader, amount, "low_gas");
        }
    }

    /// Deposit `amount` USDC into `trader`'s NEAR Intents account:
    /// `ft_transfer_call` to the intents contract with the trader id as `msg`.
    fn transfer_to_intents(&self, trader: AccountId, amount: u128) -> Promise {
        ext_ft::ext(self.usdc.clone())
            .with_attached_deposit(ONE_YOCTO)
            .with_static_gas(GAS_FOR_FT_TRANSFER_CALL)
            .with_unused_gas_weight(1)
            .ft_transfer_call(
                self.intents.clone(),
                U128(amount),
                None,
                trader.to_string(),
            )
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .with_unused_gas_weight(0)
                    .on_payout(trader, U128(amount)),
            )
    }

    fn add_owed(&mut self, trader: &AccountId, amount: u128, reason: &str) {
        let current = self.owed.get(trader).copied().unwrap_or(0);
        self.owed.insert(trader.clone(), current + amount);
        emit(
            "payout_owed",
            json!({ "trader": trader, "amount": U128(amount), "reason": reason }),
        );
    }
}

/// Check the `msg` and amount of an incoming payment.
/// Returns a short reason when the payment must be refused.
fn parse_purchase(msg: &str, amount: u128, min_amount: u128) -> Result<Purchase, &'static str> {
    if amount == 0 {
        return Err("zero_amount");
    }
    if amount < min_amount {
        return Err("too_small");
    }
    let m: BuyMsg = serde_json::from_str(msg).map_err(|_| "bad_msg")?;
    let trader: AccountId = m.trader.parse().map_err(|_| "bad_trader")?;
    let holder: AccountId = m.holder.parse().map_err(|_| "bad_holder")?;
    if trader == holder {
        return Err("trader_is_holder");
    }
    if !ALLOWED_DAYS.contains(&m.days) {
        return Err("bad_days");
    }
    Ok(Purchase {
        trader,
        holder,
        days: m.days,
    })
}

/// `amount * fee_bps / 10_000`, rounded down, without overflowing.
fn fee_of(amount: u128, fee_bps: u16) -> u128 {
    let bps = u128::from(fee_bps);
    amount / 10_000 * bps + (amount % 10_000) * bps / 10_000
}

/// Add `item` to the list stored under `owner`, creating the list if needed.
fn push_index(
    index: &mut LookupMap<AccountId, Vector<AccountId>>,
    owner: &AccountId,
    item: AccountId,
    prefix: impl FnOnce(CryptoHash) -> StorageKey,
) {
    index
        .entry(owner.clone())
        .or_insert_with(|| Vector::new(prefix(env::sha256_array(owner.as_bytes()))))
        .push(item);
}

/// Indexes for one page of a list of `len` items.
fn page(len: u32, from_index: Option<u32>, limit: Option<u32>) -> impl Iterator<Item = u32> {
    let from = from_index.unwrap_or(0).min(len);
    let limit = limit.unwrap_or(MAX_PAGE).min(MAX_PAGE);
    from..from.saturating_add(limit).min(len)
}

/// True if this call still has enough gas to schedule a transfer using
/// `transfer_gas` plus our callback.
fn has_gas_for(transfer_gas: Gas) -> bool {
    let left = env::prepaid_gas().saturating_sub(env::used_gas());
    left >= transfer_gas
        .saturating_add(GAS_FOR_CALLBACK)
        .saturating_add(GAS_RESERVE)
}

/// How much of `sent` reached the receiver of an `ft_transfer_call`.
/// The token returns the used amount (as a JSON string); a failed promise
/// means nothing was delivered. If the result cannot be read we assume it was
/// delivered, so that money is never sent twice.
fn delivered_amount(sent: u128) -> u128 {
    if env::promise_results_count() != 1 {
        return 0;
    }
    match env::promise_result_checked(0, 64) {
        Ok(bytes) => serde_json::from_slice::<U128>(&bytes)
            .map(|used| used.0.min(sent))
            .unwrap_or(sent),
        Err(PromiseError::Failed) => 0,
        Err(_) => sent,
    }
}

/// Read the result of the single `ft_transfer` this callback is waiting on.
fn transfer_succeeded() -> bool {
    if env::promise_results_count() != 1 {
        return false;
    }
    // `ft_transfer` returns nothing, so we only need to know success/failure.
    !matches!(env::promise_result_checked(0, 16), Err(PromiseError::Failed))
}

/// Log a refused payment. The caller returns the full amount (the refund).
fn refuse(sender_id: &AccountId, token: &AccountId, amount: U128, reason: &str) {
    emit(
        "payment_refused",
        json!({
            "sender_id": sender_id,
            "token": token,
            "amount": amount,
            "reason": reason,
        }),
    );
}

/// Write a NEP-297 event log: `EVENT_JSON:{...}`.
fn emit(event: &str, data: serde_json::Value) {
    let log = json!({
        "standard": EVENT_STANDARD,
        "version": EVENT_VERSION,
        "event": event,
        "data": [data],
    });
    env::log_str(&format!("EVENT_JSON:{log}"));
}

#[cfg(test)]
mod tests;
