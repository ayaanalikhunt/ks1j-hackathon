# KS1J Hackathon

Next.js (App Router, TS, Tailwind) + Supabase, deployed on Vercel.

```
cp .env.local.example .env.local   # fill in Supabase URL + anon key
npm run dev                        # http://localhost:3000
npm run build && npm run lint
```

Supabase clients: `src/lib/supabase/client.ts` (browser), `server.ts` (server components / actions).
