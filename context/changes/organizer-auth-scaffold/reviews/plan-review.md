<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Organizer Auth Scaffold

- **Plan**: context/changes/organizer-auth-scaffold/plan.md
- **Mode**: Deep
- **Date**: 2026-06-04
- **Verdict**: REVISE → SOUND (after fixes)
- **Findings**: 1 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding

Grounding: 9/9 paths ✓, 5/5 symbols ✓, brief↔plan ✓

## Findings

### F1 — JWT Authority URL has no local/cloud switching mechanism

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Changes 3 & 4
- **Detail**: Change 3 hardcoded Authority to `https://{ProjectRef}.supabase.co/auth/v1` (cloud-only URL constructed from ProjectRef). Change 4 acknowledged "the JWT issuer is http://localhost:54321/auth/v1 — the Authority config must handle both local and cloud issuers" but specified no mechanism. The config contract only added `Supabase:ProjectRef` — no Authority key.
- **Fix**: Add a `Supabase:Authority` config key. Set to `http://localhost:54321/auth/v1` in `appsettings.Development.json`, cloud URL via Fly.io secret. Read Authority directly from config in Change 3 instead of constructing from ProjectRef.
- **Decision**: FIXED — added `Supabase:Authority` config key, replaced ProjectRef-based URL construction in Changes 3, 4, and Phase 4 Change 5.

### F2 — Set-Cookie append semantics acknowledged but not resolved

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Change 3 (server client factory)
- **Detail**: Current State Analysis flagged that `setResponseHeader` may replace rather than append Set-Cookie headers. But Phase 2 Change 3's contract used `setResponseHeader('Set-Cookie', ...)` in `setAll` without resolving the known risk. If it replaces, only the last cookie chunk survives and auth silently breaks.
- **Fix**: Update Change 3 contract to specify `appendResponseHeader` in `setAll` and verify multi-cookie round-trip during Phase 2 manual testing.
- **Decision**: FIXED — updated Change 3 contract to use `appendResponseHeader` with accumulation fallback and explicit verification step.

### F3 — `[auth.external.google]` section doesn't exist in config.toml

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 — Change 3
- **Detail**: Plan said "In the `[auth.external.google]` section, set enabled = true..." implying the section exists. Only `[auth.external.apple]` exists at config.toml:322. The entire section must be added, not modified.
- **Fix**: Change wording to "add" and specify the full TOML block.
- **Decision**: FIXED — updated to "add a new section" with full TOML block specified.
