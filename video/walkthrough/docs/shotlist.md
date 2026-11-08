# Keyhole demo walkthrough: shot list
120 s · 90 bpm · 180 beats · format: 16x9
Music: synthesized lo-fi, F major, quiet bed under captions · VO: none
Every screen is the real app (hosted Demo mode, plus Live-mode screens once the real-money test is done). A step label sits top-left ("1 · Find a trader"), and one short caption per shot sits at the bottom. A soft violet ring highlights what to look at.

| # | beats | time | step / caption | on screen (asset) | motion | out |
|---|-------|------|----------------|-------------------|--------|-----|
| 1 | 0-8 | 0-5 | **Keyhole in 2 minutes** · "Demo mode: simulated traders, today's real prices" | Keyhole icon + wordmark on canvas | icon springs in, title types on | push into the home screen |
| 2 | 8-20 | 5-13 | **1 · Find a trader** · "Ranked by return. One is losing money: nothing is cherry-picked." | `d01_home.png` | slow push; ring on the period switch, then on the losing card | zoom onto Mara's card |
| 3 | 20-32 | 13-21 | "Return, win rate, biggest dip: read from the trader's private NEAR account." | `d01_card_mara.png` large | callout lines to the return, win rate and biggest dip, one per bar | card flies up into the profile |
| 4 | 32-46 | 21-31 | **2 · Check the record** · "The chart and stats are public. Mara can't edit them." | `d02_trader.png` | pan across chart → stats | scroll down |
| 5 | 46-56 | 31-37 | "The trades are private." | `d02_trader_locked.png` | dolly onto the lock | cut |
| 6 | 56-64 | 37-43 | "Even the data API refuses without a key (403)." | `d13_api_403.png` | quick punch-in on the message | cut back |
| 7 | 64-80 | 43-53 | **3 · Buy a key** · "7, 30 or 90 days. 95% goes to the trader, instantly." | `d03_buy_dialog.png` → `d03_buy_dialog_90.png` → `d03_buy_paying.png` | dialog rises; ring moves 30d → 90d ("Save 20%") → Pay | dialog flips to success |
| 8 | 80-88 | 53-59 | "You're in." | `d04_youre_in_dialog.png` | pop | push into the feed |
| 9 | 88-104 | 59-69 | **4 · See the trades** · "Each change in Mara's holdings is a trade: size, price, and how it has done since." | `d05_trades.png`, `d05_feed.png` | pan down the feed; ring on one row's size and result | ring lands on "Copy" |
| 10 | 104-120 | 69-80 | **5 · Copy a trade** · "The amount comes from a live NEAR Intents price check." | `d06_copy_dialog.png` → `d06_copy_dialog_25.png` | ring on "Same as Mara", then 25%; amount updates | press "Copy trade" |
| 11 | 120-130 | 80-87 | "Copied. Your copies are tracked." | `d07_copied_dialog.png` → `d08_trades_after.png` | pop, then the row shows "Copied" | cut |
| 12 | 130-136 | 87-91 | "Or copy automatically (Demo today)." | `d08_autocopy_on.png` | toggle flips on | cut |
| 13 | 136-152 | 91-101 | **6 · For traders** · "Sign once with your wallet. Set a price. Get paid." | `d11_start.png` → `d11_start_3.png` → `d10_sell.png` | steps tick through; earnings bars grow | slide to phones |
| 14 | 152-164 | 101-109 | "Made for phones too." | `m02_trader.png`, `m05_trades.png`, `m06_copy.png` | three phones slide in, staggered | cut |
| 15 | 164-176 | 109-117 | **Live mode** · "The same app on NEAR mainnet: real wallets, real payments through NEAR Intents." | Live-mode screens (sign-in, payment address) from the real-money test; fallback `d12_how.png` table | pan | to end card |
| 16 | 176-180 | 117-120 | End card | icon, wordmark, `keyhole-near.vercel.app`, `github.com/sarenabg/keyhole` | settle | hold |

Longest gap without a new event: beats 88-104 (about 10 s), kept alive by the pan and the moving ring.
