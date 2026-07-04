<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Claim-path Integrity (Test-Plan Phase 1) Implementation Plan

- **Plan**: context/changes/testing-claim-path-integrity/plan.md
- **Scope**: Phase 2 of 3
- **Date**: 2026-07-04
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Undocumented correction to a pre-existing test's seed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: backend/Picnivo.Tests/Features/Claims/ClaimItem/ClaimItemHandlerTests.cs:24
- **Detail**: Alongside the two planned additions, this diff also changes the pre-existing `WhenNotComingAndNoYesVote_ReturnsForbidden` from `SeedEventAsync(db, dateOptionCount: 2)` to `dateOptionCount: 1`. This is a real, necessary fix: with 2 date options and no `ChosenDateOptionId`, `Event.ResolveEffectiveChosenDateOptionId` (`Event.cs:24-27`) returns `null`, so the test was actually asserting the Phase-1 "no chosen date" 403 guard (duplicating `WhenMultiDateAndNoChosenDate_ReturnsForbidden`), not the "Undecided, no Yes vote" ineligibility branch its name and the new eligibility-matrix comment (`ClaimItemHandlerTests.cs:10-16`) claim it covers. Both review sub-agents independently verified the fix is correct and required to make the matrix-completeness claim in item #2 of the plan actually true — but the Phase 2 plan text only describes *adding* new tests/comments, not correcting this existing one (unlike Phase 1, which explicitly called out correcting `WhenAttendanceComing_AllowsClaim`).
- **Fix**: Add a short note to the Phase 2 "Eligibility matrix completeness check" plan section documenting that `WhenNotComingAndNoYesVote_ReturnsForbidden`'s seed was corrected from `dateOptionCount: 2` to `1` to fix an oracle ambiguity (same pattern as the Phase 1 correction note for `WhenAttendanceComing_AllowsClaim`).
- **Decision**: FIXED — added correction note to plan.md Phase 2 §2 "Eligibility matrix completeness check"

### F2 — §3 rollout table not updated per plan's own Migration Notes

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/test-plan.md:66
- **Detail**: The plan's Migration Notes state: "§3 Phase 1 status advances to reflect this rollout phase landing." The §2 Risk #2 wording was corrected (confirmed), but the §3 Phased Rollout table row for "1 | Claim-path integrity" still reads `Status: not started`, `Change folder: —` — stale, since `change.md` for this change is at `status: impl_reviewed` and phases 1-2 have landed.
- **Fix**: Update the §3 table row 1 to `Status: implementing` (Phase 3 remains) and `Change folder: context/changes/testing-claim-path-integrity`.
- **Decision**: FIXED — updated test-plan.md §3 row 1 to Status: implementing, Change folder: context/changes/testing-claim-path-integrity

## Verification Evidence

- `dotnet build backend/Picnivo.API` — not re-run standalone; covered by `dotnet test` build step, succeeded.
- `dotnet test backend/Picnivo.Tests` — **Passed! Failed: 0, Passed: 113, Skipped: 0, Total: 113** (5s).
- `WhenVotedYesButAttendanceOut_ReturnsForbidden` — exists (`ClaimItemHandlerTests.cs:126-162`), passes.
- `WhenIneligible_DirectApiCall_Returns403` — exists (`ClaimItemEndpointTests.cs:52-71`), passes; asserts 403 and no persisted `ItemClaim`.
- `test-plan.md §2` no longer contains "UI-only enforcement" / "bypassable by calling the API directly" — confirmed via grep, zero matches.
- Eligibility-gate math independently verified: the new `SeedEventWithIneligibleParticipantAsync` seeds a single-date event with no explicit `ChosenDateOptionId`; `Event.ResolveEffectiveChosenDateOptionId` auto-resolves the sole date, so the 403 in `WhenIneligible_DirectApiCall_Returns403` comes from the genuine ineligibility branch (Undecided, no Yes vote), not an accidental trip of the Phase 1 null-chosen-date guard.
- `§3 Phase 2` cross-reference in the corrected test-plan.md wording resolves to a real section ("Authorization boundaries", test-plan.md:67) — not dangling.

### Manual (unchanged by this review — pending user confirmation per plan)

- [ ] 2.5 `test-plan.md §2` Risk #2 wording reads coherently against the server-enforced reality
- [ ] 2.6 Eligibility matrix comment/tests read as an intentional oracle (FR-009/FR-013), not lifted from handler output
