# Best-Date Aggregation Correctness (Risk #5) — Plan Brief

> Full plan: `context/changes/testing-aggregation-correctness/plan.md`
> Research: `context/changes/testing-aggregation-correctness/research.md`

## What & Why

Close the test gaps for **risk #5** ("Best-date aggregation miscounts — the wrong 'best'
date is shown") — Phase 3 of the `test-plan.md` phased rollout. The backend ranking rule
has no test pinning its tie-break chain, so a refactor could silently reorder ties, count
`Maybe`, or leak attendance into the tally undetected. This is a **test-only** change.

## Starting Point

The backend (`GetEventByToken.cs`) ranks dates by most-`Yes` → fewest-`No` → earliest-
`StartsAt`, entirely in memory and attendance-blind. The frontend owns the separate
attendance-inclusive "X of N can make it" tally, which is already well-tested (including
the `49244ca` regression). The backend has only a happy-path best-date test; no tie-break,
`Maybe`, or attendance-boundary coverage.

## Desired End State

Rule-derived backend unit tests pin the fewest-No tie-break, the `StartsAt` tie-break, and
`Maybe` inertness, plus a characterization test proving the backend tally ignores
attendance. The frontend null-best-date fallback is covered. §6.5 cookbook is filled in and
Phase 3 reads `complete`.

## Key Decisions Made

| Decision                          | Choice                                 | Why (1 sentence)                                                              | Source   |
| --------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------- | -------- |
| `StartsAt` third tie-break        | Pin as characterization test           | FR-011 only specifies Yes-then-No; a named char. test guards it without over-promising | Plan     |
| Backend attendance-inert test     | Add it                                  | Directly refutes the most likely misreading of risk #5; nearly free           | Plan     |
| Frontend fallback-chain test      | In scope — add one test                 | Closes the last named gap in the aggregation surface                          | Plan     |
| HTTP/Postgres tie-break test      | Unit-only; keep existing HTTP smoke     | Ranking is in-memory and DB-independent — a container adds no signal          | Plan / Research |

## Scope

**In scope:** Four backend unit tests (fewest-No, `StartsAt`, `Maybe`-inert, attendance-
inert); one frontend fallback test; §6.5 cookbook fill-in; Phase 3 status → `complete`.

**Out of scope:** Any production code change; HTTP/Postgres tie-break test; re-testing the
frontend attendance predicate or `49244ca` regression; new test infrastructure.

## Architecture / Approach

All backend tests go into the existing `GetEventByTokenHandlerTests.cs` (handler-test file,
per the "separate handler/endpoint/validator files" lesson), each seeding its own data via
`DbContext`, calling the static `Handle`, and asserting a best-date **derived from the rule**
(oracle hygiene). The frontend test extends `event-detail-view.test.tsx`. No new harnesses.

## Phases at a Glance

| Phase                                        | What it delivers                                        | Key risk                                              |
| -------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| 1. Backend ranking & tie-break coverage      | 4 rule-derived unit tests pinning ranking/tie-break     | Oracle contamination (expected value copied from `Handle`) |
| 2. Frontend fallback test + close-out        | 1 fallback test + §6.5 cookbook + status → `complete`   | Cookbook drifting from the tests actually written     |

**Prerequisites:** None — research is complete; harnesses (`TestDb.Create()`, frontend
`Wrapper`) already exist.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- The `StartsAt` tie-break and attendance-inert tests must be named as characterization
  tests so future readers don't mistake them for FR-011 guarantees.
- Oracle hygiene is the primary quality risk: every expected best-date must be justified by
  the rule, never lifted from handler output.

## Success Criteria (Summary)

- `dotnet test backend/Picnivo.Tests` and `pnpm --dir frontend test` pass with the new tests.
- A refactor that reorders ties, counts `Maybe`, or leaks attendance into the backend tally
  now fails loudly.
- §6.5 documents the pattern; §3 Phase 3 reads `complete`.
