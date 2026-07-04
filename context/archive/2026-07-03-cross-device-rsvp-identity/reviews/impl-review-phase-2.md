<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Cross-Device RSVP Identity

- **Plan**: context/changes/cross-device-rsvp-identity/plan.md
- **Scope**: Phase 2 of 3 (Frontend — lazy cookie backfill on event visit)
- **Date**: 2026-07-04
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 0 observations

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

### F1 — Participant-id resolver uses unverified `getSession()` instead of the established `getUser()`-then-`getSession()` refresh pattern

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: frontend/src/features/events/get-event-by-token/functions.ts:52

- **Detail**: The plan explicitly instructed this resolver to "mirror `getSessionFn`" (`frontend/src/lib/supabase/session.ts:10`), which calls `supabase.auth.getUser()` — a call that revalidates against the Supabase Auth server and can trigger the SDK's token-refresh flow (a refreshed token is persisted back to cookies via `createSupabaseServerClient`'s `setAll` callback). The plan also names `create-event/functions.ts:24` as the Bearer-token precedent; that file's `getSession()` call only works safely because it runs behind `authMiddleware` (`middleware/auth.ts:6-9`), which calls `getUser()` first — so by the time the handler reads `getSession()`, it's reading from an already-verified, already-refreshed client.

  The new resolver instead calls `supabase.auth.getSession()` directly (functions.ts:50-53) on a fresh client with no prior `getUser()` call. This route can't use `authMiddleware` (it must not throw for guests), but nothing replaces the `getUser()` step that middleware normally performs. Per Supabase's own SSR docs, `getSession()` "reads from cookies without Auth server verification" and "must not be used for authorization decisions." Because the backend's `GetMyParticipant` endpoint independently validates the JWT via `.RequireAuthorization()`, there's no security bypass — a forged or expired token is rejected server-side regardless of how the frontend obtained it. The real cost is reliability: an organizer whose access token is expired-but-refreshable gets that stale token forwarded as-is (no refresh happens), the backend 401s, and the generic-error branch (functions.ts:61-67) logs and returns `null` — silently reproducing the exact "organizer sees no attendance dialog" bug this phase exists to fix, intermittently, whenever the access token is near/past its TTL.

- **Fix**: Call `supabase.auth.getUser()` first (guard on `!user` → return `null`, mirroring `getSessionFn`'s error logging), then read `supabase.auth.getSession()` on the *same* client instance for the now-verified/refreshed `access_token` — the same two-step sequence `authMiddleware` + `create-event/functions.ts` already establish, just inlined since `authMiddleware` can't guard a public route.
  - Strength: Matches two existing precedents in this exact codebase (`session.ts`, and `authMiddleware` → `create-event/functions.ts`) rather than introducing a third pattern; closes the token-refresh gap so this phase's fix doesn't intermittently fail for its own target users.
  - Tradeoff: One extra Supabase Auth-server round trip on the cookie-less path — already the slow path; guests and returning organizers with a cookie are unaffected.
  - Confidence: HIGH — directly evidenced by two sibling files in this repo using the exact `getUser()`-then-`getSession()` sequence, and confirmed against Supabase's official SSR documentation via Context7.
  - Blind spot: Haven't load-tested the added latency; expected negligible since it only affects the already-network-bound cookie-less path.

- **Decision**: FIXED — applied the getUser()-then-getSession() fix in functions.ts:49-58, updated functions.test.ts mocks to stub getUser (5 tests updated). Verified: tsc clean, lint 0 errors, 160/160 tests pass.

## Verification Notes

**Automated Verification** (all re-run live, not taken from the plan's checkboxes):
- ✅ `pnpm exec tsc --noEmit` — clean, no errors
- ✅ `pnpm lint` — 0 errors (129 pre-existing warnings unrelated to this phase's files)
- ✅ `pnpm test` — 160/160 tests pass, including the 5-case `getMyParticipantIdFn` suite (cookie-hit, account-resolve+backfill, guest/no-session, 404-swallowed, unexpected-error-logged)

**Plan Adherence**: All three planned changes (API client regen, graceful resolver with cookie backfill, threading `participantId` into the loader) are implemented as specified, confirmed by an independent drift-review agent. The one deviation is F1 above — the plan's explicit instruction to "mirror `getSessionFn`" wasn't followed for the auth-read method itself.

**Scope Discipline**: No unplanned files touched; all five explicitly out-of-scope items (FK/schema change, data migration, guest cross-device identity, eager cookie restoration, `isOrganizer`-based rendering fallback) remain absent, as required.

**Pattern Consistency**: Cookie helper usage (`httpOnly`, `secure: PROD`, `sameSite: lax`) is correct and consistent with `join-event`/`set-attendance`. Error-swallowing (opaque `null`, no `err.response?.data?.detail` surfaced) is appropriate for this silent-identity-resolution context. The sequential-await restructuring in `$token.tsx`'s loader (`myParticipantId` resolved before `getEventByTokenFn`, vs. the previous fully-parallel `Promise.all`) is an intentional, well-documented, necessary tradeoff — a same-request `Set-Cookie` isn't readable mid-request — and only affects the already-slow cookie-less path.
