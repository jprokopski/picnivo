<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Event Creation and Sharing (S-01)

- **Plan**: context/changes/event-creation-and-sharing/plan.md
- **Scope**: Phase 6 of 6 (Events Dashboard & Public Event Page)
- **Date**: 2026-07-02
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Misleading "voting open" status text with no voting feature

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: frontend/src/features/events/list-events/components/event-card.tsx:29
- **Detail**: The plan's "What We're NOT Doing" list explicitly excludes "vote-derived status chips" from this phase (S-02 owns voting). The card's `whenLabel` renders `` t`${dateOptionCount} dates · voting open` `` whenever an event has more than one date option — promising a "voting" feature that doesn't exist yet in the shipped product. This isn't just scope creep, it's user-facing copy that overstates functionality.
- **Fix**: Drop the `· voting open` suffix; render just the date count (e.g. `${dateOptionCount} dates`) until S-02 actually ships voting.
- **Decision**: FIXED — removed the "· voting open" suffix in `event-card.tsx:29`.

### F2 — Filter tabs (All/Ongoing/Past) reintroduce scope explicitly excluded by plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Scope Discipline
- **Location**: frontend/src/features/events/list-events/components/events-list.tsx:14-45,65-97
- **Detail**: The plan's "What We're NOT Doing" states: *"No rich dashboard — no All/Ongoing/Past filters ... Just a simple card list."* The implementation adds exactly this filter UI (`role="tablist"`, all/ongoing/past tabs with counts, default `"ongoing"`). It matches `frontend/context/foundation/design/picnivo-web-events.jsx`'s `WEB_FILTERS` 1:1 — genuinely careful pixel-level fidelity, not sloppy. The Phase 6 design-fidelity addendum ("mock wins" when mock and plan diverge) plausibly justifies this, but the addendum requires any deliberate deviation to be an "explicit, called-out exception" — this one wasn't called out anywhere, so it reads as silent scope creep rather than a documented decision. Two normative documents (plan prose vs. design mock) now disagree and nothing records which one governs going forward.
- **Fix A ⭐ Recommended**: Keep the filters (already built, tested, and pixel-matched to the mock) and update `plan.md`'s Phase 6 "What We're NOT Doing" bullet with a note that the design-fidelity addendum superseded the original "no filters" scope call, so future reviews don't re-flag this.
  - Strength: Preserves already-implemented, well-tested work; the addendum's own "mock wins" language was written specifically to resolve this class of conflict.
  - Tradeoff: The original scope note (no rich dashboard, PRD had no filter requirement) was presumably deliberate — keeping filters expands surface area (more UI states, more to keep in sync with future vote/status data in S-02) earlier than planned.
  - Confidence: HIGH — the addendum text is unambiguous about mock precedence, and the implementation quality (tests cover filter behavior) suggests this was a considered choice, not an oversight.
  - Blind spot: Whether the PRD or roadmap owner actually wants filters in S-01, or intended them for S-02 alongside real vote-derived data.
- **Fix B**: Strip the filter tabs back to a flat list per the plan's literal text, and note in the plan that the mock's filter UI is deferred to when S-02 supplies real ongoing/past semantics.
  - Strength: Keeps strict scope discipline; avoids shipping filter UI before there's vote/status data to make "ongoing" meaningful.
  - Tradeoff: Discards tested, working code; `isPastEvent()`'s date-only heuristic isn't wrong, so the loss is more about premature complexity than a functional bug.
  - Confidence: MEDIUM — depends on whether the PRD actually wants a minimal S-01 dashboard, which the plan's own scope note suggests but the mock contradicts.
  - Blind spot: Haven't checked the PRD/roadmap text directly for a stated position on dashboard filters in S-01 vs S-02.
- **Decision**: FIXED via Fix A — kept the filters; `plan.md`'s "What We're NOT Doing" bullet updated to record the design-fidelity addendum superseding the original "no filters" scope call.

### F3 — No error boundary for non-404 failures on the new event routes

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: frontend/src/routes/e/$token.tsx, frontend/src/routes/_authenticated/events.tsx
- **Detail**: `getEventByTokenFn` only special-cases HTTP 404 (→ `null` → `EventNotFound`); any other failure (network error, backend 5xx, timeout) rethrows uncaught. Neither new route defines an `errorComponent`, and `frontend/src/routes/__root.tsx` has none either, so a backend outage falls through to TanStack Router's default technical error boundary. This is worse on the public `/e/$token` page — a guest with no account has no other recourse if the page just shows a raw error. This phase is the first time these loaders are wired into real user-facing routes, making it the natural point to close the gap.
- **Fix A ⭐ Recommended**: Add a single `errorComponent` on the root route (`__root.tsx`) as an app-wide "Something went wrong, try again" fallback.
  - Strength: One change covers every route (including future ones), consistent with how `notFoundComponent`-style catch-alls are usually centralized in TanStack Start.
  - Tradeoff: A generic message can't be tailored per-route (e.g. public page might want "try refreshing the link" copy specifically).
  - Confidence: MED — haven't verified whether `__root.tsx` already has hooks for this or if it needs new wiring.
  - Blind spot: Whether other existing routes (dashboard, create) have the same gap and would benefit from/be affected by a root-level change.
- **Fix B**: Add `errorComponent` individually to `events.tsx` and `e/$token.tsx` with route-appropriate copy.
  - Strength: Tailored messaging per route (e.g. public page can suggest re-checking the link).
  - Tradeoff: Doesn't fix the same gap on other existing routes; more code to keep in sync.
  - Confidence: MED — straightforward TanStack Start API, low implementation risk.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — added `frontend/src/components/error-fallback.tsx` (`ErrorFallback`) wired as `defaultErrorComponent` on `createRouter` in `frontend/src/router.tsx`.

## Observations

### F4 — `isPastEvent()` reads `new Date()` during SSR render

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/features/events/list-events/components/events-list.tsx:16-18
- **Detail**: `isPastEvent()` calls `new Date()` directly in the render path (used for the default `"ongoing"` filter and tab counts) on a component that renders during SSR then hydrates client-side. If an event's `soonestDate` falls in the server/client render window, the ongoing/past bucket could differ, risking a hydration mismatch. Low likelihood/impact given low traffic, small data.
- **Fix**: Not urgent; if ever observed, move the "now" computation into a `useEffect`-gated client recompute or pass a loader-supplied timestamp.
- **Decision**: SKIPPED — theoretical, low-likelihood edge case; not worth fixing now.

## Automated Verification (re-run, not rubber-stamped)

- ✅ `pnpm exec tsc --noEmit` — clean
- ✅ `pnpm lint` — 0 errors (11 pre-existing `react-refresh` warnings, unrelated to this diff)
- ✅ `pnpm test` — 50/50 passing across 7 files, including `events-list.test.tsx` and `event-detail-view.test.tsx`
- ✅ `pnpm build` — succeeds

## Manual Verification

6.5–6.9 are correctly left unchecked in `plan.md` — no rubber-stamping; these require an actual browser walkthrough the user hasn't done yet.
