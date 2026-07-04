<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Organizer-only Delete for Event with Cascading Cleanup

- **Plan**: context/changes/delete-event/plan.md
- **Scope**: Phase 2 of 2
- **Date**: 2026-07-04
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Unhandled exception freezes the delete confirm dialog

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/features/events/delete-event/components/delete-event.tsx:31-40
- **Detail**: `handleConfirm` has no `try/catch` around `await deleteEventFn(...)`. `deleteEventFn` (functions.ts:28) deliberately rethrows any non-Axios error, and `authMiddleware` can throw on an expired/missing session. If that happens, `setPending(true)` already fired but `setPending(false)` is only reached in the `result.error` branch — `pending` stays `true` forever, and since both `AlertDialogAction` and `AlertDialogCancel` are `disabled={pending}` (lines 74, 79), the user is left with a frozen confirm dialog and no toast explaining why. This mirrors a pre-existing gap in the template (`best-hero.tsx`'s `handleLock` has the same shape), so it isn't a new pattern, but it's more consequential here since it's a destructive-action dialog with both buttons disabled.
- **Fix**: Wrap the call in `try/catch/finally`, mirroring `auth-panel.tsx:69-90` — `finally { setPending(false) }`, and `toast.error(...)` in the `catch` so any failure path (not just the handled `{error}` branch) surfaces feedback and unfreezes the dialog.
- **Decision**: FIXED — wrapped `deleteEventFn` call in `try/catch/finally` in `delete-event.tsx`, mirroring `auth-panel.tsx`'s exact pattern (`toast.error` in catch, `setPending(false)` in finally).

### F2 — No test coverage for the new delete-event feature

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: frontend/src/features/events/delete-event/ (no `.test.` files exist)
- **Detail**: Neither `functions.ts` nor `components/delete-event.tsx` has a companion test file, despite sibling components with the identical pending/toast/navigate shape (`best-hero.test.tsx`, `auth-panel.test.tsx`) having tests, and CLAUDE.md stating "Write tests for all new features." `event-detail-view.test.tsx` was touched only to add a `useNavigate` mock (a required companion fix so the existing suite doesn't throw now that `DeleteEvent` calls `useNavigate()`) — no new assertion was added for the `isOrganizer`-gated visibility of the delete control, or for the delete/error/toast flow itself. The plan's own Phase 2 checkbox `2.5 Frontend tests pass: pnpm test` is checked, but that only proves the *existing* suite still passes, not that the new code is covered.
- **Fix A ⭐ Recommended**: Add tests now before closing Phase 2 — at minimum, an assertion in `event-detail-view.test.tsx` that the danger-zone control renders only when `isOrganizer` is true, plus a `delete-event.test.tsx` covering the success-navigate and error-toast paths.
  - Strength: Matches the project's explicit testing convention and closes the gap before it's forgotten; the sibling pattern (`best-hero.test.tsx`) is a ready template.
  - Tradeoff: Delays closing Phase 2 by a small amount of additional work.
  - Confidence: HIGH — CLAUDE.md is explicit ("Write tests for all new features") and sibling coverage already establishes the pattern to follow.
  - Blind spot: None significant.
- **Fix B**: Accept as a follow-up item, record in the plan's testing strategy as deferred, and track separately.
  - Strength: Ships the feature now; test-writing doesn't block the manual-verification pause already scheduled next.
  - Tradeoff: Coverage debt on a destructive, unrecoverable action (hard delete) — the highest-stakes place to skip tests.
  - Confidence: MEDIUM — reasonable if there's schedule pressure, but risk is asymmetric given the feature deletes data permanently.
  - Blind spot: Whether "later" actually happens once the change is archived.
- **Decision**: FIXED via Fix A — added `delete-event.test.tsx` (renders trigger, opens confirm dialog naming the event, calls `deleteEventFn` + navigates on success, error toast without navigate on `{error}`, generic error toast when the fn throws) and an `isOrganizer`-gating assertion in `event-detail-view.test.tsx`. 173/173 tests pass (6 new).

### F3 — Regenerated API client has Prettier drift

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/api/picnivo-api.ts (whole file)
- **Detail**: The project's `.prettierrc` mandates `"singleQuote": false`, but the regenerated file uses single quotes and irregular indentation throughout (e.g. `import { ... } from '@tanstack/react-query';` instead of double quotes). `pnpm orval` was run but Prettier was not run afterward on the output. Functionally the API surface is correct (`deleteEvent` matches the expected shape, same as sibling generated functions) — this is style-only drift on a generated file.
- **Fix**: Run `pnpm format` (or `pnpm exec prettier --write src/api/picnivo-api.ts`) to bring the generated file back to repo convention before committing.
- **Decision**: FIXED — ran `pnpm format`; `picnivo-api.ts` now uses double quotes throughout (0 single-quoted strings remain). Typecheck still clean.

### F4 — `SectionCard` reused across feature-action boundaries via reach-through import

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/features/events/delete-event/components/delete-event.tsx:18
- **Detail**: `DeleteEvent` imports `SectionCard` via a relative path reaching into a different action folder (`../../get-event-by-token/components/section-card`). `SectionCard` was previously used only within `get-event-by-token` (by `share-aside.tsx` and `event-detail-view.tsx`). The project's own stated convention (`frontend/CLAUDE.md`, Feature Structure) is: "A component belongs in `<Feature>/<Action>/components/` when it is only ever used by that one action. If two or more actions need it, move it up to `src/components/`." `delete-event` is now a second action consuming `SectionCard`, which is exactly the documented trigger to promote it, rather than reach across action boundaries.
- **Fix A ⭐ Recommended**: Move `section-card.tsx` to `src/components/` and update both consumers' imports.
  - Strength: Matches the repo's explicit, already-documented rule for exactly this situation; keeps action folders self-contained going forward.
  - Tradeoff: Touches 3 files (the move + 2 import updates) for a small presentational component — minor churn.
  - Confidence: HIGH — the convention and the trigger condition (2+ consumers) are both explicit in CLAUDE.md.
  - Blind spot: Haven't checked for other near-term consumers that might want `SectionCard` too, which would strengthen the case further.
- **Fix B**: Leave the reach-through import as-is for now since it's only two importers, and revisit if a third feature needs it.
  - Strength: Zero extra churn right now; the component conceptually still "belongs" to the detail-view UI.
  - Tradeoff: Directly contradicts the documented convention as written; sets a precedent for other reach-through imports.
  - Confidence: LOW — the rule was written specifically to avoid this outcome.
  - Blind spot: None significant.
- **Decision**: FIXED DIFFERENTLY — per user direction, dropped the `SectionCard` wrapper entirely; `DeleteEvent` now renders just the destructive trigger `Button` + `AlertDialog`, no "danger zone" card chrome. This removes the cross-feature import altogether rather than promoting the component, since the wrapping wasn't needed. Copy tied to the removed card (`Danger zone`, `Delete this event`, the outer description paragraph) was dropped from the component and now shows as obsolete (`#~`) in `messages.po`; the remaining dialog copy (title/description/buttons) is unaffected. Tests and `event-detail-view.tsx` wiring updated to match; 173/173 tests pass.

## Verification Notes

- **Automated checks** (all pass, run directly, after triage):
  - `pnpm exec tsc --noEmit` — no errors.
  - `pnpm lint` — 0 errors, 142 pre-existing warnings (baseline; none introduced by the new/changed files).
  - `pnpm test -- --run` — 173/173 passed across 24 test files (6 new tests added during triage).
  - `deleteEvent` confirmed present in `src/api/picnivo-api.ts` with the expected Orval shape.
  - `pnpm lingui extract` — clean, 205 source messages, no untranslated bare literals.
- **Triage side-effect caught and corrected**: fixing F3 with a project-wide `pnpm format` (no file argument) reformatted 15 files outside this phase's scope — Tailwind class-order churn across ~13 unrelated components plus a mangled re-serialization of the compiled `messages.ts` catalog — and inflated lint warnings from 142 to 507 (eslint's `tailwindcss/classnames-order` disagreeing with `prettier-plugin-tailwindcss`'s output on files this phase didn't touch). All 15 were reverted via `git checkout --`, and the fix was reapplied scoped to just `src/api/picnivo-api.ts` via `pnpm exec prettier --write`. Lint is back to the 142-warning baseline. Take away: prefer `prettier --write <file>` over bare `pnpm format` when the fix should be scoped to one generated file.
- **Manual checks**: items 2.6-2.10 remain unchecked in the plan's Progress section (no rubber-stamping) — correctly pending the user's manual confirmation of the full delete flow, per the plan's own "Implementation Note."
- **Scope**: this phase is currently **uncommitted** (working tree only, no commit yet) — `git status`/`git diff` were used instead of `git log` for scope detection. Confirmed the only files touched match the plan's 5 planned changes plus two expected companions (`event-detail-view.test.tsx` mock addition, `messages.po` extraction). Two untracked files (`.claude/prompts/mvp-check.md`, `context/mvp-check-report.md`) are unrelated pre-existing artifacts from a different task, not scope creep from this phase.
- **Drift agent**: all 5 planned changes MATCH the plan's contract; `event-card.tsx`/`EventBand` "NOT doing" guardrails held (untouched).
- **Safety/pattern agent**: no CRITICAL findings; auth/security posture correct (client-side `isOrganizer` gating is UX-only, backend 403 is the authoritative boundary); double-submit protection present (both dialog buttons disabled while pending); Lingui, Tailwind, `cn()`, filename, and feature-folder-placement conventions otherwise clean.
