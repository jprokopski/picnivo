# Claim-path Integrity (Test-Plan Phase 1) — Plan Brief

> Full plan: `context/changes/testing-claim-path-integrity/plan.md`
> Frame brief: `context/changes/testing-claim-path-integrity/frame.md`
> Research: `context/changes/testing-claim-path-integrity/research.md`

## What & Why

Close Test-Plan Phase 1 ("Claim-path integrity"), which must prove two risks: FCFS holds when two participants claim the same item concurrently (Risk #1), and the eligibility gate is server-enforced and unbypassable (Risk #2). Framing settled that both mechanisms are largely already sound — but surfaced one real defect (Branch 2) that must be fixed, not just tested.

## Starting Point

The claim path already works: a claim is a unique-indexed `ItemClaim` INSERT (loser gets 409), and the eligibility gate returns 403 before the INSERT — genuinely server-side, not UI-only. An endpoint race test already proves FCFS against real Postgres. Two gaps remain: (1) on a multi-date event with no locked date, a `Coming` participant can still claim (Branch 2 bug), and an existing test blesses it; (2) the endpoint 409 mapping works only *implicitly* because the test factory omits `.UseExceptionProcessor()`.

## Desired End State

Claiming on a multi-date event with no locked date returns 403 (single-date/locked events unaffected), pinned by a regression test. The full server-enforced eligibility matrix — including Branch 1 (Yes-then-Out → blocked) — is covered, with a Postgres endpoint test proving a direct API call can't skip the gate. The 409 race mapping is explicit and guarded by a deterministic durability test. The test-plan's false "UI-only / bypassable" Risk #2 premise is corrected.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Risk #1 posture | Harden, don't rebuild | Race is already sound (green 3/3 vs Postgres); only the 409 durability is implicit | Frame |
| Risk #2 "bypass" premise | Reframe — false for eligibility | Gate returns 403 before INSERT; only identity is trusted-by-design (Phase 2) | Frame |
| Branch 2 (multi-date, no lock) | It's a bug — fix it | Contradicts FR-009 + design's "claiming opens once date is locked" | Frame |
| Branch 1 (Yes-then-Out) | Intended — pin it | Explicit opt-out overrides a prior Yes by design | Frame |
| Identity/ownership | Out of scope | Accepted friend-group trust model → test-plan Phase 2 | Frame |
| 409 durability hardening | Explicit processor + deterministic test | Guarantees prod parity + removes race-timing dependence | Plan |
| Test-plan §2 wording | Correct it in this phase | Frozen strategy doc shouldn't assert a false premise for future phases | Plan |
| Branch 2 fix packaging | Include in this change | Defect + its regression tests land together as one coherent PR | Plan |

## Scope

**In scope:**
- Server-side locked-date 403 gate in `ClaimItem.cs` (Branch 2 fix) + corrected blessing test + regression test
- Full eligibility matrix at the SQLite handler layer, incl. Branch 1 pin
- Postgres endpoint test proving direct-API server-side enforcement (403, no persisted claim)
- Explicit `.UseExceptionProcessor()` in the test factory + deterministic sequential 409 test
- Correcting `test-plan.md §2` Risk #2 wording

**Out of scope:**
- Authenticating the claim path / binding `participantId` to a principal (Phase 2)
- N-way, claim-vs-release, claim-vs-count-me-out races
- Optimistic-concurrency tokens or explicit transactions
- Frontend `haul.tsx` changes

## Architecture / Approach

One-branch guard in the claim handler (403 when the effective chosen date is null), then test coverage across the two existing harness layers: fast SQLite handler tests for the eligibility matrix, real-Postgres endpoint tests for direct-API enforcement and concurrency. Oracles derive from FR-009/FR-013 and enum semantics, not handler output. Constraint-as-concurrency-control convention is preserved.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Branch 2 fix | Locked-date 403 gate + corrected blessing test + regression test | The guard must not break single-date/locked flows |
| 2. Close Risk #2 | Eligibility matrix + Branch 1 pin + direct-API endpoint test + §2 doc correction | Matrix oracle must not be lifted from the handler (tautology) |
| 3. Harden Risk #1 | Explicit exception processor + deterministic 409 durability test | Explicit processor could double-intercept — verify full suite |

**Prerequisites:** Local Postgres for Testcontainers (Docker); `dotnet test backend/Picnivo.Tests` runnable.
**Estimated effort:** ~1–2 sessions across 3 phases; mostly test code + one small handler guard.

## Open Risks & Assumptions

- Adding `.UseExceptionProcessor()` to `ApiFixture` assumes no double-interception regression — mitigated by running the full suite; fallback is "deterministic test only," leaving the factory untouched.
- Assumes the frame's product-intent call on Branch 2 (multi-date-no-lock = 403) holds; if the team later wants pre-lock claiming, the guard and its test reverse together.

## Success Criteria (Summary)

- A `Coming` participant on a multi-date, unlocked event is rejected (403); single-date/locked flows still succeed.
- An ineligible participant calling the API directly is rejected server-side (403, no claim persisted); the full eligibility matrix incl. Branch 1 is pinned.
- The FCFS race yields exactly one winner + a clean, deterministically-guaranteed 409; the test-plan no longer asserts a false Risk #2 premise.
