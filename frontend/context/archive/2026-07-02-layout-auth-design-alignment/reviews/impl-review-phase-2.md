<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Layout & Auth Design Alignment

- **Plan**: frontend/context/changes/layout-auth-design-alignment/plan.md
- **Scope**: Phase 2 of 2
- **Date**: 2026-07-02
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

## Findings

### F1 — Open-redirect check missing on callback's `next` param

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/routes/auth/callback.tsx:23,43
- **Detail**: `next` is read straight from the URL and used unchecked as a redirect target (`throw redirect({ to: deps.next || "/events" })`). The equivalent `redirect` param in AuthPanel is explicitly validated (`redirect.startsWith("/") && !redirect.startsWith("//")`) to block protocol-relative open-redirect payloads (`//evil.com`) — this file handles the same class of post-auth redirect but skips that check. Exploitability is constrained by Supabase's PKCE code exchange (a valid `code` is required to reach line 43), but it's a real inconsistency on a security-sensitive surface and cheap to close.
- **Fix**: Apply the same safe-redirect check to `next` before using it (or extract a shared `isSafeRedirect()` helper used by both auth-panel.tsx and callback.tsx).
- **Decision**: FIXED — inline safe-redirect guard added mirroring auth-panel.tsx

### F2 — cn() rule violated in 3 files

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: auth-panel.tsx:242, avatar-stack.tsx:22-25, logo.tsx:79-82
- **Detail**: Accepted lesson mandates `cn()` from `@/lib/utils` for all conditional/composed className — template literals and string concatenation are banned. None of these three files import `cn`: auth-panel.tsx uses a template literal (`${FIELD_INPUT} pr-14`), avatar-stack.tsx and logo.tsx use `+` concatenation for conditional classes.
- **Fix**: `cn(FIELD_INPUT, "pr-14")`; `cn("border-2 border-[rgba(255,247,234,0.9)] shadow-(--sh-sm)", i !== 0 && "-ml-2.25")`; `cn("font-display ... tracking-[-0.02em]", tone === "light" ? "text-white" : "text-(--ink)")`.
- **Decision**: FIXED — cn() adopted in all 3 files

### F3 — No error handling around signInFn/signUpFn

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: auth-panel.tsx:72-97
- **Detail**: `handleSubmit` calls `signInFn`/`signUpFn` with no try/catch, while the analogous `handleGoogleSignIn` (lines 99-111) does wrap its external call. If the server function throws instead of resolving `{ error }` (network failure, cold start), `submitting` never resets and the form is stuck disabled with no visible feedback.
- **Fix**: Wrap the signInFn/signUpFn call in try/catch/finally, resetting `submitting` and setting a generic inline error on catch.
- **Decision**: FIXED — wrapped in try/catch/finally

### F4 — Arbitrary Tailwind values with scale equivalents

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: auth-panel.tsx:39 (`ring-[4px]`), avatar-stack.tsx:24,29 (`-ml-[9px]`)
- **Detail**: Direct hits on the accepted lesson's arbitrary-value checklist: `ring-4` covers 4px on Tailwind's ring scale; `-ml-2.25` (9px = 2.25×4px) matches the fractional-scale convention already used elsewhere (`mb-1.75`, `h-13`).
- **Fix**: `ring-[4px]` → `ring-4`; `-ml-[9px]` → `-ml-2.25`.
- **Decision**: FIXED — applied together with F2

### F5 — Undisclosed deletion of PicnicScene.tsx

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/PicnicScene.tsx (deleted in d7f95fe)
- **Detail**: Deleted as a side effect of a commit whose stated intent was only a kebab-case rename. Verified safe: it was a byte-for-byte dead duplicate of picnic-scene.tsx (same earlier commit created both), with zero importers at any point in history — all 4 real call sites always used the kebab-case file. No functional risk, just an undisclosed deletion worth a process note.
- **Fix**: None needed. Consider calling out incidental cleanups explicitly in commit messages going forward.
- **Decision**: SKIPPED

### F6 — format-instant.ts change bundled into the auth commit

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/lib/format-instant.ts
- **Detail**: Commit 8c56f77 also pins `formatInstantParts`'s locale default to `"en-US"` to fix an SSR/hydration mismatch — unrelated to auth, affects only the events list/detail pages. Self-disclosed in the commit's "Supporting changes" note, so not hidden, but outside the plan's Phase 2 file list.
- **Fix**: None needed — correct and disclosed. Consider a separate commit for unrelated fixes discovered mid-implementation next time.
- **Decision**: SKIPPED
