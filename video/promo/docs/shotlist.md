# Keyhole promo v2: shot list
About 56 s · 120 bpm · 112 beats · formats: 16x9 (primary), 1x1
Music: bespoke synthesized score (punchy house, D dorian): sparse under the voice, hits between lines, a drop on "Meet Keyhole". Narration: see narration.md (ducked music under every line).
Look: Keyhole brand. Canvas #F5F6F8, ink #0D1117, one accent violet #5B3DF5; profit green only on numbers. Space Grotesk display, Inter UI.

**What's new in v2 (motion):**
- Narration drives everything: each line's words appear as they're spoken (kinetic type), big and bold.
- Real screens are **rebuilt from their own pieces**: each trader card, stat chip, trade row and button is cut from the real screenshot and animated on its own (cascades, springs, parallax depth, slight 3-D tilt), so the app feels alive rather than a still picture.
- Real numbers **count up** (the +37.4% return, earnings) in the brand font, on top of the real screen.
- A **cursor** taps the real buttons, with a ripple, so actions read at a glance.
- **Transitions carry shapes**: lock → keyhole logo → key; whip pans with motion blur; push-throughs into a card.
- A living background: slow-drifting dot grid and soft violet light behind the screens (never a flat backdrop).

| # | beats | time | narration | on screen (real assets) | motion | out |
|---|-------|------|-----------|-------------------------|--------|-----|
| 1 | 0-8 | 0-4 | "The best traders keep their trades private." | Kinetic type on ink; "private." in violet | words slam in on the voice; a padlock snaps shut on "private" | lock shrinks to a dot, whip down |
| 2 | 8-16 | 4-8 | "So how do you know who's actually good?" | Wall of the 6 real trader cards (`d01_card_*` crops), blurred, tilted in depth | cards drift past in parallax; a violet question mark scrubs through | the cards rush toward camera |
| 3 | 16-24 | 8-12 | "Meet Keyhole." | Keyhole logo (`logo/icon_0.svg`) | logo stamps in on the drop (impact), then the camera dives through the keyhole into the app | home screen fills the frame |
| 4 | 24-36 | 12-18 | "Every trader's record is read straight from their private account on NEAR." | Home grid rebuilt card by card from `d01_home.png`; Mara's card lifts forward | cards cascade in (staggered springs); "+37.4%" counts up; a thin violet line traces from the card down to a "NEAR" tag | card flips into the profile |
| 5 | 36-46 | 18-23 | "They can't edit it, and they can't hide a loss." | Profile chart + 4 stat chips (`d02_trader.png` crops); the losing trader's card (−27.6%) | chart draws itself; chips snap in one per beat; the losing card slides in beside, red number pulses | lock icon rises from the trades card |
| 6 | 46-56 | 23-28 | "Their trades stay hidden… until you buy a key." | Blurred trades + lock (`d02_trader_locked.png`) | blurred rows slide behind frosted glass; on "key" the lock morphs into a key that turns | key flies into the key card |
| 7 | 56-66 | 28-33 | "Pay with any coin. The trader gets paid instantly." | Key card (`d02_keycard.png`), Buy dialog (`d03_buy_dialog.png`), real coin logos | coin logos orbit into the key card; cursor taps "Pay 25 USDC"; "+23.75 USDC" flies to Mara's avatar | "You're in" pops on violet |
| 8 | 66-76 | 33-38 | "Now you see every trade the moment it happens," | Private feed (`d05_feed.png`), rows cut out individually | rows cascade in from the right one per half-beat, each with its coin pair spinning in; live dot pulses | camera slides onto the Copy button |
| 9 | 76-86 | 38-43 | "and copy it in one tap, at a live price." | Copy dialog (`d06_copy_dialog.png`) → Copied (`d07_copied_dialog.png`) | cursor taps Copy (ripple); dialog springs up; "32.116 NEAR" counts up; check mark draws | whip right |
| 10 | 86-100 | 43-50 | "Traders earn for being right. Followers finally know who to trust." | Earnings (`d10_sell.png` crops) then two phones (`m02_trader.png`, `m05_trades.png`) | bars grow, "3,522 USDC" counts up; phones swing in from both sides with depth | phones part to reveal the end card |
| 11 | 100-112 | 50-56 | "Keyhole. Trade in private. Sell the view." | Logo, wordmark, URL, "Built on NEAR Intents · NEAR HACKATHON" | logo settles with a spring; line types on with the voice; hold 3 s | end |

Formats:
- 1x1: type above the screen instead of beside it; screens cropped tighter (one card, the dialog, the feed column); shot 10 shows one phone.
- 16x9: type in the left third, screens on the right two-thirds, except shots 1, 3 and 11 (full-frame).

Longest gap without a new event: under 2 s everywhere (narration words, counters and cascades keep it moving).
