# Authorization Boundaries (Test Plan Phase 2) — Plan Brief

> Full plan: `context/changes/testing-authorization-boundaries/plan.md`
> Research: `context/changes/testing-authorization-boundaries/research.md`

## What & Why

Close Test Plan **Phase 2 — Authorization boundaries** (Risks #3 IDOR & #4 vote integrity). The
codebase already *enforces* cross-event isolation and one-vote-per-person-per-date, but has **no
tests** exercising those boundaries — and it carries a latent concurrency defect on the cast-votes
path. This change adds the missing endpoint/integration tests and hardens that one defect.

## Starting Point

Three authority tiers exist (organizer-JWT, item-removal dual-authority, participant token+GUID).
The organizer auth ladder (`SelectFinalDate`) and `RemoveItem` dual-authority matrix are already
pinned. What is untested: cross-event id tampering (event A's id against event B's token), the DB
unique index that actually guards votes, the in-request duplicate-`DateOptionId` rule, and the
accepted within-event impersonation model. The vote upsert also has an unguarded first-vote race.

## Desired End State

Cross-event tampering is proven refused (404 for foreign entity ids, 400 for a foreign dateOption);
the `(ParticipantId, DateOptionId)` unique index is proven to reject a duplicate row; within-event
impersonation is pinned as accepted-by-design; and two simultaneous first-votes both succeed (204)
with exactly one persisted row — no 409/500 leak.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Latent 500/409 vote race | Harden the handler | Phase 2 is uniquely positioned to see and close it | Plan |
| Race resolution status | Idempotent success (re-read + 204) | Both callers wanted the vote recorded; 409 is wrong for an upsert | Plan |
| Cross-event test breadth | Representative pair (RemoveItem + CastVotes) + foreign-dateOption 400 | All participant-writes share one FK-guard pattern; two prove both shapes + the 404-vs-400 boundary | Plan |
| Impersonation coverage | One labelled characterization test on CastVotes | Accepted friend-group model; one test documents the intentional boundary | Plan / Research |
| Constraint proof | Deterministic forced-insert (direct DbContext, real Postgres) | Proves the index independent of handler logic; no concurrency flakiness | Research |

## Scope

**In scope:** Cross-event isolation tests (RemoveItem 404, CastVotes 404, foreign dateOption 400);
impersonation characterization test; validator duplicate-`DateOptionId` test; forced-insert
constraint test; harden `CastVotes.Handle` + concurrent first-vote test.

**Out of scope:** Changing the friend-group trust model; cross-event tests on
SetAttendance/AddItem/ClaimItem/ReleaseClaim (same pattern); re-testing covered ladders; returning
409 for the vote race; frontend; Risk #5 aggregation (Phase 3); quality-gate wiring (Phase 4).

## Architecture / Approach

Two additive test phases (Risk #3, then Risk #4 guardrails) that land without production risk,
followed by one isolated phase with the single production change (handler catch of
`UniqueConstraintException` → reset tracker → reload + update → 204) plus its concurrency proof.
All tests use the real Postgres `ApiFixture` (required for the unique index and race), mirror the
vertical-slice layout, and assert both HTTP status and persisted state.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Risk #3 auth tests | Cross-event 404/400 + impersonation characterization | Tautological assertions that pass regardless of the FK guard |
| 2. Risk #4 guardrail tests | Validator duplicate rule + forced-insert constraint proof | Test not genuinely hitting the Postgres index |
| 3. Harden vote race | Handler catch → idempotent 204 + concurrency test | EF change-tracker not reset before retry (re-throws) |

**Prerequisites:** Research complete (done); real Postgres Testcontainer already provisioned by `ApiFixture`.
**Estimated effort:** ~1–2 sessions across 3 phases (mostly tests; one small handler change).

## Open Risks & Assumptions

- The handler retry must reset EF change-tracker state before the second `SaveChanges`, else it
  re-attempts the failing insert (the one non-obvious implementation point).
- Catch the *translated* `UniqueConstraintException` (from `UseExceptionProcessor`), not raw
  `DbUpdateException`, so other failures still reach the global handler.
- Concurrency/constraint tests depend on real Postgres; SQLite in-memory would not reproduce them.

## Success Criteria (Summary)

- A foreign-event id/token is refused (404), a foreign dateOption is refused (400).
- A duplicate `(participant, dateOption)` row is rejected by the DB index.
- Two simultaneous first-votes both succeed with a single persisted row.
