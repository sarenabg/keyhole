# Hackathon requirements check

Checked against https://nearhackathon.com/HACKATHON.md on 8 Nov 2026 (rules up to Q-017). Deadline: **14 Nov 2026, 23:59 UTC**. Plan: submit 13 Nov.

| Requirement | Status | Where / what's left |
|---|---|---|
| Public repository by the deadline, public through judging | ✅ | https://github.com/sarenabg/keyhole (public since 8 Nov). Latest local commits not pushed yet: waiting for your OK |
| LICENSE file | ✅ | `LICENSE` (MIT) |
| README a person **and an AI** can follow: product, problem, "do X → see Y" | ✅ | `README.md`: 2-minute demo table, automated checks with expected output, Live mode steps |
| Reproducible | ✅ | `cd web && npm install && npm run dev`, then `npm test` (record + demo + live checks). Contract: `cargo test` |
| Only in-window work judged; disclose pre-hackathon code | ✅ | Repo started 8 Nov 2026; nothing pre-hackathon. README "Hackathon disclosures" |
| `pre-hackathon` / `hackathon-submission` tags or branch | ⏳ | No pre-hackathon code, so only the `hackathon-submission` tag is needed, at the commit you submit |
| List libraries, templates, AI-generated code | ✅ | README "Hackathon disclosures" |
| Disclose other chains | ✅ | None deployed (README) |
| **Same person's other project named in each README** (Q-015) | ✅ / ⏳ | Keyhole's README names Harbor. Harbor's README must name Keyhole too (Harbor session) |
| **At most 2 projects per person, 2 submissions per email** | ⚠️ | Harbor + 3 of Elias's ideas = 4. At least two need another lead and email. Decide who leads Keyhole |
| Demo: video in the X post (screenshots alone aren't enough for a local-only demo) | ✅ | Hosted demo exists, plus finished videos: `submission/media/` (v1, no narration) |
| Hosted demo is a plus; keep up until 18 Nov (ideally 25 Nov) | ✅ | https://keyhole-near.vercel.app (Demo). Live mode online needs the Turso database |
| X post: "built at NEAR HACKATHON", @NEARProtocol, #NEARHackathon, video or screenshots | ⏳ (you) | Drafts in `submission/X_POST.md` |
| Form fields and limits | ⏳ (you) | Drafts in `submission/FORM.md`: name, tracks `privacy` + `defi`, repo URL, 1,888-character idea. You add lead, email, size, payout account, X post link, consent |
| Contact notice read verbatim before consent | ⏳ (you) | "I agree that the organizers may use these details to review our submission and contact us about this hackathon." |
| One submission per repo; fix mistakes at /request-changes | Note | Don't resubmit: the same repo returns 409 |
| Intents has no testnet: mainnet with tiny amounts and `dry: true` | ✅ | Demo uses dry quotes; Live uses real NEAR Intents; checks move no money |
| Mainnet test transactions (strong, not required) | ⏳ (you) | `docs/LIVE_TEST.md`; then add links to the README "Mainnet proof" line |
| AI screening (Claude Code / Codex follow the README) | ✅ | Every claim in the README has a command or a page to check it |

## Still open before submitting

1. **You:** decide the lead and email (2-per-person rule).
2. **You (optional, strong):** Turso database in Vercel, the keys contract, and the ~$10 real-money test (`docs/LIVE_TEST.md`).
3. **You:** post on X with a video; copy the link.
4. **You:** fill the form from `submission/FORM.md`.
5. **Claude, on your OK:** push the latest commits, redeploy the site (dialog fix), and tag `hackathon-submission`.
