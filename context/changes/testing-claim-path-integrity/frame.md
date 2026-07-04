# Frame Brief: Claim-path integrity (Test Plan Phase 1 — Risks #1 & #2)

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Test-plan Phase 1 ("Claim-path integrity") must prove two risks:

- **Risk #1** — two participants claim the same item concurrently; both appear
  to succeed, FCFS silently fails, one claim is lost on reload.
- **Risk #2** — the attendance/claim gate admits an ineligible participant or
  blocks an eligible one, *"and the gate is bypassable by calling the API
  directly (UI-only enforcement)."*

## Initial Framing (preserved)

- **User's stated cause or approach**: Both are live, un-protected failure
  scenarios that new integration + concurrency tests must close. Risk #2 is
  framed as a possibly **UI-only** gate a direct API call can skip.
- **User's proposed direction**: Open Phase 1; widen race coverage (N-way,
  claim-vs-release, claim-vs-count-me-out) and build an eligibility matrix +
  a direct-API bypass attempt.
- **Pre-dispatch narrowing**: Leading concern is **Risk #2 (the gate)**. On
  Risk #2, the worry is **gate-correctness only** — the server-side eligibility
  *rule* — not identity spoofing (accepted friend-group model, deferred to
  Phase 2). On Risk #1, scope is **harden the existing race**, not N-way /
  cross-operation.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Gate enforcement layer** — is the eligibility gate server-side or UI-only?
   *(the test plan assumes UI-only; the whole reframe hinges here)* ← initial framing
2. **Eligibility rule semantics** — the two subtle branches; if unintended,
   tests would bless a bug.
3. **FCFS race-test soundness** — does the green race test actually prove FCFS,
   or does the 409-vs-500 factory gap hollow it out?
4. **Identity / ownership boundary** — trusted-from-URL by design; **user
   ruled this out of Phase 1** → on the map, not investigated (accepted trust
   model, overlaps Phase 2).

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Dim 1 — gate is UI-only (initial framing) | `ClaimItem.cs:57-76` runs the eligibility check and returns **403 before** the INSERT at `:78`; no validator, gate is in the handler; frontend `haul.tsx` gate is *parity*, not sole enforcement. Gate is **server-enforced**. | **NONE** (premise false for eligibility) |
| Dim 1′ — *identity/ownership* is UI-only | Endpoint anonymous (`ClaimItemEndpoint.cs:8`, no `.RequireAuthorization()`); `participantId` trusted from URL; no ownership check. Bypassable *as identity*. | STRONG — but **out of Phase 1 scope** (Phase 2) |
| Dim 2 — Branch 1 "Yes-then-Out" is a bug | Archived design `plan.md:157-163,92-95`: Out explicitly overrides a prior Yes by design; count-me-out even releases claims (`SetAttendance.cs:39-57`). | NONE → **INTENDED**, pin it |
| Dim 2 — Branch 2 "multi-date, no locked date" is a bug | Code lets `Coming` alone claim with no locked-date check (`ClaimItem.cs:52-76`, `Event.cs:24-27`); design narrative `plan.md:164-169` says claiming opens only once the date is locked, **server-enforced**; FR-009 (`prd.md:89`) presupposes "the chosen date"; `SetAttendance.cs:37` sets `Coming` with no pre-lock guard; existing test `ClaimItemHandlerTests.cs:32-56` already blesses current behavior. | **STRONG (ambiguity)** → user decided: **BUG** |
| Dim 3 — race test is unsound (409→500) | `ApiFixture.cs:175-181` removes `DbContextOptions` and re-adds `UseNpgsql` **without** `.UseExceptionProcessor()` — *but* EF Core's accumulating `IDbContextOptionsConfiguration` keeps Program's processor interceptor alive; test **passes 3/3**, one 204 / one 409 / one row. | NONE → **SOUND**, harden only |

## Narrowing Signals

- **User: leading concern = Risk #2, gate-correctness only.** Identity spoofing
  is the accepted friend-group trust model → Phase 2, not Phase 1.
- **User: Risk #1 = harden the existing race**, not N-way / cross-operation.
- **User decision on Branch 2: the multi-date-no-locked-date path is a BUG** —
  the server gate should 403 when no final date is resolved. The existing
  `WhenAttendanceComing_AllowsClaim` (2 dates, no chosen date → allowed) test
  is therefore asserting the wrong thing.
- **Agent C falsified the 409-vs-500 suspicion** (evidence reduced scope rather
  than confirming a bias) — a healthy signal the race baseline is real.

## Cross-System Convention

The project's consistent pattern is **constraint-as-concurrency-control**: no
app-level locks or optimistic tokens; correctness under contention is delegated
to DB unique indexes + the exception-processor → ProblemDetails mapping (same
backstop as item de-dup, S-02 Phase 3). Risk #1's guard matches this convention
and is already sound. Eligibility is enforced in the handler (server-side),
consistent with the "gate enforced server-side, not just UI" design intent —
*except* the Branch 2 locked-date gate the narrative promised was never coded.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: assert the *server-enforced
> eligibility rule* is correct across the two PRD paths, **fix and then pin**
> the missing multi-date locked-date gate (Branch 2), and **harden — not
> rebuild** — the already-sound FCFS race. Risk #2's "UI-only enforcement /
> bypassable by direct API" premise is **false for eligibility** and must be
> re-stated; identity/ownership bypass is the accepted friend-group trust
> model, deferred to Phase 2.

Risk #1 is structurally mitigated with a sound green race test — Phase 1
hardens it, it does not build FCFS from zero. Risk #2's eligibility *rule* is
genuinely server-enforced (403 before INSERT), so the planned "direct-API
bypass" test as written would test a premise that doesn't hold; what a direct
API call *can* skip is ownership, which is intentional and belongs to Phase 2.
The one real defect this pass surfaced is Branch 2: on a multi-date event with
no locked date, `Coming` alone lets a claim through, contradicting FR-009 and
the design's own "claiming opens once the date's locked, server-enforced"
narrative — and an existing test currently blesses it.

## Confidence

- **HIGH** — Dim 1 (server-enforced) and Dim 3 (race sound) have strong,
  independently-confirmed, file-grounded evidence and match convention; Dim 2
  Branch 2 was ambiguous but is now a **decided** product-intent call (bug).
  The reframe survived an honest attempt to break it (the 409-vs-500 suspicion
  was falsified, not rationalized away).

## What Changes for /10x-plan

- **Do not** write a "direct API call skips the gate" bypass test framed as
  UI-only — the eligibility gate is server-enforced. Assert the eligibility
  **matrix** server-side (both PRD paths + the ineligible 403) at the handler
  layer, with a direct-API call confirming the gate is not client-dependent.
- **Branch 2 is a fix, not just a test**: add the missing server-side
  locked-date gate (403 when `ResolveEffectiveChosenDateOptionId` is null on a
  multi-date event) and **correct/replace** `ClaimItemHandlerTests
  .WhenAttendanceComing_AllowsClaim` (2-date, no chosen date), which currently
  blesses the bug. Pin Branch 1 (Yes-then-Out → blocked) as intended.
- **Risk #1**: harden the existing 2-way Postgres race; add an explicit
  assertion that the loser is specifically **409** (guarding the *implicit*
  exception-processor durability Agent C flagged). N-way / claim-vs-release /
  claim-vs-count-me-out are **out of Phase 1 scope**.
- **Recommend the test plan's Risk #2 wording be re-stated** to separate
  "eligibility rule (server-enforced — assert correctness)" from "identity/
  ownership (trusted-by-design — Phase 2)".

## References

- Gate (403 before INSERT): `backend/Picnivo.API/Features/Claims/ClaimItem/ClaimItem.cs:57-76,78-89`
- Anonymous endpoint / identity trusted from URL: `Features/Claims/ClaimItem/ClaimItemEndpoint.cs:8`
- Effective-chosen-date resolver: `backend/Picnivo.API/Data/Models/Event.cs:24-27`
- Unguarded attendance setter (Branch 2 reachability): `Features/Participants/SetAttendance/SetAttendance.cs:37`
- Existing test that blesses Branch 2: `backend/Picnivo.Tests/Features/Claims/ClaimItem/ClaimItemHandlerTests.cs:32-56`
- Race test + factory: `backend/Picnivo.Tests/Features/Claims/ClaimItem/ClaimItemEndpointTests.cs:43-48`; `backend/Picnivo.Tests/ApiFixture.cs:175-181`
- Constraint guard: `Data/Configurations/ItemClaimConfiguration.cs:15`; exception→409: `ExceptionHandling/ProblemDetails/UniqueConstraintProblemDetails.cs:7`
- Design intent: `context/archive/2026-07-02-participant-voting-and-claims/plan.md:92-95,157-169`
- PRD: `context/foundation/prd.md:89` (FR-009), `:92` (FR-013), `:77` (FR-004)
- Related research: `context/changes/testing-claim-path-integrity/research.md`
- Investigation tasks: #1 (gate layer), #2 (eligibility semantics), #3 (race soundness)
