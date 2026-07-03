<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Participant Voting and Item Claims (S-02)

- **Plan**: context/changes/participant-voting-and-claims/plan.md
- **Scope**: Phase 4 of 7 — Frontend: Join & Participant Identity
- **Date**: 2026-07-02
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Automated verification (re-run)

- `pnpm exec tsc --noEmit` — pass
- `pnpm lint` — pass (only pre-existing `react-refresh` warnings)
- `pnpm test` — 64/64 pass
- `pnpm extract && pnpm compile` — pass (123 messages, 0 missing)
- `dotnet build` — pass
- `dotnet test` — 96/96 pass

Matches plan items 4.1–4.3, 4.6. Item 4.4 is falsely checked — see F4. Manual items 4.7/4.8 correctly left unchecked, pending.

## Findings

### F1 — Participant identity swapped from localStorage to httpOnly cookies, undocumented

- **Severity**: WARNING
- **Impact**: HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence
- **Location**: frontend/src/lib/participant/cookie.ts
- **Detail**: Plan specified `lib/participant/token.ts` (+`token.test.ts`): browser localStorage token with `getParticipantId`/`setParticipantId`/`clearParticipantId(eventToken)`, SSR-safe via a `window` guard. Actual implementation is `cookie.ts`: an httpOnly server-side cookie (`getParticipantIdCookie`/`setParticipantIdCookie`) via `@tanstack/react-start/server`. `token.ts` doesn't exist. `clearParticipantId` has no equivalent anywhere. Nothing in the plan documents this swap. This changes the mechanism for every future mutation (Phases 5-6): server functions must read the cookie server-side, and must stay POST/PUT (never GET) since `sameSite: lax` is the only CSRF mitigation in place.
- **Fix A ⭐ Recommended**: Keep the cookie approach; add a plan addendum documenting the swap and rationale, and fill the test gap (see F4).
  - Strength: httpOnly defeats XSS-based token theft, removes need for `window` SSR guard — stronger than the plan's original design. Reuses the established `getCookie`/`setCookie` pattern from `lib/supabase/server.ts`.
  - Tradeoff: `clearParticipantId` silently dropped rather than consciously descoped.
  - Confidence: HIGH — both review passes independently reached the same conclusion.
  - Blind spot: Whether a later phase's design (`WebGuestExit`, count-me-out recovery) implicitly assumed the client could read/clear its own participant id.
- **Fix B**: Revert to the plan's literal localStorage/`token.ts` design.
  - Strength: Matches the approved plan exactly; no addendum needed.
  - Tradeoff: Throws away a strictly more secure implementation for no functional gain.
  - Confidence: LOW — no evidence this is actually preferable.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — plan.md addendum added under Phase 4 item 1 documenting the cookie swap, rationale, and the dropped `clearParticipantId`.

### F2 — Organizer auto-joins their own event as a Participant (unplanned)

- **Severity**: WARNING
- **Impact**: HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Scope Discipline
- **Location**: backend/Picnivo.API/Features/Events/CreateEvent/CreateEvent.cs:21-49, backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByToken.cs:22,83
- **Detail**: `CreateEvent` now creates a `Participant` row for the organizer at event-creation time and returns `ParticipantId`; join-event frontend stores it as the organizer's own participant cookie. `GetEventByToken` also now exposes `OrganizerId` (needed for `isOrganizer` — reasonable). Neither is mentioned in the Phase 4 plan (or any phase); it modifies `CreateEvent.cs`, whose phase (Phase 1) was already reviewed and closed. Every event will show `ParticipantCount ≥ 1` and the organizer's name in `ParticipantNames` from creation — before any guest joins. Phase 7's dashboard card ("N going", crew avatar stack) and Phase 6's crew Coming/Can't-make-it split will render the organizer mixed in with real guests unless filtered. Design references show the organizer only in a "hosted by" kicker, never in the crew list.
- **Fix A ⭐ Recommended**: Keep it; add a plan addendum explaining the rationale (organizer needs a ParticipantId to vote/claim on their own event), and explicitly flag in Phase 6/7 plan sections that `ParticipantCount`/crew lists include the organizer so those phases design for it intentionally.
  - Strength: Solves a real gap — without this the organizer has no way to vote or claim items on their own event page.
  - Tradeoff: Inflates "N going" and crew lists by one on every fresh event, which may not match design intent.
  - Confidence: MEDIUM — the underlying need is real; whether "auto-join as Participant" is the right mechanism is a product call.
  - Blind spot: Haven't confirmed against Phase 5/6 design mockups whether they show/hide the organizer in the crew list.
- **Fix B**: Revert; defer organizer-participant identity to whichever phase (5 or 6) first requires the organizer to vote/claim, and decide UX there.
  - Strength: Keeps Phase 4 scoped to what it says; avoids baking in an assumption before the dependent UI exists.
  - Tradeoff: Already-passing tests (`CreateEventHandlerTests.AddsOrganizerAsParticipant`, updated `CreateEventEndpointTests`) would need to be pulled too.
  - Confidence: MEDIUM — clean but costs real progress.
  - Blind spot: Whether Phase 5's hero/vote-control components already assume `event.you` exists for the organizer.
- **Decision**: FIXED via Fix A — plan.md addendum added under Phase 4 item 3, plus explicit notes added to the Phase 6 and Phase 7 Overview sections flagging that `participants[]`/`ParticipantCount` include the organizer.

### F3 — New Organizer lookup in CreateEvent can throw unhandled on a timing edge case

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: backend/Picnivo.API/Features/Events/CreateEvent/CreateEvent.cs:21-24
- **Detail**: `db.Organizers.Where(o => o.Id == organizerId).Select(o => o.DisplayName).FirstAsync(ct)` throws `InvalidOperationException` if no matching organizer row exists yet. Per backend/CLAUDE.md, `organizers` is provisioned by a `handle_new_user()` trigger on `auth.users` INSERT — if a brand-new user calls "create event" before that row is visible, this throws, and `GlobalExceptionHandler` has no mapping for `InvalidOperationException`, falling to a generic 500. No test covers this path.
- **Fix**: Change to `FirstOrDefaultAsync` and return an explicit problem response if null, rather than relying on an unhandled exception to surface as a generic 500.
  - Strength: Turns a confusing 500 into a diagnosable, intentional error response; cheap, localized change.
  - Tradeoff: Adds a branch that may never trigger if the trigger is transactionally synchronous with signup (unconfirmed).
  - Confidence: MEDIUM — plausible risk, real-world likelihood unverified.
  - Blind spot: Haven't inspected the actual `handle_new_user()` trigger SQL to confirm synchronicity.
- **Decision**: FIXED — `CreateEvent.cs` now uses `FirstOrDefaultAsync` and returns `Results.Unauthorized()` when no organizer row exists (matching the existing early-return style used for the missing-`sub`-claim case). Added `ReturnsUnauthorizedWhenOrganizerNotYetProvisioned` test in `CreateEventHandlerTests.cs`; all 17 CreateEvent tests pass.

### F4 — Progress checklist claims token/cookie tests exist; they don't

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/participant-voting-and-claims/plan.md:868 (item 4.4); frontend/src/lib/participant/cookie.ts
- **Detail**: Progress item `4.4 Token util tests: set/get/clear round-trip; SSR-safe returns null` is checked `[x]`. No test file exists for `cookie.ts` anywhere in the repo (confirmed via grep across all test files). `getParticipantIdCookie`/`setParticipantIdCookie` ship with zero direct unit coverage.
- **Fix**: Write `cookie.test.ts` covering set/get round-trip (mocking `@tanstack/react-start/server`'s `getCookie`/`setCookie`) and per-event namespacing.
- **Decision**: FIXED — added `frontend/src/lib/participant/cookie.test.ts` (4 tests: read namespaced id, undefined when unset, safe cookie options on write, independent namespacing per event token). Full suite now 68/68 passing.

### F5 — Minor unrelated tooling/infra changes bundled into this phase

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: dev.sh:20-27, backend/Picnivo.API/ExceptionHandling/GlobalExceptionHandler.cs:8
- **Detail**: `dev.sh` gained a `kill_tree` helper (verified correct, no injection/cycle risk). `GlobalExceptionHandler.cs` gained a `[RequiresUnreferencedCode]` annotation (accurate but currently has no functional effect — no `PublishTrimmed`/`PublishAot`). Both harmless, unrelated to "Join & Participant Identity" scope.
- **Fix**: No action needed; noted for scope hygiene only.
- **Decision**: SKIPPED — acknowledged, no action needed.
