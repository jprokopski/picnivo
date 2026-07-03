<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Participant Voting and Item Claims (S-02)

- **Plan**: context/changes/participant-voting-and-claims/plan.md
- **Scope**: Phase 5 of 7 — Voting Hub (Summary Layout, Reaction Voting, Best-Date Hero)
- **Date**: 2026-07-03
- **Verdict**: NEEDS ATTENTION (all findings fixed during triage)
- **Findings**: 0 critical, 4 warnings, 0 observations

All Phase 5 work was uncommitted at review time (working-tree diff, not a
merged commit range).

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING (F3) |
| Scope Discipline | WARNING (F4) |
| Safety & Quality | WARNING (F2) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | FAIL (F1) |

## Findings

### F1 — Lint actually fails; Progress checklist claims it passes

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: frontend/src/features/events/get-event-by-token/components/share-aside.tsx:17-19
- **Detail**: `pnpm lint` failed with `react-hooks/set-state-in-effect` on the effect that deferred `window.location.origin` resolution to avoid an SSR hydration mismatch. Plan Progress item 5.2 was checked `[x]` despite this.
- **Fix A ⭐ Recommended**: Resolve the origin server-side and pass the full share URL down as a prop, eliminating the client-only effect.
- **Decision**: FIXED via Fix A. Added `getShareOriginFn` (`get-event-by-token/functions.ts`, uses `getRequestUrl()` from `@tanstack/react-start/server`), threaded `shareUrl` through the `/e/$token` loader → `EventDetailView` → `ShareAside`. `ShareAside` no longer needs `useEffect`/`useState` for the URL or a `token` prop. `pnpm lint` now passes with 0 errors.

### F2 — Vote/lock mutations fail silently, no user-facing error

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: frontend/src/features/events/vote-on-dates/components/vote-control.tsx:45-51, frontend/src/features/events/get-event-by-token/components/best-hero.tsx:37-44
- **Detail**: `castVotesFn`/`selectFinalDateFn` return `{ error }` but neither component surfaced it — a failed vote or lock silently reset with zero feedback. `join-bar.tsx` already had an established `error` + `role="alert"` pattern for this exact failure shape.
- **Fix**: User chose a toast-based approach over replicating join-bar's inline alert.
- **Decision**: FIXED differently — wired up the existing (previously unused) `sonner`/shadcn `Toaster` in `__root.tsx`, and both `VoteControl.handleChange` and `BestHero.handleLock` now call `toast.error(result.error || t\`Something went wrong. Please try again.\`)` on failure and skip `router.invalidate()`. Added an error-path test to each component's test file (`vote-control.test.tsx`, `best-hero.test.tsx`) asserting `toast.error` is called and `invalidate` is not. 88/88 tests pass.

### F3 — Undocumented backend behavior change: implicit organizer "yes" for announcements

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByToken.cs:52-62
- **Detail**: `CountFor` adds +1 to `YesCount` for single-date (announcement) events, treating the organizer as an implicit yes-voter. Implemented and tested, but missing from plan.md's Phase 2 addenda, which already document two other Phase-5-driven reworks of this closed phase.
- **Fix**: Extend the existing addendum block to also cover this change.
- **Decision**: FIXED — added a third addendum under Phase 2 item 3 in plan.md documenting the implicit-yes-count rule, its rationale (consistency with the frontend's parallel `yesVoterNamesFor` logic), and its test coverage.

### F4 — Unplanned change to a Phase 7 file: `target="_blank"` removed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: frontend/src/features/events/list-events/components/event-card.tsx:41
- **Detail**: `target="_blank"` (added in S-01) was removed from the dashboard card's event link, ahead of Phase 7's start, with no documentation.
- **Fix**: Add a note to the Phase 7 section explaining why same-tab navigation is now preferred.
- **Decision**: FIXED — added a "Note (from Phase 5 review, 2026-07-03)" to the Phase 7 Overview explaining the change is intentional (preserves `router.invalidate()`-driven hub state) and instructing Phase 7 not to reintroduce `target="_blank"`.

## Re-verified success criteria (post-fix)

- `pnpm typecheck` — pass
- `pnpm lint` — pass (0 errors, pre-existing warnings only)
- `pnpm test` — 88/88 pass
- `dotnet build` — pass
- `dotnet test` (GetEventByToken suite) — 13/13 pass
- `pnpm extract && pnpm compile` — pass (catalogs refreshed; no new/missing strings)

Manual verification items (5.8–5.10) remain correctly pending per the plan's
own "pause for manual confirmation before Phase 6" note.
