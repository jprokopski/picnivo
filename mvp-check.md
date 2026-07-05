# MVP Project Analysis Report — Picnivo

**Project type:** Web application (event coordinator for small groups). Monorepo with a **TanStack Start / React 19** frontend and a **.NET 10 ASP.NET Core** vertical-slice backend, backed by **Supabase (Postgres + Auth)** and Entity Framework Core.

Analysis is based solely on code and documentation found in the repository, per the minimal technical criteria. Visual design, styling, accessibility, and deployment are out of scope and were not judged.

---

## 1. Checklist

### ✅ Criterion 1 — CRUD actions

All four operations exist on the core `Event` (and its sub-entities), acting on **persisted** data via EF Core (`SaveChangesAsync`). Evidence:

| Op | Entity | Route | File & proof |
|----|--------|-------|--------------|
| **Create** | Event | `POST /api/events` | `Features/Events/CreateEvent/CreateEvent.cs:77` — `db.Events.Add(@event); SaveChangesAsync` |
| **Read** | Event (list) | `GET /api/events` | `Features/Events/ListEvents/ListEvents.cs:22` — query filtered by organizer |
| **Read** | Event (detail) | `GET /api/events/{token}` | `Features/Events/GetEventByToken/GetEventByToken.cs:16-52` |
| **Update** | Event | `PUT /api/events/{token}/chosen-date` | `Features/Events/SelectFinalDate/SelectFinalDate.cs:47-49` — mutates `ChosenDateOptionId`, saves |
| **Delete** | Event | `DELETE /api/events/{token}` | `Features/Events/DeleteEvent/DeleteEvent.cs:33-37` — `db.Events.Remove(...)`, saves |

Update is a genuine mutation of a persisted record (not a transient UI edit). CRUD also spans Items (`AddItem`/`RemoveItem`), Participants (`JoinEvent`/`SetAttendance`), Votes (`CastVotes`), and Claims (`ClaimItem`/`ReleaseClaim`). **All four operations confirmed on persisted data.**

### ✅ Criterion 2 — Business logic

Multiple non-trivial rules beyond plain CRUD, reflecting the product's core value (converging a group toward a ready event):

- **Best-date ranking** — `GetEventByToken.cs:77-82`: `OrderByDescending(Yes).ThenBy(No).ThenBy(StartsAt)` — most Yes votes, ties broken by fewest No, then earliest.
- **Attendance-gated claiming** — `ClaimItem.cs:64-79`: a participant may claim an item only if `Attendance == Coming`, **or** `Undecided` **and** they voted `Yes` on the chosen date; otherwise 403.
- **Vote integrity** — unique index on `(ParticipantId, DateOptionId)` (`Data/Configurations/DateVoteConfiguration.cs`) plus an upsert with `UniqueConstraintException` retry (`CastVotes.cs`), and a FluentValidation rule rejecting duplicate date options per request.
- **Unguessable share token** — `ShareTokenGenerator.cs`: 10-char base62 via `RandomNumberGenerator` (~60 bits entropy).
- **Announcement vs. voting mode** — `Event.ResolveEffectiveChosenDateOptionId`: a single date option auto-locks as the chosen date.
- **Duplicate name/item detection** — case-insensitive checks in `JoinEvent.cs` (warning) and `AddItem.cs` (409 Conflict).

### ✅ Criterion 3 — Tests addressing a defined risk

A real test plan defines concrete risks, and real tests map to them:

- **Test plan:** `context/foundation/test-plan.md` §2 "Risk Map" enumerates 5 ranked risks.
- **Risk #1 (concurrent claim → FCFS silently fails):** `backend/Picnivo.Tests/Features/Claims/ClaimItem/ClaimItemEndpointTests.cs` → `RaceForSameItem_OneWinsOneGetsConflict` (Postgres Testcontainer, asserts exactly one 204 / one 409 / one persisted row).
- **Risk #4 (vote integrity):** `CastVotesConstraintTests.cs → DuplicateParticipantAndDateOption_ThrowsUniqueConstraintException` and `CastVotesValidatorTests.cs → WithDuplicateDateOptionId_IsInvalid`.
- **Risk #5 (best-date miscount):** `GetEventByTokenHandlerTests.cs → WithEqualYesCounts_TieBreaksByFewestNo`, `MaybeVotes_AreInertToRanking`, etc.

Backend (xUnit) and frontend (Vitest + Testing Library) suites are extensive (~35 backend test files, ~24 frontend), plus Playwright e2e. **Real tests map to stated risks — confirmed.**

### ✅ Criterion 4 — Authentication tied to a user

A deliberate two-tier model matching the domain:

- **Organizers** authenticate via **Supabase Auth** (email/password + Google OAuth): `frontend/src/lib/auth/functions.ts`, `_authenticated` route guard, `middleware/auth.ts`. Backend validates the **JWT Bearer** token (`Program.cs:39-50`, ES256, audience `authenticated`) and extracts the user id from the `sub` claim.
- **Per-user scoping:** `ListEvents.cs:22` filters `Where(e => e.OrganizerId == organizerId)`; `DeleteEvent.cs:28-31` rejects non-owners with 403. Organizer endpoints carry `.RequireAuthorization()`.
- **Participants** use lightweight, register-free identity (display name + `pv_p_{token}` cookie) reached only through the unguessable link — a reasonable design decision explicitly justified in the PRD Access Control section.

**Authentication and per-user ownership confirmed.**

### ✅ Criterion 5 — Documentation

The 10x written foundation is present and substantive (not placeholders):

- `README.md` (root + `frontend/` + `backend/`) — what it is, monorepo layout, quick start.
- `context/foundation/prd.md` — full PRD: vision, persona, success criteria, 13 functional requirements with Socratic counter-arguments, NFRs, business-logic narrative, access control.
- Plus `shape-notes.md`, `roadmap.md`, and `test-plan.md` in `context/foundation/`.

**Documentation confirmed.**

---

## 2. Project Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | CRUD actions | ✅ |
| 2 | Business logic | ✅ |
| 3 | Tests addressing a defined risk | ✅ |
| 4 | Authentication tied to a user | ✅ |
| 5 | Documentation | ✅ |

**Score: 5 / 5 = 100%** — all minimal technical foundations met, no obvious gaps.

---

## 3. Priority Improvements

No unmet criteria, so no required fixes. Optional polish only:

- **Wire e2e into CI.** Per `test-plan.md` §4, Playwright runs locally only. A CI job (even nightly against a disposable stack) would catch full-flow regressions the unit/integration tiers can't.
- **Document participant impersonation as intentional.** The "any caller with a participant GUID can act as them" trust model is already pinned by a characterization test; a one-line note in the README/PRD would make the accepted trade-off visible to reviewers.

---

## Beyond the minimum

This project clearly exceeds the MVP bar and merits a closer look:

- **Vertical-slice architecture** on both sides (backend `Features/<Area>/<Action>/`, frontend `features/<Feature>/<Action>/`) with mirrored test layout.
- **Risk-driven test strategy** — a formal, phased test plan tying every suite to a ranked failure scenario, including **real-Postgres concurrency tests** for first-come-first-served claiming and forced-insert tests proving the DB unique constraint (not just handler convenience).
- **Explicit authorization-boundary testing** (IDOR: cross-event ids → 404, foreign referenced ids → 400) and vote-stuffing defenses.
- Typed API client generated via **Orval** from the backend OpenAPI spec, and quality gates (per-edit + pre-commit scoped tests) wired via husky.
