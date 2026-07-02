<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Event Creation and Sharing (S-01)

- **Plan**: `context/changes/event-creation-and-sharing/plan.md`
- **Scope**: Phase 5 of 6
- **Date**: 2026-06-30
- **Verdict**: APPROVED (all findings fixed during triage)
- **Findings**: 0 critical · 3 warnings · 2 observations (all resolved)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS (fixed) |
| Architecture | PASS |
| Pattern Consistency | PASS (fixed) |
| Success Criteria | PASS (automated 5.1–5.4; manual 5.5–5.8 pending) |

## Automated Verification (Phase 5)

| Check | Result |
|-------|--------|
| 5.1 `pnpm typecheck` | PASS |
| 5.2 `pnpm lint` | PASS (pre-existing react-refresh warnings only) |
| 5.3 `pnpm test` | PASS (37/37) |
| 5.4 `pnpm extract` / `pnpm compile` | PASS (107 messages, no missing) |

## Findings

### F1 — handleSubmit has no try/catch — form stuck forever on server error

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `frontend/src/features/events/create-event/components/CreateEventForm.tsx:55–65`
- **Detail**: `handleSubmit` awaited `createEventFn(...)` with no `try/catch`. TanStack Start's `inputValidator` throws (not returns) on schema violation. Concrete trigger: organizer picks today + a past time slot → `futureIsoInstant` guard throws on server → `setIsSubmitting(false)` never runs → form permanently stuck in "Creating…". Also, the frontend allowed past times on today's date (calendar only blocked past days).
- **Fix**: Wrapped `createEventFn` call in `try/catch` with `finally { setIsSubmitting(false) }`. Added frontend guard that rejects any date whose combined datetime is already in the past before submitting.
- **Decision**: FIXED

### F2 — navigator.clipboard.writeText unhandled rejection

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `frontend/src/features/events/create-event/components/ShareLinkDialog.tsx:26–30`
- **Detail**: Clipboard API unavailable in HTTP contexts (local dev) or when permission denied — throws an unhandled rejection.
- **Fix**: Wrapped in `try/catch`; silent on failure since the URL is still visible for manual copy.
- **Decision**: FIXED

### F3 — SUGGESTIONS array in ItemsEditor hardcoded English

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `frontend/src/features/events/create-event/components/ItemsEditor.tsx:7–16`
- **Detail**: 8-item suggestion array declared at module scope — `useLingui()` unavailable there, strings never extracted to catalog.
- **Fix**: Moved array inside component body, wrapped each string with `t```. Also saved as a lesson in `frontend/context/foundation/lessons.md`.
- **Decision**: FIXED + ACCEPTED-AS-RULE: Module-scope string arrays bypass Lingui extraction

### F4 — formatDisplayDate hardcodes "en-US" locale

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `frontend/src/features/events/create-event/datetime.ts:17`
- **Detail**: `"en-US"` hardcoded; date chips always render in English regardless of active locale.
- **Fix**: Added optional `locale` parameter to `formatDisplayDate`; `DatePicker.tsx` now passes `i18n.locale` from `useLingui()` so date chips follow the app's active Lingui locale.
- **Decision**: FIXED

### F5 — vi.mock("../functions") set up but success/error paths never tested

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence / Success Criteria
- **Location**: `frontend/src/features/events/create-event/components/CreateEventForm.test.tsx`
- **Detail**: Mock was wired but never exercised in a submit scenario. Success path (ShareLinkDialog appears) and error path (error alert renders) were both missing.
- **Fix**: Added `CreateEventForm.integration.test.tsx` with mocked DatePicker stub and two new tests covering both paths. All 37 tests pass.
- **Decision**: FIXED

### F6 — Timezone safety in datetime.test.ts unexplained

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `frontend/src/features/events/create-event/datetime.test.ts:15–20`
- **Detail**: `getHours()`/`getMinutes()` assertions appeared timezone-fragile without explanation.
- **Fix**: Added one-line comment explaining the local→ISO→local round-trip safety.
- **Decision**: FIXED
