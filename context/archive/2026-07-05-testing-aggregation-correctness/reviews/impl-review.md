<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Best-Date Aggregation Correctness (Risk #5) — Test Implementation Plan

- **Plan**: context/changes/testing-aggregation-correctness/plan.md
- **Scope**: Phase 1 and Phase 2 of 2 (full plan)
- **Date**: 2026-07-05
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

None. Both review sub-agents (Plan Drift Detection; Safety, Quality & Pattern Compliance) returned zero findings across all four planned backend tests, the one planned frontend test, and the two planned doc edits.

## Evidence

### Plan Adherence

All four backend tests in `backend/Picnivo.Tests/Features/Events/GetEventByToken/GetEventByTokenHandlerTests.cs` match planned intent exactly:

- `WithEqualYesCounts_TieBreaksByFewestNo` (L150) — fewest-No tie-break, oracle derived from the rule (comment at L242-243), not from `Handle`.
- `EqualYesAndNo_TieBreaksByEarliestStartsAt_Characterization` (L248) — StartsAt tie-break, named/commented as a characterization test below the FR-011 line.
- `MaybeVotes_AreInertToRanking` (L333) — Maybe-heavy date loses to 1×Yes date; `MaybeCount` surfaces as 3 while contributing zero to ranking.
- `AttendanceStatus_DoesNotMoveBackendTally_Characterization` (L432) — participant with `Attendance = Coming` and no `DateVote`; `YesCount` and `BestDateOptionId` unaffected.

Frontend: `event-detail-view.test.tsx` (L174-194) adds `"falls back to the first date option when neither chosenDateOptionId nor bestDateOptionId is set"`, reusing the existing `baseEvent`/`Wrapper` fixtures, asserting the hero renders the first date option.

Docs: `test-plan.md` §6.5 is filled in (no longer "TBD"), names all four Phase 1 reference tests, restates the backend/frontend layer split and the oracle-hygiene anti-pattern verbatim. §3 Phase 3 Status reads `complete`. `change.md` had `status: complete`, `updated: 2026-07-05`.

### Scope Discipline

`git diff --stat 71b641f^..330d1cd` touches only: the two planned test files, `test-plan.md`, and the change's own process docs (`change.md`, `plan.md`, `plan-brief.md`, `research.md` — created by this change, not undocumented extras). No production source file under `backend/Picnivo.API/` or `frontend/src/` was modified — confirmed independently by both sub-agents and by direct inspection.

### Safety & Quality

Each of the four backend tests seeds its own Organizer/Event/Participants/DateVotes independently via `DbContext` (no shared fixtures); `TestDb.Create()` disposes correctly. Tests relying on `.First()`/`.Last()` on unordered `DateOptions` are self-consistent (same variables used for seeding and assertion), matching the existing `ReturnsTalliesAndBestDateOptionId` pattern. The one test needing chronological order adds explicit `.OrderBy(d => d.StartsAt)`. No security, performance, reliability, or data-safety findings.

### Architecture

Test-only change; no module boundaries or dependency direction affected.

### Pattern Consistency

All four backend tests use the `GetEventByTokenHandler` alias (no double-name references), visible Arrange/Act/Assert structure, `var` throughout, correctly placed in the handler test file per the "separate test files for handler/endpoint/validator" lesson. Frontend test reuses existing fixture/Wrapper setup and semantic queries (`getByRole`), no reinvented harness.

### Success Criteria

**Automated** (re-run during this review):
- `dotnet test backend/Picnivo.Tests --filter "FullyQualifiedName~GetEventByToken"` — Passed: 17, Failed: 0.
- `pnpm --dir frontend test -- get-event-by-token` — 24 test files, 174 tests passed.
- `pnpm --dir frontend exec tsc --noEmit` — clean, no errors.

**Manual**:
- Every new test's expected best-date is derivable from the ranking rule text alone (oracle hygiene confirmed by inline comments and independent agent read).
- StartsAt and attendance tests are clearly named/commented as characterization tests, not FR-011 guarantees.
- §6.5 accurately names the Phase 1 reference tests; §3 Phase 3 Status and `change.md` status both read `complete`.
