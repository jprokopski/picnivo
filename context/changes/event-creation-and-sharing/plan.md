# Event Creation and Sharing (S-01) Implementation Plan

## Overview

Build roadmap slice **S-01**: a logged-in organizer creates an event (title required; optional description and location; 1–10 proposed date/time options; an item list), receives an unguessable shareable link, can open a read-only public event page at that link, and can see a list of their own events. This is the first feature slice on top of the completed F-01 (EF Core + Supabase Postgres persistence) and F-02 (Supabase Auth + `Organizer` bridge entity) scaffolds.

PRD refs: US-01, FR-001, FR-002, FR-003, FR-004, FR-005 (organizer half), FR-006. Secondary success criterion: an organizer goes from idea to shareable link in **under 2 minutes**.

## Current State Analysis

**Backend** (`backend/Picnivo.API/`): ASP.NET Core 10 Minimal API, EF Core 10 + Npgsql against Supabase Postgres. All endpoints live in `Program.cs`. Entities use `IEntityTypeConfiguration<T>` classes under `Data/Configurations/`; migrations via `dotnet ef` in `Data/Migrations/`, applied in CI via a bundled `efbundle`.

- `backend/Picnivo.API/Data/Models/Event.cs` — stub entity: `Id` (Guid), `Title`, `CreatedAt`. **No `OrganizerId` FK yet.**
- `backend/Picnivo.API/Data/Models/Organizer.cs` — `Id` (Guid, = Supabase `auth.users.id`, `ValueGeneratedNever`), `DisplayName`, `CreatedAt`. Auto-provisioned by a `handle_new_user()` DB trigger on signup.
- `backend/Picnivo.API/Data/PicnivoDbContext.cs` — `DbSet<Event>`, `DbSet<Organizer>`; uses `ApplyConfigurationsFromAssembly`.
- `Program.cs` — JWT bearer auth via Supabase JWKS (ES256), `MapInboundClaims = false`. Logged-in user id read with `user.FindFirstValue("sub")`. Protected endpoints use `.RequireAuthorization()`; `/healthz` and others are public. CORS enabled. Sample `/api/me` exists but is unused by any client.
- **No backend test project exists.**

**Frontend** (`frontend/`): TanStack Start (React 19) + Tailwind v4, file-based routing, Lingui i18n used in **every** route. Supabase SSR cookie sessions.

- Routing: `_authenticated.tsx` layout guard (`beforeLoad` redirects to `/login` when `context.user` is null). Existing routes: `/`, `/about`, `/login`, `/register`, `/auth/callback`, `/_authenticated/dashboard`.
- API pattern: `createServerFn` (server functions running on Cloudflare Workers) with `.inputValidator(zodSchema)`. Auth state from `getSessionFn()` populating `context.user` in the root `beforeLoad`.
- Styling: Tailwind v4 + custom CSS tokens in `src/styles.css` (`--lagoon`, `--sand`, `--sea-ink`, `--surface`, `--line`, …), Manrope (body) + Fraunces (display). **No component library today.**
- Tests: Vitest configured, React Testing Library available; **no test files written yet.**
- **No frontend→backend HTTP integration exists.** There is no `API_URL` env var, no authed-fetch helper, and no code that forwards the Supabase JWT to the .NET backend. The frontend currently talks only to Supabase directly. S-01 must establish this seam.

### Key Discoveries:

- The frontend reaches the backend for the first time in this slice. The .NET backend authenticates by validating the Supabase JWT in the `Authorization: Bearer` header (`Program.cs` JWT setup); the server function must read the access token from the Supabase server session and forward it.
- shadcn/ui's `Calendar` component is a thin wrapper over **react-day-picker** (the date library chosen for this slice), so the two decisions converge. react-day-picker v9 supports `mode="multiple"`, `max={10}`, and `disabled={{ before: new Date() }}` — directly satisfying FR-004 (1–10 future dates). It selects **dates only**; time-of-day needs a separate per-date time input.
- shadcn/ui supports Tailwind v4 + React 19 (init prompts for `--force`/`--legacy-peer-deps`) and has a dedicated TanStack Start install path; it themes via CSS variables, which lets us map its semantic tokens onto the existing Picnivo palette.
- The `Organizer` row is guaranteed to exist for any authenticated user (provisioned by the F-02 trigger), so `OrganizerId` on `Event` can be a non-nullable FK populated from the JWT `sub` claim without a "create organizer if missing" path.

## Desired End State

A logged-in organizer can:

1. Open a create-event screen, fill in title (required) + optional description/location, pick 1–10 future date/time options, and add bring-items.
2. Submit and receive a shareable link (`/e/{token}`, short unguessable token) in a modal with one-click copy-to-clipboard.
3. Open `/e/{token}` (no auth) and see a read-only event page: title, description, location, the date options, and the item list.
4. Visit `/_authenticated/events` and see a simple list of the events they created.

**Verification**: Backend integration tests pass against a real Postgres (Testcontainers); `dotnet ef database update` applies the new migration cleanly; frontend Vitest component tests pass; the full flow works end-to-end in a browser locally (create → copy link → open public page in a fresh/incognito session).

## What We're NOT Doing

- **No participant flow** — no name entry, voting, item claiming, vote summaries, best-date ranking, or attendance confirmation. That is S-02 (FR-007–FR-013, FR-010–FR-012).
- **No participant-added items** — FR-005's participant half is deferred to S-02. S-01 is organizer-only item management.
- **No event editing/deletion after creation** beyond what's needed to create. (Edit flows can be a later slice; not in US-01.)
- **No rich dashboard** — no vote-derived status chips (those need S-02 data). ~~No All/Ongoing/Past filters~~ — **superseded during Phase 6**: the design-fidelity addendum ("match the mock 1:1, mock wins on conflicts") took precedence once the mocks turned out to include All/Ongoing/Past filters; kept as a date-only filter (no vote/status semantics) per `picnivo-web-events.jsx`.
- **No retrofit of existing auth pages** to shadcn — login/register/dashboard keep their current hand-built styling this slice.
- **No real-time updates, email, reminders, calendar export** — PRD non-goals / deferred.
- **No image/cover uploads** — the design mock shows cover imagery; S-01 uses a static/derived placeholder, no upload pipeline.

## Implementation Approach

Vertical slice, back-to-front. The backend gains the full S-01 data model (Event + DateOption + EventItem related tables, OrganizerId FK, share token) and three endpoints (create, list-mine, get-by-token), with the project's first xUnit test project. The frontend then establishes its first backend-integration plumbing (env, authed fetch forwarding the JWT, server functions), adopts shadcn/ui themed to the Picnivo palette, and builds the three screens (create form + share modal, events list, public event page). Validation is enforced on both sides: Zod in the server functions and inline UI hints for fast feedback, with the backend as the authoritative boundary.

## Critical Implementation Details

- **Frontend→backend auth handoff (load-bearing, first time in the codebase).** The create/list server functions run server-side and must call the .NET backend with the organizer's Supabase JWT. The access token comes from the Supabase **server** client's session (`supabase.auth.getSession()`), forwarded as `Authorization: Bearer <access_token>`. The public get-by-token path needs **no** auth header. The backend base URL is configured as a `VITE_`-prefixed env var (it is **not** secret, so the F-02 "secrets get baked into the client bundle" lesson does not apply) and read through the existing `src/lib/env.ts` schema — see Phase 3.1. Reserve `cloudflare:workers`/`.dev.vars` for values that must stay server-only (none in this slice).
- **Share-token collision handling.** Token generation can collide (rare). The insert path must retry on a unique-constraint violation rather than assuming uniqueness. The `Token` column is unique-indexed.
- **Time representation.** Each date option is stored as a UTC instant (`timestamptz` via `DateTimeOffset`). The frontend resolves the organizer's chosen local date + time to an absolute instant before sending; the public page renders back in the viewer's locale. react-day-picker selects the date; a per-date time control supplies the time.
- **Migration ordering.** The new tables reference `Organizer`; the migration must be generated against the current model snapshot (which already includes `Organizer` from F-02) so the FK resolves.

## Phase 1: Backend Data Model & Migration

### Overview

Expand the domain model to support events with date options and items, owned by an organizer and reachable by an unguessable token.

### Changes Required:

#### 1. Expand the Event entity

**File**: `backend/Picnivo.API/Data/Models/Event.cs`

**Intent**: Make `Event` a real aggregate root: owned by an organizer, optionally described/located, reachable by a public token, and parent to date options and items.

**Contract**: Add `OrganizerId` (Guid, FK → `Organizer.Id`), `Description` (string?, nullable), `Location` (string?, nullable), `Token` (string, unique public share token), and navigation collections `ICollection<DateOption> DateOptions` and `ICollection<EventItem> Items`. Keep existing `Id`, `Title`, `CreatedAt`.

#### 2. New DateOption entity

**File**: `backend/Picnivo.API/Data/Models/DateOption.cs` (new)

**Intent**: One proposed date/time for an event; stable row so S-02 votes can FK to it.

**Contract**: `public class DateOption` with `Id` (Guid), `EventId` (Guid FK), `StartsAt` (DateTimeOffset, stored `timestamptz`), and an `Event` navigation. Namespace `Picnivo.API.Data.Models`.

#### 3. New EventItem entity

**File**: `backend/Picnivo.API/Data/Models/EventItem.cs` (new)

**Intent**: One bring-item on the logistics list; stable row so S-02 claims can FK to it.

**Contract**: `public class EventItem` with `Id` (Guid), `EventId` (Guid FK), `Label` (string, required), and an `Event` navigation. (No `ClaimedBy` yet — that's S-02.)

#### 4. Entity configurations

**Files**: `backend/Picnivo.API/Data/Configurations/EventConfiguration.cs` (edit), `DateOptionConfiguration.cs` (new), `EventItemConfiguration.cs` (new)

**Intent**: Map the new columns, constraints, relationships, and the unique token index following the existing configuration pattern.

**Contract**:
- `EventConfiguration`: configure `OrganizerId` FK (required, cascade or restrict — use cascade so deleting an organizer cleans up events), `Description`/`Location` as nullable with sensible max lengths, `Token` required with a **unique index**, and the `DateOptions`/`Items` one-to-many relationships (cascade delete).
- `DateOptionConfiguration`: PK, required `StartsAt` as `timestamptz`, FK to `Event`.
- `EventItemConfiguration`: PK, required `Label` with max length, FK to `Event`.

#### 5. Register DbSets

**File**: `backend/Picnivo.API/Data/PicnivoDbContext.cs`

**Intent**: Expose the new entities so EF tracks them and the migration includes the tables.

**Contract**: Add `DbSet<DateOption>` and `DbSet<EventItem>`. (`ApplyConfigurationsFromAssembly` already discovers the new configs.)

#### 6. Share-token generator

**File**: `backend/Picnivo.API/Services/ShareTokenGenerator.cs` (new) — or a static helper if simpler

**Intent**: Produce a short (~8–11 char) URL-safe, unguessable token from a cryptographic RNG.

**Contract**: A method returning a base62 (or URL-safe base64 without padding) string from `RandomNumberGenerator`. Pure and unit-testable. Collision handling (retry) lives at the insert site, not here.

#### 7. EF migration

**File**: `backend/Picnivo.API/Data/Migrations/<timestamp>_AddEventDetailsDateOptionsAndItems.cs` (generated)

**Intent**: Capture the schema delta (new Event columns + unique token index + two new tables) as a code-first migration.

**Contract**: Generated via `dotnet ef migrations add AddEventDetailsDateOptionsAndItems --project Picnivo.API --output-dir Data/Migrations`. Review the generated up/down for the unique index on `Token` and cascade behaviors before committing.

### Success Criteria:

#### Automated Verification:

- [ ] Solution builds: `dotnet build` (from `backend/`)
- [ ] Migration applies cleanly to a fresh DB: `dotnet ef database update --project Picnivo.API`
- [ ] Migration down-script reverts cleanly (spot check): `dotnet ef database update <previous> --project Picnivo.API`

#### Manual Verification:

- [ ] Inspecting the local DB shows `Events` with new columns + unique index on `Token`, and `DateOptions` / `EventItems` tables with FKs to `Events`.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Backend API Endpoints & First Test Project

### Overview

Add the three S-01 endpoints with DTOs and server-side validation, and stand up the repo's first backend test project covering them.

### Changes Required:

#### 1. Request/response DTOs

**File**: `backend/Picnivo.API/Dtos/EventDtos.cs` (new; create `Dtos/` folder)

**Intent**: Define the create request and the read shapes so internal entities aren't leaked over the wire.

**Contract**:
- `CreateEventRequest`: `Title` (required), `Description?`, `Location?`, `DateOptions` (list of instants, 1–10), `Items` (list of labels, 0..n).
- `EventSummaryResponse` (for list): `Id`, `Title`, `Location?`, `Token`, `CreatedAt`, `DateOptionCount`, `ItemCount`, soonest date.
- `EventDetailResponse` (for public page): `Title`, `Description?`, `Location?`, organizer display name, ordered `DateOptions` (id + instant), `Items` (id + label). No internal-only fields.

#### 2. POST /api/events — create (auth)

**File**: `backend/Picnivo.API/Program.cs`

**Intent**: Create an event owned by the calling organizer, generating a unique token, persisting date options and items in one transaction.

**Contract**: `app.MapPost("/api/events", ...).RequireAuthorization()`. Read `OrganizerId` from `user.FindFirstValue("sub")`. Validate server-side: title non-empty, 1–10 date options, no past dates, item labels non-empty/deduped. Generate token via the generator; on unique-violation, retry. Return 201 with the new `Token` (and id). Return 400 with validation messages on bad input.

#### 3. GET /api/events — list mine (auth)

**File**: `backend/Picnivo.API/Program.cs`

**Intent**: Return the calling organizer's events for the dashboard.

**Contract**: `app.MapGet("/api/events", ...).RequireAuthorization()`. Filter `Events` by `OrganizerId == sub`. Project to `EventSummaryResponse` (include counts). Order by soonest upcoming date (then created). Returns 200 with a (possibly empty) array.

#### 4. GET /api/events/{token} — public read

**File**: `backend/Picnivo.API/Program.cs`

**Intent**: Resolve a share token to a read-only event view, with no authentication.

**Contract**: `app.MapGet("/api/events/{token}", ...)` **without** `.RequireAuthorization()`. Look up by `Token`; 404 if not found. Project to `EventDetailResponse` (include organizer display name, ordered date options, items). Returns 200.

#### 5. Backend test project

**Files**: `backend/Picnivo.Tests/Picnivo.Tests.csproj` (new), test classes, plus a new `backend/Picnivo.slnx` solution.

**Intent**: Establish the repo's backend testing foundation and cover the new endpoints against a real Postgres.

**Create a solution so `backend/` commands resolve (required).** Today there is **no** solution file in `backend/`, only `Picnivo.API/`; with two projects, `dotnet build`/`dotnet test` from `backend/` are ambiguous. Add a solution in the modern XML format — `dotnet new sln --format slnx -o backend` (→ `backend/Picnivo.slnx`) — then `dotnet sln backend/Picnivo.slnx add Picnivo.API Picnivo.Tests`, and add a `Picnivo.Tests → Picnivo.API` project reference. After this, success criteria 2.1/2.2 (`dotnet build` / `dotnet test` from `backend/`) resolve unambiguously.

**Expose `Program` to the test project (required first).** `Program.cs` uses top-level statements, so the generated `Program` class is `internal` and `WebApplicationFactory<Program>` cannot reference it — the test project will not compile. Append `public partial class Program { }` to the bottom of `backend/Picnivo.API/Program.cs` (preferred over `InternalsVisibleTo`) before writing the integration tests.

**Contract**: xUnit project. **Integration tests** via `WebApplicationFactory<Program>` with a **Testcontainers PostgreSQL** instance (real Npgsql behavior — `timestamptz`, unique index, defaults — which EF InMemory/SQLite can't reproduce); the factory overrides the connection string and runs migrations on startup. Cover: create requires auth (401 without token); create persists event + options + items and returns a token; validation rejects empty title, 0 and 11 date options, and past dates (400); list returns only the caller's events; get-by-token returns the detail shape and 404 for unknown tokens; token uniqueness under concurrent/repeated creates. **Unit test** the `ShareTokenGenerator` (length, URL-safe charset, non-repeating across many calls). Auth in tests: mint or stub a valid bearer principal (test auth handler) so `RequireAuthorization` + `sub` claim resolve.

### Success Criteria:

#### Automated Verification:

- [ ] Solution builds: `dotnet build`
- [ ] Backend tests pass: `dotnet test` (from `backend/`)
- [ ] Linting/format passes if configured: `dotnet format --verify-no-changes`

#### Manual Verification:

- [ ] `curl`/REST client: creating an event with a valid bearer token returns 201 + token; `GET /api/events/{token}` returns the event with no auth; `GET /api/events` returns only the caller's events.

**Implementation Note**: Pause for manual confirmation after automated verification passes.

---

## Phase 3: Frontend Backend-Integration Plumbing

### Overview

Establish the first frontend→backend HTTP seam: configuration, an Orval-generated typed API client from the backend OpenAPI spec, a custom fetch mutator that forwards the Supabase JWT, and the server functions the screens will call.

### Changes Required:

#### 1. Backend base URL config

**Files**: `frontend/src/lib/env.ts`, `frontend/.env`

**Intent**: Make the .NET backend base URL configurable per environment (local dev points at `http://localhost:<port>`; production at the Fly.dev URL).

**Contract**: Add `VITE_API_URL` (a **`VITE_`-prefixed** URL) to the existing Zod schema in `src/lib/env.ts` and to `.env`. The base URL is **not secret**, so the F-02 "don't bake secrets into the client bundle" concern does not apply — only `VITE_*` vars appear in `import.meta.env`, which `env.ts` parses at module scope. Do **not** add a non-`VITE_` name here: on Cloudflare Workers server-runtime vars come from `cloudflare:workers`/`.dev.vars`, so a bare name would be `undefined` and the module-scope `parse()` would throw on boot.

#### 2. Orval setup + code generation

**Files**: `frontend/orval.config.ts` (new), `frontend/src/lib/api/axios-instance.ts` (new), `frontend/src/api/` (generated, do not edit), `frontend/package.json` (add `orval` + `@tanstack/react-query` deps + `orval` script)

**Intent**: Generate a fully-typed axios + React Query API client from the backend OpenAPI spec (`backend/Picnivo.API/Picnivo.API.json`). Server functions call the generated plain functions; React components use the generated hooks.

**Contract**:
- Install `orval` (dev dep), `axios`, `@tanstack/react-query`.
- `orval.config.ts`: point `input` at `../backend/Picnivo.API/Picnivo.API.json` (relative to `frontend/`); set `output.target` to `src/api/`; set `output.client` to `'react-query'`; set `output.override.mutator` to `{ path: 'src/lib/api/axios-instance.ts', name: 'axiosInstance' }`.
- `src/lib/api/axios-instance.ts`: export a named `axiosInstance` — an `axios.create()` instance with `baseURL: env.VITE_API_URL` and `headers: { 'Content-Type': 'application/json' }`. Auth tokens are **not** set globally — they are injected per-call via `options.headers` in the server functions so each authenticated request carries its own token without leaking between requests on the server.
- Add `"orval": "orval"` to `package.json` scripts.
- Run `pnpm orval` to generate `src/api/` with typed call functions **and** React Query hooks for every endpoint. Commit the generated output.

#### 3. Zod schemas + server functions

**Files**: `frontend/src/lib/events/functions.ts` (new), `frontend/src/lib/events/schema.ts` (new)

**Intent**: Provide the typed, validated entry points the UI calls server-side, mirroring the existing `auth/functions.ts` pattern. Components use the generated React Query hooks for client-side data fetching.

**Contract**: The two authed server functions reuse the existing `authMiddleware` (`src/middleware/auth.ts`) which injects `{ user, supabase }` into context; the access token comes from `supabase.auth.getSession()` on that client. Do not hand-roll a second auth path.
- `createEventSchema` (Zod): title required, 1–10 date options (each a future ISO instant string), optional description/location, item labels. Shared by UI and server fn.
- `createEventFn` = `createServerFn({ method: 'POST' }).middleware([authMiddleware]).inputValidator(createEventSchema).handler(...)` → calls the Orval-generated `POST /api/events` plain function with `{ headers: { Authorization: \`Bearer ${token}\` } }` → returns `{ token }` or error.
- `listEventsFn` = `createServerFn({ method: 'GET' }).middleware([authMiddleware]).handler(...)` → calls the Orval-generated `GET /api/events` plain function with auth header → returns summaries.
- `getEventByTokenFn` = `createServerFn({ method: 'GET' }).inputValidator(tokenSchema).handler(...)` → calls the Orval-generated `GET /api/events/{token}` plain function (public, **no** auth header) → returns detail or null.
- Phase 5/6 screens may use the generated React Query hooks (e.g. `useGetApiEvents`) directly in components for client-side refetch and cache invalidation, wrapping them with a `QueryClientProvider` at the app root if not already present.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `pnpm exec tsc --noEmit` in `frontend/`
- [ ] Lint passes: `pnpm lint`
- [ ] Unit tests for `createEventSchema` pass: `pnpm test`

#### Manual Verification:

- [ ] From a temporary call (or the next phase's UI), `createEventFn` reaches the backend and the created event is retrievable via `getEventByTokenFn`; an unauthenticated `getEventByTokenFn` works while `createEventFn` requires a session.

**Implementation Note**: Pause for manual confirmation after automated verification passes.

---

## Phase 4: shadcn/ui Setup & Theming

### Overview

Initialize shadcn/ui, map its theme tokens onto the existing Picnivo palette and fonts so new components match the shipped auth UI, and add the component set the screens need.

### Changes Required:

#### 1. Initialize shadcn/ui

**Files**: `frontend/components.json` (new), `frontend/src/lib/utils.ts` (new `cn` helper), `frontend/tsconfig.json` + Vite config (path alias), `package.json` (deps)

**Intent**: Wire shadcn/ui into the TanStack Start + Tailwind v4 + React 19 project.

**Contract**: Run the shadcn init (TanStack Start / Vite path, `cssVariables: true`, resolve React 19 peer deps with `--force` or `--legacy-peer-deps`). Ensure the `@/` import alias resolves in both TS and Vite. Adds `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, and `tailwindcss-animate` (or v4 equivalent).

#### 2. Map shadcn theme tokens to the Picnivo palette

**File**: `frontend/src/styles.css`

**Intent**: Make shadcn's semantic CSS variables resolve to the existing brand colors and fonts so generated components inherit the Picnivo look in light and dark mode.

**Contract**: Define shadcn's expected variables (`--background`, `--foreground`, `--primary`, `--primary-foreground`, `--muted`, `--border`, `--ring`, `--card`, etc.) in terms of the existing tokens (`--lagoon`, `--sand`, `--sea-ink`, `--surface`, `--line`, …) under `:root` and under the project's **existing** dark selectors — `:root[data-theme="dark"]` **and** the `@media (prefers-color-scheme: dark)` block (styles.css) — **not** a new shadcn-default `.dark` class. This keeps shadcn components on the app's existing dark switch. Ensure shadcn's `@theme inline` mapping uses them. Preserve Manrope/Fraunces. Keep existing tokens intact (auth pages unaffected).

#### 3. Add component set

**Files**: `frontend/src/components/ui/*` (generated)

**Intent**: Pull in the components the create form, share modal, dashboard, and public page use.

**Contract**: `npx shadcn add` for: `button`, `input`, `textarea`, `label`, `card`, `dialog`, `popover`, `calendar` (brings in react-day-picker), and a toast/`sonner` if used for copy feedback. Verify the `calendar` import works and renders themed.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build`

#### Manual Verification:

- [ ] A scratch render of `Button`, `Card`, `Dialog`, and `Calendar` shows the Picnivo palette/fonts (not shadcn's stock neutral), in both light and dark mode.
- [ ] Existing auth/header pages are visually unchanged.

**Implementation Note**: Pause for manual confirmation after automated verification passes.

---

## Phase 5: Create-Event Screen & Share Modal

### Overview

Build the single-page, sectioned create form (Basics / Dates / Items) with the calendar-based date picker, client-side validation, a live preview, and a post-create share modal with copy-to-clipboard.

### Changes Required:

#### 1. Create route

**File**: `frontend/src/routes/_authenticated/create.tsx` (new)

**Intent**: An organizer-only screen to compose and submit a new event, then surface the shareable link.

**Contract**: Nested under `_authenticated` (auth-guarded). Single scrollable form with three sections:
- **Basics** — title (required), location (optional), description/note (optional textarea). shadcn `Input`/`Textarea`/`Label`.
- **Dates** — shadcn `Calendar` in `mode="multiple"` with `max={10}` and `disabled={{ before: new Date() }}`; for each selected date, a per-date time control; renders selected date/time chips with remove. Enforces 1–10 (FR-004).
- **Items** — add-by-input (Enter or button) building a removable list of labels, with a few suggestion pills.
- A **live preview** card mirroring title/location/date-count/item-count.
- Submit ("Create & get link") calls `createEventFn`; on success opens the share modal. All copy via Lingui `<Trans>`/`useLingui`. Client validation mirrors `createEventSchema` with inline hints; the server fn remains authoritative.

#### 2. Share modal

**File**: `frontend/src/components/events/ShareLinkDialog.tsx` (new)

**Intent**: Present the generated `/e/{token}` link with one-click copy (FR-006, US-01 AC).

**Contract**: shadcn `Dialog` showing a success state, the absolute share URL, a copy-to-clipboard button (with copied feedback), and an "Open event page" action navigating to `/e/{token}`. URL built from the app origin + token.

#### 3. Local time → instant conversion

**File**: co-located helper (e.g. `frontend/src/lib/events/datetime.ts`)

**Intent**: Combine each selected calendar date with its chosen time into an absolute UTC instant before submit (per the time-representation decision).

**Contract**: Pure function: `(date, timeOfDay) => ISO instant`. Unit-tested.

#### 4. Component/unit tests

**Files**: co-located `*.test.tsx` / `*.test.ts`

**Intent**: Cover the brittle interactive logic.

**Contract**: Vitest + Testing Library. Test: date add/remove respects the 1–10 bound; item add/remove and dedupe; validation blocks submit on empty title / zero dates; copy-link writes the expected URL; the date→instant helper. Mock `createEventFn`.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm lint`
- [ ] Tests pass: `pnpm test`
- [ ] Lingui extraction is clean (no untranslated additions break build): `pnpm extract` then `pnpm compile`

#### Manual Verification:

- [ ] An organizer can create an event with title + 1–10 dates + items in under ~2 minutes and gets a working copyable link.
- [ ] Validation prevents empty title, 0 dates, >10 dates, and past dates with clear messages.
- [ ] Screen is usable on a mobile viewport; calendar and time inputs work on touch.
- [ ] Copy-to-clipboard works; "Open event page" navigates to the public page.

**Implementation Note**: Pause for manual confirmation after automated verification passes.

---

## Phase 6: Events Dashboard & Public Event Page

### Overview

Add the organizer's events list and the read-only public event page the share link lands on.

**Design fidelity (required, not aspirational).** Both screens must match the mocks in `frontend/context/foundation/design/` **1:1** — layout, spacing, component choice, and visual styling, not just "inspired by." This is the explicit bar per `frontend/CLAUDE.md`'s Design section ("Match them before improvising"). Build side-by-side with the relevant `.jsx` mock and `picnivo.css`/`picnivo-web.css` open; where the mock and shadcn defaults diverge, the mock wins — restyle the shadcn primitive rather than accepting its stock look. Treat any deliberate deviation (e.g. dynamic data the static mock doesn't show) as an explicit, called-out exception, not a drift.

### Changes Required:

#### 1. Events list route

**File**: `frontend/src/routes/_authenticated/events.tsx` (new)

**Intent**: Show the organizer the events they've created (US-01: "see their events"; FR-002).

**Contract**: Auth-guarded. Loads via `listEventsFn` (in `beforeLoad`/loader or a query). Renders a simple responsive grid of shadcn `Card`s (title, location, date count, item count, a link to open the event / copy link). No filters or vote-derived status chips. Empty state with a CTA to `/create`. Lingui throughout. Add nav entry ("My events" / "New event") consistent with the header pattern. Must match the design mock `frontend/context/foundation/design/picnivo-web-events.jsx` **1:1** (grid layout, card composition/spacing, empty state) — see the Design fidelity note above.

#### 2. Public event page route

**File**: `frontend/src/routes/e/$token.tsx` (new)

**Intent**: The destination of the share link — a read-only event view requiring no account (Access Control: "the link IS the access").

**Contract**: **Public** route (not under `_authenticated`). Loads via `getEventByTokenFn({ token })`. Renders title, description, location, organizer display name, the date options (formatted in the viewer's locale), and the item list — all read-only. Must match the design mock `frontend/context/foundation/design/picnivo-web-event.jsx` **1:1** (the source-of-truth layout for this page, per `frontend/CLAUDE.md`) — see the Design fidelity note above. 404/not-found state for unknown tokens. Lingui throughout. (S-02 will layer voting/claiming onto this page.)

#### 3. Tests

**Files**: co-located `*.test.tsx`

**Intent**: Cover list rendering (incl. empty state) and public-page rendering (incl. not-found), mocking the server functions.

**Contract**: Vitest + Testing Library: events list renders cards from mocked summaries and shows empty state when none; public page renders detail from a mocked event and a not-found state for a missing token.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm lint`
- [ ] Tests pass: `pnpm test`
- [ ] Build succeeds: `pnpm build`

#### Manual Verification:

- [ ] After creating events, `/_authenticated/events` lists them; empty state shows for a new organizer.
- [ ] Opening `/e/{token}` in a fresh/incognito session (logged out) shows the event read-only; an unknown token shows not-found.
- [ ] Pages are usable on mobile viewports.
- [ ] End-to-end: create → copy link → open in logged-out browser → see the event. (US-01 satisfied.)
- [ ] Side-by-side comparison against `picnivo-web-events.jsx` and `picnivo-web-event.jsx`: layout, spacing, and styling match 1:1 (no unapproved shadcn-default look or improvised layout).

**Implementation Note**: Pause for manual confirmation after automated verification passes.

---

## Testing Strategy

### Unit Tests:

- Backend: `ShareTokenGenerator` (length, charset, uniqueness across many calls).
- Frontend: `createEventSchema` validation; date→instant conversion; date/item add-remove + dedupe logic.

### Integration Tests:

- Backend (`WebApplicationFactory` + Testcontainers Postgres): create requires auth; create persists event/options/items + returns token; validation rejects (empty title, 0/11 dates, past dates); list is organizer-scoped; get-by-token returns detail and 404s on unknown; token uniqueness.

### Manual Testing Steps:

1. Log in as an organizer; open `/create`.
2. Enter title only → submit blocked until ≥1 date; add 1–10 dates with times and a few items.
3. Submit → share modal shows a short link; copy it.
4. Open the link in an incognito window (logged out) → read-only event page renders.
5. Try `/e/bogus-token` → not-found.
6. Return to `/_authenticated/events` → the new event appears; verify counts.
7. Repeat on a mobile viewport.

## Performance Considerations

Traffic is low (PRD `qps: low`, `data_volume: small`). The list and detail queries are small, single-organizer or single-token lookups; the `Token` unique index keeps public lookups O(log n). Event page must be interactive within 2s on mobile (NFR) — the public page is a simple read with no client-heavy work, well within budget.

## Migration Notes

One additive EF migration (new Event columns + unique token index + two new tables). No existing data to backfill (no events exist in production yet beyond scaffold proof-of-concept rows; the new columns are additive and `OrganizerId` has no pre-existing rows to migrate). Applied in CI via the existing bundled-migration deploy step.

## References

- Roadmap: `context/foundation/roadmap.md` (S-01)
- PRD: `context/foundation/prd.md` (US-01, FR-001–FR-006)
- Prior art (patterns): `context/archive/2026-06-02-data-persistence-scaffold/plan.md`, `context/archive/2026-06-04-organizer-auth-scaffold/plan-brief.md`
- Backend auth/user-id accessor: `backend/Picnivo.API/Program.cs` (JWT setup, `user.FindFirstValue("sub")`)
- Frontend server-fn + auth pattern: `frontend/src/lib/auth/functions.ts`, `frontend/src/lib/supabase/server.ts`, `frontend/src/routes/_authenticated.tsx`
- Design mocks: `frontend/context/foundation/design/picnivo-web-create.jsx` (create form), `picnivo-web-events.jsx` (events list), `picnivo-web-event.jsx` (public event page), `picnivo-web-app.jsx`
- shadcn/ui: TanStack Start install + Tailwind v4 `cssVariables` theming; `calendar` wraps react-day-picker
- react-day-picker v9: `mode="multiple"`, `max`, `disabled={{ before: new Date() }}`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend Data Model & Migration

#### Automated

- [x] 1.1 Solution builds (`dotnet build`) — c9cb421
- [x] 1.2 Migration applies cleanly (`dotnet ef database update`) — c9cb421
- [x] 1.3 Migration down-script reverts cleanly (spot check) — c9cb421

#### Manual

- [x] 1.4 DB shows new Event columns + unique Token index and DateOptions/EventItems tables with FKs — c9cb421

### Phase 2: Backend API Endpoints & First Test Project

#### Automated

- [x] 2.1 Solution builds (`dotnet build`) — 42e2108
- [x] 2.2 Backend tests pass (`dotnet test`) — 42e2108
- [x] 2.3 Format check passes (`dotnet format --verify-no-changes`) — 42e2108

#### Manual

- [x] 2.4 curl/REST: create→201+token (auth), get-by-token (no auth), list is caller-scoped — 42e2108

### Phase 3: Frontend Backend-Integration Plumbing

#### Automated

- [x] 3.1 Type checking passes (`pnpm typecheck`) — df356f4
- [x] 3.2 Lint passes (`pnpm lint`) — df356f4
- [x] 3.3 `createEventSchema` unit tests pass (`pnpm test`) — df356f4

#### Manual

- [x] 3.4 `createEventFn` reaches backend (authed) and event is retrievable via `getEventByTokenFn` (public) — df356f4

### Phase 4: shadcn/ui Setup & Theming

#### Automated

- [x] 4.1 Type checking passes (`pnpm typecheck`) — 0710267
- [x] 4.2 Lint passes (`pnpm lint`) — 0710267
- [x] 4.3 Build succeeds (`pnpm build`) — 0710267

#### Manual

- [x] 4.4 Scratch render of Button/Card/Dialog/Calendar shows Picnivo palette in light+dark — 0710267
- [x] 4.5 Existing auth/header pages visually unchanged — 0710267

### Phase 5: Create-Event Screen & Share Modal

#### Automated

- [x] 5.1 Type checking passes (`pnpm typecheck`) — 868e31e
- [x] 5.2 Lint passes (`pnpm lint`) — 868e31e
- [x] 5.3 Tests pass (`pnpm test`) — 868e31e
- [x] 5.4 Lingui extract + compile clean (`pnpm extract` / `pnpm compile`) — 868e31e

#### Manual

- [x] 5.5 Create event (title + 1–10 dates + items) in ~2 min → working copyable link — 868e31e
- [x] 5.6 Validation blocks empty title / 0 / >10 / past dates with clear messages — 868e31e
- [x] 5.7 Usable on mobile viewport (calendar + time on touch) — 868e31e
- [x] 5.8 Copy-to-clipboard + "Open event page" navigation work — 868e31e

### Phase 6: Events Dashboard & Public Event Page

#### Automated

- [x] 6.1 Type checking passes (`pnpm typecheck`)
- [x] 6.2 Lint passes (`pnpm lint`)
- [x] 6.3 Tests pass (`pnpm test`)
- [x] 6.4 Build succeeds (`pnpm build`)

#### Manual

- [ ] 6.5 `/_authenticated/events` lists created events; empty state for new organizer
- [ ] 6.6 `/e/{token}` renders read-only when logged out; unknown token shows not-found
- [ ] 6.7 Pages usable on mobile viewports
- [ ] 6.8 End-to-end: create → copy link → open logged-out → see event (US-01)
- [ ] 6.9 Side-by-side comparison against `picnivo-web-events.jsx` and `picnivo-web-event.jsx`: layout, spacing, and styling match 1:1
