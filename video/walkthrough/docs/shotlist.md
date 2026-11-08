# Keyhole walkthrough v2: shot list
About 2 min 16 s · 96 bpm · 218 beats · format: 16x9
Music: bespoke synthesized lo-fi house, F major, kept low under the narration (ducked), with small accents between lines. Narration: see narration.md.
Every screen is the real app (Demo mode on the hosted site, plus real Live-mode screens).

**What's new in v2 (motion):**
- Narrated, with captions that appear word by word as they're spoken (bottom band), plus the step badge.
- Each screen is **brought to life** from its own pieces: cards, rows, chips and dialogs are cut from the real screenshot and animate in (cascades, springs, depth), instead of a static picture with a camera move.
- A **cursor** performs every action (tap, ripple, scroll), so it feels like watching someone use the app.
- **Counters** on real numbers (return, amounts, earnings); **callout lines** draw from labels to the exact spot.
- **Smooth transitions**: push-throughs into the element that opens the next screen (card → profile, Get a key → dialog, Copy → copy dialog), whip pans between steps, a keyhole-shaped wipe into each new step.
- Living background: soft drifting dot grid and violet light behind the stage.

| # | beats | time | step / narration | on screen (real assets) | motion |
|---|-------|------|------------------|-------------------------|--------|
| 1 | 0-14 | 0-9 | Intro: "Here's Keyhole in two minutes…prices are real." | Logo + title; "Demo" badge | title types on with the voice; badge stamps in; keyhole wipe into step 1 |
| 2 | 14-34 | 9-21 | 1 · "Start with the traders… Nothing is cherry-picked." | `d01_home_full.png` rebuilt card by card | 6 cards cascade in; camera glides to the losing card (−27.6% pulses red); ring |
| 3 | 34-52 | 21-33 | "Each card shows the return…private account on NEAR." | `d01_card_mara.png` lifted out, large | callout lines draw to return / win rate / biggest dip as each is named; +37.4% counts up |
| 4 | 52-66 | 33-41 | 2 · "Open a trader. The chart and the numbers are public…" | `d02_trader.png` | push-through from the card; chart draws itself; 4 stat chips snap in |
| 5 | 66-80 | 41-50 | "But the trades themselves are private. Even our data feed says no…" | `d02_trader_locked.png`, `d13_api_403.png` | frosted rows slide; lock drops; the 403 message types out in a terminal-style panel cut from the real screen |
| 6 | 80-102 | 50-64 | 3 · "So let's buy one…ninety-five percent, instantly." | `d03_buy.png` + dialog states (`_90`, `_paying`) | cursor taps Get a key → dialog springs up; cursor taps 30d → 90d (Save 20% pops) → back to 30 → Pay; "23.75 USDC → trader" flies |
| 7 | 102-108 | 64-68 | "And we're in." | `d04_youre_in_dialog.png` | pop + a burst of small key glyphs |
| 8 | 108-132 | 68-83 | 4 · "Now you see every trade…within minutes." | `d05_trades.png` rows cut individually, `d05_feed.png` | rows cascade in; ring + callouts on size, price and "since"; live dot pulses; smooth scroll |
| 9 | 132-152 | 83-95 | 5 · "See one you like? Tap Copy…live market price." | `d06_copy.png`, `d06_copy_dialog_25.png` | cursor taps Copy; dialog rises; cursor taps 25% → amount morphs; "Live price" tag lights |
| 10 | 152-166 | 95-104 | "Copy, and it's done…copy automatically." | `d07_copied.png`, `d08_trades_after.png`, `d08_autocopy_on.png` | check mark draws; row turns "Copied"; auto-copy switch flips with a spring |
| 11 | 166-184 | 104-115 | 6 · "If you trade…start earning." | `d11_start.png` → `d11_start_3.png` → `d10_sell.png` | three steps tick with check marks; earnings bars grow; total counts up |
| 12 | 184-192 | 115-120 | "It works just as well on your phone." | `m02_trader.png`, `m05_trades.png`, `m06_copy.png` | three phones swing in with depth, staggered |
| 13 | 192-210 | 120-131 | Live: "And it's not just a demo…any coin." | `l01_home_live.png`, `l02_signin.png`, `l05_pay_address.png` | "LIVE · NEAR mainnet" bar slides down; wallet dialog springs; QR + amount highlight |
| 14 | 210-218 | 131-136 | End: "Keyhole. Trade in private. Sell the view." | Logo, wordmark, links | logo settles; lines type on; hold |
