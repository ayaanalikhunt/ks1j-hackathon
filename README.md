# KS1J

pnpm + turbo monorepo. Backend is Firebase (project `ks1j-8a2e3`: Auth, Firestore, Storage, Functions, Hosting).

```
apps/web            Next.js public site + /admin (static export to apps/web/out)
apps/mobile         Expo Router member app
packages/shared     domain rules, money maths, date and community helpers
packages/rules-tests  emulator tests for rules and functions
functions           Cloud Functions (Node 22, asia-south1)
tools/seed          seed data and role assignment scripts
```

## Setup

```
pnpm install
```

Needs Node 22, pnpm 12 and the Firebase CLI (`firebase login`).

## Everyday commands

| Task | Command |
| --- | --- |
| Dev server (web) | `pnpm dev` |
| Lint | `pnpm lint` |
| Typecheck | `pnpm typecheck` |
| Emulator tests | `pnpm test` (runs `packages/rules-tests` inside the auth, firestore, functions and storage emulators) |
| Production build | `pnpm build` (writes `apps/web/out`) |

Always rebuild the web app normally before deploying. A build made for the emulators leaves emulator settings in `apps/web/out`.

## Secrets and settings

Set once per project, never commit values:

```
firebase functions:secrets:set RAZORPAY_KEY_SECRET --project ks1j-8a2e3
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET --project ks1j-8a2e3
firebase functions:secrets:set ANTHROPIC_API_KEY --project ks1j-8a2e3   # Ask AI Guide; fiqh answers stay "not switched on" until set
```

Environment variables read by functions: `ENABLE_RAZORPAY`, `RAZORPAY_API_BASE`, `FX_API_BASE`, `PROOF_BUCKET`. `FUNCTIONS_EMULATOR` is set by the emulator.

Razorpay dashboard: add a webhook to the deployed `razorpay` function URL for `payment.captured` and `payment.failed`, using the same secret as `RAZORPAY_WEBHOOK_SECRET`. Use live keys only once the test flow works end to end.

## Deploy

```
pnpm build
firebase deploy --only firestore:rules,firestore:indexes,storage --project ks1j-8a2e3
firebase deploy --only functions --project ks1j-8a2e3
firebase deploy --only hosting --project ks1j-8a2e3
```

Run `pnpm test` first. After each deploy, smoke-check the live site: sign in, open the donate page, and open an admin page.

## Roles and seed data

`tools/seed/seed.mjs` loads sample data; `tools/seed/assign-roles.mjs` gives a member an admin-like role. Run them against the emulators unless you mean to touch live data.

## Mobile

`apps/mobile` is an Expo app. `pnpm --filter ./apps/mobile start` for development. The Android APK is built by `.github/workflows/android-apk.yml`.
