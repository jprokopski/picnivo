# Claim-path Integrity (Test-Plan Phase 1) Implementation Plan

## Overview

Close Test-Plan Phase 1 ("Claim-path integrity"), which must prove two risks:

- **Risk #1 (FCFS under contention)** — two participants claim the same item concurrently; exactly one wins, the other gets a clean rejection, and persisted state shows a single claimant.
- **Risk #2 (eligibility gate)** — the server-enforced eligibility gate admits every eligible participant and rejects every ineligible one, and cannot be skipped by a client that talks to the API directly.

Framing (see `frame.md`) already settled the diagnostics: Risk #1's race is **already sound** (harden, don't rebuild); Risk #2's eligibility rule is **already server-enforced** (assert its correctness, don't chase a false "UI-only bypass"); and the one real defect the frame surfaced is **Branch 2** — on a multi-date event with no locked date, a `Coming` participant can claim, contradicting FR-009 and the design's "claiming opens once the date is locked" narrative, with an existing test currently blessing it.

This plan fixes Branch 2 (production code), builds the server-side eligibility matrix across both test harness layers, hardens the implicit 409 durability the race test depends on, and corrects the test-plan's false Risk #2 premise.

## Current State Analysis

**Risk #1 — already structurally mitigated.**
- A claim is an INSERT of an `ItemClaim` row (`ClaimItem.cs:78-89`), guarded solely by the unique index `IX_ItemClaims_EventItem` (`Data/Configurations/ItemClaimConfiguration.cs:15`). No optimistic token, no explicit transaction, no read-check-write TOCTOU on the claim itself — correctness under contention is delegated to the DB constraint (project's "constraint-as-concurrency-control" convention).
- The loser's `SaveChangesAsync` throws a unique-violation → typed `UniqueConstraintException` (via `Program.cs:16-17` `.UseExceptionProcessor()`) → mapped to **409** (`ProblemDetails/UniqueConstraintProblemDetails.cs:7`).
- `ClaimItemEndpointTests.RaceForSameItem_OneWinsOneGetsConflict` (`ClaimItemEndpointTests.cs:27-49`) already fires two parallel claims and asserts exactly one 204, one 409, and one persisted row, against a real Postgres Testcontainer — green 3/3.
- **The one fragility**: `CustomWebApplicationFactory` (`ApiFixture.cs:181`) re-registers `UseNpgsql(connectionString)` **without** `.UseExceptionProcessor()`. The frame confirmed the 409 mapping survives anyway (EF Core's accumulating `IDbContextOptionsConfiguration` keeps `Program`'s processor alive), so the mapping works — but **implicitly and undocumented**. A future EF upgrade could silently drop it and turn the 409 into a 500.

**Risk #2 — server-enforced, but one real bug.**
- The eligibility gate at `ClaimItem.cs:57-76` returns 403 **before** the INSERT (`:78`). Not UI-only. Frontend `haul.tsx:53-62` mirrors it as parity, not sole enforcement.
- The two PRD paths in code: (a) `Attendance == Coming` (`:57`); (b) `Attendance == Undecided` + a `Yes` `DateVote` on the effective chosen date (`:58-71`).
- Effective chosen date: `Event.ResolveEffectiveChosenDateOptionId(chosen, dateOptionIds)` = `chosen ?? (dateOptionIds.Count == 1 ? single : null)` (`Event.cs:24-27`). Single-date events treat their lone date as chosen (FR-004); multi-date events with no organizer-locked date resolve to **null**.
- **Branch 2 defect**: when `chosenDateOptionId` is null (multi-date, no lock), path (b) is skipped but path (a) `Coming` still lets a claim through — `ClaimItem.cs` has **no** guard requiring a resolved chosen date. This contradicts FR-009 ("the chosen date") and the archived design narrative ("claiming opens only once the date is locked, server-enforced"). `ClaimItemHandlerTests.WhenAttendanceComing_AllowsClaim` (`:32-56`, seeded `dateOptionCount: 2`, no chosen date, `Coming` → asserts `NoContent`) currently **blesses** this bug.
- **Branch 1** (intended): path (b) is only evaluated when `Attendance == Undecided` (`:60`), so a participant who voted `Yes` but later set `Out` is blocked — explicit opt-out wins. Intended per archived design; currently **unpinned** by any test.
- **Identity is out of scope**: the endpoint is anonymous (`ClaimItemEndpoint.cs:8`), `participantId` is trusted from the URL, and `SetAttendance`/`CastVotes` are unauthenticated. This cross-participant trust is the **accepted friend-group model** (archived cross-device-identity change) → deferred to test-plan Phase 2. This plan asserts the eligibility *rule*, never treats identity spoofing as a vuln.

**Test harness (Phase 1 starts from a real baseline).**
- Endpoint tests → real Postgres 16 via Testcontainers (`ApiFixture`, `[Collection("Api")]`, `ctx.CheckOutAsync()`), using the NSwag-generated `PicnivoApiClient` (`ctx.ApiClient` unauthenticated). Real migrations run, so the real unique index exists.
- Handler tests → in-memory SQLite via `TestDb.Create()` (`.UseExceptionProcessor()` with the SQLite exceptions package), calling `ClaimItem.Handle(...)` directly.
- `ClaimItemHandlerTests.SeedEventAsync(db, dateOptionCount, attendance, token)` and `ClaimItemEndpointTests.SeedEventWithTwoComingParticipantsAsync(services, token)` are the existing seed helpers.

### Key Discoveries:

- The Branch 2 fix is a **one-branch guard** in `ClaimItem.cs`: reject with 403 when `chosenDateOptionId` is null, before the eligibility evaluation. Single-date events are unaffected (they always resolve non-null). — `ClaimItem.cs:52-76`, `Event.cs:24-27`
- `WhenAttendanceComing_AllowsClaim` (`ClaimItemHandlerTests.cs:32-56`) uses `dateOptionCount: 2` with no chosen date — it is the test that currently blesses Branch 2 and **must be corrected**, not merely supplemented.
- The 409 mapping in endpoint tests is **implicit** — the factory omits `.UseExceptionProcessor()` but it survives via EF's accumulating config. Making it explicit at `ApiFixture.cs:181` is the Risk #1 hardening. — `ApiFixture.cs:169-191`
- `WhenAlreadyClaimed_ThrowsUniqueConstraintException` (`ClaimItemHandlerTests.cs:158-196`) proves the constraint at the **SQLite handler** layer sequentially; the endpoint layer has only the *probabilistic* race test, no *deterministic* sequential 409 assertion.
- Oracle hygiene (test-plan §2): expected outcomes for the eligibility matrix derive from FR-009/FR-013 and enum semantics, **not** from re-running the handler.

## Desired End State

When this plan is complete:

- Claiming on a **multi-date event with no locked date returns 403** even for a `Coming` participant; single-date and locked-date events are unaffected. A regression test pins this, and no test asserts the old (buggy) behavior.
- The **server-enforced eligibility matrix** is fully covered at the handler layer: `Coming` → allowed, `Undecided`+`Yes`-on-chosen → allowed, single-date `Coming` → allowed, ineligible (no `Yes`, not `Coming`) → 403, and **Branch 1** (`Yes`-then-`Out`) → 403 (pinned as intended).
- A **direct API call** by an ineligible participant is rejected with 403 at the Postgres endpoint layer — proving the gate is server-side, not client-dependent.
- The FCFS race's **409 mapping is explicit and guaranteed** (`CustomWebApplicationFactory` re-adds `.UseExceptionProcessor()`), and a **deterministic** sequential duplicate-claim → 409 endpoint test guards durability independent of race timing. The existing probabilistic race test still passes.
- `test-plan.md §2` no longer asserts the false "UI-only / bypassable by direct API" premise for Risk #2; it separates the server-enforced eligibility rule from the trusted-by-design identity model (Phase 2).

Verify: `dotnet test backend/Picnivo.Tests` is green; the corrected/added tests exist and assert the outcomes above; `test-plan.md §2` reads correctly.

## What We're NOT Doing

- **Not** authenticating the claim path or binding `participantId` to a principal. Identity/ownership is the accepted friend-group trust model → test-plan Phase 2 (Authorization boundaries).
- **Not** writing a "direct API call skips the gate" bypass test framed as UI-only — the premise is false for eligibility. The direct-API test asserts the gate *holds* server-side, not that it's bypassable.
- **Not** widening Risk #1 to N-way races, claim-vs-release, or claim-vs-count-me-out. The frame scoped Phase 1 to hardening the existing 2-way race. No generalized parallel-request helper is built here.
- **Not** adding optimistic-concurrency tokens or explicit transactions to the claim path — constraint-as-concurrency-control is the deliberate convention and is sound.
- **Not** touching the frontend `haul.tsx` gate — it is parity, and its behavior is unchanged by the Branch 2 fix (it already computes eligibility from `chosenDateOptionId`).

## Implementation Approach

Three phases, ordered by dependency and risk:

1. **Fix-first**: land the Branch 2 production fix and re-point the test that blesses it, so the codebase never sits in a state where a green test asserts the bug.
2. **Close Risk #2**: complete the eligibility matrix at the cheap SQLite handler layer, add the one Postgres endpoint test that proves server-side enforcement, and correct the test-plan doc.
3. **Harden Risk #1**: make the 409 mapping explicit and add a deterministic durability test.

Each phase is independently verifiable via `dotnet test` and leaves the suite green.

## Critical Implementation Details

- **Branch 2 guard placement & status.** The guard must reject with **403** (not 404/409/400 — consistent with the existing ineligibility 403) and sit **after** `ResolveEffectiveChosenDateOptionId` resolves (`ClaimItem.cs:52-55`) and **before** the INSERT. Placing it before the `isComing` evaluation is simplest: a null effective chosen date means claiming is not open, regardless of attendance. Single-date events resolve non-null and are unaffected — confirm `WithSingleDateEvent_AllowsClaimAfterConfirm`, `ClaimingClearsOrphanStamp`, and `WhenAlreadyClaimed_ThrowsUniqueConstraintException` (all `dateOptionCount: 1`) stay green.
- **Correcting `WhenAttendanceComing_AllowsClaim` (do not just add a test).** This test currently seeds `dateOptionCount: 2` with no chosen date and asserts `NoContent` — it blesses Branch 2. To keep it a valid "Coming → allowed" matrix cell, give it a resolved chosen date (either `dateOptionCount: 1`, or set `ChosenDateOptionId` on the seeded event). The Branch 2 *rejection* is pinned by a separate new test.
- **Exception-processor double-registration risk.** Adding `.UseExceptionProcessor()` at `ApiFixture.cs:181` while `Program`'s config already contributes one could, in principle, double-wrap the interceptor. Verify by running the **full** `Picnivo.Tests` suite after the change — the existing race test and every endpoint test must stay green, and the new deterministic 409 test must pass. If double-interception surfaces (e.g. an exception is wrapped twice or a test regresses), fall back to the "deterministic test only" path and leave the factory unchanged.

## Phase 1: Fix the Branch 2 locked-date gate

### Overview

Add the missing server-side guard that rejects a claim when no effective chosen date exists (multi-date, unlocked), correct the handler test that currently blesses the bug, and pin the fix with a regression test.

### Changes Required:

#### 1. Claim handler — locked-date gate

**File**: `backend/Picnivo.API/Features/Claims/ClaimItem/ClaimItem.cs`

**Intent**: After resolving the effective chosen date, reject with 403 when it is null — claiming is not open until the organizer locks a date on a multi-date event. This closes Branch 2 while leaving single-date events (which resolve non-null) untouched.

**Contract**: New guard between the `ResolveEffectiveChosenDateOptionId` call (`:52-55`) and the `isComing` evaluation (`:57`): `if (chosenDateOptionId is null) return Results.StatusCode(StatusCodes.Status403Forbidden);`. Response contract unchanged (endpoint already `.Produces(403)`).

#### 2. Correct the test that blesses Branch 2

**File**: `backend/Picnivo.Tests/Features/Claims/ClaimItem/ClaimItemHandlerTests.cs`

**Intent**: Re-point `WhenAttendanceComing_AllowsClaim` (`:32-56`) so it tests a genuine "Coming → allowed" cell with a resolved chosen date, instead of asserting the now-rejected multi-date-no-lock path.

**Contract**: Change the seed so the effective chosen date is non-null — either `dateOptionCount: 1` with `attendance: Coming`, or keep two dates and set `event.ChosenDateOptionId`. Assertion stays `NoContent` + one persisted claim.

#### 3. Regression test pinning the Branch 2 fix

**File**: `backend/Picnivo.Tests/Features/Claims/ClaimItem/ClaimItemHandlerTests.cs`

**Intent**: Add a test proving a `Coming` participant on a multi-date event with no locked date is now rejected with 403.

**Contract**: New `[Fact]` `WhenMultiDateAndNoChosenDate_ReturnsForbidden` — seed `dateOptionCount: 2`, `attendance: Coming`, no `ChosenDateOptionId`; call `ClaimItem.Handle`; assert `StatusCodeHttpResult` with `403`. Oracle derives from FR-009 + the design's locked-date rule, not from handler output.

### Success Criteria:

#### Automated Verification:

- [ ] Backend builds: `dotnet build backend/Picnivo.API`
- [ ] All backend tests pass: `dotnet test backend/Picnivo.Tests`
- [ ] `WhenMultiDateAndNoChosenDate_ReturnsForbidden` exists and passes
- [ ] No remaining test asserts `NoContent` for a multi-date, no-chosen-date, `Coming` claim

#### Manual Verification:

- [ ] Confirm single-date and locked-date claim flows still work in the running app (claim succeeds when a date is locked / event is single-date)
- [ ] Confirm a multi-date event with no locked date rejects a claim attempt (403), matching the design intent

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Close Risk #2 — eligibility matrix, direct-API bypass, doc correction

### Overview

Complete the server-enforced eligibility matrix at the SQLite handler layer (pinning Branch 1), prove the gate holds against a direct API call at the Postgres endpoint layer, and correct the test-plan's false Risk #2 premise.

### Changes Required:

#### 1. Pin Branch 1 (Yes-vote-then-Out → blocked)

**File**: `backend/Picnivo.Tests/Features/Claims/ClaimItem/ClaimItemHandlerTests.cs`

**Intent**: Pin the intended semantics that an explicit `Out` overrides a prior `Yes` vote — the participant is blocked even though they voted Yes on the chosen date.

**Contract**: New `[Fact]` `WhenVotedYesButAttendanceOut_ReturnsForbidden` — seed a chosen date, add a `Yes` `DateVote` on it, set `attendance: Out`; assert `StatusCodeHttpResult` 403. Mirrors the setup of `WhenVotedYesOnChosenDate_AllowsClaim` (`:58-93`) with attendance flipped to `Out`.

#### 2. Eligibility matrix completeness check

**File**: `backend/Picnivo.Tests/Features/Claims/ClaimItem/ClaimItemHandlerTests.cs`

**Intent**: Confirm the matrix now covers every cell explicitly; add only what is missing after Phase 1. Existing cells: `Coming`→allowed (corrected in Phase 1), `Undecided`+`Yes`→allowed (`:58`), single-date `Coming`→allowed (`:95`), ineligible→403 (`:12`), Branch 2→403 (Phase 1), Branch 1→403 (above).

**Contract**: No new test if the matrix is complete after the above; document the covered matrix in a short comment at the top of the eligibility-related tests. Add a cell only if a gap is found (e.g. `Undecided`+`No`-vote → 403 if not implied by the ineligible case).

#### 3. Direct-API bypass confirmation (server-side enforcement)

**File**: `backend/Picnivo.Tests/Features/Claims/ClaimItem/ClaimItemEndpointTests.cs`

**Intent**: Prove the eligibility gate is enforced server-side over the real HTTP boundary — an ineligible participant calling the endpoint directly (via `ctx.ApiClient`, no client-side gate in the loop) is rejected with 403.

**Contract**: New `[Fact]` `WhenIneligible_DirectApiCall_Returns403` — seed an event with a participant whose `Attendance` is `Undecided` and no `Yes` vote (extend or add a seed helper alongside `SeedEventWithTwoComingParticipantsAsync`); call `ctx.ApiClient.ClaimItemAsync(token, itemId, participantId)`; assert the thrown `ApiException.StatusCode == 403`. Also assert no `ItemClaim` row was persisted.

#### 4. Correct test-plan §2 Risk #2 wording

**File**: `context/foundation/test-plan.md`

**Intent**: Remove the false "bypassable by calling the API directly (UI-only enforcement)" premise from Risk #2 and separate the server-enforced eligibility rule from the trusted-by-design identity model (deferred to Phase 2).

**Contract**: Edit the Risk #2 row in the §2 Risk Map table and its §2 Risk Response Guidance row: re-state as "the eligibility gate admits an ineligible participant or blocks an eligible one" (server-enforced — assert correctness), and note that cross-participant identity is the accepted friend-group trust model verified under Authorization boundaries (§3 Phase 2). Do not alter risk ordering, impact/likelihood, or other rows.

### Success Criteria:

#### Automated Verification:

- [ ] All backend tests pass: `dotnet test backend/Picnivo.Tests`
- [ ] `WhenVotedYesButAttendanceOut_ReturnsForbidden` exists and passes
- [ ] `WhenIneligible_DirectApiCall_Returns403` exists and passes, asserting 403 and no persisted claim
- [ ] `test-plan.md §2` no longer contains "UI-only enforcement" / "bypassable by calling the API directly" for Risk #2

#### Manual Verification:

- [ ] Read `test-plan.md §2` end-to-end; the Risk #2 wording reads coherently and does not contradict the server-enforced reality
- [ ] Confirm the eligibility matrix comment/tests read as an intentional oracle (derived from FR-009/FR-013), not lifted from handler output

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Harden Risk #1 — 409 durability

### Overview

Make the endpoint-layer 409 mapping explicit and guaranteed, and add a deterministic (non-raced) durability test so the mapping is guarded independent of race timing.

### Changes Required:

#### 1. Explicit exception processor in the test factory

**File**: `backend/Picnivo.Tests/ApiFixture.cs`

**Intent**: Re-add `.UseExceptionProcessor()` when `CustomWebApplicationFactory` re-registers the Postgres DbContext, so the unique-violation → 409 mapping matches prod (`Program.cs:16-17`) explicitly rather than relying on EF's accumulating-config side effect.

**Contract**: At `:181`, change `options => options.UseNpgsql(connectionString)` to also call `.UseExceptionProcessor()` (EntityFramework.Exceptions.PostgreSQL — same package/namespace `Program.cs` uses). No other factory changes.

#### 2. Deterministic sequential 409 durability test

**File**: `backend/Picnivo.Tests/Features/Claims/ClaimItem/ClaimItemEndpointTests.cs`

**Intent**: Guard the 409 mapping deterministically at the endpoint layer — claim once (204), then a second eligible participant claims the same item sequentially and receives a clean 409. Complements the probabilistic race test by removing timing dependence.

**Contract**: New `[Fact]` `SecondClaimOnClaimedItem_Returns409` — reuse `SeedEventWithTwoComingParticipantsAsync`; `await ctx.ApiClient.ClaimItemAsync(token, itemId, aliceId)` (expect success), then `SafeClaimAsync(ctx.ApiClient, token, itemId, bobId)` and assert the result is `409`; assert exactly one persisted `ItemClaim` for the item.

### Success Criteria:

#### Automated Verification:

- [ ] All backend tests pass: `dotnet test backend/Picnivo.Tests`
- [ ] Existing `RaceForSameItem_OneWinsOneGetsConflict` still passes (no double-interception regression)
- [ ] `SecondClaimOnClaimedItem_Returns409` exists and passes, asserting 409 and exactly one persisted claim
- [ ] Full suite green after the `ApiFixture` change (verifies no cross-test regression from the explicit processor)

#### Manual Verification:

- [ ] Re-run the endpoint suite 2–3 times to confirm the race test remains stable and the deterministic test is not flaky
- [ ] Confirm (by reading `ApiFixture.cs`) that the exception-processor registration now visibly matches `Program.cs` prod wiring

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation. This completes Phase 1 of the test-plan rollout.

---

## Testing Strategy

### Unit / Handler Tests (SQLite, fast):

- Eligibility matrix: `Coming`→allowed, `Undecided`+`Yes`-on-chosen→allowed, single-date `Coming`→allowed, ineligible→403.
- Branch 1: `Yes`-then-`Out`→403 (explicit opt-out wins).
- Branch 2: multi-date, no locked date, `Coming`→403 (the fix).

### Integration / Endpoint Tests (Postgres Testcontainer):

- Direct-API bypass: ineligible participant → 403 over real HTTP, no persisted claim.
- FCFS race (existing): two parallel claims → one 204, one 409, one row.
- Deterministic durability (new): sequential second claim → 409, one row.

### Manual Testing Steps:

1. Run the app; on a multi-date event with no locked date, attempt to claim as a `Coming` participant → expect rejection (403).
2. Lock a date (organizer `SelectFinalDate`), then claim as a `Coming` or `Yes`-voting participant → expect success.
3. On a single-date event, claim as a `Coming` participant → expect success (unaffected by the fix).
4. Set a `Yes`-voter's attendance to `Out`, then attempt to claim → expect rejection.

## Performance Considerations

None. Changes are a single added guard (one comparison) in the claim handler and test-only additions. No new queries, no added round-trips. The Postgres Testcontainer tests reuse the existing pooled-DB fixture.

## Migration Notes

- **Behavior change**: claiming on a multi-date event with no locked date now returns 403 where it previously succeeded. This is a bug fix aligning with FR-009 and the design's server-enforced locked-date rule; no data migration is required (no schema change). Existing claims are unaffected.
- **Test-plan doc**: `test-plan.md §2` Risk #2 wording is corrected in Phase 2; §3 Phase 1 status advances to reflect this rollout phase landing.

## References

- Frame brief: `context/changes/testing-claim-path-integrity/frame.md`
- Research: `context/changes/testing-claim-path-integrity/research.md`
- Claim handler / gate: `backend/Picnivo.API/Features/Claims/ClaimItem/ClaimItem.cs:52-89`
- Effective-chosen-date resolver: `backend/Picnivo.API/Data/Models/Event.cs:24-27`
- Test that blesses Branch 2: `backend/Picnivo.Tests/Features/Claims/ClaimItem/ClaimItemHandlerTests.cs:32-56`
- Existing race test + factory: `backend/Picnivo.Tests/Features/Claims/ClaimItem/ClaimItemEndpointTests.cs:27-49`; `backend/Picnivo.Tests/ApiFixture.cs:169-191`
- 409 mapping: `backend/Picnivo.API/ExceptionHandling/ProblemDetails/UniqueConstraintProblemDetails.cs:7`; `backend/Picnivo.API/Program.cs:16-17`
- Test-plan spec: `context/foundation/test-plan.md` §2, §3 Phase 1, §6.2–6.4

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Fix the Branch 2 locked-date gate

#### Automated

- [x] 1.1 Backend builds: `dotnet build backend/Picnivo.API` — 5166fad
- [x] 1.2 All backend tests pass: `dotnet test backend/Picnivo.Tests` — 5166fad
- [x] 1.3 `WhenMultiDateAndNoChosenDate_ReturnsForbidden` exists and passes — 5166fad
- [x] 1.4 No remaining test asserts `NoContent` for a multi-date, no-chosen-date, `Coming` claim — 5166fad

#### Manual

- [ ] 1.5 Single-date and locked-date claim flows still work in the running app
- [ ] 1.6 Multi-date event with no locked date rejects a claim attempt (403)

### Phase 2: Close Risk #2 — eligibility matrix, direct-API bypass, doc correction

#### Automated

- [ ] 2.1 All backend tests pass: `dotnet test backend/Picnivo.Tests`
- [ ] 2.2 `WhenVotedYesButAttendanceOut_ReturnsForbidden` exists and passes
- [ ] 2.3 `WhenIneligible_DirectApiCall_Returns403` exists and passes (403 + no persisted claim)
- [ ] 2.4 `test-plan.md §2` no longer contains "UI-only enforcement" / "bypassable by calling the API directly" for Risk #2

#### Manual

- [ ] 2.5 `test-plan.md §2` Risk #2 wording reads coherently against the server-enforced reality
- [ ] 2.6 Eligibility matrix comment/tests read as an intentional oracle (FR-009/FR-013), not lifted from handler output

### Phase 3: Harden Risk #1 — 409 durability

#### Automated

- [ ] 3.1 All backend tests pass: `dotnet test backend/Picnivo.Tests`
- [ ] 3.2 Existing `RaceForSameItem_OneWinsOneGetsConflict` still passes (no double-interception regression)
- [ ] 3.3 `SecondClaimOnClaimedItem_Returns409` exists and passes (409 + exactly one persisted claim)
- [ ] 3.4 Full suite green after the `ApiFixture` change

#### Manual

- [ ] 3.5 Endpoint suite re-run 2–3 times confirms race test stability and no flakiness
- [ ] 3.6 `ApiFixture.cs` exception-processor registration visibly matches `Program.cs` prod wiring
