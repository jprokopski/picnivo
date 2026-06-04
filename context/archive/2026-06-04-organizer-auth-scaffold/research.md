---
date: 2026-06-04T00:00:00+02:00
researcher: Claude (10x-research)
git_commit: c1378ca5baff4aaf58ef1232692f71c4370c3a10
branch: 6-f-02-add-organizer-registration-and-login
repository: picnivo
topic: "Codebase compatibility with Supabase Auth research for F-02"
tags: [research, codebase, auth, supabase, ef-core, tanstack-start, compatibility]
status: complete
last_updated: 2026-06-04
last_updated_by: Claude (10x-research)
---

# Research: Codebase Compatibility with Supabase Auth Research for F-02

**Date**: 2026-06-04
**Researcher**: Claude (10x-research)
**Git Commit**: c1378ca5baff4aaf58ef1232692f71c4370c3a10
**Branch**: 6-f-02-add-organizer-registration-and-login
**Repository**: picnivo

## Research Question

Are the three research documents (`research-supabase-auth.md`, `research-supabase-auth-api.md`,
`research-user-entity-mapping.md`) compatible with the current codebase? What gaps, conflicts,
or adjustments are needed before implementing F-02?

## Summary

**The three research documents are fully compatible with the codebase.** No conflicts exist.
The codebase is a clean slate for auth — zero auth packages, middleware, routes, or entities
on either side. Every assumption in the research docs checks out against the live code. There
are six items that require attention during planning but none that invalidate the research.

## Compatibility Verdict by Document

### research-supabase-auth.md — COMPATIBLE

| Claim | Codebase Reality | Status |
|---|---|---|
| ASP.NET Core 10 Minimal API | `net10.0` in `.csproj`, Minimal API in `Program.cs` | Confirmed |
| `AddJwtBearer()` for backend auth | Package not installed yet; no conflicting auth | Clean slate |
| TanStack Start has official Supabase quickstart | Frontend uses `@tanstack/react-start` v1.168 | Compatible |
| `@supabase/supabase-js` for frontend | Not installed; no conflicting auth packages | Clean slate |
| Supabase CLI already running for local Postgres | `backend/supabase/config.toml` exists, port 54322 | Confirmed |
| GoTrue excluded from `supabase start` | CLAUDE.md shows `-x gotrue,...` | Confirmed — must enable |
| Local Supabase JWT secret is default | Connection string uses default `postgres:postgres` | Consistent |
| Cloudflare Workers compatible | `wrangler.jsonc` with `nodejs_compat` flag | Compatible |

### research-supabase-auth-api.md — COMPATIBLE

| Claim | Codebase Reality | Status |
|---|---|---|
| JWT `sub` claim for user ID extraction | No `ClaimsPrincipal` usage yet; pattern is standard | Compatible |
| `RequireAuthorization()` for protected routes | Not used yet; only endpoint is `/healthz` (public) | Clean slate |
| `@supabase/supabase-js` `signUp`/`signIn` API | No frontend auth code exists | Clean slate |
| Backend doesn't need `supabase-csharp` | No Supabase C# packages installed | Consistent |

### research-user-entity-mapping.md — COMPATIBLE

| Claim | Codebase Reality | Status |
|---|---|---|
| `public.organizers` bridge table pattern | No user tables exist; only `Events` table | Clean slate |
| EF Core DbContext with `ApplyConfigurationsFromAssembly` | `PicnivoDbContext` uses this pattern — new configs auto-discovered | Confirmed |
| `ValueGeneratedNever()` for Organizer.Id | Not used yet; `Event.Id` uses `ValueGeneratedOnAdd()` | Must add for Organizer |
| FK to `auth.users` via raw SQL in migration | EF Core manages public schema; no `auth` schema refs | Compatible |
| DB trigger for auto-creating organizer row | No Supabase migrations dir exists yet | Must create |
| `Event` entity needs `OrganizerId` FK | Current `Event` has no FK; only `Id`, `Title`, `CreatedAt` | Deferred to S-01 |

## Detailed Findings

### Backend (`backend/Picnivo.API/`)

**Project setup** (`Picnivo.API.csproj`):
- Target: `net10.0`
- Packages: `Microsoft.AspNetCore.OpenApi` 10.0.5, `Microsoft.EntityFrameworkCore.Design` 10.0.5, `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.2
- Missing for F-02: `Microsoft.AspNetCore.Authentication.JwtBearer` (must add, version 10.0.x)
- No auth packages of any kind installed

**Program.cs pipeline** (27 lines):
- Services: `AddOpenApi()` → `AddDbContext<PicnivoDbContext>(UseNpgsql)`
- Middleware: connection string null-check → `MapOpenApi()` (dev) → `MapGet("/healthz")` → `Run()`
- No `AddAuthentication`, `AddJwtBearer`, `AddAuthorization`, `UseAuthentication`, `UseAuthorization`
- Insertion points are clear: services after `AddDbContext`, middleware before endpoint mapping

**EF Core** (`Data/PicnivoDbContext.cs`):
- Single `DbSet<Event> Events`
- Uses `ApplyConfigurationsFromAssembly` — new entity configs will be auto-discovered
- No explicit schema set — defaults to `public` on PostgreSQL
- Single migration: `20260602215731_InitialCreate` (creates `Events` table)

**Configuration**:
- `appsettings.Development.json`: connection string to local Supabase Postgres (port 54322)
- No JWT secret, Supabase URL, or auth config anywhere
- Production secrets via `fly secrets set` (per CLAUDE.md convention)

### Frontend (`frontend/`)

**Package versions**:
- `@tanstack/react-start` v1.168.18, `@tanstack/react-router` v1.170.10
- React 19.2.6, Vite 8.0.14, TypeScript 6.0.3
- No `@supabase/supabase-js` or `@supabase/ssr` — must install both

**Routing**:
- File-based routing with three routes: `__root.tsx`, `index.tsx`, `about.tsx`
- Root uses `createRootRoute()` (no context) — must migrate to `createRootRouteWithContext` for auth
- No `beforeLoad` hooks, no route guards, no `_authenticated` layout routes
- No `createServerFn` usage anywhere — auth will be the first server-side code

**Environment**:
- `.dev.vars` is gitignored but doesn't exist yet — must create with Supabase URL/anon key
- `wrangler.jsonc` has no env bindings — production secrets via `wrangler secret put`
- CLAUDE.md documents `import { env } from 'cloudflare:workers'` pattern for server functions

### Supabase Infrastructure (`backend/supabase/`)

**config.toml auth section**:
- `[auth].enabled = true` with sensible defaults
- `site_url = "http://127.0.0.1:3000"` — matches frontend dev server
- `enable_signup = true`, email confirmations disabled, JWT expiry 3600s
- Inbucket/Mailpit on port 54324 for email testing
- No OAuth providers enabled (fine for MVP email/password)

**Current `supabase start` command** (from CLAUDE.md):
```
supabase start -x gotrue,realtime,storage-api,imgproxy,kong,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor,mailpit
```
GoTrue AND Mailpit are excluded — both must be removed from exclusion list for F-02.

**Supabase migrations**: directory doesn't exist (`backend/supabase/migrations/`). The research
recommends a Supabase migration for the `handle_new_user()` trigger since it touches the `auth`
schema. This directory must be created.

**Linked Supabase Cloud project**: ref `xdzmwfxoxgbphcsqbuek`, name `picnivo` — production
project exists and is linked.

## Items Requiring Attention

### 1. Enable GoTrue and Mailpit in local dev (BLOCKING)

The `supabase start` command in `backend/CLAUDE.md` excludes `gotrue` and `mailpit`.
Both must be removed from the `-x` flag. This is a prerequisite for any local auth testing.

### 2. Create Supabase migrations directory (BLOCKING)

`backend/supabase/migrations/` doesn't exist. The `handle_new_user()` trigger that auto-creates
organizer rows on signup must be a Supabase migration (not EF Core) because it references
`auth.users`. Create the directory and the trigger migration.

### 3. Router context migration (FRONTEND, BLOCKING)

The root route uses `createRootRoute()`. For auth state to be available in route guards
(`beforeLoad`), it must be migrated to `createRootRouteWithContext<{ user: User | null }>()`.
This is a non-breaking change but touches the core routing setup.

### 4. Data Protection keys (BACKEND, NON-BLOCKING for MVP)

The deployment plan notes: "Data Protection keys on ephemeral storage — current impact: zero
(no auth, no cookies). When auth is added, solve with `PersistKeysToDbContext()`." Since
Supabase Auth handles sessions client-side (not ASP.NET cookies), this is lower priority —
but should be addressed if any server-side session or anti-forgery tokens are needed.

### 5. Event.OrganizerId FK (DEFERRED to S-01)

The current `Event` entity has no `OrganizerId` FK. The research docs show the relationship
(`Organizer` → `Events`), but this belongs in S-01 (event creation), not F-02. F-02 should
create the `Organizer` entity without modifying `Event`.

### 6. Signing algorithm check (PRODUCTION)

Research notes that newer Supabase projects may use ES256 (asymmetric) instead of HS256
(symmetric). The `AddJwtBearer` config differs between the two. The Supabase dashboard
JWT settings must be checked before production deployment.

## Code References

- `backend/Picnivo.API/Picnivo.API.csproj` — NuGet packages, no JWT bearer
- `backend/Picnivo.API/Program.cs:8-26` — Full middleware pipeline, no auth
- `backend/Picnivo.API/Data/PicnivoDbContext.cs` — DbContext with `ApplyConfigurationsFromAssembly`
- `backend/Picnivo.API/Data/Models/Event.cs` — Only entity, no OrganizerId
- `backend/Picnivo.API/Data/Configurations/EventConfiguration.cs` — Uses `ValueGeneratedOnAdd`
- `backend/Picnivo.API/appsettings.Development.json` — Connection string, no JWT config
- `backend/supabase/config.toml:155-366` — Auth section with sensible defaults
- `frontend/package.json` — No Supabase packages
- `frontend/src/routes/__root.tsx` — Uses `createRootRoute()` without context
- `frontend/src/router.tsx` — Router factory, no auth context
- `frontend/wrangler.jsonc` — No env bindings
- `backend/CLAUDE.md:10` — Supabase start command with GoTrue excluded

## Architecture Insights

The codebase has a clean separation that aligns well with the research:

1. **Schema boundary**: EF Core owns `public.*`, Supabase owns `auth.*`. The bridge is
   `public.organizers` with a raw-SQL FK to `auth.users(id)` — EF Core never maps `auth` tables.

2. **Migration dual-track**: EF Core migrations handle `public` schema tables (and are
   auto-deployed via GitHub Actions). Supabase migrations handle `auth`-touching objects
   (triggers, functions). Both live in the same Postgres instance but are managed independently.

3. **JWT-only backend coupling**: The backend validates Supabase JWTs via standard ASP.NET Core
   middleware — no Supabase SDK dependency on the backend. This is the loosest possible coupling.

4. **Frontend-first auth**: `@supabase/supabase-js` handles signup/signin/session on the
   frontend. The backend never calls Supabase Auth APIs directly — it only validates the
   JWT that the frontend sends in the `Authorization` header.

## Historical Context

- `context/changes/data-persistence-scaffold/plan.md` — F-01 completed all 4 phases, established
  EF Core + Npgsql + Supabase Postgres as the data layer. F-02 builds directly on this.
- `context/changes/organizer-auth-scaffold/research-supabase-auth.md` — Trade-off analysis
  choosing Supabase Auth over ASP.NET Core Identity, motivated by frontend SDK availability
  and loose backend coupling.
- `context/changes/organizer-auth-scaffold/research-user-entity-mapping.md` — Bridge table
  pattern from official Supabase docs; trigger-based row creation recommended over lazy creation.

## Related Research

- `context/changes/organizer-auth-scaffold/research-supabase-auth.md` — Stack compatibility
- `context/changes/organizer-auth-scaffold/research-supabase-auth-api.md` — SDK/API reference
- `context/changes/organizer-auth-scaffold/research-user-entity-mapping.md` — Entity mapping

## Open Questions — Resolved

1. **HS256 vs ES256**: **ES256 (ECDSA with SHA-256, NIST P-256 curve).** Supabase dashboard confirms the JWT is signed with a private key and verified with a public ECC key. Backend must validate JWTs via the JWKS endpoint (`https://xdzmwfxoxgbphcsqbuek.supabase.co/.well-known/jwks.json`), not a shared symmetric secret. No `SUPABASE_JWT_SECRET` needed on the backend.

2. **Supabase migration deployment**: **Use EF Core migrations for everything.** No separate Supabase migration pipeline. The `handle_new_user()` trigger and raw SQL referencing `auth.users` go into EF Core migrations via `migrationBuilder.Sql(...)`. No `backend/supabase/migrations/` directory needed. Single migration track, single deployment path.

3. **Session hydration**: **Root route `beforeLoad` + `createMiddleware` on server functions.** This is the recommended TanStack Start pattern — all official auth examples (Auth.js, Clerk, basic-auth) use it. Root `beforeLoad` fetches session via `createServerFn` and returns it as route context (every route gets auth state). `createMiddleware` protects individual server functions since they are RPC endpoints accessible via direct POST regardless of UI route. No `createStart` global middleware needed.
