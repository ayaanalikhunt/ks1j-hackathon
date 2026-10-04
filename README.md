# KS1J

pnpm + turbo monorepo. Spec: `C:\Projects\ks1j artifacts\MASTER_REBUILD_PROMPT_1.md`.
Backend is Firebase (project `ks1j-8a2e3`: Auth, Firestore, Hosting), not Supabase.

```
apps/web         Next.js public site + /admin
apps/mobile      Expo Router member app (not yet created)
packages/shared  domain rules, money maths, community helpers
```

`pnpm install` · `pnpm dev` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build`
