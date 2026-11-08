# Video status (paused 8 Nov 2026 at the user's request: "anything but video generations")

**Finished and in `submission/media/` (v1, no narration):**
- `keyhole-promo-16x9.mp4`, `keyhole-promo-1x1.mp4` (45 s), `keyhole-walkthrough.mp4` (2 min).

**v2 (narrated) — stopped mid-render. No v2 video file exists yet.**
- Approved: narration scripts and shot lists (`promo/docs/`, `walkthrough/docs/`); voices Asher (promo) and Jonathan (walkthrough).
- Done: narration generated (`*/audio/vo/takeA.mp3`), edited onto the beat (`vo_edit.py` → `*/audio/vo.wav`, `*/vo.json`); new music beds; both films rebuilt (`promo/film.js`, `walkthrough/film.js`, shared `kit.js`), two review rounds each (`*/docs/critique.md`).
- Not done: final renders, sound mix (`sfx.mjs`, `mix.mjs`), poster frames, delivery. To resume, run the render step in the motion-reel skill (step 7) for each film.
- v1 film sources are kept as `promo/film_v1.js` and `walkthrough/film_v1.js`.
