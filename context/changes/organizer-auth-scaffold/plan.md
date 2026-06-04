# Organizer Auth Scaffold Implementation Plan

## Overview

Scaffold organizer registration and login (F-02) — the auth foundation that unlocks S-01 (event creation). Adds email/password and Google OAuth signup/signin, cookie-based SSR sessions on Cloudflare Workers, JWT validation on the ASP.NET Core backend, the Organizer entity with a DB trigger for auto-provisioning, protected route infrastructure with an `_authenticated` layout guard, CORS, and fully styled auth UI pages.

## Current State Analysis

**Backend** (`backend/Picnivo.API/`):
- .NET 10 Minimal API with EF Core + Npgsql. Single `Events` table (`Program.cs:8-26`).
- No auth packages, middleware, CORS, or user entities. Single public `/healthz` endpoint.
- `appsettings.Development.json` has local Supabase Postgres connection string on port 54322.
- `PicnivoDbContext` uses `ApplyConfigurationsFromAssembly` — new entity configs auto-discovered.

**Frontend** (`frontend/`):
- TanStack Start (React 19) + Tailwind v4, deployed to Cloudflare Workers.
- Three routes: `__root.tsx`, `index.tsx`, `about.tsx`. Root uses `createRootRoute()` without context.
- No Supabase SDK, no server functions, no route guards, no `.dev.vars` file.
- Design tokens (--sea-ink, --lagoon, --sand, --foam) and component patterns in place.

**Supabase**:
- Local `config.toml` has auth enabled, email signup on, JWT expiry 3600s, Mailpit on 54324.
- GoTrue and Mailpit are **excluded** from the `supabase start` command in `backend/CLAUDE.md`.
- Production project: ref `xdzmwfxoxgbphcsqbuek`, JWT signing: ES256 (JWKS endpoint).

### Key Discoveries:

- ES256 asymmetric signing confirmed — backend validates via JWKS discovery at `{Authority}/.well-known/openid-configuration`, not a shared secret. No `SUPABASE_JWT_SECRET` needed.
- `@supabase/ssr` provides `parseCookieHeader`/`serializeCookieHeader` for Cloudflare Workers cookie handling — the standard Node.js cookie APIs don't exist in Workers.
- TanStack Start `setResponseHeader` from `@tanstack/react-start/server` — need to verify whether it appends or replaces `Set-Cookie` headers (Supabase may chunk session cookies). If it replaces, use `appendResponseHeader` or accumulate.
- EF Core can create the `handle_new_user()` trigger via `migrationBuilder.Sql(...)` — no separate Supabase migration track needed. Single migration pipeline.

## Desired End State

An organizer can register with email/password (providing a required display name) or Google OAuth, log in, see a protected dashboard stub, and log out. Unauthenticated users are redirected to `/login` when hitting protected routes. The backend validates Supabase JWTs via JWKS and exposes a protected `/api/me` endpoint. An `organizers` row is auto-created on signup via a DB trigger. The auth flow works both locally (with GoTrue + Mailpit) and in production (Supabase Cloud + Google OAuth).

**Verification**: Register a new account via email, log in, hit `/api/me` and see the user ID returned, visit a protected route and confirm access, log out and confirm redirect to login. Repeat with Google OAuth. Verify the `organizers` table has a row matching the auth user.

## What We're NOT Doing

- **Event creation or management** — deferred to S-01. No `OrganizerId` FK on `Event` yet.
- **Password reset flow** — email/password users who forget passwords wait for a future change.
- **Email confirmation** — disabled in `config.toml` (`enable_confirmations = false`). Users can sign in immediately after registration.
- **MFA or phone auth** — out of scope for MVP foundation.
- **Real-time session sync** — no WebSocket-based session invalidation. Session state refreshes on navigation (via root `beforeLoad`).
- **Profile editing** — display name is set at registration and not editable in F-02.

## Implementation Approach

Four phases, backend-first:

1. **Phase 1** sets up the local dev infrastructure (enable GoTrue/Mailpit), creates the Organizer entity with the auto-provisioning DB trigger, and wires JWT validation + CORS on the backend. After this phase, the backend can validate tokens and the trigger creates organizer rows.

2. **Phase 2** installs the Supabase SDK on the frontend, creates server and browser clients with cookie-based SSR, migrates the router to context-based auth, and adds session hydration via the root `beforeLoad` + auth middleware for server functions.

3. **Phase 3** builds the login/register UI pages, the Google OAuth callback route, the `_authenticated` layout guard, and a logout flow. After this phase, the full auth flow is testable in a browser against local GoTrue.

4. **Phase 4** wires production: Google Cloud Console OAuth app, Supabase Cloud Google provider, Fly.io and Cloudflare secrets, CLAUDE.md updates, and end-to-end production verification.

## Critical Implementation Details

### Timing & lifecycle

The DB trigger `handle_new_user()` fires inside the Supabase signup transaction — the organizer row is guaranteed to exist before the frontend receives the session. However, the EF Core migration that creates the trigger runs against the `public` schema but references `auth.users`. This means the migration cannot run until GoTrue has been started at least once (which creates the `auth` schema and `auth.users` table). Phase 1 must enable GoTrue **before** running `dotnet ef database update`.

### State sequencing

Cookie-based SSR with `@supabase/ssr` requires that the Supabase server client is instantiated **per request** inside a server function or `beforeLoad` — never at module scope. The `import { env } from 'cloudflare:workers'` pattern only works inside request handlers on Cloudflare Workers, not at module top-level. The `createSupabaseServerClient()` helper must be a factory function called per-request.

---

## Phase 1: Local Dev Infrastructure & Backend Auth

### Overview

Enable GoTrue and Mailpit for local auth testing, create the Organizer entity with a DB trigger that auto-provisions rows on signup, wire JWT authentication and CORS middleware into the ASP.NET Core pipeline, and expose a protected `/api/me` endpoint for verification.

### Changes Required:

#### 1. Enable GoTrue and Mailpit in local Supabase

**File**: `backend/CLAUDE.md`

**Intent**: Remove `gotrue` and `mailpit` from the `-x` exclusion list so the standard `supabase start` command launches auth services. This is a prerequisite for all local auth testing.

**Contract**: The `supabase start -x ...` command loses `gotrue` and `mailpit` from its exclusion flag. After this change, `supabase start` brings up GoTrue at `http://localhost:54321/auth/v1/` and Mailpit at `http://localhost:54324`.

#### 2. Add JWT Bearer NuGet package

**File**: `backend/Picnivo.API/Picnivo.API.csproj`

**Intent**: Add the JWT validation package needed for Supabase token verification.

**Contract**: Add `Microsoft.AspNetCore.Authentication.JwtBearer` version 10.0.x (matching the existing ASP.NET Core 10 packages). This transitively includes `Microsoft.IdentityModel.Tokens` for JWKS/ECDSA support.

#### 3. Wire authentication, authorization, and CORS in Program.cs

**File**: `backend/Picnivo.API/Program.cs`

**Intent**: Configure the ASP.NET Core pipeline to validate Supabase JWTs via JWKS discovery (ES256), add CORS for the frontend origin, and expose a protected `/api/me` endpoint that returns the authenticated user's ID.

**Contract**: Services: `AddCors()` with a default policy allowing `http://localhost:3000` + a configurable production frontend URL, `AllowAnyHeader()`, `AllowAnyMethod()`, `AllowCredentials()`. `AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer()` with `Authority` read from `Supabase:Authority` config key (triggers OIDC discovery → JWKS → ES256 key). `TokenValidationParameters`: `ValidAlgorithms = ["ES256"]` (prevents algorithm confusion attacks), `MapInboundClaims = false` (preserves `sub` claim name). `AddAuthorizationBuilder()`. Middleware order: `UseCors()` → `UseAuthentication()` → `UseAuthorization()` — before endpoint mapping. New endpoint: `MapGet("/api/me", ...)` with `.RequireAuthorization()` that returns `user.FindFirstValue("sub")`.

Configuration values read from `IConfiguration`:
- `Supabase:Authority` — the Supabase Auth base URL (local: `http://localhost:54321/auth/v1`, production: `https://xdzmwfxoxgbphcsqbuek.supabase.co/auth/v1`)
- `Frontend:Url` — production frontend URL for CORS

#### 4. Add Supabase configuration to appsettings

**File**: `backend/Picnivo.API/appsettings.Development.json`

**Intent**: Add local Supabase project reference and frontend URL for CORS configuration.

**Contract**: Add `Supabase.Authority` set to `http://localhost:54321/auth/v1` (local GoTrue issuer) and `Frontend.Url` set to `http://localhost:3000`.

**File**: `backend/Picnivo.API/appsettings.json`

**Intent**: Add placeholder config structure for production.

**Contract**: Add `Supabase` and `Frontend` sections with empty/placeholder values. Production values come from Fly.io secrets (`Supabase__Authority`, `Frontend__Url`).

#### 5. Create Organizer entity and configuration

**File**: `backend/Picnivo.API/Data/Models/Organizer.cs`

**Intent**: Create the Organizer bridge entity that maps Supabase auth users to application data. The `Id` matches `auth.users.id` — it is NOT auto-generated.

**Contract**: Entity with `Guid Id`, `string DisplayName` (non-nullable), `DateTimeOffset CreatedAt`. No navigation to `Events` yet (deferred to S-01).

**File**: `backend/Picnivo.API/Data/Configurations/OrganizerConfiguration.cs`

**Intent**: Configure the Organizer entity for EF Core with the correct table name and key generation strategy.

**Contract**: `ToTable("organizers")`, `HasKey(o => o.Id)`, `Property(o => o.Id).ValueGeneratedNever()` (ID comes from Supabase, not auto-gen), `Property(o => o.DisplayName).IsRequired().HasMaxLength(100)`, `Property(o => o.CreatedAt).HasDefaultValueSql("now()")`.

#### 6. Add Organizer DbSet to context

**File**: `backend/Picnivo.API/Data/PicnivoDbContext.cs`

**Intent**: Register the Organizer entity so EF Core manages its table.

**Contract**: Add `DbSet<Organizer> Organizers => Set<Organizer>();` alongside the existing `Events` DbSet. The configuration is auto-discovered via `ApplyConfigurationsFromAssembly`.

#### 7. Create migration with Organizer table and auto-provisioning trigger

**Intent**: Generate an EF Core migration that creates the `organizers` table and adds a `handle_new_user()` trigger that auto-creates an organizer row when a user signs up in Supabase Auth.

**Contract**: Run `dotnet ef migrations add AddOrganizer --project Picnivo.API --output-dir Data/Migrations`. Then append raw SQL to the migration's `Up` method:

```csharp
migrationBuilder.Sql("""
    ALTER TABLE organizers
    ADD CONSTRAINT fk_organizers_auth_users
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    """);

migrationBuilder.Sql("""
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.organizers (id, display_name, created_at)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', 'Organizer'),
        NOW()
      );
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    """);

migrationBuilder.Sql("""
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    """);
```

The `Down` method drops the trigger, function, and FK constraint before dropping the table.

The `COALESCE` chain handles: (1) email/password signup with explicit `display_name` in metadata, (2) Google OAuth which provides `full_name` in metadata, (3) fallback to 'Organizer' — though the UI enforces display name as required, the DB should be defensive.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `dotnet ef database update --project Picnivo.API` (from `backend/`)
- Backend builds without errors: `dotnet build` (from `Picnivo.API/`)
- Backend starts and `/healthz` returns 200: `dotnet run` then `curl http://localhost:5062/healthz`
- `/api/me` returns 401 without a token: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5062/api/me`

#### Manual Verification:

- `supabase start` (updated command without gotrue/mailpit exclusions) brings up GoTrue and Mailpit
- Register a test user via GoTrue REST API or Supabase Studio, verify an `organizers` row is created with matching ID
- Use the test user's JWT to call `/api/me` and get the user ID back
- Verify Mailpit is accessible at `http://localhost:54324`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Frontend Auth Infrastructure

### Overview

Install the Supabase SDK, create server-side and browser-side clients with cookie-based session management, migrate the TanStack Router to context-based auth, and add session hydration via the root route's `beforeLoad` plus auth middleware for server functions.

### Changes Required:

#### 1. Install Supabase packages

**Intent**: Add the Supabase JavaScript client and SSR helper for cookie-based auth on Cloudflare Workers.

**Contract**: `pnpm add @supabase/supabase-js @supabase/ssr` in the `frontend/` directory.

#### 2. Create environment variable files

**File**: `frontend/.dev.vars`

**Intent**: Provide local Supabase credentials for server-side code running on Cloudflare Workers in dev mode.

**Contract**: Contains `SUPABASE_URL=http://localhost:54321` and `SUPABASE_ANON_KEY=<local-anon-key from supabase status>`. This file is gitignored.

**File**: `frontend/.env`

**Intent**: Provide client-side Supabase credentials via Vite's `import.meta.env`.

**Contract**: Contains `VITE_SUPABASE_URL=http://localhost:54321` and `VITE_SUPABASE_ANON_KEY=<local-anon-key>`. The `VITE_` prefix makes these available in browser code.

#### 3. Create Supabase server client factory

**File**: `frontend/src/lib/supabase/server.ts`

**Intent**: Create a per-request Supabase client that reads/writes cookies via TanStack Start's server utilities. This is the SSR auth backbone — every server function and `beforeLoad` that needs auth uses this.

**Contract**: Exports `createSupabaseServerClient()` that calls `createServerClient` from `@supabase/ssr` with `env.SUPABASE_URL` and `env.SUPABASE_ANON_KEY` (from `cloudflare:workers`). Cookie handling uses `parseCookieHeader(request.headers.get('Cookie'))` for `getAll`. For `setAll`, use `appendResponseHeader('Set-Cookie', serializeCookieHeader(...))` for each cookie (not `setResponseHeader`, which may replace rather than append — Supabase can chunk sessions across multiple Set-Cookie headers). If `appendResponseHeader` is unavailable, accumulate all serialized cookie strings and set them via a single header manipulation that preserves all values. Verify multi-cookie round-trip during Phase 2 manual testing. Must be called inside a request context (server function or `beforeLoad`), never at module scope.

#### 4. Create Supabase browser client factory

**File**: `frontend/src/lib/supabase/client.ts`

**Intent**: Create a singleton browser-side Supabase client for client-only auth operations (OAuth redirect trigger, `onAuthStateChange` listener).

**Contract**: Exports `createSupabaseBrowserClient()` that calls `createBrowserClient` from `@supabase/ssr` with `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`. Uses browser `document.cookie` by default — no custom cookie config needed. Singleton pattern (create once, reuse).

#### 5. Create session-fetching server function

**File**: `frontend/src/lib/supabase/session.ts`

**Intent**: Create a server function that fetches the current user from Supabase Auth cookies. This is called by the root route's `beforeLoad` on every navigation.

**Contract**: Exports `getSessionFn` — a `createServerFn({ method: 'GET' })` that calls `createSupabaseServerClient().auth.getUser()` and returns the `User` object or `null`. Uses `getUser()` (not `getSession()`) because `getUser()` validates the JWT against the Supabase server, while `getSession()` only reads from cookies without verification.

#### 6. Create auth middleware for server functions

**File**: `frontend/src/middleware/auth.ts`

**Intent**: Create a reusable middleware that validates the Supabase session and injects the authenticated user into server function context. Server functions are RPC endpoints accessible via direct POST — route guards alone don't protect them.

**Contract**: Exports `authMiddleware` — a `createMiddleware().server(async ({ next }) => { ... })` that calls `createSupabaseServerClient().auth.getUser()`, throws if no user, and calls `next({ context: { user, supabase } })` to pass the authenticated user and client to the handler.

#### 7. Migrate root route to context-based

**File**: `frontend/src/routes/__root.tsx`

**Intent**: Migrate from `createRootRoute()` to `createRootRouteWithContext<RouterContext>()` so auth state is available to all child routes via `beforeLoad` context. Add session hydration that runs on every navigation.

**Contract**: Define `RouterContext` type with `{ user: User | null }` (where `User` is from `@supabase/supabase-js`). Change `createRootRoute()` to `createRootRouteWithContext<RouterContext>()({...})` (note double invocation). Add `beforeLoad` that calls `getSessionFn()` and returns `{ user }`. All existing route options (head, shellComponent) remain unchanged.

#### 8. Provide initial context in router factory

**File**: `frontend/src/router.tsx`

**Intent**: Supply the default `context` value required by `createRootRouteWithContext`. This is the initial value before `beforeLoad` runs.

**Contract**: Add `context: { user: null }` to the `createTanStackRouter()` options. Type `RouterContext` must be imported and used in the `Register` module augmentation.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles without errors: `pnpm exec tsc --noEmit` (from `frontend/`)
- Build succeeds: `pnpm build` (from `frontend/`)
- Lint passes: `pnpm lint` (from `frontend/`)
- Dev server starts without errors: `pnpm dev` (from `frontend/`)

#### Manual Verification:

- Frontend loads at `http://localhost:3000` without errors in browser console
- Existing routes (index, about) still work — no regressions
- Browser DevTools Network tab shows the `getSessionFn` server function call on navigation (returning `null` since no user is logged in yet)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Auth UI & Route Protection

### Overview

Build login and register pages with styled forms, the Google OAuth flow with callback route, an `_authenticated` layout route that guards protected pages, a dashboard stub for testing, and a logout flow.

### Changes Required:

#### 1. Create login page

**File**: `frontend/src/routes/login.tsx`

**Intent**: Build a login page with email/password form and Google OAuth button. This is the entry point for returning organizers.

**Contract**: Route at `/login` via `createFileRoute('/login')`. Contains: email and password input fields with client-side validation, a submit handler that calls a `signInFn` server function (email/password via `signInWithPassword`), a "Sign in with Google" button that calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '${origin}/auth/callback' } })` via the browser client, a link to the register page, error display for auth failures. On successful email/password login, redirect to the `redirect` search param or `/dashboard`. Styled with existing design tokens (--sea-ink, --lagoon, --sand, etc.) and the `island-shell` pattern.

#### 2. Create register page

**File**: `frontend/src/routes/register.tsx`

**Intent**: Build a registration page with display name, email, and password fields plus Google OAuth. This is the entry point for new organizers.

**Contract**: Route at `/register` via `createFileRoute('/register')`. Contains: display name (required), email, and password input fields. Submit calls a `signUpFn` server function that passes `display_name` via `options.data` (stored in `raw_user_meta_data`). Google OAuth button (same as login page — Google provides `full_name` automatically). Link to login page. On successful registration, redirect to `/dashboard`. Error display for validation failures (email already taken, weak password, etc.).

#### 3. Create auth server functions

**File**: `frontend/src/lib/auth/functions.ts`

**Intent**: Create server functions for sign-in, sign-up, and sign-out that use the Supabase server client to set session cookies.

**Contract**: Three server functions:
- `signInFn`: `POST`, validates `{ email, password }`, calls `supabase.auth.signInWithPassword()`, returns `{ error: string | null }`.
- `signUpFn`: `POST`, validates `{ email, password, displayName }`, calls `supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } })`, returns `{ error: string | null }`.
- `signOutFn`: `POST`, calls `supabase.auth.signOut()`, returns `{ error: string | null }`.

All three use `createSupabaseServerClient()` so session cookies are set/cleared on the server response.

#### 4. Create OAuth callback route

**File**: `frontend/src/routes/auth/callback.tsx`

**Intent**: Handle the Supabase OAuth redirect after Google sign-in. Exchanges the PKCE authorization code for a session and redirects to the app.

**Contract**: Route at `/auth/callback`. `validateSearch` extracts `code` and `next` from the URL. `loader` calls a `handleAuthCallbackFn` server function that creates a Supabase server client, calls `supabase.auth.exchangeCodeForSession(code)`, and returns the redirect target. On success, redirect to `next` (default `/dashboard`). On failure, redirect to `/login` with an error. Renders a brief "Completing sign in..." message while the exchange happens.

#### 5. Create `_authenticated` layout route

**File**: `frontend/src/routes/_authenticated.tsx`

**Intent**: Create a pathless layout route that guards all nested routes, redirecting unauthenticated users to `/login`.

**Contract**: `createFileRoute('/_authenticated')` with `beforeLoad` that checks `context.user` — if null, `throw redirect({ to: '/login', search: { redirect: location.href } })`. Component renders `<Outlet />`.

#### 6. Create dashboard stub

**File**: `frontend/src/routes/_authenticated/dashboard.tsx`

**Intent**: Create a minimal protected page at `/dashboard` to verify the auth guard works. Displays the logged-in user's display name and email, and a logout button.

**Contract**: Route at `/_authenticated/dashboard` (renders at `/dashboard`). Reads `context.user` from route context. Shows user info (display name, email) and a "Sign Out" button that calls `signOutFn` then `router.invalidate()` to clear cached auth state. Styled with design tokens.

#### 7. Update Header with auth-aware navigation

**File**: `frontend/src/components/Header.tsx`

**Intent**: Add login/register links for unauthenticated users and dashboard/logout for authenticated users.

**Contract**: The Header receives auth state from route context (or via a hook). Shows "Log In" / "Register" links when no user, shows user display name + "Dashboard" link + "Sign Out" button when authenticated. Preserves existing nav links (Home, About).

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `pnpm exec tsc --noEmit`
- Build succeeds: `pnpm build`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Register a new user with email/password + display name → redirects to `/dashboard`, user info displayed
- Log out → redirects to `/login`, header shows "Log In" / "Register"
- Log in with the registered email/password → redirects to `/dashboard`
- Navigate to `/dashboard` while logged out → redirects to `/login` with redirect param
- After login from redirect, returns to `/dashboard`
- Google OAuth: click "Sign in with Google" → redirects to Google → completes OAuth → returns to `/dashboard` with Google display name
- Verify `organizers` table has rows for both email and Google auth users
- Mailpit at `http://localhost:54324` shows any auth emails (if email confirmation were enabled)
- Existing public routes (/, /about) still work for unauthenticated users

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Production Wiring & Verification

### Overview

Configure Google OAuth credentials, set production secrets on Supabase Cloud, Fly.io, and Cloudflare, update CLAUDE.md documentation, and verify the full auth flow works end-to-end in production.

### Changes Required:

#### 1. Configure Google OAuth in Google Cloud Console (manual)

**Intent**: Create a Google OAuth 2.0 client for Supabase auth. This provides the client ID and secret that Supabase uses to redirect users to Google sign-in.

**Contract**: In Google Cloud Console → APIs & Credentials → Create OAuth 2.0 Client ID. Authorized redirect URI: `https://xdzmwfxoxgbphcsqbuek.supabase.co/auth/v1/callback`. Copy the client ID and client secret for the next step.

#### 2. Enable Google provider in Supabase Cloud (manual)

**Intent**: Configure Supabase Cloud to accept Google OAuth sign-ins using the credentials from step 1.

**Contract**: In Supabase Dashboard → Authentication → Providers → Google: enable the provider, paste the client ID and client secret. Verify the callback URL matches the one registered in Google Cloud Console.

#### 3. Enable Google provider in local config.toml

**File**: `backend/supabase/config.toml`

**Intent**: Enable Google OAuth for local development to match the production configuration.

**Contract**: Add a new `[auth.external.google]` section after the existing `[auth.external.apple]` block (config.toml:322). The section does not exist yet. Contents:

```toml
[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"
client_secret = "env(GOOGLE_CLIENT_SECRET)"
redirect_uri = ""
```

The `redirect_uri` defaults to the Supabase callback when empty. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to a local `.env` file in the `backend/supabase/` directory (gitignored).

#### 4. Run production database migration

**Intent**: Apply the Organizer table + trigger migration to the production Supabase Postgres database.

**Contract**: The existing GitHub Actions workflow deploys EF Core migrations automatically. Verify the `AddOrganizer` migration applied successfully by checking the production `organizers` table exists and the `handle_new_user()` trigger is registered. If the CI migration has already run from Phase 1's merge, verify; otherwise trigger a deploy.

#### 5. Set Fly.io backend secrets

**Intent**: Configure the production backend with Supabase project reference and frontend URL for JWT validation and CORS.

**Contract**: Run `fly secrets set Supabase__Authority=https://xdzmwfxoxgbphcsqbuek.supabase.co/auth/v1 Frontend__Url=https://<production-frontend-url> --app picnivo`. The `__` separator maps to the `:` hierarchy in `IConfiguration` (e.g., `Supabase:Authority`).

#### 6. Set Cloudflare Workers secrets

**Intent**: Configure the production frontend with Supabase credentials for server-side auth.

**Contract**: Run `wrangler secret put SUPABASE_URL` (value: `https://xdzmwfxoxgbphcsqbuek.supabase.co`) and `wrangler secret put SUPABASE_ANON_KEY` (value: the production anon key from Supabase dashboard → Settings → API). Also set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the client-side build (or configure via Cloudflare environment variables in the dashboard).

#### 7. Update CLAUDE.md documentation

**File**: `backend/CLAUDE.md`

**Intent**: Document the new auth-related commands, secrets, and local dev workflow changes.

**Contract**: Update the `supabase start` command (already done in Phase 1). Add a section documenting: production secrets needed (`Supabase__ProjectRef`, `Frontend__Url`), the JWT validation approach (JWKS discovery, no shared secret), and the Organizer entity/trigger relationship.

**File**: `frontend/CLAUDE.md`

**Intent**: Document frontend auth setup, environment variables, and Supabase client patterns.

**Contract**: Add a section documenting: required env vars (`.dev.vars` for server, `.env` for client), the Supabase server vs browser client distinction, the auth middleware pattern for server functions, and the `_authenticated` layout route convention.

### Success Criteria:

#### Automated Verification:

- Backend deploys successfully: GitHub Actions workflow completes
- Frontend deploys successfully: Cloudflare Workers Builds completes
- Production `/healthz` returns 200: `curl https://<backend-url>/healthz`
- Production `/api/me` returns 401 without token: `curl -s -o /dev/null -w "%{http_code}" https://<backend-url>/api/me`

#### Manual Verification:

- Register a new account on production via email/password → redirects to dashboard
- Log in with the new account → dashboard shows user info
- Google OAuth: click "Sign in with Google" → completes flow → arrives at dashboard
- Log out → redirected to login
- Visit protected route while logged out → redirected to login
- Verify production `organizers` table has rows for test users

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests:

- Backend: No unit tests for auth middleware configuration (standard ASP.NET boilerplate). Unit test for Organizer entity configuration if non-trivial custom logic emerges.
- Frontend: No unit tests for Supabase client factories (thin wrappers). Auth middleware is tested through integration.

### Integration Tests:

- Backend: Integration test that starts the API with a test JWT (self-signed for test, or from local GoTrue) and verifies `/api/me` returns the correct user ID. Test that unauthenticated requests to protected endpoints return 401. Test that CORS preflight returns correct headers.
- Frontend: Not in F-02 scope. E2E auth testing deferred.

### Manual Testing Steps:

1. Start local Supabase (`supabase start` from `backend/`) — verify GoTrue and Mailpit are running
2. Apply migrations (`dotnet ef database update --project Picnivo.API` from `backend/`)
3. Start backend (`dotnet run` from `Picnivo.API/`) — verify `/healthz` and `/api/me` (401)
4. Start frontend (`pnpm dev` from `frontend/`) — verify home page loads
5. Register with email/password (provide display name) → verify redirect to dashboard, organizer row created
6. Log out → verify redirect to login, header updated
7. Log in with email/password → verify redirect to dashboard
8. Register/sign-in with Google OAuth → verify callback completes, dashboard shows Google display name
9. Navigate to protected route while logged out → verify redirect to login
10. After login, verify redirect back to originally requested page

## Performance Considerations

- `getUser()` in root `beforeLoad` makes a network call to Supabase Auth on every navigation. For local dev this adds ~10-50ms. For production, the Supabase project is on the same region — latency should be <100ms. If this becomes noticeable, consider caching the user in route context with a TTL and only re-validating periodically.
- JWKS key discovery on the backend is cached by the JWT middleware with automatic refresh — no per-request key fetch after the first one.
- The `handle_new_user()` trigger adds negligible overhead to the signup transaction (single INSERT into a small table).

## Migration Notes

- First auth migration — no data to migrate. If the `events` table already has data in production, the Organizer table and trigger are additive and don't affect existing rows.
- The `Event.OrganizerId` FK will be added in S-01. Events created before S-01 will need a migration strategy (assign to a default organizer or require retrospective assignment).

## References

- Research: `context/changes/organizer-auth-scaffold/research.md`
- Supabase Auth research: `context/changes/organizer-auth-scaffold/research-supabase-auth.md`
- API reference: `context/changes/organizer-auth-scaffold/research-supabase-auth-api.md`
- Entity mapping: `context/changes/organizer-auth-scaffold/research-user-entity-mapping.md`
- Prior plan (F-01): `context/changes/data-persistence-scaffold/plan.md`
- Roadmap: `context/foundation/roadmap.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Local Dev Infrastructure & Backend Auth

#### Automated

- [x] 1.1 Migration applies cleanly — 3b064c2
- [x] 1.2 Backend builds without errors — 3b064c2
- [x] 1.3 Backend starts and /healthz returns 200 — 3b064c2
- [x] 1.4 /api/me returns 401 without a token — 3b064c2

#### Manual

- [x] 1.5 supabase start brings up GoTrue and Mailpit
- [x] 1.6 Test user registration creates organizers row
- [x] 1.7 JWT call to /api/me returns user ID
- [x] 1.8 Mailpit accessible at localhost:54324

### Phase 2: Frontend Auth Infrastructure

#### Automated

- [x] 2.1 TypeScript compiles without errors — 4656628
- [x] 2.2 Build succeeds — 4656628
- [x] 2.3 Lint passes — 4656628
- [x] 2.4 Dev server starts without errors — 4656628

#### Manual

- [x] 2.5 Frontend loads without console errors
- [x] 2.6 Existing routes still work
- [x] 2.7 getSessionFn server function call visible in Network tab

### Phase 3: Auth UI & Route Protection

#### Automated

- [x] 3.1 TypeScript compiles — e77075a
- [x] 3.2 Build succeeds — e77075a
- [x] 3.3 Lint passes — e77075a

#### Manual

- [x] 3.4 Email/password registration with display name works — e77075a
- [x] 3.5 Logout redirects to login with header update — e77075a
- [x] 3.6 Email/password login works — e77075a
- [x] 3.7 Google OAuth flow completes end-to-end — 613f212
- [x] 3.8 Organizers table has rows for both auth methods — 613f212
- [x] 3.9 Protected route redirects to login when unauthenticated — e77075a
- [x] 3.10 Public routes work for unauthenticated users — e77075a

### Phase 4: Production Wiring & Verification

#### Automated

- [ ] 4.1 Backend deploys successfully
- [ ] 4.2 Frontend deploys successfully
- [ ] 4.3 Production /healthz returns 200
- [ ] 4.4 Production /api/me returns 401 without token

#### Manual

- [ ] 4.5 Production email/password registration works
- [ ] 4.6 Production login works
- [ ] 4.7 Production Google OAuth works
- [ ] 4.8 Production logout and route protection work
- [ ] 4.9 Production organizers table has test user rows
