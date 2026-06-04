<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Organizer Auth Scaffold

- **Plan**: context/changes/organizer-auth-scaffold/plan.md
- **Scope**: Phase 3 of 4
- **Date**: 2026-06-04
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — OAuth callback ignores `next` param on success

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: frontend/src/routes/auth/callback.tsx:36
- **Detail**: Plan specifies redirecting to `next` (default `/dashboard`) after OAuth code exchange. The `next` param is parsed but the success path hardcoded `throw redirect({ to: '/dashboard' })` — ignoring `deps.next`.
- **Fix**: Changed line 36 to use `deps.next || '/dashboard'`.
- **Decision**: FIXED

### F2 — Open redirect via unvalidated `redirect` search param

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/routes/login.tsx:34
- **Detail**: The `redirect` param from the URL was passed directly to `navigate()`. The `_authenticated` layout sets `redirect: location.href` (full URL). A crafted `/login?redirect=https://evil.com` could attempt an open redirect.
- **Fix**: Added validation that `redirect` starts with `/` and not `//` before using it.
- **Decision**: FIXED

### F3 — Google OAuth calls lack error handling

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/routes/login.tsx:40, register.tsx:39
- **Detail**: Both `handleGoogleSignIn` functions called `signInWithOAuth()` without try/catch. On failure, user got no feedback.
- **Fix**: Wrapped in try/catch with `setError()` on failure in both files.
- **Decision**: FIXED

### F4 — Server function input validators are pass-through

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/lib/auth/functions.ts:5-7
- **Detail**: `inputValidator` functions were identity functions with no runtime validation. Malformed payloads would reach Supabase and produce unhelpful errors.
- **Fix**: Replaced with zod schemas (`z.email()`, `z.string().min(...)`, `z.string().max(...)`).
- **Decision**: FIXED

### F5 — Dashboard shows user ID (not in plan)

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: frontend/src/routes/_authenticated/dashboard.tsx:39
- **Detail**: Dashboard displayed the Supabase UUID, which was not in the plan.
- **Fix**: Removed the user ID display.
- **Decision**: FIXED

### F6 — Sign-out calls lack error handling

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: frontend/src/components/Header.tsx:10, frontend/src/routes/_authenticated/dashboard.tsx:14
- **Detail**: Both `handleSignOut` functions call `signOutFn()` then `router.invalidate()` without error handling. Sign-out failures are rare.
- **Decision**: SKIPPED
