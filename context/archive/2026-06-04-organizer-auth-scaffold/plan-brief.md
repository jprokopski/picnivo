# Organizer Auth Scaffold — Plan Brief

> Full plan: `context/changes/organizer-auth-scaffold/plan.md`
> Research: `context/changes/organizer-auth-scaffold/research.md`

## What & Why

Picnivo needs organizer accounts before event creation can work (S-01 depends on a logged-in organizer per US-01). This plan scaffolds the full auth foundation: email/password + Google OAuth registration and login, cookie-based SSR sessions on Cloudflare Workers, JWT validation on the ASP.NET Core backend, and the Organizer bridge entity that maps Supabase Auth users to application data.

## Starting Point

Both backend and frontend are clean slates for auth — no auth packages, middleware, route guards, or user entities on either side. The backend has EF Core with a single `Events` table on .NET 10 Minimal API. The frontend has TanStack Start with React 19 and three placeholder routes. Supabase is running locally for Postgres but GoTrue (auth service) is excluded from the start command.

## Desired End State

An organizer can register (email/password with display name, or Google OAuth), log in, see a protected dashboard, and log out. Unauthenticated users are redirected to `/login` on protected routes. The backend validates Supabase JWTs via JWKS discovery (ES256) and serves a protected `/api/me` endpoint. An `organizers` row is auto-created on signup via a DB trigger. The flow works locally and in production.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Auth provider | Supabase Auth (not ASP.NET Identity) | Loose backend coupling (JWT-only), first-class TanStack Start SDK, local dev via existing Supabase CLI | Research |
| Auth methods | Email/password + Google OAuth | PRD FR-001 says "email/password or OAuth"; Google covers the most common OAuth provider | Plan |
| JWT signing | ES256 via JWKS endpoint | Supabase Cloud project uses asymmetric keys; backend discovers keys automatically, no shared secret | Research |
| Session management | Cookie-based SSR via @supabase/ssr | Required for server-side auth in `beforeLoad` and server functions on Cloudflare Workers | Plan |
| Route protection | `_authenticated` layout route | TanStack Router convention; `beforeLoad` guard redirects to `/login`, covers all nested routes | Plan |
| Organizer provisioning | DB trigger (`handle_new_user()`) via EF Core migration | Guarantees row exists before any API call; single migration track, no separate Supabase migrations | Research + Plan |
| Display name | Required on signup form, Google profile fallback | User preference — display name must not be nullable | Plan |
| Migration track | EF Core only (no Supabase migrations dir) | Single deployment pipeline via existing GitHub Actions workflow | Research |
| CORS | Backend CORS middleware | Backend is directly callable from browser and server functions; standard practice | Plan |
| Auth UI | Full styled pages (login, register, dashboard) | F-02 must be testable end-to-end in a browser, not just infrastructure | Plan |

## Scope

**In scope:**
- Email/password signup + login + logout
- Google OAuth signup + login
- Organizer entity with DB auto-provisioning trigger
- JWT validation (ES256/JWKS) + CORS on backend
- Cookie-based SSR sessions via `@supabase/ssr`
- `_authenticated` layout route + `/login` + `/register` + `/auth/callback` + `/dashboard` stub
- Auth-aware header navigation
- Production wiring (Google Cloud Console, Supabase Cloud, Fly.io, Cloudflare secrets)

**Out of scope:**
- Password reset, email confirmation, MFA, phone auth
- Event creation or `OrganizerId` FK on Event (S-01)
- Profile editing, avatar upload
- E2E test automation (Playwright)
- Real-time session sync (WebSockets)

## Architecture / Approach

Frontend-first auth: `@supabase/supabase-js` + `@supabase/ssr` handle signup/signin/session on the frontend (Cloudflare Workers). The backend never calls Supabase Auth APIs — it only validates the JWT sent in the `Authorization` header via standard ASP.NET Core `AddJwtBearer()` middleware with JWKS key discovery. The Organizer entity in `public.organizers` bridges `auth.users` via a raw-SQL FK and a `SECURITY DEFINER` trigger.

```
Browser → Supabase Auth (GoTrue) → session cookies
Browser → Cloudflare Worker (TanStack Start SSR) → reads cookies → auth context
Browser → ASP.NET Core API (Fly.io) → validates JWT → protected endpoints
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Local Dev Infrastructure & Backend Auth | GoTrue enabled, Organizer entity + trigger, JWT validation + CORS, `/api/me` | Trigger references `auth.users` — migration must run after GoTrue creates the schema |
| 2. Frontend Auth Infrastructure | Supabase SDK, server/browser clients, router context migration, session hydration | `setResponseHeader` append semantics for `Set-Cookie` on Workers |
| 3. Auth UI & Route Protection | Login/register pages, OAuth callback, `_authenticated` guard, dashboard, logout | Google OAuth redirect flow through Supabase → Google → Supabase → app |
| 4. Production Wiring & Verification | Google Cloud OAuth app, Supabase Cloud config, Fly.io + Cloudflare secrets | Manual external service configuration (Google Console, Supabase dashboard) |

**Prerequisites:** F-01 (data persistence) complete. Local Supabase running. Access to Google Cloud Console and Supabase dashboard for Phase 4.
**Estimated effort:** ~3-4 sessions across 4 phases.

## Open Risks & Assumptions

- `setResponseHeader` from `@tanstack/react-start/server` may replace rather than append `Set-Cookie` headers — Supabase can chunk sessions across multiple cookies. If it replaces, need to find an `appendResponseHeader` alternative.
- Google OAuth in local dev requires the same Google Cloud OAuth credentials as production (or a separate local OAuth app). May need to skip local Google OAuth testing if credentials aren't available.
- The `handle_new_user()` trigger assumes GoTrue has created the `auth` schema before the EF Core migration runs. Migration ordering is critical.

## Success Criteria (Summary)

- An organizer can register and log in with email/password or Google OAuth, both locally and in production
- Protected routes redirect unauthenticated users; public routes remain open
- The `organizers` table has a row for every registered user, auto-created by the DB trigger
