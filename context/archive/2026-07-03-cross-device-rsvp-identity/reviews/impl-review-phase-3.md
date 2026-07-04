<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Cross-Device RSVP Identity

- **Plan**: context/changes/cross-device-rsvp-identity/plan.md
- **Scope**: Phase 3 of 3 — Bundled fix: OAuth redirect threading
- **Date**: 2026-07-04
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Safe-redirect guard duplicated a third time

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/features/auth/components/auth-panel.tsx:86-89,102-105; frontend/src/routes/auth/callback.tsx:43-46
- **Detail**: The 4-line safe-redirect guard (`starts with "/" && not "//"`, else `/events`) now exists as three independent copies: `handleSubmit` (pre-existing), the new `handleGoogleSignIn` (this phase), and `callback.tsx`'s `safeNext` (pre-existing). This phase followed the plan's explicit instruction to "compute the safe redirect (same guard as the email path)" — implemented as planned — but that instruction itself directs a third copy-paste rather than a shared helper. This codebase already has a convention for exactly this shape of thing: small, testable, cross-cutting helpers in `src/lib/` with a co-located test (e.g. `src/lib/participant/cookie.ts` + `cookie.test.ts`, `src/lib/format-instant.ts`).
- **Fix A ⭐ Recommended**: Extract to `frontend/src/lib/auth/safe-redirect.ts` (e.g. `safeRedirectPath(path)`) with a co-located test, and use it at all 3 call sites.
  - Strength: Matches the established `src/lib/` convention; fixes F2 in one place instead of three; removes the drift risk that just materialized as a third copy.
  - Tradeoff: Touches already-shipped Phase 1/2 code (`callback.tsx`, `handleSubmit`), which is slightly outside Phase 3's stated scope ("pass `next` into `signInWithOAuth`" only).
  - Confidence: HIGH — the pattern is well-established in this codebase and the extraction is mechanical.
  - Blind spot: Haven't checked whether `callback.tsx`'s `safeNext` path has an existing test that would need updating alongside the extraction.
  - Fix B: Leave the duplication as-is; record a follow-up instead.
  - Strength: Keeps this phase's diff minimal and scoped exactly to what the plan describes.
  - Tradeoff: Three independent copies of security-relevant validation logic now exist — the next new auth surface (magic link, another OAuth provider) is likely to add a fourth.
  - Confidence: MEDIUM — fine short-term, but the drift already happened once.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — extracted `frontend/src/lib/auth/safe-redirect.ts` (`safeRedirectPath`) with a co-located test (`safe-redirect.test.ts`), used at all 3 call sites (`auth-panel.tsx` handleSubmit + handleGoogleSignIn, `callback.tsx` loader). The helper also rejects the backslash bypass from F2. `tsc --noEmit`, `pnpm lint`, and `pnpm test` (166 tests) all pass.

### F2 — Safe-redirect guard doesn't reject backslash-based bypass

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/features/auth/components/auth-panel.tsx:86-89,102-105; frontend/src/routes/auth/callback.tsx:43-46
- **Detail**: The guard `redirect.startsWith("/") && !redirect.startsWith("//")` blocks `//evil.com` but not backslash-based protocol-relative variants like `/\evil.com`, which some browsers normalize to `//evil.com` when resolving a URL. This is a pre-existing gap in `callback.tsx`'s guard (not introduced by this phase) that Phase 3 has now replicated into `handleGoogleSignIn` as directed by the plan. Exploitability wasn't confirmed — it depends on whether TanStack Router's `navigate({ to })` / `redirect({ to })` ever resolve an unmatched string via a raw `location.href`-style assignment rather than router-internal history navigation — but the fix is cheap and worth folding into the F1 extraction regardless.
- **Fix**: Tighten the guard (ideally inside the F1 shared helper) to also reject a leading backslash, e.g. `redirect.startsWith("/") && !redirect.startsWith("//") && !redirect.startsWith("/\\")`.
- **Decision**: FIXED — resolved as a side effect of F1's Fix A. `safeRedirectPath` in `frontend/src/lib/auth/safe-redirect.ts` rejects paths starting with `/\` in addition to `//`; covered by `safe-redirect.test.ts`.

## Verification Detail

**Automated** (both pass):
- `pnpm exec tsc --noEmit` — clean, no output.
- `pnpm lint` — 0 errors, 129 pre-existing warnings unrelated to this diff (Tailwind class ordering, fast-refresh) — matches plan's `[x]` marks for 3.1/3.2.

**Manual** (3.3, 3.4): correctly left `[ ]` pending in Progress — this is the plan's own designated pause point for manual confirmation, not rubber-stamping.

**Plan Adherence** (sub-agent, MATCH): `handleGoogleSignIn` computes the safe redirect identically to the email path and builds `redirectTo: ${origin}/auth/callback?next=${encodeURIComponent(safe)}`, exactly per the plan's contract. `callback.tsx` has zero working-tree diff, confirming the plan's "no change needed" assumption held.

**Scope Discipline**: only `auth-panel.tsx` (+ plan.md progress checkboxes) changed — no unplanned files.
