<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Participant Voting and Item Claims (S-02)

- **Plan**: context/changes/participant-voting-and-claims/plan.md
- **Scope**: Phase 2 of 7 — Backend: Join, Voting & Read Models
- **Date**: 2026-07-02
- **Verdict**: NEEDS ATTENTION (all findings triaged and resolved during this review)
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Summary

All 4 planned Phase 2 changes (JoinEvent, CastVotes, extended GetEventByToken,
extended ListEvents) match the plan with no scope creep. Claimed test coverage
verified against real assertions, not just test names. `dotnet build` and
`dotnet test` (47/47) pass. Manual verification step 2.7 remains pending
(unchanged by this review — organizer's own HTTP-client pass).

## Findings

### F1 — CastVotes upsert lacks duplicate/race guard

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: backend/Picnivo.API/Features/Votes/CastVotes/CastVotes.cs:44-66
- **Detail**: `existing` votes are fetched once before the loop and never updated
  as new `DateVote`s are added within it. A same-request payload with two votes
  for the same `dateOptionId`, or two near-simultaneous requests for a
  brand-new `(participant, dateOption)` pair, both insert and trip the unique
  index as an unhandled 500 — nothing catches it despite `Program.cs:16` wiring
  `UseExceptionProcessor()`.
- **Fix A ⭐ Recommended**: Reject duplicate `dateOptionId`s within one request
  in `CastVotesValidator`.
  - Strength: Deterministically closes the same-request duplicate case with a
    one-line validator rule; no new exception-handling pattern needed.
  - Tradeoff: Doesn't address the rarer cross-request race.
  - Confidence: HIGH.
  - Blind spot: Cross-request race remains open; low probability at
    friend-group scale.
- **Fix B**: Also wrap `SaveChangesAsync` in a try/catch for the
  unique-constraint exception and retry as an update on conflict.
  - Strength: Closes both cases, matching the plan's reliance on the unique
    index as a real backstop.
  - Tradeoff: Introduces a new exception-handling pattern with no precedent
    elsewhere in this codebase.
  - Confidence: MEDIUM.
  - Blind spot: Exact exception surface of `UseExceptionProcessor()` in this
    EF Core version unverified.
- **Decision**: FIXED via Fix A — added `.Must(...)` distinct-`DateOptionId`
  rule to `CastVotesValidator.cs`.

### F2 — Vote validator accepts the `Invalid` sentinel as a valid choice

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: backend/Picnivo.API/Features/Votes/CastVotes/CastVotesValidator.cs:12-15;
  backend/Picnivo.API/Data/Models/VoteChoice.cs:3
- **Detail**: `VoteChoice.Invalid = 0` is a real enum member, so `IsInEnum()`
  accepts `Choice = 0`. A request that omits `choice` or explicitly sends `0`
  is accepted, silently consumes that participant's vote slot, and never
  counts toward tallies.
- **Fix**: Add `.NotEqual(VoteChoice.Invalid)` to the `Choice` rule.
- **Decision**: FIXED — added to `CastVotesValidator.cs:18`.

### F3 — Best-date tiebreak has no stable secondary sort

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByToken.cs:56-60
- **Detail**: `bestDateOptionId` orders an EF projection with no explicit
  `ORDER BY`. Postgres doesn't guarantee row order absent one, so fully-tied
  dates (typically pre-voting) can return a different "leading" date between
  identical requests.
- **Fix**: Add a final `.ThenBy(d => d.StartsAt)` for deterministic ordering.
- **Decision**: FIXED — added at `GetEventByToken.cs:59`.

### F4 — ListEvents fetches all participants before capping to 6 in memory

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Performance
- **Location**: backend/Picnivo.API/Features/Events/ListEvents/ListEvents.cs:34,46
- **Detail**: The aggregate query pulls every participant's `{DisplayName,
  CreatedAt}` per event, capping to 6 afterward in memory. Still one round
  trip (no N+1) — fine at friend-group scale.
- **Fix attempted**: Moved `OrderBy(CreatedAt).Take(6)` into the EF projection
  to cap server-side. This broke the SQLite-backed handler tests — SQLite
  cannot translate `ORDER BY` on `DateTimeOffset` inside a subquery (the
  Postgres-backed endpoint tests would have been fine). Reverted.
- **Decision**: SKIPPED (reverted attempted fix) — left as in-memory capping,
  matching the original LOW-impact recommendation. Worth revisiting only if
  event sizes ever grow past friend-group scale, and then via a
  SQLite-compatible approach (e.g. ordering by `Id` instead of `CreatedAt`,
  since `Participant.Id` is a time-ordered GUID v7).

## Verification performed

- `dotnet build` — pass
- `dotnet test` — 47/47 pass (after all fixes)
