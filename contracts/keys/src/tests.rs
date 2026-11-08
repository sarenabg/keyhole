//! Unit tests. Run with `cargo test`.
//!
//! Cross-contract results (did the token transfer work?) are simulated by
//! calling our callbacks directly with a fake `PromiseResult`.

use super::*;
use near_sdk::mock::MockAction;
use near_sdk::test_utils::{get_created_receipts, get_logs, VMContextBuilder};
use near_sdk::{test_vm_config, testing_env, PromiseResult, RuntimeFeesConfig};

const NOW_MS: u64 = 1_700_000_000_000;
const DAY: u64 = DAY_MS;
const PRICE: u128 = 25_000_000; // 25 USDC
const EVM: &str = "0x8ba1f109551bd432803012645ac136ddd64dba72";
const IMPLICIT: &str = "98793cd91a3f870fb126f66285808c7e094afcfc4eda8a970f6648cdf0dbd6de";

fn acc(name: &str) -> AccountId {
    name.parse().unwrap()
}
fn contract_id() -> AccountId {
    acc("keys.keyhole.near")
}
fn usdc() -> AccountId {
    acc("usdc.near")
}
fn owner() -> AccountId {
    acc("owner.near")
}
fn trader() -> AccountId {
    acc("alice.near")
}
fn holder() -> AccountId {
    acc("bob.near")
}
fn one_click() -> AccountId {
    acc("1click.near")
}
fn stranger() -> AccountId {
    acc("stranger.near")
}

/// Set who is calling, the time (ms) and how much NEAR is attached.
fn set_ctx(caller: AccountId, time_ms: u64, deposit: NearToken) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(contract_id())
        .predecessor_account_id(caller.clone())
        .signer_account_id(caller)
        .block_timestamp(time_ms * 1_000_000)
        .attached_deposit(deposit)
        .account_balance(NearToken::from_near(10));
    testing_env!(b.build());
}

fn call(caller: AccountId, time_ms: u64) {
    set_ctx(caller, time_ms, NearToken::from_yoctonear(0));
}

fn call_yocto(caller: AccountId, time_ms: u64) {
    set_ctx(caller, time_ms, ONE_YOCTO);
}

/// Simulate this contract's callback running after a transfer with `result`.
fn callback_ctx(result: PromiseResult) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(contract_id())
        .predecessor_account_id(contract_id())
        .block_timestamp(NOW_MS * 1_000_000);
    testing_env!(
        b.build(),
        test_vm_config(),
        RuntimeFeesConfig::test(),
        Default::default(),
        vec![result]
    );
}

/// What `ft_transfer_call` returns: the used amount as a JSON string.
fn used(amount: u128) -> PromiseResult {
    PromiseResult::Successful(format!("\"{amount}\"").into_bytes())
}

fn setup() -> Contract {
    call(acc("deployer.near"), NOW_MS);
    Contract::new(owner(), usdc(), None, None)
}

fn buy_msg(trader: &str, holder: &str, days: u32) -> String {
    format!(r#"{{"trader":"{trader}","holder":"{holder}","days":{days}}}"#)
}

/// The token delivers `amount` with `msg` at `time_ms`. Returns the refund.
fn pay_msg(c: &mut Contract, msg: &str, amount: u128, time_ms: u64) -> u128 {
    call(usdc(), time_ms);
    match c.ft_on_transfer(one_click(), U128(amount), msg.to_string()) {
        PromiseOrValue::Value(v) => v.0,
        PromiseOrValue::Promise(_) => panic!("expected a value"),
    }
}

/// Buy (or extend) alice.near's key for bob.near.
fn buy(c: &mut Contract, days: u32, amount: u128, time_ms: u64) -> u128 {
    pay_msg(c, &buy_msg("alice.near", "bob.near", days), amount, time_ms)
}

fn has_event(name: &str) -> bool {
    get_logs()
        .iter()
        .any(|l| l.starts_with("EVENT_JSON:") && l.contains(&format!("\"event\":\"{name}\"")))
}

fn has_log(text: &str) -> bool {
    get_logs().iter().any(|l| l.contains(text))
}

/// Calls this contract scheduled on the token in the last call:
/// (method name, JSON args). Each must attach exactly 1 yoctoNEAR.
fn token_calls() -> Vec<(String, serde_json::Value)> {
    get_created_receipts()
        .into_iter()
        .filter(|r| r.receiver_id == usdc())
        .flat_map(|r| r.actions)
        .filter_map(|a| match a {
            MockAction::FunctionCallWeight {
                method_name,
                args,
                attached_deposit,
                ..
            } => {
                assert_eq!(attached_deposit, ONE_YOCTO);
                Some((
                    String::from_utf8(method_name).unwrap(),
                    serde_json::from_slice(&args).unwrap(),
                ))
            }
            _ => None,
        })
        .collect()
}

fn key(c: &Contract) -> Key {
    c.get_key(trader(), holder()).expect("key exists")
}

/// Assert a payment was refused in full and nothing was recorded.
fn assert_refused(c: &mut Contract, msg: &str, amount: u128, reason: &str) {
    assert_eq!(pay_msg(c, msg, amount, NOW_MS), amount);
    assert!(has_event("payment_refused"));
    assert!(has_log(&format!("\"reason\":\"{reason}\"")), "expected reason {reason}");
    assert!(token_calls().is_empty());
    assert_eq!(c.sales_count(), 0);
    assert_eq!(c.config().fees, U128(0));
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

#[test]
fn new_uses_defaults() {
    let c = setup();
    let cfg = c.config();
    assert_eq!(cfg.owner, owner());
    assert_eq!(cfg.usdc, usdc());
    assert_eq!(cfg.intents, acc("intents.near"));
    assert_eq!(cfg.fee_bps, 500);
    assert_eq!(cfg.fees, U128(0));
    assert_eq!(cfg.min_amount, U128(1_000_000));
    assert_eq!(c.sales_count(), 0);
}

#[test]
fn new_accepts_custom_intents_and_fee() {
    call(acc("deployer.near"), NOW_MS);
    let c = Contract::new(owner(), usdc(), Some(acc("intents.testnet")), Some(1000));
    assert_eq!(c.config().intents, acc("intents.testnet"));
    assert_eq!(c.config().fee_bps, 1000);
}

#[test]
#[should_panic(expected = "Fee can be at most 2000")]
fn new_rejects_fee_above_max() {
    call(acc("deployer.near"), NOW_MS);
    Contract::new(owner(), usdc(), None, Some(2001));
}

// ---------------------------------------------------------------------------
// Buying keys
// ---------------------------------------------------------------------------

#[test]
fn buying_a_key_records_it_and_logs_event() {
    let mut c = setup();
    assert_eq!(buy(&mut c, 30, PRICE, NOW_MS), 0);
    assert!(has_event("key_bought"));
    assert!(has_log("\"standard\":\"keyhole\""));
    assert!(has_log("\"version\":\"1.0.0\""));
    let k = key(&c);
    assert_eq!(k.trader, trader());
    assert_eq!(k.holder, holder());
    assert_eq!(k.expires_at_ms, NOW_MS + 30 * DAY);
    assert_eq!(k.total_paid, U128(PRICE));
    assert_eq!(k.purchases, 1);
    assert_eq!(k.last_days, 30);
    assert_eq!(c.sales_count(), 1);
    assert!(c.has_key(trader(), holder()));
}

#[test]
fn fee_math_and_forwarding() {
    let mut c = setup();
    buy(&mut c, 30, PRICE, NOW_MS);
    // 5% of 25 USDC is 1.25 USDC; the trader gets 23.75 USDC.
    assert_eq!(c.config().fees, U128(1_250_000));
    let sale = &c.sales(None, None)[0];
    assert_eq!(sale.amount, U128(PRICE));
    assert_eq!(sale.trader_share, U128(23_750_000));
    assert!(has_log("\"fee\":\"1250000\""));

    // The share is deposited into alice.near's NEAR Intents account.
    let calls = token_calls();
    assert_eq!(calls.len(), 1);
    let (method, args) = &calls[0];
    assert_eq!(method, "ft_transfer_call");
    assert_eq!(args["receiver_id"], "intents.near");
    assert_eq!(args["amount"], "23750000");
    assert_eq!(args["msg"], "alice.near");
}

#[test]
fn fee_rounds_down_and_tiny_amounts_work() {
    let mut c = setup();
    call_yocto(owner(), NOW_MS);
    c.set_min_amount(U128(0));
    // 19 * 5% = 0.95 -> fee 0, trader gets all 19.
    buy(&mut c, 7, 19, NOW_MS);
    assert_eq!(c.config().fees, U128(0));
    assert_eq!(c.sales(None, None)[0].trader_share, U128(19));
    assert_eq!(fee_of(10_001, 500), 500);
    assert_eq!(fee_of(u128::MAX, 2000), u128::MAX / 5);
}

#[test]
fn custom_fee_is_used() {
    let mut c = setup();
    call_yocto(owner(), NOW_MS);
    c.set_fee(1000);
    buy(&mut c, 30, PRICE, NOW_MS);
    assert_eq!(c.config().fees, U128(2_500_000));
    assert_eq!(c.sales(None, None)[0].trader_share, U128(22_500_000));
}

#[test]
fn zero_fee_forwards_everything() {
    let mut c = setup();
    call_yocto(owner(), NOW_MS);
    c.set_fee(0);
    buy(&mut c, 30, PRICE, NOW_MS);
    assert_eq!(c.config().fees, U128(0));
    assert_eq!(token_calls()[0].1["amount"], PRICE.to_string());
}

#[test]
fn extending_a_valid_key_adds_days() {
    let mut c = setup();
    buy(&mut c, 30, PRICE, NOW_MS);
    // Ten days later the key still works; 7 more days go on top.
    buy(&mut c, 7, 10_000_000, NOW_MS + 10 * DAY);
    let k = key(&c);
    assert_eq!(k.expires_at_ms, NOW_MS + 37 * DAY);
    assert_eq!(k.total_paid, U128(PRICE + 10_000_000));
    assert_eq!(k.purchases, 2);
    assert_eq!(k.last_days, 7);
    assert_eq!(c.sales_count(), 2);
}

#[test]
fn expired_key_restarts_from_now() {
    let mut c = setup();
    buy(&mut c, 7, PRICE, NOW_MS);
    let later = NOW_MS + 100 * DAY;
    buy(&mut c, 90, PRICE, later);
    let k = key(&c);
    assert_eq!(k.expires_at_ms, later + 90 * DAY);
    assert_eq!(k.purchases, 2);
}

#[test]
fn evm_and_implicit_accounts_are_accepted() {
    let mut c = setup();
    assert_eq!(pay_msg(&mut c, &buy_msg(IMPLICIT, EVM, 90), PRICE, NOW_MS), 0);
    assert!(c.has_key(acc(IMPLICIT), acc(EVM)));
    assert_eq!(token_calls()[0].1["msg"], IMPLICIT);
}

// ---------------------------------------------------------------------------
// Refused payments (full amount goes back, nothing recorded)
// ---------------------------------------------------------------------------

#[test]
fn wrong_token_is_refunded() {
    let mut c = setup();
    call(acc("fake-usdc.near"), NOW_MS);
    let r = c.ft_on_transfer(one_click(), U128(PRICE), buy_msg("alice.near", "bob.near", 30));
    assert!(matches!(r, PromiseOrValue::Value(U128(PRICE))));
    assert!(has_log("\"reason\":\"wrong_token\""));
    assert!(c.get_key(trader(), holder()).is_none());
    assert_eq!(c.sales_count(), 0);
}

#[test]
fn bad_json_is_refunded() {
    let mut c = setup();
    assert_refused(&mut c, "not json", PRICE, "bad_msg");
    assert_refused(&mut c, "", PRICE, "bad_msg");
    assert_refused(&mut c, r#"{"trader":"alice.near","days":30}"#, PRICE, "bad_msg");
    let days_as_text = r#"{"trader":"alice.near","holder":"bob.near","days":"30"}"#;
    assert_refused(&mut c, days_as_text, PRICE, "bad_msg");
}

#[test]
fn bad_trader_id_is_refunded() {
    let mut c = setup();
    assert_refused(&mut c, &buy_msg("Alice.NEAR", "bob.near", 30), PRICE, "bad_trader");
    assert_refused(&mut c, &buy_msg("not an account", "bob.near", 30), PRICE, "bad_trader");
}

#[test]
fn bad_holder_id_is_refunded() {
    // EVM addresses must be lowercase to be valid account ids.
    let mut c = setup();
    let upper = "0x8BA1F109551BD432803012645AC136DDD64DBA72";
    assert_refused(&mut c, &buy_msg("alice.near", upper, 30), PRICE, "bad_holder");
    assert_refused(&mut c, &buy_msg("alice.near", "", 30), PRICE, "bad_holder");
}

#[test]
fn bad_days_are_refunded() {
    let mut c = setup();
    for days in [0, 1, 14, 31, 365] {
        assert_refused(&mut c, &buy_msg("alice.near", "bob.near", days), PRICE, "bad_days");
    }
}

#[test]
fn zero_amount_is_refunded() {
    let mut c = setup();
    assert_refused(&mut c, &buy_msg("alice.near", "bob.near", 30), 0, "zero_amount");
}

#[test]
fn trader_buying_own_key_is_refunded() {
    let mut c = setup();
    assert_refused(
        &mut c,
        &buy_msg("alice.near", "alice.near", 30),
        PRICE,
        "trader_is_holder",
    );
}

// ---------------------------------------------------------------------------
// Payout callbacks
// ---------------------------------------------------------------------------

#[test]
fn payout_success_counts_as_earned() {
    let mut c = setup();
    buy(&mut c, 30, PRICE, NOW_MS);
    callback_ctx(used(23_750_000));
    assert_eq!(c.on_payout(trader(), U128(23_750_000)), U128(23_750_000));
    assert!(has_event("payout_sent"));
    let s = c.trader_stats(trader());
    assert_eq!(s.earned, U128(23_750_000));
    assert_eq!(s.owed, U128(0));
    assert_eq!(s.keys_sold, 1);
}

#[test]
fn payout_failure_is_owed() {
    let mut c = setup();
    buy(&mut c, 30, PRICE, NOW_MS);
    callback_ctx(PromiseResult::Failed);
    assert_eq!(c.on_payout(trader(), U128(23_750_000)), U128(0));
    assert!(has_event("payout_owed"));
    let s = c.trader_stats(trader());
    assert_eq!(s.earned, U128(0));
    assert_eq!(s.owed, U128(23_750_000));
}

#[test]
fn payout_refused_by_intents_is_owed() {
    // intents.near refused the deposit: the token refunded us and says 0 used.
    let mut c = setup();
    buy(&mut c, 30, PRICE, NOW_MS);
    callback_ctx(used(0));
    assert_eq!(c.on_payout(trader(), U128(23_750_000)), U128(0));
    assert_eq!(c.trader_stats(trader()).owed, U128(23_750_000));
    assert_eq!(c.trader_stats(trader()).earned, U128(0));
}

#[test]
fn partial_payout_owes_the_rest() {
    let mut c = setup();
    callback_ctx(used(20_000_000));
    assert_eq!(c.on_payout(trader(), U128(23_750_000)), U128(20_000_000));
    let s = c.trader_stats(trader());
    assert_eq!(s.earned, U128(20_000_000));
    assert_eq!(s.owed, U128(3_750_000));
}

#[test]
fn low_gas_payment_records_owed_instead_of_forwarding() {
    let mut c = setup();
    let mut b = VMContextBuilder::new();
    b.current_account_id(contract_id())
        .predecessor_account_id(usdc())
        .block_timestamp(NOW_MS * 1_000_000)
        .prepaid_gas(Gas::from_tgas(20));
    testing_env!(b.build());
    let r = c.ft_on_transfer(one_click(), U128(PRICE), buy_msg("alice.near", "bob.near", 30));
    assert!(matches!(r, PromiseOrValue::Value(U128(0))));
    assert!(c.has_key(trader(), holder()));
    assert!(token_calls().is_empty());
    assert!(has_log("\"reason\":\"low_gas\""));
    assert_eq!(c.trader_stats(trader()).owed, U128(23_750_000));
}

#[test]
fn pay_owed_clears_owed_and_retries() {
    let mut c = setup();
    buy(&mut c, 30, PRICE, NOW_MS);
    callback_ctx(PromiseResult::Failed);
    c.on_payout(trader(), U128(23_750_000));

    // Anyone can retry. Owed is cleared and a new deposit is sent.
    call(stranger(), NOW_MS + 1);
    let _ = c.pay_owed(trader());
    assert_eq!(c.trader_stats(trader()).owed, U128(0));
    let calls = token_calls();
    assert_eq!(calls.len(), 1);
    assert_eq!(calls[0].0, "ft_transfer_call");
    assert_eq!(calls[0].1["amount"], "23750000");
    assert_eq!(calls[0].1["msg"], "alice.near");

    // It fails again: the money is owed again, not lost.
    callback_ctx(PromiseResult::Failed);
    c.on_payout(trader(), U128(23_750_000));
    assert_eq!(c.trader_stats(trader()).owed, U128(23_750_000));

    // Third time works.
    call(stranger(), NOW_MS + 2);
    let _ = c.pay_owed(trader());
    callback_ctx(used(23_750_000));
    c.on_payout(trader(), U128(23_750_000));
    let s = c.trader_stats(trader());
    assert_eq!(s.owed, U128(0));
    assert_eq!(s.earned, U128(23_750_000));
}

#[test]
#[should_panic(expected = "Nothing owed to this trader")]
fn pay_owed_with_nothing_owed_panics() {
    let mut c = setup();
    call(stranger(), NOW_MS);
    let _ = c.pay_owed(trader());
}

// ---------------------------------------------------------------------------
// Fees and owner settings
// ---------------------------------------------------------------------------

#[test]
fn withdraw_fees_sends_and_restores_on_failure() {
    let mut c = setup();
    buy(&mut c, 30, PRICE, NOW_MS); // 1_250_000 fees
    buy(&mut c, 30, PRICE, NOW_MS); // 2_500_000 fees

    call_yocto(owner(), NOW_MS);
    let _ = c.withdraw_fees(owner(), Some(U128(1_000_000)));
    assert_eq!(c.config().fees, U128(1_500_000));
    let calls = token_calls();
    assert_eq!(calls.len(), 1);
    assert_eq!(calls[0].0, "ft_transfer");
    assert_eq!(calls[0].1["receiver_id"], "owner.near");
    assert_eq!(calls[0].1["amount"], "1000000");

    callback_ctx(PromiseResult::Failed);
    assert!(!c.on_fees_withdrawn(owner(), U128(1_000_000)));
    assert_eq!(c.config().fees, U128(2_500_000));

    // No amount = everything.
    call_yocto(owner(), NOW_MS);
    let _ = c.withdraw_fees(owner(), None);
    assert_eq!(c.config().fees, U128(0));
    callback_ctx(PromiseResult::Successful(vec![]));
    assert!(c.on_fees_withdrawn(owner(), U128(2_500_000)));
    assert!(has_event("fees_withdrawn"));
    assert_eq!(c.config().fees, U128(0));
}

#[test]
#[should_panic(expected = "Only the owner can do this")]
fn withdraw_fees_is_owner_only() {
    let mut c = setup();
    buy(&mut c, 30, PRICE, NOW_MS);
    call_yocto(stranger(), NOW_MS);
    let _ = c.withdraw_fees(stranger(), None);
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn withdraw_fees_needs_one_yocto() {
    let mut c = setup();
    buy(&mut c, 30, PRICE, NOW_MS);
    call(owner(), NOW_MS);
    let _ = c.withdraw_fees(owner(), None);
}

#[test]
#[should_panic(expected = "Amount is more than the collected fees")]
fn withdraw_fees_cannot_exceed_fees() {
    let mut c = setup();
    buy(&mut c, 30, PRICE, NOW_MS);
    call_yocto(owner(), NOW_MS);
    let _ = c.withdraw_fees(owner(), Some(U128(1_250_001)));
}

#[test]
#[should_panic(expected = "No fees to withdraw")]
fn withdraw_fees_with_no_fees_panics() {
    let mut c = setup();
    call_yocto(owner(), NOW_MS);
    let _ = c.withdraw_fees(owner(), None);
}

#[test]
#[should_panic(expected = "Fee can be at most 2000")]
fn set_fee_rejects_above_max() {
    let mut c = setup();
    call_yocto(owner(), NOW_MS);
    c.set_fee(2001);
}

#[test]
#[should_panic(expected = "Only the owner can do this")]
fn set_fee_is_owner_only() {
    let mut c = setup();
    call_yocto(stranger(), NOW_MS);
    c.set_fee(100);
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn set_fee_needs_one_yocto() {
    let mut c = setup();
    call(owner(), NOW_MS);
    c.set_fee(100);
}

#[test]
fn set_owner_hands_over_control() {
    let mut c = setup();
    call_yocto(owner(), NOW_MS);
    c.set_owner(acc("new-owner.near"));
    assert_eq!(c.config().owner, acc("new-owner.near"));
    call_yocto(acc("new-owner.near"), NOW_MS);
    c.set_fee(700);
    assert_eq!(c.config().fee_bps, 700);
}

#[test]
#[should_panic(expected = "Only the owner can do this")]
fn old_owner_loses_control() {
    let mut c = setup();
    call_yocto(owner(), NOW_MS);
    c.set_owner(acc("new-owner.near"));
    call_yocto(owner(), NOW_MS);
    c.set_fee(700);
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

#[test]
fn has_key_turns_false_when_time_passes() {
    let mut c = setup();
    assert!(!c.has_key(trader(), holder()));
    buy(&mut c, 7, PRICE, NOW_MS);
    call(stranger(), NOW_MS + 7 * DAY - 1);
    assert!(c.has_key(trader(), holder()));
    call(stranger(), NOW_MS + 7 * DAY);
    assert!(!c.has_key(trader(), holder()));
    // The expired key is still on record.
    assert!(c.get_key(trader(), holder()).is_some());
    // Keys only work one way: the trader holds no key to the holder.
    assert!(!c.has_key(holder(), trader()));
}

#[test]
fn keys_of_holder_lists_each_trader_once() {
    let mut c = setup();
    pay_msg(&mut c, &buy_msg("alice.near", "bob.near", 30), PRICE, NOW_MS);
    pay_msg(&mut c, &buy_msg("carol.near", "bob.near", 7), PRICE, NOW_MS);
    pay_msg(&mut c, &buy_msg("alice.near", "bob.near", 7), PRICE, NOW_MS); // extension
    pay_msg(&mut c, &buy_msg("alice.near", "dave.near", 7), PRICE, NOW_MS);
    call(stranger(), NOW_MS);
    let keys = c.keys_of_holder(holder());
    assert_eq!(keys.len(), 2);
    assert_eq!(keys[0].trader, acc("alice.near"));
    assert_eq!(keys[0].purchases, 2);
    assert_eq!(keys[1].trader, acc("carol.near"));
    assert!(c.keys_of_holder(acc("nobody.near")).is_empty());
}

#[test]
fn holders_of_paginates() {
    let mut c = setup();
    for i in 0..5 {
        pay_msg(&mut c, &buy_msg("alice.near", &format!("h{i}.near"), 30), PRICE, NOW_MS);
    }
    pay_msg(&mut c, &buy_msg("alice.near", "h0.near", 30), PRICE, NOW_MS); // extension
    call(stranger(), NOW_MS);
    assert_eq!(c.holders_of(trader(), None, None).len(), 5);
    let page = c.holders_of(trader(), Some(1), Some(2));
    assert_eq!(page.len(), 2);
    assert_eq!(page[0].holder, acc("h1.near"));
    assert_eq!(page[1].holder, acc("h2.near"));
    assert!(c.holders_of(trader(), Some(10), Some(2)).is_empty());
    assert!(c.holders_of(acc("nobody.near"), None, None).is_empty());

    let s = c.trader_stats(trader());
    assert_eq!(s.keys_sold, 6);
    assert_eq!(s.holders, 5);
}

#[test]
fn sales_paginate_in_order() {
    let mut c = setup();
    for (i, days) in [7, 30, 90, 7, 30].into_iter().enumerate() {
        buy(&mut c, days, PRICE, NOW_MS + i as u64);
    }
    call(stranger(), NOW_MS);
    assert_eq!(c.sales_count(), 5);
    assert_eq!(c.sales(None, None).len(), 5);
    let page = c.sales(Some(1), Some(2));
    assert_eq!(page.len(), 2);
    assert_eq!(page[0].days, 30);
    assert_eq!(page[0].at_ms, NOW_MS + 1);
    assert_eq!(page[1].days, 90);
    assert_eq!(c.sales(Some(4), Some(100)).len(), 1);
    assert!(c.sales(Some(5), None).is_empty());
    assert!(c.sales(Some(u32::MAX), Some(u32::MAX)).is_empty());
}

#[test]
fn trader_stats_for_unknown_trader_is_empty() {
    let c = setup();
    let s = c.trader_stats(acc("nobody.near"));
    assert_eq!(s.keys_sold, 0);
    assert_eq!(s.earned, U128(0));
    assert_eq!(s.owed, U128(0));
    assert_eq!(s.holders, 0);
}

// ---------------------------------------------------------------------------
// Minimum payment
// ---------------------------------------------------------------------------

#[test]
fn payment_below_minimum_is_refunded() {
    let mut c = setup();
    assert_refused(&mut c, &buy_msg("alice.near", "bob.near", 30), 999_999, "too_small");
    assert_refused(&mut c, &buy_msg("alice.near", "bob.near", 30), 1, "too_small");
    assert!(c.get_key(trader(), holder()).is_none());
}

#[test]
fn payment_of_exactly_minimum_is_accepted() {
    let mut c = setup();
    assert_eq!(buy(&mut c, 7, 1_000_000, NOW_MS), 0);
    assert!(has_event("key_bought"));
    assert!(c.has_key(trader(), holder()));
    assert_eq!(c.config().fees, U128(50_000));
}

#[test]
fn set_min_amount_changes_the_minimum() {
    let mut c = setup();
    call_yocto(owner(), NOW_MS);
    c.set_min_amount(U128(5_000_000));
    assert_eq!(c.config().min_amount, U128(5_000_000));
    assert_refused(&mut c, &buy_msg("alice.near", "bob.near", 30), 4_999_999, "too_small");
    assert_eq!(buy(&mut c, 30, 5_000_000, NOW_MS), 0);
}

#[test]
fn zero_minimum_still_refuses_zero_amount() {
    let mut c = setup();
    call_yocto(owner(), NOW_MS);
    c.set_min_amount(U128(0));
    assert_refused(&mut c, &buy_msg("alice.near", "bob.near", 30), 0, "zero_amount");
}

#[test]
#[should_panic(expected = "Only the owner can do this")]
fn set_min_amount_is_owner_only() {
    let mut c = setup();
    call_yocto(stranger(), NOW_MS);
    c.set_min_amount(U128(0));
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn set_min_amount_needs_one_yocto() {
    let mut c = setup();
    call(owner(), NOW_MS);
    c.set_min_amount(U128(0));
}
