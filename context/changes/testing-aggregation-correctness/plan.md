# Best-Date Aggregation Correctness (Risk #5) — Test Implementation Plan

## Overview

Close the test gaps for **risk #5** ("Best-date aggregation miscounts — the wrong
'best' date is shown") from `context/foundation/test-plan.md` §3 Phase 3. This is a
**pure test-addition** change: no production code is modified. We pin the backend
ranking rule and its tie-break chain with SQLite-in-memory unit tests, guard the
backend/frontend layer boundary with a characterization test, add one frontend
hero-selection fallback test, then fill in the §6.5 cookbook entry and advance the
Phase 3 status to `complete`.

## Current State Analysis

Risk #5 splits cleanly across two layers (the single most important finding from
`research.md`):

- **Backend** (`GetEventByToken.cs:77-82`) owns *ranking* and *per-date raw vote
  tallies*. Best date = most `Yes` (desc) → fewest `No` (asc) → earliest `StartsAt`
  (asc). Tallies are **raw vote counts only**; the backend is completely
  attendance-blind. Aggregation runs **in memory** (LINQ-to-Objects) after the data
  is loaded, so tie-break ordering is fully deterministic and unit-testable on SQLite
  — no Postgres container needed for ranking logic.
- **Frontend** (`set-attendance/schema.ts` `isEffectivelyComing`) owns the
  attendance-inclusive "X of N can make it" tally. It does **not** rank dates — it
  reads the winner straight from the backend's `bestDateOptionId`, falling back to
  `dateOptions[0]`.

Existing coverage:

- **Backend** — `GetEventByTokenHandlerTests.cs` has a happy-path best-date test
  (`ReturnsTalliesAndBestDateOptionId:70`) and organizer/chosen-date tests, but **no
  test pins any tie-break**, that `Maybe` is inert, or that attendance doesn't move
  the tally. `GetEventByTokenEndpointTests.cs` has the HTTP round-trip smoke
  (`JoinVoteThenGet_ReturnsTalliesBestDateAndYou:44`).
- **Frontend** — `set-attendance/schema.test.ts` covers every `isEffectivelyComing`/
  `isEffectivelyOut` branch; `event-detail-view.test.tsx:455` is the direct `49244ca`
  attendance regression. The only untested gap is the hero-selection fallback chain
  when `bestDateOptionId` is null (fixtures always set it).

## Desired End State

The backend ranking rule is pinned by rule-derived unit tests such that any future
refactor that reorders ties, counts `Maybe`, or leaks attendance into the tally fails
loudly. The frontend null-best-date fallback is covered. `test-plan.md` §6.5 documents
the best-date test pattern, and Phase 3 reads `complete`.

Verify: `dotnet test backend/Picnivo.Tests` and `pnpm --dir frontend test` both pass
with the new tests present; §6.5 is no longer "TBD"; the §3 Phase 3 row Status column
reads `complete`.

### Key Discoveries:

- Ranking chain: `GetEventByToken.cs:77-82` — `OrderByDescending(Yes).ThenBy(No).ThenBy(StartsAt)`.
- Static handler is directly callable in unit tests via alias
  (`GetEventByTokenHandlerTests.cs:1` uses `using GetEventByTokenHandler = ...`), returning
  `Ok<EventDetailResponse>` — the richest existing tally reference is at
  `GetEventByTokenHandlerTests.cs:70` with `DateVote` seeding at `:111-133`.
- Frontend predicate + attendance tally already fully covered; only the
  `chosenDateOptionId ?? bestDateOptionId ?? dateOptions[0]` chain
  (`event-detail-view.tsx:46-48`) lacks a test.
- Oracle hygiene rule (test-plan §2 risk #5): derive every expected best-date from the
  **rule**, never from running `Handle`.

## What We're NOT Doing

- **No production code changes** — this phase only adds tests and updates docs.
- **No HTTP/Postgres tie-break test** — ranking is in-memory and DB-independent; the
  container adds no signal. The existing `JoinVoteThenGet` HTTP smoke stays as-is.
- **No re-testing the frontend attendance predicate or the `49244ca` regression** —
  already covered in `schema.test.ts` and `event-detail-view.test.tsx`.
- **No new test harness or fixtures infrastructure** — reuse `TestDb.Create()` and the
  existing frontend `Wrapper`.
- **Not elevating the `StartsAt` tie-break to a product guarantee** — it is pinned as a
  clearly-named *characterization* test (FR-011 only specifies Yes-then-No).

## Implementation Approach

Two test-writing phases plus a doc-closing step. All backend tests are added to the
existing `GetEventByTokenHandlerTests.cs` (respecting the "separate handler/endpoint/
validator files" lesson — these are all handler tests). Each test seeds its own
`DateOption`/`Participant`/`DateVote` via `DbContext`, calls the static `Handle`, and
asserts against a best-date derived from the ranking rule. The frontend test is added to
the existing component test file. Finally, close out the cookbook and status.

## Critical Implementation Details

- **Oracle derivation is the whole point.** For every backend tie-break test, the
  expected winner must be reasoned from the rule text and written into the fixture
  *before* considering what `Handle` returns. Example: two dates each with 2×`Yes`,
  date A 0×`No`, date B 1×`No` → **A wins by fewest-No**, independent of handler output.
- **Give every fixture date a distinct `StartsAt`** except where the test deliberately
  exercises the `StartsAt` tie-break — this keeps the other tests off the unspecified
  triple-tie stable-sort fallback (`research.md` §"state space" point 4).
- **`Guid.CreateVersion7()`** for seeded ids (matches existing fixtures); ranking never
  depends on id order, so this is only for realistic monotonic ids.

## Phase 1: Backend ranking & tie-break coverage

### Overview

Add rule-derived unit tests to `GetEventByTokenHandlerTests.cs` pinning the fewest-No
tie-break, the `StartsAt` tie-break (as a characterization test), `Maybe` inertness, and
the attendance-inert-to-backend-tally boundary.

### Changes Required:

#### 1. Fewest-No tie-break test

**File**: `backend/Picnivo.Tests/Features/Events/GetEventByToken/GetEventByTokenHandlerTests.cs`

**Intent**: Prove that when two dates have equal `Yes` counts, the one with fewer `No`
votes wins — the FR-011 tie-break. Seed two date options each with 2×`Yes`; give the
loser 1×`No` and the winner 0×`No`. Assert `BestDateOptionId` is the 0-`No` date.

**Contract**: New `[Fact]` following the `ReturnsTalliesAndBestDateOptionId:70` seeding
pattern; calls the aliased static `Handle`, asserts on `Ok<EventDetailResponse>.Value.BestDateOptionId`.
Expected winner derived from the rule, not from `Handle`. Both dates get distinct
`StartsAt` so the No-count is the sole discriminator.

#### 2. `StartsAt` tie-break characterization test

**File**: `backend/Picnivo.Tests/Features/Events/GetEventByToken/GetEventByTokenHandlerTests.cs`

**Intent**: Document (as a characterization test, not a product guarantee) that when two
dates tie on both `Yes` and `No`, the earlier `StartsAt` wins. Name it to signal it is
below the FR-011 line (e.g. `EqualYesAndNo_TieBreaksByEarliestStartsAt_Characterization`).

**Contract**: New `[Fact]`; two dates each 2×`Yes` / 0×`No`, date A `StartsAt` earlier
than date B; assert `BestDateOptionId == A`. Test name must make clear this pins
implementation behavior FR-011 does not specify.

#### 3. `Maybe`-is-inert test

**File**: `backend/Picnivo.Tests/Features/Events/GetEventByToken/GetEventByTokenHandlerTests.cs`

**Intent**: Prove `Maybe` votes never affect ranking. A date with 3×`Maybe` must lose to
a date with 1×`Yes`.

**Contract**: New `[Fact]`; assert `BestDateOptionId` is the 1×`Yes` date and that the
Maybe-heavy date's `MaybeCount` is surfaced (3) while its ranking contribution is zero.

#### 4. Attendance-inert-to-backend-tally characterization test

**File**: `backend/Picnivo.Tests/Features/Events/GetEventByToken/GetEventByTokenHandlerTests.cs`

**Intent**: Guard the backend/frontend boundary against the most likely misreading of
risk #5. Seed a participant with `AttendanceStatus.Coming` and **no** `DateVote`; assert
the date's `YesCount` is unchanged and `BestDateOptionId` is unaffected — the backend
tally is attendance-blind by design.

**Contract**: New `[Fact]`, clearly named as a characterization test (mirrors Phase 2's
accepted-by-design pattern). Seed `Participant { Attendance = AttendanceStatus.Coming }`
with zero votes on the target date; assert `YesCount == 0` (or the pre-seeded vote count)
for that date.

### Success Criteria:

#### Automated Verification:

- Backend tests pass: `dotnet test backend/Picnivo.Tests`
- Backend builds clean: `dotnet build backend/Picnivo.API`
- All four new tests are present and green in `GetEventByTokenHandlerTests.cs`

#### Manual Verification:

- Each new test's expected best-date is derivable from the ranking rule text alone
  (oracle hygiene — no expected value copied from `Handle` output)
- The `StartsAt` and attendance tests are named so a reader sees they are
  characterization tests, not FR-011 guarantees

**Implementation Note**: After Phase 1 automated verification passes, pause for manual
confirmation that oracle hygiene holds before proceeding to Phase 2.

---

## Phase 2: Frontend hero-selection fallback test + phase close-out

### Overview

Add one frontend test for the null-`bestDateOptionId` fallback, then fill in the §6.5
cookbook entry and advance the Phase 3 status to `complete`.

### Changes Required:

#### 1. Hero-selection fallback test

**File**: `frontend/src/features/events/get-event-by-token/components/event-detail-view.test.tsx`

**Intent**: Cover the `chosenDateOptionId ?? bestDateOptionId ?? dateOptions[0]` chain
(`event-detail-view.tsx:46-48`) when both `chosenDateOptionId` and `bestDateOptionId` are
null — the hero must fall back to the first date option rather than rendering nothing.

**Contract**: New test in the existing file, reusing the file's fixture/`Wrapper` setup;
render `EventDetailView` with `chosenDateOptionId: null`, `bestDateOptionId: null`, and ≥2
`dateOptions`; assert the hero renders the first date option.

#### 2. Fill in test-plan §6.5 cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the §6.5 "TBD" with the concrete best-date aggregation test pattern:
backend ranking/tie-break tests belong in `GetEventByTokenHandlerTests.cs` as SQLite
unit tests deriving the expected best-date from the rule; frontend attendance/fallback
tests live in `set-attendance/schema.test.ts` and `event-detail-view.test.tsx`.

**Contract**: §6.5 prose edit; name the reference tests added in Phase 1 and the layer
split; restate the oracle-hygiene anti-pattern ("never derive expected best-date from the
implementation output").

#### 3. Advance Phase 3 status

**File**: `context/foundation/test-plan.md`

**Intent**: Update the §3 Phase 3 row Status column from `researched` to `complete`.

**Contract**: Single-cell edit in the §3 rollout table (Status vocabulary literal
`complete`). Also update `change.md` `status:` to `complete` and `updated:` to today.

### Success Criteria:

#### Automated Verification:

- Frontend tests pass: `pnpm --dir frontend test`
- Frontend type-checks: `pnpm --dir frontend exec tsc --noEmit`
- The new fallback test is present and green in `event-detail-view.test.tsx`

#### Manual Verification:

- §6.5 is filled in (no longer "TBD") and names the Phase 1 reference tests
- §3 Phase 3 Status reads `complete`; `change.md` status is `complete`

**Implementation Note**: After Phase 2 automated verification passes, pause for manual
confirmation that the cookbook entry reads accurately before considering Phase 3 done.

---

## Testing Strategy

### Unit Tests:

- Backend: fewest-No tie-break, `StartsAt` tie-break (characterization), `Maybe` inert,
  attendance-inert-to-tally — all via `TestDb.Create()` + static `Handle`, rule-derived
  oracles.
- Frontend: hero-selection null-best-date fallback via Testing Library.

### Integration Tests:

- None added. The existing `GetEventByTokenEndpointTests.cs` HTTP smoke is retained
  unchanged; ranking is in-memory and DB-independent, so no Postgres tie-break test is
  warranted.

### Manual Testing Steps:

1. Run `dotnet test backend/Picnivo.Tests` — confirm the four new handler tests pass.
2. Run `pnpm --dir frontend test` — confirm the fallback test passes.
3. Read each backend test and confirm the expected winner is justified by the rule text
   in a comment or the test name, not by handler output.

## Performance Considerations

None. Unit tests run in-memory on SQLite; no container spin-up added.

## Migration Notes

None — test-only change.

## References

- Research: `context/changes/testing-aggregation-correctness/research.md`
- Ranking rule: `backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByToken.cs:74-82`
- Tally reference test + seeding: `backend/Picnivo.Tests/Features/Events/GetEventByToken/GetEventByTokenHandlerTests.cs:70,111-133`
- Frontend predicate + fallback: `frontend/src/features/events/set-attendance/schema.ts:21-35`, `frontend/src/features/events/get-event-by-token/components/event-detail-view.tsx:46-48`
- Test plan: `context/foundation/test-plan.md` §2 (risk #5), §3 (Phase 3), §6.5 (cookbook — to fill)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend ranking & tie-break coverage

#### Automated

- [x] 1.1 Backend tests pass: `dotnet test backend/Picnivo.Tests` — 71b641f
- [x] 1.2 Backend builds clean: `dotnet build backend/Picnivo.API` — 71b641f
- [x] 1.3 All four new tests present and green in `GetEventByTokenHandlerTests.cs` — 71b641f

#### Manual

- [x] 1.4 Each new test's expected best-date is derivable from the ranking rule alone (oracle hygiene) — 71b641f
- [x] 1.5 `StartsAt` and attendance tests are named as characterization tests, not FR-011 guarantees — 71b641f

### Phase 2: Frontend hero-selection fallback test + phase close-out

#### Automated

- [x] 2.1 Frontend tests pass: `pnpm --dir frontend test` — 3362e29
- [x] 2.2 Frontend type-checks: `pnpm --dir frontend exec tsc --noEmit` — 3362e29
- [x] 2.3 New fallback test present and green in `event-detail-view.test.tsx` — 3362e29

#### Manual

- [x] 2.4 §6.5 is filled in (no longer "TBD") and names the Phase 1 reference tests — 3362e29
- [x] 2.5 §3 Phase 3 Status reads `complete`; `change.md` status is `complete` — 3362e29
