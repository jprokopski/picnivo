<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Authorization Boundaries (Test Plan Phase 2)

- **Plan**: context/changes/testing-authorization-boundaries/plan.md
- **Scope**: Phase 1, 2, 3 of 3 (full plan)
- **Date**: 2026-07-04
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- `dotnet build backend/Picnivo.API` — succeeded (2 pre-existing NU1903 advisory warnings, unrelated to this change).
- `dotnet test backend/Picnivo.Tests` — Passed: 121, Failed: 0, Skipped: 0.
- All six planned changes (RemoveItem cross-event test, CastVotes cross-event/foreign-dateOption/impersonation tests, validator duplicate-DateOptionId test, new CastVotesConstraintTests.cs, CastVotes.cs handler hardening, concurrent first-vote endpoint test) verified MATCH against plan intent by an independent drift-detection sub-agent — no DRIFT, MISSING, or unplanned EXTRA changes found.
- Handler hardening (`CastVotes.cs:57-83`) independently re-read: catches only `UniqueConstraintException`, single non-looping retry, correctly detaches stale `Added` entries before re-querying, `Guid.CreateVersion7()` unchanged.
- git diff for commits f95676f..76200cb touches exactly the files listed in the plan's "Changes Required" sections, plus plan/change/research doc updates — no scope creep.
- Progress section: all checkboxes `[x]` with commit shas that resolve to real commits (f95676f, dfa1956, 76200cb) matching the described work.

## Findings

### F1 — Single-retry window still theoretically racy for a third concurrent caller

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: backend/Picnivo.API/Features/Votes/CastVotes/CastVotes.cs:57-83
- **Detail**: The handler retries exactly once after a `UniqueConstraintException`. If a third caller's insert collided with the retry's own save, that second `UniqueConstraintException` would propagate unhandled to the global handler (409/500) rather than resolving idempotently. This is explicitly the plan's stated design ("the row can only exist after the race resolves") and matches realistic traffic (two simultaneous first-votes, not three), so it's not a defect — just a documented edge the plan chose not to cover.
- **Fix**: None needed — in scope as designed. Optional: a one-line code comment noting the single-retry assumption if a future reader might mistake it for an oversight.
- **Decision**: FIXED — added a comment above the retry `SaveChangesAsync` at CastVotes.cs noting the single-retry/two-caller-race assumption.

### F2 — Duplicated event/participant seed helper across two CastVotes test files

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: backend/Picnivo.Tests/Features/Votes/CastVotes/CastVotesConstraintTests.cs, backend/Picnivo.Tests/Features/Votes/CastVotes/CastVotesEndpointTests.cs
- **Detail**: Both files define a near-identical `SeedEventWithParticipantAsync`-style helper. The project convention ("action folder owns everything... do not share artifacts across action folders") makes this acceptable rather than a violation, since both files already live in the same action folder and per-file duplication here is intentional per lessons ("each test case should compose its own required data").
- **Fix**: None needed — consistent with the documented no-shared-test-helpers convention.
- **Decision**: ACCEPTED — confirmed as intentional convention, no change made.

## Notes

- Manual verification items (1.4, 1.5, 2.3, 3.4, 3.5) are inherently non-artifact-producing (spot-checks: "does the test fail if the guard is removed"). `change.md` documents a genuine spot-check for 2.3 (SQLite also throws `UniqueConstraintException`, contradicting the plan's literal manual-step wording, but the constraint test's design — targeting real Postgres directly — is unaffected). No evidence of rubber-stamping found elsewhere; this is consistent with how manual checks are normally recorded in this project.
- "What We're NOT Doing" boundaries respected: no frontend changes, no Risk #5/aggregation work, no quality-gate wiring, no changes to the accepted friend-group trust model, no cross-event tests added beyond the representative RemoveItem/CastVotes pair.
