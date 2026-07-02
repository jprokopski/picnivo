<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Participant Voting and Item Claims (S-02)

- **Plan**: context/changes/participant-voting-and-claims/plan.md
- **Scope**: Phase 3 of 7 (Backend — Claims, Attendance Recovery, Items & Lock Date)
- **Date**: 2026-07-02
- **Verdict**: NEEDS ATTENTION (all findings resolved during triage)
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Automated verification (re-run during review)

- `dotnet build` — pass
- `dotnet test` — 95/95 pass (Testcontainers Postgres + SQLite handler tests)
- `dotnet ef database update` / revert to previous migration / re-apply — clean round-trip

## Findings

### F1 — Generic exception catch bypasses the plan's constraint-scoped check

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: backend/Picnivo.API/Features/Claims/ClaimItem/ClaimItem.cs:71-84 (original)
- **Detail**: The plan explicitly said to catch the unique violation scoped to `IX_ItemClaims_EventItem`, mirroring S-01's constraint-name check, and to avoid a generic catch-all. The code caught a bare `DbUpdateException` and re-queried to guess whether it was a conflict — any unrelated `SaveChanges` failure would be misrouted through the "maybe already claimed" path.
- **Fix**: Catch `UniqueConstraintException` (from `EntityFrameworkCore.Exceptions.PostgreSQL`, already wired via `UseExceptionProcessor()` in `Program.cs`).
- **Decision**: FIXED

  Implementation note: `ConstraintName`/`ConstraintProperties` are documented as never populated on SQLite (used by the fast `TestDb` unit tests), only on Postgres. Applying the initial name-scoped guard (`ex.ConstraintName == "IX_ItemClaims_EventItem"`) broke `ClaimItemHandlerTests.WhenAlreadyClaimed_ReturnsConflict` on SQLite. Resolved by:
  1. Adding `EntityFrameworkCore.Exceptions.Sqlite` to `Picnivo.Tests.csproj` and wiring `.UseExceptionProcessor()` into `TestDb.cs`, so the SQLite test path also throws typed exceptions (parity with production).
  2. Catching `UniqueConstraintException` by type alone (no name filter) in `ClaimItem.cs` — `ItemClaims` has only one relevant unique index, so this is still far more precise than the original blanket catch and works identically on both providers.
  Verified: full suite (95/95) passes, including the Postgres-backed `ClaimItemEndpointTests.RaceForSameItem_OneWinsOneGetsConflict` and the SQLite-backed handler test.

### F2 — Unplanned tooling/lesson/test changes outside Phase 3 scope

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: backend/.editorconfig (new), backend/Picnivo.API/Picnivo.API.csproj, backend/Picnivo.Tests/Picnivo.Tests.csproj, backend/context/foundation/lessons.md, backend/Picnivo.Tests/Features/{Events/CreateEvent,Participants/JoinEvent,Votes/CastVotes}/*ValidatorTests.cs
- **Detail**: Phase 3's plan only lists the 4 features (SetAttendance, ClaimItem/ReleaseClaim, AddItem/RemoveItem, SelectFinalDate). The working tree also adds `StyleCop.Analyzers`, a new `.editorconfig`, two new lessons.md entries, and a retroactive `TestValidateAsync` refactor of three Phase 1/2 validator test files — none in Phase 3's "Changes Required." Verified low-risk (clean diffs, all tests pass).
- **Fix**: Document as a short addendum to the plan.
- **Decision**: SKIPPED (user judged not worth documenting now)

### F3 — AddItem cap/dedupe checks are TOCTOU races with no DB backstop

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: backend/Picnivo.API/Features/Items/AddItem/AddItem.cs:37-49 (original)
- **Detail**: Unlike `ItemClaim` (backed by `IX_ItemClaims_EventItem`), `AddItem`'s case-insensitive dedupe was a plain `CountAsync`/`AnyAsync` check with no DB-level backstop — two concurrent adds with the same label could both succeed. Genuinely new concurrency surface vs. S-01 (whose cap check was single-request, in-memory, on event creation).
- **Fix**: Add a unique index on `(EventId, lower(Label))`.
- **Decision**: FIXED

  Implementation:
  1. `EventItemConfiguration.cs`: added a stored computed shadow column `NormalizedLabel` (`lower("Label")`) and a unique index `IX_EventItems_Event_NormalizedLabel` on `(EventId, NormalizedLabel)`.
  2. Migration `AddEventItemNormalizedLabelUniqueIndex` generated and applied; verified clean revert + re-apply.
  3. `AddItem.cs`: wrapped `SaveChangesAsync` in a `try/catch (UniqueConstraintException)` returning `Conflict()` as a race backstop, alongside the existing pre-check for the happy-path early return.
  The 50-item cap race was intentionally left as-is — the plan's own Performance Considerations section accepts "friend-group scale, low QPS," and fixing the cap race would need a different mechanism (e.g. serializable transaction) disproportionate to this observation's severity.
  Verified: full suite (95/95) passes; migration round-trips cleanly.

## Summary

3 of 4 planned Phase 3 changes (SetAttendance, AddItem/RemoveItem, SelectFinalDate) matched the plan cleanly on first read. ClaimItem/ReleaseClaim matched on gate logic and orphan handling but had one real deviation (F1) from the plan's explicit exception-handling instruction, now fixed. One scope-discipline note (F2, unplanned tooling/lessons housekeeping) was raised and consciously skipped. One reliability observation (F3, AddItem race) was raised and fixed with a DB-backed unique index, mirroring the pattern already established for `ItemClaim`. All automated success criteria pass; manual item 3.8 (end-to-end HTTP flow) remains correctly pending per the plan's own "pause for manual confirmation" note.
