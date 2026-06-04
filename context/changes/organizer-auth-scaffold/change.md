---
change_id: organizer-auth-scaffold
title: Organizer registration and login
status: implementing
created: 2026-06-04
updated: 2026-06-04
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

### Phase 2 adaptation: env access pattern

Server client (`server.ts`) uses `import.meta.env.VITE_*` instead of planned `cloudflare:workers` bindings — Cloudflare Vite plugin isn't loaded in dev mode so `cloudflare:workers` doesn't resolve. Cookie handling also uses TanStack Start native `getCookies()`/`setCookie()` instead of `@supabase/ssr` helpers (framework-idiomatic, positive change).

**Phase 4 action**: if any server-side code ever needs a true secret (service role key), it must use Cloudflare Worker bindings from `.dev.vars`/secrets, not `VITE_` prefix (which is baked into the client bundle).
