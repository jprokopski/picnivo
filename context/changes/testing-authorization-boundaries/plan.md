# Authorization Boundaries (Test Plan Phase 2) Implementation Plan

## Overview

Close Test Plan **Phase 2 — Authorization boundaries** (`context/foundation/test-plan.md` §3),
covering **Risk #3 (Authorization / IDOR)** and **Risk #4 (Vote integrity)**. The work is
predominantly additive backend tests that prove two boundaries the codebase already enforces
but does not exercise:

1. **Cross-event id/token isolation** — a `participantId`/`itemId` from event A used against
   event B's token is refused (404), and a foreign `dateOptionId` is refused (400).
2. **Vote-integrity guardrails** — the DB unique index on `(ParticipantId, DateOptionId)` is
   the real one-vote-per-person-per-date guardrail (not the handler upsert), and the
   in-request duplicate-`DateOptionId` validator rule.

Plus **one production hardening**: the cast-votes path has a latent concurrency defect where
two simultaneous *first* votes on the same `(participant, dateOption)` race into the INSERT
branch; the loser's `SaveChanges` violates the unique index. Phase 2 hardens the handler so
that race resolves as **idempotent success (204)** rather than leaking the global 409
unique-constraint response — a 409 is semantically wrong for a vote upsert where both callers
simply wanted their vote recorded.

## Current State Analysis

**Authority model (three tiers, from research):**

| Tier | Identifier | Enforced by | Test lever (existing) |
|---|---|---|---|
| Organizer | JWT `sub` → `Event.OrganizerId` | `.RequireAuthorization()` + explicit owner compare | `TestAuthHandler` header `X-Test-Organizer-Id` (absent → 401, GUID → that `sub`) |
| Item-removal | JWT organizer **OR** original-adder `participantId` | in-handler dual check on an un-gated endpoint | already pinned in `RemoveItemEndpointTests` |
| Participant | `Event.Token` + `Participant.Id` (GUID) | event-scoped FK filter (`EntityId == @event.Id`) | anonymous `ctx.ApiClient` |

**What is already covered (pin / do not rewrite):**
- `SelectFinalDateEndpointTests.cs:12-90` — the organizer auth ladder (401 → 403 → 204 → 400).
- `RemoveItemEndpointTests.cs:11-57` — dual-authority matrix (organizer 204, non-adder/non-organizer 403, unknown token 404).
- `CastVotesEndpointTests.cs:34` (`RepeatedVote_NeverYieldsTwoRows`) and
  `CastVotesHandlerTests.cs` — the upsert / no-duplicate-row *convenience* behaviour.
- `ClaimItemEndpointTests.cs:28` (`RaceForSameItem_OneWinsOneGetsConflict`) — the concurrency
  test template (`Task.WhenAll` + a `Safe*Async` status wrapper + count-persisted-rows).

**What is missing (the gaps this plan closes):**
- No test seeds two events and crosses ids between them (Risk #3 primary gap).
- No test forces the `IX_DateVotes_Participant_DateOption` unique index to reject a duplicate
  row — the happy-path upsert never reaches it (Risk #4 guardrail unproven).
- No test for `CastVotesValidator.cs:12-14` (in-request duplicate `DateOptionId`).
- No characterization test pinning within-event GUID impersonation as the **accepted**
  friend-group model.
- `CastVotes.Handle` does not catch the concurrent-first-vote unique violation.

### Key Discoveries

- **Two error codes encode two boundaries.** Cross-event *entity* id → **404** (via
  `EntityId == @event.Id`, e.g. `RemoveItem.cs:28-31`, `CastVotes.cs:32-35`); a foreign
  *dateOption* on cast-votes → **400** (`CastVotes.cs:42-45`); wrong-organizer → **403**; no
  JWT on a gated endpoint → **401**. Tests must distinguish these precisely.
- **The global exception pipeline already maps unique violations to 409.**
  `Program.cs:17` `.UseExceptionProcessor()` (EntityFramework.Exceptions.PostgreSQL) translates
  a Postgres 23505 into `UniqueConstraintException`; `GlobalExceptionHandler.cs:14-32` +
  `UniqueConstraintProblemDetails.cs:7` map that type → **409**. So an *unhandled* concurrent
  first-vote race currently surfaces as a global **409** (or a 500 if the processor is ever
  dropped — the Phase 1 "409-vs-500 factory gap"). Either way it is **not** the idempotent
  success we want for a vote. The hardening must catch the violation *in the handler* so it
  never reaches the global handler.
- **The write is an upsert** (`CastVotes.cs:47-73`): read existing `(participantId, dateOptionIds)`
  rows, update `Choice` if present else insert a new `DateVote` with `Guid.CreateVersion7()`.
  Re-voting the same option updates the single row — the race only exists on the *first* vote
  (both callers take the INSERT branch).
- **Test harness** (`ApiFixture.cs`): `[Collection("Api")]` + `WebApplicationFactory<Program>`
  over a **pooled real Postgres Testcontainer** (`fixture.CheckOutAsync()`), reset by TRUNCATE.
  `ctx.ApiClient` = unauthenticated; `ctx.AuthedApiClient(id)` = authenticated as `id`. Seed
  each test's own data via `DbContext`. This is real Postgres, so the unique index and the
  concurrency race are both faithfully reproduced (SQLite-in-memory would not enforce them the
  same way).

## Desired End State

- Cross-event tampering is proven refused for the representative item-tier and participant-tier
  endpoints, with the 404-vs-400 distinction asserted.
- The `(ParticipantId, DateOptionId)` unique index is proven to reject a duplicate row via a
  deterministic forced insert.
- The in-request duplicate-`DateOptionId` validator rule has a test.
- Within-event GUID impersonation is pinned as accepted-by-design (one labelled characterization
  test), so a future reviewer does not mistake it for a bug.
- Two simultaneous first-votes on the same `(participant, dateOption)` both return **204**, with
  **exactly one** persisted row and no 409/500 leak.

Verify: `dotnet test backend/Picnivo.Tests` green; the concurrency test fails before the Phase 3
handler change and passes after.

### Key Discoveries

- `context/changes/testing-authorization-boundaries/research.md` — full endpoint inventory,
  tier model, and gap analysis.
- `ClaimItemEndpointTests.cs:28-49` — concurrency test shape to mirror (differs in the assertion:
  claims are exclusive → one 409; votes are idempotent → both 204).
- `ListEventsEndpointTests.cs:25-45` — two-organizer / two-event seeding template.
- `EntityFramework.Exceptions.Common.UniqueConstraintException` is the caught type (thrown after
  `UseExceptionProcessor` translation), not raw `DbUpdateException`.

## What We're NOT Doing

- **Not changing the accepted friend-group trust model.** Within-event GUID-based impersonation
  stays permitted (test-plan §2 Risk #2 row; Phase 1 frame). We pin it as characterization, not
  fix it.
- **Not adding cross-event tests to every participant-write endpoint.** `SetAttendance`,
  `AddItem`, `ClaimItem`, `ReleaseClaim` share the identical FK-guard pattern; `RemoveItem`
  (item tier) + `CastVotes` (participant tier) are the representative pair.
- **Not re-testing already-covered ladders** — `SelectFinalDate` (401/403/204/400) and the
  `RemoveItem` dual-authority matrix are pinned; we only add the missing cross-event item→404.
- **Not returning 409 for the vote race.** The hardening resolves it to idempotent 204.
- **Not touching frontend, aggregation (Risk #5, Phase 3), or quality-gate wiring (Phase 4).**

## Implementation Approach

Two additive test phases (Risk #3, then Risk #4 guardrails) that can land immediately without
production risk, followed by one isolated phase carrying the single production behaviour change
plus its concurrency proof. Ordering matters: the Phase 2 constraint test bypasses the handler
(direct `DbContext`), so it is independent of and unaffected by the Phase 3 handler change; the
Phase 3 concurrency test is the one that flips from failing to passing when the handler is
hardened.

All tests follow the vertical-slice layout (`backend/CLAUDE.md` → Tests; backend lessons):
mirror `Features/<Area>/<Action>/`, separate `*EndpointTests`/`*HandlerTests`/`*ValidatorTests`,
seed each test's own aggregate via `DbContext`, Arrange-Act-Assert, Shouldly assertions, assert
both HTTP status and persisted state.

## Critical Implementation Details

- **Handler retry must reset EF change-tracker state.** After the first `SaveChangesAsync` throws
  `UniqueConstraintException`, the losing `DateVote` is still tracked in `Added` state. A naive
  second `SaveChanges` re-attempts the same failing insert. The catch block must detach/reset the
  failed additions (or clear the tracker) and re-query the now-existing rows fresh before applying
  the intended `Choice` as an *update*, then save again. This is the one non-obvious ordering in
  the plan.
- **Catch the translated type.** With `UseExceptionProcessor` active, the exception surfacing from
  `SaveChangesAsync` on a 23505 is `EntityFramework.Exceptions.Common.UniqueConstraintException`,
  not raw `DbUpdateException`. Catch that specific type so genuine `DbUpdateException`s (other
  failures) still propagate to the global handler.
- **Concurrency tests require the real Postgres fixture.** Use `fixture.CheckOutAsync()` — SQLite
  in-memory does not reproduce the unique-index contention. The forced-insert constraint test
  (Phase 2) likewise needs real Postgres for the index to fire.

---

## Phase 1: Risk #3 — Authorization boundary tests

### Overview

Prove cross-event id/token isolation for the representative item-tier and participant-tier
endpoints, and pin within-event impersonation as accepted-by-design.

### Changes Required

#### 1. Cross-event `RemoveItem` isolation

**File**: `backend/Picnivo.Tests/Features/Items/RemoveItem/RemoveItemEndpointTests.cs` (extend)

**Intent**: Prove event B's token cannot remove event A's item — the FK filter
(`i.EventId == @event.Id`, `RemoveItem.cs:28-31`) returns 404 rather than deleting a
foreign item.

**Contract**: New `[Fact]` seeding two independent events (each its own organizer, item, adder
participant — mirror `ListEventsEndpointTests.cs:29-33`). Act: DELETE event A's `itemId` against
event B's `token` (as event B's organizer or adder). Assert: `ApiException.StatusCode` 404, and
event A's item still persists in the DB.

#### 2. Cross-event `CastVotes` isolation + foreign dateOption

**File**: `backend/Picnivo.Tests/Features/Votes/CastVotes/CastVotesEndpointTests.cs` (extend)

**Intent**: Prove the participant-tier FK guard (`p.EventId == @event.Id`, `CastVotes.cs:32-35`)
returns 404 for a foreign participant, and the dateOption membership check
(`CastVotes.cs:42-45`) returns 400 for a foreign dateOption.

**Contract**: Two `[Fact]`s over a two-event seed:
- Event A's `participantId` against event B's `token` → 404; no `DateVote` rows written for that
  participant.
- Event A's `dateOptionId` in a votes payload against event B's `token`/participant → 400; no rows
  written.

#### 3. Within-event impersonation characterization (accepted model)

**File**: `backend/Picnivo.Tests/Features/Votes/CastVotes/CastVotesEndpointTests.cs` (extend)

**Intent**: Pin — with a clear name/comment — that a caller holding the event token plus *another*
participant's GUID **can** cast votes as that participant. This is the accepted friend-group trust
model (test-plan §2 Risk #2 row), documented in the suite so it is not misread as an IDOR gap.

**Contract**: `[Fact]` named to signal intent (e.g. `AnyCallerWithParticipantGuid_CanVoteAsThem_AcceptedFriendGroupTrust`)
with a comment linking test-plan §2. Seed one event with two participants (Alice, Bob). Act: an
anonymous client casts Bob's votes using Bob's GUID. Assert: 204 and Bob's vote persisted — the
*documented, intended* behaviour.

### Success Criteria

#### Automated Verification:
- Build + client regen succeeds: `dotnet build backend/Picnivo.API`
- New RemoveItem/CastVotes tests pass: `dotnet test backend/Picnivo.Tests`
- Full backend suite green: `dotnet test backend/Picnivo.Tests`

#### Manual Verification:
- Cross-event tests fail if the FK filter is removed from the handler (spot-check the assertion is
  real, not tautological).
- The impersonation test is clearly labelled as accepted-by-design (name + comment cite test-plan §2).

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human before proceeding to Phase 2.

---

## Phase 2: Risk #4 — Vote-integrity guardrail tests

### Overview

Prove the two Risk #4 guardrails deterministically: the in-request duplicate-`DateOptionId`
validator rule, and the DB unique index that actually enforces one-vote-per-person-per-date.

### Changes Required

#### 1. In-request duplicate `DateOptionId` validator test

**File**: `backend/Picnivo.Tests/Features/Votes/CastVotes/CastVotesValidatorTests.cs` (extend)

**Intent**: Cover `CastVotesValidator.cs:12-14` — a request listing the same `DateOptionId` twice
is rejected. The existing validator tests only cover empty / out-of-range choice.

**Contract**: `[Fact]` using `TestValidateAsync` (backend lessons) with a `CastVotesRequest`
containing two votes on the same `DateOptionId`; assert a validation error on the votes collection.

#### 2. DB unique constraint forced-insert test

**File**: `backend/Picnivo.Tests/Features/Votes/CastVotes/CastVotesConstraintTests.cs` (new)

**Intent**: Prove `IX_DateVotes_Participant_DateOption` rejects a second row for the same
`(ParticipantId, DateOptionId)` — the *real* Risk #4 guardrail, which the happy-path upsert never
reaches. Bypass the handler and insert directly so the assertion targets the constraint, not the
handler's convenience logic.

**Contract**: `[Collection("Api")]` test on the real Postgres fixture (`fixture.CheckOutAsync()`).
Seed one event + participant + dateOption; insert one `DateVote`; then add a second `DateVote` with
the same `(ParticipantId, DateOptionId)` via `DbContext` and assert `SaveChangesAsync` throws
`UniqueConstraintException` (the translated type). Assert exactly one row persists afterward.

### Success Criteria

#### Automated Verification:
- Validator + constraint tests pass: `dotnet test backend/Picnivo.Tests`
- Full backend suite green: `dotnet test backend/Picnivo.Tests`

#### Manual Verification:
- The constraint test fails (no throw) if pointed at a SQLite in-memory context — confirming it
  genuinely exercises the Postgres index (spot-check reasoning; do not commit the SQLite variant).

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human before proceeding to Phase 3.

---

## Phase 3: Risk #4 — Harden concurrent first-vote race to idempotent success

### Overview

Fix the latent concurrency defect: two simultaneous first-votes on the same
`(participant, dateOption)` must both succeed idempotently (204, one row), not leak the global 409
unique-constraint response.

### Changes Required

#### 1. Harden `CastVotes.Handle`

**File**: `backend/Picnivo.API/Features/Votes/CastVotes/CastVotes.cs`

**Intent**: Wrap the save so a concurrent first-vote unique violation is recovered in-handler and
resolved as an idempotent upsert, returning 204 — never surfacing the global 409/500.

**Contract**: Catch `EntityFramework.Exceptions.Common.UniqueConstraintException` around the
`SaveChangesAsync` at `CastVotes.cs:75`. On catch: reset the change-tracker state for the failed
`Added` `DateVote`(s), re-query the now-existing `(participantId, dateOptionIds)` rows, apply the
requested `Choice` as an update, `SaveChangesAsync` again, and return `Results.NoContent()`. Single
retry (the row can only exist after the race resolves). Only `UniqueConstraintException` is caught;
other exceptions still propagate to `GlobalExceptionHandler`. No endpoint `.Produces` change needed
(still 204/404/400).

#### 2. Concurrent first-vote endpoint test

**File**: `backend/Picnivo.Tests/Features/Votes/CastVotes/CastVotesEndpointTests.cs` (extend)

**Intent**: Prove the race resolves idempotently — the assertion that distinguishes votes from
claims (claims: one 204 + one 409; votes: both 204).

**Contract**: `[Fact]` mirroring `ClaimItemEndpointTests.cs:28-49` — a `SafeCastVotesAsync` wrapper
returning the status code, `Task.WhenAll` on two simultaneous first-votes for the *same*
`(participant, dateOption)` (different `Choice` values). Assert: both results are 204, and exactly
one `DateVote` row persists for that `(participant, dateOption)`. (Which choice wins is
non-deterministic — assert row count and both-succeeded, not a specific `Choice`, to avoid an
oracle problem.)

### Success Criteria

#### Automated Verification:
- Backend builds: `dotnet build backend/Picnivo.API`
- Concurrency test passes after the handler change: `dotnet test backend/Picnivo.Tests`
- Full backend suite green: `dotnet test backend/Picnivo.Tests`

#### Manual Verification:
- Reverting the Phase 3 handler change makes the concurrency test fail (both-204 assertion breaks),
  confirming the test actually exercises the hardening.
- No regression in the existing `RepeatedVote_NeverYieldsTwoRows` upsert test.

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human. This is the final phase.

---

## Testing Strategy

### Unit Tests
- `CastVotesValidator` in-request duplicate `DateOptionId` rule (`TestValidateAsync`).

### Integration Tests
- Cross-event `RemoveItem` → 404; cross-event `CastVotes` → 404; foreign `dateOptionId` → 400.
- Within-event impersonation characterization (accepted model) → 204.
- Forced duplicate insert → `UniqueConstraintException`, one row (real Postgres).
- Concurrent first-vote race → both 204, one row (real Postgres, `Task.WhenAll`).

### Manual Testing Steps
1. `dotnet test backend/Picnivo.Tests` — full suite green.
2. Temporarily revert the Phase 3 handler catch → confirm the concurrency test fails → restore.
3. Confirm the impersonation test's name/comment cite test-plan §2 (accepted-by-design signal).

## Performance Considerations

Negligible. The handler retry runs only on the rare first-vote race; the common path is unchanged.
Concurrency and constraint tests use the pooled Postgres Testcontainer already provisioned by
`ApiFixture` — no new infrastructure.

## Migration Notes

None — no schema change. The `(ParticipantId, DateOptionId)` unique index already exists
(`DateVoteConfiguration.cs:15-18`, migration `20260702124332`).

## References

- Research: `context/changes/testing-authorization-boundaries/research.md`
- Test plan: `context/foundation/test-plan.md` §2 (Risks #3/#4), §3 (Phase 2)
- Concurrency template: `backend/Picnivo.Tests/Features/Claims/ClaimItem/ClaimItemEndpointTests.cs:28-49`
- Two-event seed template: `backend/Picnivo.Tests/Features/Events/ListEvents/ListEventsEndpointTests.cs:25-45`
- Handler under change: `backend/Picnivo.API/Features/Votes/CastVotes/CastVotes.cs:47-77`
- Exception pipeline: `backend/Picnivo.API/Program.cs:17,61`, `ExceptionHandling/GlobalExceptionHandler.cs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Risk #3 — Authorization boundary tests

#### Automated
- [x] 1.1 Build + client regen succeeds: `dotnet build backend/Picnivo.API`
- [x] 1.2 New RemoveItem/CastVotes tests pass: `dotnet test backend/Picnivo.Tests`
- [x] 1.3 Full backend suite green: `dotnet test backend/Picnivo.Tests`

#### Manual
- [x] 1.4 Cross-event tests fail if the FK filter is removed (assertion is real, not tautological)
- [x] 1.5 Impersonation test clearly labelled accepted-by-design (name + comment cite test-plan §2)

### Phase 2: Risk #4 — Vote-integrity guardrail tests

#### Automated
- [ ] 2.1 Validator + constraint tests pass: `dotnet test backend/Picnivo.Tests`
- [ ] 2.2 Full backend suite green: `dotnet test backend/Picnivo.Tests`

#### Manual
- [ ] 2.3 Constraint test genuinely exercises the Postgres index (would not throw on SQLite)

### Phase 3: Risk #4 — Harden concurrent first-vote race to idempotent success

#### Automated
- [ ] 3.1 Backend builds: `dotnet build backend/Picnivo.API`
- [ ] 3.2 Concurrency test passes after the handler change: `dotnet test backend/Picnivo.Tests`
- [ ] 3.3 Full backend suite green: `dotnet test backend/Picnivo.Tests`

#### Manual
- [ ] 3.4 Reverting the handler change makes the concurrency test fail (verifies the test exercises the hardening)
- [ ] 3.5 No regression in `RepeatedVote_NeverYieldsTwoRows` upsert test
