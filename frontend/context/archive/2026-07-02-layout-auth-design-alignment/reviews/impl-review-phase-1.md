<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Layout & Auth Design Alignment

- **Plan**: context/changes/layout-auth-design-alignment/plan.md
- **Scope**: Phase 1 of 2
- **Date**: 2026-07-02
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Automated Verification

- `pnpm exec tsc --noEmit` — PASS
- `pnpm test -- --run` — PASS (7 files, 50 tests)
- `pnpm lint` — PASS (0 errors, 11 pre-existing warnings unrelated to this diff)
- `pnpm build` — PASS
- `grep -rn "dashboard" src/routes src/components` — clean (no matches)
- `grep -n "sea-ink" src/routes/auth/callback.tsx` — clean (no matches)

## Manual Verification

Items 1.7–1.12 in plan.md `## Progress` are unchecked, per the plan's own pause-for-manual-confirmation gate. Not evaluated as part of this automated review. Note: item 1.9 ("`/e/$token` shows full nav to logged-in users, logo-only bar to guests") would fail if tested as-is, per F1 below.

## Findings

### F1 — Guest header still shows a "Log in" button, not logo-only

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: frontend/src/components/header.tsx:178-182
- **Detail**: Plan item 4 contracts: "the `user`-null branch of the right-hand column renders nothing (or is removed), leaving the logo cell" — specifically so a guest on the public `/e/$token` page sees "just a bar with a logo." The actual guest branch collapsed the old two-button pair (Log in + Sign up) into one, but kept a primary-styled "Log in" link:
  ```tsx
  ) : (
    <Link to="/login" search={{ redirect: "" }} className={PRIMARY_BTN}>
      <Trans>Log in</Trans>
    </Link>
  )
  ```
  Sign-up was dropped, but a CTA still renders — this contradicts the explicit "logo-only" contract and would fail manual checklist item 1.9 if tested as-is.
- **Fix**: Render `null` in the guest branch instead of the "Log in" link.
- **Decision**: SKIPPED (plan updated instead — guest header keeps a single "Log in" button by
  design; logo-only requirement removed from plan.md)

## Notes

- `login.tsx`, `register.tsx`, and `auth/callback.tsx` diffs are ~90% Prettier reformatting (quote style, semicolons) layered on the planned one-line redirect changes — noisy but harmless, not a finding.
- `routeTree.gen.ts` diff confirmed as purely mechanical regeneration — no hand-edited divergence.
- All 6 planned Phase 1 changes verified: items 1, 2, 3, 5, 6 MATCH; item 4 DRIFT (see F1).
