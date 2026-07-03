<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Participant Voting and Item Claims (S-02)

- **Plan**: context/changes/participant-voting-and-claims/plan.md
- **Scope**: Phase 1 of 7 — Data Model & Migration
- **Date**: 2026-07-02
- **Verdict**: APPROVED
- **Findings**: 0 critical 1 warning 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — AttendanceStatus/VoteChoice stored as raw int

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: Data/Configurations/ParticipantConfiguration.cs (Attendance), Data/Configurations/DateVoteConfiguration.cs (Choice)
- **Detail**: `Participant.Attendance` (AttendanceStatus) and `DateVote.Choice` (VoteChoice) are persisted as plain `integer` columns — no `.HasConversion<string>()` anywhere in either config, confirmed in the migration (`b.Property<int>`) and generated SQL. These are the first enums in the model, so nothing existing is violated, but storing enum ordinals is fragile: inserting or reordering a member of `AttendanceStatus`/`VoteChoice` later would silently corrupt every persisted vote/attendance row. Both independent review agents flagged this. Tables are currently empty, so it's free to fix now and expensive after Phase 2+ writes real rows.
- **Fix A ⭐ Recommended**: Add `.HasConversion<string>()` to `Attendance` and `Choice` in both configs, then regenerate the migration.
  - Strength: Removes the reordering-corruption class entirely, at zero data-loss cost since no rows exist yet — this is the last free moment to do it.
  - Tradeoff: Slightly larger columns, no compile-time exhaustiveness on the SQL side; requires editing the just-generated migration (recreate or hand-patch the two columns).
  - Confidence: HIGH — standard EF Core mitigation; the plan already leans on DB-level integrity elsewhere (unique indexes for vote/claim guardrails), consistent with that philosophy.
  - Blind spot: Haven't checked whether the OpenAPI/NSwag-generated frontend client assumes int enums — but frontend consumption doesn't start until Phase 4+, so there's no existing consumer to break.
- **Fix B**: Leave int storage; record "never reorder, only append" as a lesson and move on.
  - Strength: No migration rework needed right now; phase stays minimal.
  - Tradeoff: Leaves a live footgun for any future contributor (or agent) who adds/reorders an enum member without realizing it corrupts stored data.
  - Confidence: MEDIUM — depends on trusting future changes to always append rather than insert/reorder.
  - Blind spot: None significant.
- **Decision**: SKIPPED

## Success Criteria Verification

- ✅ `dotnet build` — succeeds
- ✅ `dotnet ef database update` — migration applied cleanly
- ✅ Migration reverts cleanly — verified rollback + re-apply round trip
- ✅ `dotnet test` — 23/23 passing
- ⏳ Manual 1.5 (DB inspection) — unchecked, correctly pending per plan's pause note
