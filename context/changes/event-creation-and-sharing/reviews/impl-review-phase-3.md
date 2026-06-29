<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Event Creation and Sharing (S-01)

- **Plan**: context/changes/event-creation-and-sharing/plan.md
- **Scope**: Phase 3 of 6
- **Date**: 2026-06-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  4 warnings  6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Global auth interceptor sends JWT to public endpoint

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence + Safety & Quality
- **Location**: frontend/src/api/axios-instance.ts:12–28
- **Detail**: The plan required per-call auth injection so getEventByTokenFn (public endpoint) never sends a JWT. Instead a server-side interceptor attached Bearer to every request including the public GET /api/events/{token} call.
- **Fix Applied**: Removed global interceptor. Inject auth header per-call in createEventFn and listEventsFn from authMiddleware context (`context.supabase.auth.getSession()`). getEventByTokenFn passes no header.
- **Decision**: FIXED (Fix A)

### F2 — ESLint blanket-ignores all of src/api/ including hand-written code

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/eslint.config.js:9
- **Detail**: `ignores: [..., "src/api/"]` silently exempted the hand-written axios-instance.ts from all linting.
- **Fix Applied**: Narrowed ignore to `"src/api/picnivo-api.ts"` only.
- **Decision**: FIXED

### F3 — Interceptor silently swallows all errors

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/api/axios-instance.ts:22–25
- **Detail**: Bare `catch {}` in the interceptor swallowed all exceptions, not just the intended "no request context" case.
- **Decision**: RESOLVED (interceptor removed by F1 fix)

### F4 — No error surfacing in createEventFn — backend 4xx/5xx silently crash

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: frontend/src/features/events/create-event/functions.ts:9–18
- **Detail**: createEventFn called createEvent() with no try-catch. Backend 422/500 propagated to generic error boundary. Pattern mismatch with auth/functions.ts which returns `{ error: message }`.
- **Fix Applied**: Wrapped in try-catch. Returns `{ token, id, error: null }` on success; `{ token: null, id: null, error: detail }` on AxiosError (extracts `response.data.detail` from HttpValidationProblemDetails). Re-throws non-axios errors.
- **Decision**: FIXED (Fix A)

### F5 — vitest alias paths use absolute /src instead of path.resolve()

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/vitest.config.ts:18–19
- **Detail**: `alias: { "#": "/src" }` — OS-root-absolute in Node.js test runner; future tests using #/ imports would silently fail.
- **Fix Applied**: Replaced with `path.resolve(__dirname, "src")` for both aliases.
- **Decision**: FIXED

### F6 — File locations drifted from plan (env.ts at root, axios-instance.ts in src/api/)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: frontend/env.ts; frontend/src/api/axios-instance.ts
- **Detail**: Plan specified src/lib/env.ts and src/lib/api/axios-instance.ts. Both work; AGENTS.md was not documenting the actual conventions. axios-instance.ts co-located with the generated client is the correct location. env.ts at root is an intentional choice given VITE_* static inlining.
- **Fix Applied**: Updated AGENTS.md to document both canonical locations. No file moves.
- **Decision**: FIXED (documentation update)

### F7 — Unsafe `as AxiosError` cast in getEventByTokenFn

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/features/events/get-event-by-token/functions.ts:12
- **Detail**: `err as AxiosError` is an unchecked cast; non-Axios errors could silently pass the `if` condition.
- **Fix Applied**: Replaced with `isAxiosError(err) && err.response?.status === 404`.
- **Decision**: FIXED

### F8 — listEvents() return missing await

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/features/events/list-events/functions.ts:8
- **Detail**: Missing `await` for consistency with other handlers.
- **Decision**: RESOLVED (await added as part of F1 fix)

### F9 — Schema missing max-length boundary tests

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/features/events/create-event/schema.test.ts
- **Detail**: Tests cover dateOptions min/max but not title/description/location max lengths.
- **Decision**: PARTIALLY FIXED — added boundary cases for items (51 items fails, 50 passes), mirroring F10. title/description/location max-length cases remain skipped.

### F10 — items array has no max count in schema

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: frontend/src/features/events/create-event/schema.ts
- **Detail**: Backend CreateEventValidator enforces max 50 items; frontend schema had no bound.
- **Fix Applied**: Added `.max(50, "Maximum 50 items allowed")` to the items array, matching the backend validator.
- **Decision**: FIXED
