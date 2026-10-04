# KS1J

One Jamaat. One app. A member app and public website for the KS1J Mumbai Jamaat: welfare cases, donations and payouts, education loans, Khums and Lawajam, a helpdesk and Ask AI Guide, a mosque finder, and a committee dashboard.

pnpm + turbo monorepo. Backend is Firebase project `ks1j-8a2e3` (Auth, Firestore, Storage, Functions in `asia-south1`, Hosting), not Supabase. Live at https://ks1j-8a2e3.web.app. Original spec: `C:\Projects\ks1j artifacts\MASTER_REBUILD_PROMPT_1.md`.

```
apps/web            Next.js static export: public site, member pages, /admin committee dashboard
apps/mobile         Expo Router member app (Android first)
packages/shared     domain rules, money maths, dates, i18n, Ask guide data, mosque finder logic
packages/rules-tests  Firestore rules, functions and Ask classifier tests (Firebase emulators)
functions           Cloud Functions (plain JavaScript, cannot import packages/shared)
tools/seed          demo data and the mosque directory seed
tools/e2e           local end-to-end harness: seed, fake Razorpay / Anthropic servers, signed webhooks
```

## Setup

Needs Node, pnpm, the Firebase CLI, Java (for the emulators) and `gcloud` (for the seed scripts).

```
pnpm install
cp apps/web/.env.local.example apps/web/.env.local     # fill in the Firebase web config
```

Local checks, from the repo root or the package:

```
pnpm typecheck          # all packages
pnpm lint
pnpm test               # runs each package's tests
cd packages/shared && npx vitest run                    # fast, pure logic
cd packages/rules-tests && npx vitest run src/mosques.test.ts   # pure; no emulator
pnpm --filter @ks1j/rules-tests test                    # full suite on the emulators (needs Java)
```

## Secrets and configuration

Never commit these. `.env` files, `.webhook-secret.txt` and debug logs are gitignored.

| What | Where | Notes |
|---|---|---|
| Firebase web config | `apps/web/.env.local` | `NEXT_PUBLIC_FIREBASE_*` |
| `GEMINI_API_KEY` | Functions secret | The Ask AI Guide's model in production (`AI_PROVIDER=gemini` in `functions/.env`, default model `gemini-flash-latest`; `AI_MODEL` overrides). Until set, fiqh answers say "not switched on"; commands still work |
| `OPENAI_API_KEY` | Functions secret | Only if `AI_PROVIDER` is `openai` |
| `ANTHROPIC_API_KEY` | Functions secret | Only if `AI_PROVIDER` is `anthropic` (the emulator tests use this against a local fake) |
| `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Functions secrets | |
| `ENABLE_RAZORPAY`, `RAZORPAY_KEY_ID`, `AI_PROVIDER`, `AI_MODEL` | `functions/.env` | Razorpay functions load only when `ENABLE_RAZORPAY=true` |

```
firebase functions:secrets:set GEMINI_API_KEY --project ks1j-8a2e3     # then redeploy askGuide (use firebase.cmd in Windows PowerShell)
```

Razorpay webhook (dashboard): URL of the `razorpayWebhook` function, events `payment.captured` and `payment.failed`, secret = `RAZORPAY_WEBHOOK_SECRET`.

`NEXT_PUBLIC_USE_EMULATORS=true` points the web app at local emulators. It is for testing only: never set it in `.env.local` for a real build.

## Build and deploy

```
cd apps/web && npx next build          # static export to apps/web/out (postbuild flattens RSC files)
firebase deploy --only hosting --project ks1j-8a2e3
firebase deploy --only functions --project ks1j-8a2e3
firebase deploy --only firestore:rules --project ks1j-8a2e3
```

- **Deploy hosting on its own.** If functions fail in the same command, the hosting deploy is skipped.
- **Functions** need these Google Cloud grants on the compute service account, and a new callable may need `allUsers` `roles/run.invoker` on its Cloud Run service. IAM takes a couple of minutes to propagate.
  - `roles/cloudbuild.builds.builder`
  - `roles/datastore.user` (add with `--condition=None`)
- **`EBUSY ... rmdir 'apps/web/out'`** on build means something is serving that folder (a leftover static server). Stop it and rebuild.
- Before a deploy, build normally: an `out` folder left over from an emulator run holds an emulator build.

## Data

```
$env:SEED_PASSWORD = "<8+ chars>"
pnpm --filter @ks1j/seed seed            # demo data (7 *@ks1j.demo accounts, every doc tagged demo:true)
pnpm --filter @ks1j/seed reset           # delete demo-tagged docs first, then reseed
node tools/seed/seed-mosques.mjs         # the 36 mosque venues; create-only, never overwrites a verification
```

Both need `gcloud auth application-default login` once. The ledger is append-only and is never deleted.

## Mosque finder

`/mosques` searches the `mosques` collection (the bundled list of 36 is the fallback). Venues start `PENDING_VERIFICATION` with no map pin and no Friday time: the source PDF gave neither. Committee staff verify each venue at `/admin/mosques` (call or visit, check the pin, record a Friday time only if confirmed). All changes go through the `verifyMosque` function, which validates, stamps who and when, and writes the audit log. Automatic "nearest" and "nearest Friday" results use only venues that are volunteer- or officially-verified, with a pin, and `jummahStatus: YES`.

## Mobile

`apps/mobile` is Expo (Android first). Run it with `cd apps/mobile && npx expo start`. `expo-location` (mosque finder), `expo-print` and `expo-sharing` (PDF receipts and statements) are native modules, so an installed app needs a **new Android build** (`android-apk.yml` or a local build) before those features work; a JavaScript-only update is not enough.

The GitHub workflow `android-apk.yml` builds an APK on pushes to `master` that touch `apps/mobile` or `packages/shared`.

## Conventions

- Timestamps are stored in UTC and shown in IST (Asia/Kolkata).
- Money never moves on the client: only functions confirm payments and write ledger rows.
- Donor identity is admin-only and read through functions that audit every view.
- PDFs are plain black on white (records that are printed and filed); amounts are written "Rs.".
