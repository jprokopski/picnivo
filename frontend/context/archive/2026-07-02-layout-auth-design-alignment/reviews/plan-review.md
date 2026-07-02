<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Layout & Auth Design Alignment

- **Plan**: `context/changes/layout-auth-design-alignment/plan.md`
- **Mode**: Deep
- **Date**: 2026-07-02
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

8/8 paths ✓, symbols ✓ (`BASKET_PIXELS` present but not yet exported — plan already flags this; dead-token grep matches; 4 `/dashboard` redirect sites match the plan's corrected count), blast radius ✓ (`Header`/`Footer` imported only in `src/routes/__root.tsx`), brief↔plan ✓, Progress↔Phase ✓ (24/24 success criteria mapped to Progress items).

## Findings

### F1 — callback.tsx keeps chrome-height offset after chrome removal

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Change #6 (Fix callback dead token)
- **Detail**: `auth/callback.tsx:44` wraps its message in `min-h-[calc(100vh-8rem)]` — the `8rem` reserves space for the Header+Footer this plan removes. Phase 1 makes callback chrome-free (it stays at root while `__root` drops the chrome) and Change #6 already edits this exact element's className for the token swap, but only the color token, not the height calc. Result: the "Completing sign in…" text centers ~8rem too high on a now-full-bleed page. login/register have the same calc but get rebuilt/removed in Phase 2, so callback is the one file where the stale offset survives.
- **Fix**: In Change #6, also swap `min-h-[calc(100vh-8rem)]` → `min-h-screen` (or `min-h-dvh`) on `callback.tsx:44`, since the page is now chrome-free.
- **Decision**: FIXED (Fix in plan — Phase 1 #6 contract now includes the `min-h-screen` swap)

### F2 — "Reuse the Google OAuth handler unchanged" is inline, not importable

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Change #3 (AuthPanel)
- **Detail**: Phase 2 #3 said AuthPanel "reuses signInFn/signUpFn and the existing Google OAuth handler unchanged." `signInFn`/`signUpFn` are genuinely importable from `lib/auth/functions`. The Google handler is not — it's an inline `handleGoogleSignIn` duplicated in `login.tsx:44-56` and `register.tsx:39-51` (calls `createSupabaseBrowserClient().auth.signInWithOAuth`). AuthPanel must re-implement it, not import it. "Unchanged" slightly misleads; the logic (not a shared symbol) is what's reused.
- **Fix**: Reword to "port the inline Google OAuth logic into AuthPanel" so the implementer copies the ~13 lines rather than hunting for a non-existent shared function.
- **Decision**: FIXED (Fix in plan — Phase 2 #3 contract now specifies porting the inline logic with the `login.tsx:44-56` reference and snippet)

### F3 — AvatarStack port is decorative; confirm MVP scope

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 2 — Change #2 (AvatarStack)
- **Detail**: AvatarStack is a new component whose only consumer is the auth brand panel's decorative social-proof row (fake overlapping avatars). The end state ("/login matches the design split-panel") is reachable without it; it needs invented placeholder names. Justified by the repo's "match the design before improvising" convention — so this is a confirm, not a cut. Just flag it as a conscious choice rather than a silent inclusion.
- **Fix**: Keep if design fidelity is the bar (default); otherwise defer AvatarStack and ship the brand panel with logo + headline only.
- **Decision**: ACCEPTED (kept in scope for design fidelity per convention — no plan change)
