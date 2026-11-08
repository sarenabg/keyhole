# Keyhole submission pack

Everything for the NEAR HACKATHON submission. Nothing here has been posted or submitted.

| File | What it is |
|---|---|
| [FORM.md](FORM.md) | Drafted answers for every form field, including the 1,888-character idea text |
| [PITCH.md](PITCH.md) | One-liner, 30-second pitch, why NEAR, what's real, business model |
| [X_POST.md](X_POST.md) | Two drafts for the required X post |
| `media/keyhole-promo-16x9.mp4` | 45 s promo (X, YouTube) |
| `media/keyhole-promo-1x1.mp4` | 45 s promo, square (feeds) |
| `media/keyhole-walkthrough.mp4` | 2-minute demo walkthrough |
| `screenshots/` | Real screens: traders, private trader page, buying a key, private trades, copying, earnings, onboarding, Live-mode wallet sign-in and payment address, phone views |

The videos are made from code in `../video/` (real screenshots of the app, synthesized music); `node video/capture.mjs` re-captures the screens.

## Before submitting (your steps)

1. Decide the lead and email (max 2 projects per person / 2 submissions per email).
2. Optional but strong: the real-money test in `../docs/LIVE_TEST.md`, then add the mainnet transaction links to the main README.
3. Post on X (draft in X_POST.md) with the promo video. Copy the post's link.
4. Fill the form at https://nearhackathon.com/#apply with FORM.md, using the X post link as the Demo URL.
5. Tag the repo: `git tag hackathon-submission && git push --tags` (Claude can do this when you say go).
