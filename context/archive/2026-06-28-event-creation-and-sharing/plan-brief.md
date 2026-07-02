# Event Creation and Sharing (S-01) — Plan Brief

> Full plan: `context/changes/event-creation-and-sharing/plan.md`

## What & Why

Build the first feature slice (roadmap S-01): a logged-in organizer creates an event — title, optional description/location, 1–10 proposed date/time options, and a bring-item list — and gets an unguessable shareable link that lands on a read-only public event page. This is the prerequisite for the north-star slice S-02 (participant voting/claiming): events must exist before anyone can interact with them. PRD success target: idea → shareable link in under 2 minutes.

## Starting Point

F-01 (EF Core + Supabase Postgres) and F-02 (Supabase Auth + `Organizer` bridge entity) are done. The backend has a stub `Event` (Id/Title/CreatedAt, no organizer FK), Minimal-API endpoints in `Program.cs`, JWT auth via Supabase JWKS, and **no test project**. The frontend has TanStack Start + Tailwind v4, the `_authenticated` route guard, `createServerFn` + Supabase SSR sessions, mandatory Lingui i18n, and **no component library and no frontend→backend HTTP integration yet**.

## Desired End State

An organizer fills a single-page create form (Basics / Dates / Items), submits, and gets a `/e/{token}` link they copy in one click. Opening that link logged-out shows the event read-only. The organizer can also see a simple list of their own events. The participant interaction (voting/claiming) is explicitly left for S-02.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Date options & items storage | Separate related tables (DateOption, EventItem) | S-02 votes/claims need stable FK targets per option/item | Plan |
| Share token | Short (~8–11 char) random slug in a unique-indexed `Token` column; URL `/e/{token}` | Friendly unguessable URLs matching the mock; easy lookup | Plan |
| Time representation | UTC instant (`timestamptz`/`DateTimeOffset`) | Unambiguous across viewers; matches existing convention | Plan |
| Item adding in S-01 | Organizer-only; participant-add deferred to S-02 | Keeps S-01 a clean organizer slice | Plan |
| Public event page | Build read-only `/e/{token}` now | Makes the share link actually work and demoable this slice | Plan |
| Create form layout | Single page with sections | Fewest clicks → serves the <2-min goal | Plan |
| Date picker | Lightweight library (react-day-picker, via shadcn `Calendar`) | Polished calendar without hand-rolling; `mode="multiple"` fits FR-004 | Plan |
| Dashboard scope | Simple card list, no filters/status chips | Status chips need S-02 data; avoid faking it | Plan |
| Validation | Client + server (Zod), backend authoritative | Fast UX feedback plus a trustworthy boundary | Plan |
| Backend tests | xUnit: WebApplicationFactory + Testcontainers Postgres integration tests + unit tests | Exercises the real EF/auth/endpoint stack | Plan |
| Frontend tests | Targeted Vitest + Testing Library component/unit tests | Covers brittle form logic without heavy E2E | Plan |
| **UI library** | **shadcn/ui, theme tokens mapped to the Picnivo palette; auth pages not retrofitted** | User-requested; mapping keeps new screens consistent with shipped UI | User |

## Scope

**In scope:** Event data model (Event + DateOption + EventItem, OrganizerId FK, share token); create/list-mine/get-by-token endpoints + first backend test project; frontend backend-integration plumbing (env, authed fetch, server functions); shadcn/ui setup themed to brand; create-event form + share modal; events list; public read-only event page.

**Out of scope:** All participant flow (voting, claiming, names, summaries, best-date) → S-02; participant-added items; event edit/delete; rich dashboard filters/status chips; cover-image upload; real-time/email/calendar; retrofitting existing auth pages to shadcn.

## Architecture / Approach

Vertical slice, back-to-front. Backend gains the full S-01 model + three endpoints (two authed, one public by token) with xUnit integration tests against a real Postgres. Frontend establishes its first backend seam — server functions forward the Supabase JWT (`Authorization: Bearer`) to the .NET API for authed calls, omit it for the public token lookup — then adopts shadcn/ui (themed to the Picnivo palette) and builds three screens.

```
Browser → Cloudflare Worker (TanStack Start server fns)
   ├─ authed: read Supabase session token → Bearer → POST/GET /api/events
   └─ public: GET /api/events/{token}  → .NET API (Fly.io) → EF Core → Postgres
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend data model & migration | Event/DateOption/EventItem, OrganizerId FK, token, migration | Unique-index + cascade correctness in the generated migration |
| 2. Backend endpoints + first test project | create/list/get-by-token + xUnit/Testcontainers tests | Test auth handler + Testcontainers Postgres setup (first time) |
| 3. Frontend plumbing | env, authed fetch (JWT forward), server functions | First-ever frontend→backend auth handoff |
| 4. shadcn/ui setup & theming | shadcn init, tokens mapped to Picnivo palette, component set | Tailwind v4 / React 19 peer deps; `@/` alias; theme mapping |
| 5. Create form + share modal | Single-page form, calendar date picker, copy-link modal | Date+time→instant correctness; mobile calendar UX; <2-min goal |
| 6. Events list + public event page | `_authenticated/events` + public `/e/{token}` | Public (no-auth) data path; not-found handling |

**Prerequisites:** F-01 + F-02 complete (they are). Local Supabase Postgres running; Docker available for Testcontainers.
**Estimated effort:** ~4–6 sessions across 6 phases.

## Open Risks & Assumptions

- First frontend→backend integration: JWT-forwarding from the Supabase server session into the .NET API is unproven in this codebase (Phase 3 establishes it).
- Backend integration tests need Docker (Testcontainers) locally and in CI — first backend test project.
- shadcn/ui on Tailwind v4 + React 19 requires peer-dep flags and a correct `@/` alias under TanStack Start; theme mapping must not regress the existing auth/header styling.
- react-day-picker handles date selection only; per-date time input and the local→UTC conversion are hand-built (and unit-tested).

## Success Criteria (Summary)

- An organizer creates an event with title + 1–10 dated options + items in under ~2 minutes and gets a working, copyable share link (US-01).
- Opening the link while logged out shows the event read-only; unknown tokens show not-found.
- The organizer sees a list of their own events; backend and frontend test suites pass.
