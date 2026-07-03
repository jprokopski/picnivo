<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Cross-Device RSVP Identity

- **Plan**: context/changes/cross-device-rsvp-identity/plan.md
- **Scope**: Phase 1 of 3
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

## Findings

### F1 — Defensive "no IsOrganizer participant" branch is untested

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: backend/Picnivo.API/Features/Events/GetMyParticipant/GetMyParticipant.cs:36
- **Detail**: The handler defensively returns `NotFound` when `resolved.ParticipantId is null` (event exists, caller is the organizer, but no `IsOrganizer` participant row exists). All four plan-mandated test cases are covered (organizer→id, other user→404, unauthenticated→401, unknown token→404), but this defensive branch has no test. In practice `CreateEvent` always creates exactly one `IsOrganizer` participant, so the branch is near-unreachable — this is consistent with the plan, which lists the branch but not a test for it.
- **Fix**: Optional — add a test seeding an event with no `IsOrganizer` participant and asserting the organizer gets 404. Low value given the branch is defensive; acceptable to leave as-is.
- **Decision**: FIXED — added `OrganizerWithNoOrganizerParticipant_Returns404` test + `SeedEventWithoutOrganizerParticipantAsync` helper. Suite now 5/5.

### F2 — Endpoint does not document the 401 response in OpenAPI

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: backend/Picnivo.API/Features/Events/GetMyParticipant/GetMyParticipantEndpoint.cs:12
- **Detail**: `.RequireAuthorization()` makes the endpoint return 401 for unauthenticated callers (verified by the passing `Unauthenticated_Returns401` test), and the handler can also return `Results.Unauthorized()` for an unparseable `sub`. The endpoint declares `.Produces<GetMyParticipantResponse>()` and `.Produces(404)` but not `.Produces(401)`, so the generated OpenAPI spec / client won't advertise the 401. This matches the plan's contract exactly (plan specified only 200 + 404), and the client still surfaces the 401 as an `ApiException` at runtime — so this is cosmetic spec completeness, not a behavioral gap.
- **Fix**: Optional — add `.Produces(StatusCodes.Status401Unauthorized)` for spec completeness. Skip if the codebase doesn't consistently document auth failures on other authed endpoints.
- **Decision**: FIXED — added `.Produces(StatusCodes.Status401Unauthorized)` to the endpoint; spec regenerated on build.
