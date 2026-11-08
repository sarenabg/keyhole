# Deploying Keyhole

The site runs on Vercel: project `dappdesigners-projects/keyhole-near`, https://keyhole-near.vercel.app, root folder `web/`.

## Demo only (what's online now)

Nothing else is needed. Demo visitors' keys and copies live in a signed cookie, so there's no database.

Settings already on Vercel: `KEYHOLE_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_REPO_URL`.

Redeploy after a change:

```bash
cd web
vercel deploy --prod --yes
```

## Switching on Live mode online

1. **Database:** in the Vercel dashboard, open the project → **Storage** → **Turso** → create a database and connect it to **Production**. That adds `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`, which the app reads. Tables are created on first use.
2. **Turn on the Live switch:**

   ```bash
   cd web
   printf 1 | vercel env add KEYHOLE_LIVE production
   ```

3. **Optional, the keys contract** (after `docs/LIVE_TEST.md` step B):

   ```bash
   printf keys.YOURNAME.near | vercel env add KEYHOLE_KEYS_CONTRACT production
   ```

   Without it, key payments go straight to the trader (100%, no 5% fee) and are tracked by the app.
4. **Optional, NEAR Intents partner key:** `ONECLICK_API_KEY` (lower fees). Add `KEYHOLE_CONFIDENTIAL=1` only if NEAR enabled private quotes for that key.
5. **Redeploy** (`vercel deploy --prod --yes`), then check from your own computer:

   ```bash
   cd web
   BASE_URL=https://keyhole-near.vercel.app node scripts/e2e-demo.mjs
   BASE_URL=https://keyhole-near.vercel.app CRON_SECRET=<the value in Vercel> node scripts/live-check.mjs
   ```

   Expected: `✓ all 37 demo checks passed` and `✓ all 22 live checks passed (no money moved)`. The live check signs in with throwaway keys, lists and then unlists a "Check bot" trader, and asks for one real payment address without paying it.

## Keeping records fresh

- Every page view refreshes records older than 5 minutes (up to 6 traders at a time).
- `web/vercel.json` adds a daily Vercel cron to `/api/cron/snapshot` (Vercel sends `Authorization: Bearer $CRON_SECRET`).
- For more frequent refreshes on the free plan, any outside scheduler can call:

  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://keyhole-near.vercel.app/api/cron/snapshot
  ```

## Keep it up

The rules ask for the hosted demo to stay up until 18 Nov 2026, ideally 25 Nov.
