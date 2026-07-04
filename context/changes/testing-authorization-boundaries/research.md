---
date: 2026-07-04T10:24:59+0200
researcher: Jakub Prokopski
git_commit: ddcf5730d85daf3034957adde6d25f52e56011f9
branch: main
repository: picnivo
topic: "Authorization boundaries — server-side enforcement of owner-only actions and vote integrity (Test Plan Phase 2, Risks #3 & #4)"
tags: [research, codebase, authorization, idor, votes, backend, testing]
status: complete
last_updated: 2026-07-04
last_updated_by: Jakub Prokopski
---

# Research: Authorization boundaries (Test Plan Phase 2 — Risks #3 & #4)

**Date**: 2026-07-04T10:24:59+0200
**Researcher**: Jakub Prokopski
**Git Commit**: ddcf5730d85daf3034957adde6d25f52e56011f9
**Branch**: main
**Repository**: picnivo

## Research Question

Ground Test Plan Phase 2 ("Authorization boundaries") in the live codebase. Prove
what must be tested to close:

- **Risk #3 (Authorization / IDOR)** — an organizer-only action (remove item,
  select final date) is accepted from a non-organizer, or a participant action is
  spoofed onto another participant or event via id/token tampering.
- **Risk #4 (Vote integrity)** — a participant records more than one vote per date
  option, or votes as an identity they do not own (PRD guardrail: one vote per
  person per date).

Per test-plan §2, research must ground: *which endpoints are organizer-gated and how
ownership is derived* (Risk #3); and *how participant identity is asserted on the
cast-votes path, whether the write is upsert or insert, and any unique constraint on
(participant, date option)* (Risk #4).

## Summary

The system has **three distinct authority tiers**, and the correct Phase 2 tests
follow directly from which tier guards each action:

1. **Organizer tier (JWT-gated).** Four endpoints carry `.RequireAuthorization()`
   and derive the caller from the Supabase JWT `sub` claim, then check it against
   `Event.OrganizerId`. This is where Risk #3's "organizer-only action from a
   non-organizer" lives. `SelectFinalDate` is the canonical organizer-write and is
   **already** tested for the full ladder (401 no-JWT → 403 wrong-organizer → happy).
2. **Item-removal tier (dual authority, un-gated endpoint).** `RemoveItem` has **no**
   `.RequireAuthorization()` but enforces *organizer (JWT) OR original-adder
   (participantId)* in the handler. It is already tested for the 403-neither case.
3. **Participant tier (token + GUID, accepted friend-group trust).** All
   participant writes (`CastVotes`, `SetAttendance`, `AddItem`, `ClaimItem`,
   `ReleaseClaim`) are anonymous: the `participantId` comes from the URL/query and is
   trusted once it is confirmed to belong to the event named by the token. **Knowing a
   participant's GUID = authority to act as them.** Per test-plan §2 (Risk #2 row) and
   the Phase 1 frame, this within-event impersonation is the **accepted friend-group
   trust model** — Phase 2 should *pin it as characterization*, not treat it as a bug.

**The genuine, untested gap for Risk #3 is cross-event id/token tampering** — using a
`participantId` or `itemId` from event A against event B's token. Every handler guards
this with an `EntityId == @event.Id` FK filter that returns **404**, but **no test
anywhere exercises it**. That is the primary new coverage Phase 2 must add.

**For Risk #4**, a DB unique index on `(ParticipantId, DateOptionId)` exists (config +
migration + snapshot) and the handler is an **upsert** (update existing row, else
insert). The no-duplicate-row behaviour is already tested at both layers via the
handler's happy-path upsert — but **no test forces the DB constraint to actually fire**
(concurrent/forced duplicate insert), and the impersonation half of Risk #4 is the same
accepted-trust model as above. There is also a latent **unhandled `DbUpdateException`**
on a concurrent first-vote race that would surface as a 500.

## Detailed Findings

### Authority model & infrastructure

Real authentication exists (this corrected an initial assumption that endpoints were
fully anonymous):

- **Supabase JWT Bearer, ES256 via JWKS discovery** — `backend/Picnivo.API/Program.cs:38-50`.
  `MapInboundClaims = false`; `sub` claim carries the Supabase user id = `Organizer.Id`.
- `app.UseAuthentication()` / `app.UseAuthorization()` in the pipeline — `Program.cs:63-64`.
- Endpoints are discovered by reflection over `IEndpoint` — `backend/Picnivo.API/IEndpoint.cs:1-6`,
  `backend/Picnivo.API/EndpointExtensions.cs:5-25` (all pass through `ValidationEndpointFilter`).
- Also documented in `backend/CLAUDE.md` → "Authentication".

**Three identifiers, three tiers:**

| Identifier | Origin | Secret? | Guards |
|---|---|---|---|
| `Event.Token` — 10-char Base62 | `ShareTokenGenerator.Generate()` (`Features/Events/CreateEvent/ShareTokenGenerator.cs:13-27`), collision-retried at insert (`CreateEvent.cs:41-45`) | public share link | which event |
| `Participant.Id` — `Guid.CreateVersion7()` | server-generated on join (`Features/Participants/JoinEvent/JoinEvent.cs:34`), returned to client | **not secret by design** (published by `GetEventByToken`) | which participant |
| JWT `sub` → `organizerId` | Supabase Auth | cryptographically signed | organizer-only actions |

There is **no separate "organizer token"** — organizer authority is always the JWT.

### Risk #3 — endpoint inventory & ownership derivation

Full surface (12 endpoints), auth posture, and where ids come from:

| Endpoint | Method / route | Auth | Ownership check | Cross-event guard |
|---|---|---|---|---|
| CreateEvent | `POST /api/events` | **RequireAuth** | — (creates own) | — |
| ListEvents | `GET /api/events` | **RequireAuth** | filters `e.OrganizerId == sub` (`ListEvents.cs:22`) | n/a |
| GetMyParticipant | `GET /api/events/{token}/me` | **RequireAuth** | `resolved.OrganizerId != sub` → 404 (`GetMyParticipant.cs:35`) | n/a |
| **SelectFinalDate** | `PUT /api/events/{token}/chosen-date` | **RequireAuth** | `@event.OrganizerId != organizerId` → **403** (`SelectFinalDate.cs:37-40`); no JWT → **401** (`:17-20`) | dateOptionId must be in event |
| GetEventByToken | `GET /api/events/{token}` | none | — (public read) | — |
| JoinEvent | `POST /api/events/{token}/participants` | none | — (public join) | — |
| AddItem | `POST /api/events/{token}/items` | none | participant∈event (`AddItem.cs:28-30`) | FK → 404 |
| **RemoveItem** | `DELETE /api/events/{token}/items/{itemId}` | **none** | `isOrganizer(JWT) OR isAdder(participantId==item.AddedBy)` else **403** (`RemoveItem.cs:38-46`) | `i.EventId==@event.Id` → **404** (`:28-31`) |
| SetAttendance | `PUT /api/events/{token}/participants/{participantId}/attendance` | none | participant∈event (`SetAttendance.cs:27-30`) | FK → 404 |
| CastVotes | `PUT /api/events/{token}/participants/{participantId}/votes` | none | participant∈event (`CastVotes.cs:32-40`) | FK → 404 |
| ClaimItem | `POST /api/events/{token}/items/{itemId}/claim` | none | participant∈event (`ClaimItem.cs:42-45`) | FK → 404 |
| ReleaseClaim | `DELETE /api/events/{token}/items/{itemId}/claim` | none | claim ownership (`ReleaseClaim.cs:36-44`) | FK → 404 |

**Organizer-only writes (Risk #3 core):**

- **`SelectFinalDate.Handle`** (`Features/Events/SelectFinalDate/SelectFinalDate.cs:16-40`):
  ```csharp
  if (!Guid.TryParse(user.FindFirstValue("sub"), out var organizerId))
      return Results.Unauthorized();            // 401 — no/invalid JWT
  // ...load event by token...
  if (@event.OrganizerId != organizerId)
      return Results.StatusCode(StatusCodes.Status403Forbidden);  // 403 — wrong organizer
  ```
- **`RemoveItem.Handle`** (`Features/Items/RemoveItem/RemoveItem.cs:38-46`) — dual authority
  on an **un-gated** endpoint (verified live):
  ```csharp
  var isOrganizer = Guid.TryParse(user.FindFirstValue("sub"), out var organizerId)
      && organizerId == @event.OrganizerId;
  var isAdder = participantId is { } pid && item.AddedByParticipantId == pid;
  if (!isOrganizer && !isAdder)
      return Results.StatusCode(StatusCodes.Status403Forbidden);
  ```
  Note: because the endpoint is un-gated, an *unauthenticated* caller with the correct
  `participantId` of the adder is authorized — this is the accepted friend-group model,
  not a defect.

**Cross-event tampering (the untested gap).** Every participant/item write filters the
target id by the event resolved from the token, e.g. `RemoveItem.cs:28-31`
(`i.Id == itemId && i.EventId == @event.Id`) and `CastVotes.cs:32-35`
(`p.Id == participantId && p.EventId == @event.Id`). A foreign id therefore returns
**404** (a foreign *dateOption* on CastVotes returns **400**, `CastVotes.cs:42-45`).
This is correct behaviour but has **zero test coverage** — no test seeds two events and
crosses ids between them.

### Risk #4 — vote integrity (cast-votes path)

Path: `Features/Votes/CastVotes/` — endpoint `CastVotesEndpoint.cs:8` (`PUT
/api/events/{token}/participants/{participantId}/votes`), handler `CastVotes.cs:9`,
validator `CastVotesValidator.cs:6`.

**Write is an UPSERT** (`CastVotes.cs:47-73`, verified live): reads existing
`(participantId, submitted dateOptionIds)` rows, then per submitted vote updates
`current.Choice` if the row exists, else inserts a new `DateVote` with
`Guid.CreateVersion7()`. Re-voting the same option updates the single row — no duplicate.
The validator also forbids the same `DateOptionId` twice within one request
(`CastVotesValidator.cs:12-14`).

**DB unique constraint EXISTS** on `(ParticipantId, DateOptionId)`, in all three places:

- EF config — `Data/Configurations/DateVoteConfiguration.cs:15-18`
  (`.HasIndex(v => new { v.ParticipantId, v.DateOptionId }).IsUnique()` →
  `IX_DateVotes_Participant_DateOption`).
- Migration — `Data/Migrations/20260702124332_AddParticipantsVotesAndClaims.cs:152-157`
  (`CreateIndex(..., unique: true)`).
- Model snapshot — `HasIndex("ParticipantId","DateOptionId").IsUnique()`.

**Identity assertion** (`CastVotes.cs:32-40`): only `participant ∈ event`. `participantId`
is a trusted route param; no cookie / per-participant secret. → Anyone with the event
token + a valid participant GUID can overwrite that participant's votes (accepted
friend-group trust). The DB constraint prevents duplicate *rows* but does nothing about
voting *as an identity you do not own*.

**Data model** — `DateVote` (`Data/Models/DateVote.cs:3-12`): PK `Id`; FKs
`ParticipantId`→Participant (cascade), `DateOptionId`→DateOption (cascade); `Choice`
enum `VoteChoice { Invalid=0, Yes=1, Maybe=2, No=3 }` (`Data/Models/VoteChoice.cs`,
required per `DateVoteConfiguration.cs:13`). `DateVote` has **no direct `EventId`** —
event scoping is transitive through both Participant and DateOption, enforced in the
handler (`CastVotes.cs:32,42`).

**Latent race** (`CastVotes.cs:47-75`): the read-then-write is not transactionally
guarded, so two simultaneous *first* votes on the same `(participant, dateOption)` can
both take the INSERT branch; the unique index turns the loser into a
`DbUpdateException` that is **unhandled** → surfaces as **500** rather than a clean
result. (Compare Phase 1's `ClaimItem`, which handles the equivalent 409.)

### Existing test coverage — what to reuse vs. what to add

Harness (from `backend/Picnivo.Tests/ApiFixture.cs`):

- Endpoint tests: `[Collection("Api")]` + `WebApplicationFactory<Program>` over a
  **pooled real Postgres Testcontainer** (`postgres:16-alpine`, pool of 10 DBs, reset by
  `TRUNCATE "Organizers" CASCADE`) — `ApiFixture.cs:20-101,170-194`. The FK
  `fk_organizers_auth_users` is dropped so tests can insert organizers without real
  Supabase rows (`ApiFixture.cs:62-86`).
- **Test auth is header-driven** — `TestAuthHandler` reads `X-Test-Organizer-Id`
  (`TestAuthHandler.cs:16`); **absent → 401** (`:20-26`); **present GUID → authenticated
  with that `sub`** (`:28-31`). So `ctx.ApiClient` = unauthenticated (→401),
  `ctx.AuthedApiClient(Guid.NewGuid())` = authenticated-but-owns-nothing (→403/404),
  `ctx.AuthedApiClient(ownerId)` = the real organizer.
- Handler tests: SQLite in-memory via `TestDb.Create()` (`TestDb.cs:13-24`), call static
  `Handle(...)` directly through a `using <Action>Handler = ...` alias.

**Already covered (pin / do not rewrite):**

- `SelectFinalDateEndpointTests.cs:12-90` — **the gold reference**: 401 no-auth, 403
  non-organizer, happy 204 + DB assert, 400 invalid date.
- `RemoveItemEndpointTests.cs:11-57` — organizer deletes any item (204), 403 non-adder
  non-organizer, 404 unknown token.
- `ListEventsEndpointTests.cs:25-45` — ownership scoping (two organizers, caller sees
  only own). Best template for **two-organizer / two-event seeding**.
- `GetMyParticipantEndpointTests.cs:27-60` — 404 different authed user, 401 unauth.
- `CastVotesHandlerTests.cs:13` (`UpsertsVote_ChangingChoiceWithoutAddingRows`) and
  `CastVotesEndpointTests.cs:34` (`RepeatedVote_NeverYieldsTwoRows`) — upsert / no
  duplicate row at both layers.

**Gaps Phase 2 should close:**

1. **Cross-event id tampering (Risk #3, primary gap)** — no test seeds two events and
   uses event A's `participantId`/`itemId` against event B's token. Add for
   `RemoveItem` (→404), `CastVotes`/`SetAttendance`/`AddItem`/`ClaimItem` (→404), and a
   foreign `dateOptionId` on `CastVotes` (→400). Seed shape: mirror
   `ListEventsEndpointTests.cs:29-33`.
2. **Organizer-action negative ladder on `SelectFinalDate`** is covered; confirm the
   `RemoveItem` un-gated dual-authority matrix is fully pinned (organizer-only,
   adder-only, neither→403), plus a cross-event item→404.
3. **DB unique constraint actually fires (Risk #4)** — no test forces a duplicate
   `(participant, dateOption)` insert to hit `IX_DateVotes_Participant_DateOption`; the
   happy-path upsert never reaches it. Needs a forced/concurrent insert (real Postgres
   fixture, like Phase 1's claim race).
4. **Within-event impersonation characterization (Risk #4, accepted)** — pin that a
   caller with the token + another participant's GUID *can* cast votes as them, labelled
   as the accepted friend-group model (not a guardrail). Avoids a future reviewer
   mistaking it for a bug.
5. **Missing validator test** — `CastVotesValidator.cs:12-14` (in-request duplicate
   `DateOptionId`) has no test (`CastVotesValidatorTests.cs` covers empty / out-of-range
   only).
6. **Latent 500 on concurrent first-vote race** — decide (with the plan) whether to
   harden `CastVotes` to catch `DbUpdateException` like `ClaimItem` does, or accept it.

## Code References

- `backend/Picnivo.API/Program.cs:38-50` — Supabase JWT Bearer (ES256) setup
- `backend/Picnivo.API/Program.cs:63-64` — `UseAuthentication` / `UseAuthorization`
- `backend/Picnivo.API/EndpointExtensions.cs:5-25` — reflection endpoint discovery
- `backend/Picnivo.API/Features/Events/CreateEvent/ShareTokenGenerator.cs:13-27` — token gen
- `backend/Picnivo.API/Features/Events/SelectFinalDate/SelectFinalDate.cs:16-40` — organizer 401/403 check
- `backend/Picnivo.API/Features/Items/RemoveItem/RemoveItem.cs:28-46` — cross-event 404 + dual-authority 403
- `backend/Picnivo.API/Features/Votes/CastVotes/CastVotes.cs:32-75` — membership check, upsert, latent race
- `backend/Picnivo.API/Features/Votes/CastVotes/CastVotesValidator.cs:12-14` — in-request duplicate rule
- `backend/Picnivo.API/Data/Models/DateVote.cs:3-12` — vote entity
- `backend/Picnivo.API/Data/Configurations/DateVoteConfiguration.cs:15-18` — unique index
- `backend/Picnivo.API/Data/Migrations/20260702124332_AddParticipantsVotesAndClaims.cs:152-157` — unique index migration
- `backend/Picnivo.Tests/ApiFixture.cs:20-101,170-194` — pooled Postgres fixture + DbContext swap
- `backend/Picnivo.Tests/TestAuthHandler.cs:16-31` — header-driven test auth (401/403 lever)
- `backend/Picnivo.Tests/Features/Events/SelectFinalDate/SelectFinalDateEndpointTests.cs:12-90` — auth-ladder reference
- `backend/Picnivo.Tests/Features/Events/ListEvents/ListEventsEndpointTests.cs:25-45` — two-organizer seeding template
- `backend/Picnivo.Tests/Features/Votes/CastVotes/CastVotesEndpointTests.cs:34` — no-duplicate-row test

## Architecture Insights

- **Authorization is per-tier, not uniform.** Reading "endpoint is anonymous" as
  "no authorization" is wrong: participant writes carry an event-scoped FK check that is
  itself the authorization boundary for cross-event tampering. Tests must assert the
  *tier* that applies, not a blanket "requires auth."
- **Two error codes encode two different boundaries.** Cross-event *entity* id → 404
  (via `EntityId == @event.Id`); wrong-*organizer* → 403 (explicit `OrganizerId` compare);
  no JWT on a gated endpoint → 401. Phase 2 assertions should distinguish them precisely.
- **The DB constraint is the real Risk #4 guardrail**, not the handler upsert (which is
  a convenience). A test that only exercises the upsert never proves the guardrail; the
  constraint must be forced to fire — same lesson Phase 1 learned for the claim 409.
- **Accepted-by-design vs. gap.** Within-event GUID-based impersonation is the frozen
  friend-group trust model (test-plan §2 Risk #2 row; Phase 1 frame `Dim 1′`). It should
  be pinned as characterization; the *new* protection to prove is cross-event isolation.
- Follow the vertical-slice test layout (`backend/CLAUDE.md` → Tests; MEMORY
  vertical-slice note): mirror `Features/<Area>/<Action>/`, separate
  `*EndpointTests` / `*HandlerTests` / `*ValidatorTests`, seed each test's own aggregate
  via `DbContext`, assert both HTTP status and persisted state.

## Historical Context (from prior changes)

- `context/foundation/test-plan.md` §2–§3 — Risk #3 & #4 definitions and the Phase 2
  row ("endpoint + integration"); §2 explicitly scopes cross-participant identity trust
  as the **accepted friend-group model**, deferred here (so Phase 2 pins it, not fixes it).
- `context/changes/testing-claim-path-integrity/frame.md` — Phase 1 already surfaced the
  Phase 2 territory: `Dim 1′` found participant endpoints anonymous with `participantId`
  trusted from URL (STRONG, but "out of Phase 1 scope → Phase 2"). Its `Dim 3` finding
  (409-vs-500 factory gap; `UseExceptionProcessor` kept alive by EF's accumulating
  options config) is directly relevant to the CastVotes latent-500 question.
- `context/changes/testing-claim-path-integrity/plan.md` + `reviews/` — the concurrency
  test pattern (real Postgres, `Task.WhenAll`, count-persisted-rows) to reuse for the
  "constraint fires" test.

## Related Research

- `context/changes/testing-claim-path-integrity/research.md` — sibling Phase 1 research
  (claim path + eligibility gate); shares the harness and seeding conventions.

## Open Questions

1. **CastVotes latent 500** — harden to catch `DbUpdateException` (mirror `ClaimItem`'s
   409 handling) or accept the race as out-of-scope? Decide in `/10x-plan`.
2. **How far to push cross-event tests** — every participant-write endpoint, or a
   representative subset (RemoveItem + CastVotes) given they share the identical FK-guard
   pattern? Cost×signal call for the plan.
3. **Impersonation characterization scope** — one pinning test on CastVotes, or across
   SetAttendance/ClaimItem too? They share the trust model, so one may suffice.
</content>
</invoke>
