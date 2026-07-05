<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Quality-Gates Wiring (Per-Edit + Pre-Commit Scoped Tests)

- **Plan**: context/changes/testing-quality-gates-wiring/plan.md
- **Scope**: Phase 1-3 of 3 (full plan)
- **Date**: 2026-07-05
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Correction (post-triage)

The initial pass of this review (both the main review and its two sub-agents) reported F1 below as a **CRITICAL** live bug: that `.husky/pre-commit` lacked a shebang/`set -e`, so a failing `frontend/scripts/pre-commit.sh` would be silently masked by a later-succeeding `backend/scripts/pre-commit-tests.sh`, letting bad commits through. That reproduction used a hand-built `core.hooksPath` dispatcher and bypassed husky v9's actual invocation chain.

Directly verifying against the **real installed hook** (`git hook run pre-commit`, honoring the actual `core.hooksPath=.husky/_`) showed this was a false positive: husky's `_/h` wrapper invokes the top-level hook file as `sh -e "$s"` — the `-e` flag is supplied externally by husky, so errexit applies regardless of the target script's own shebang or `set -e`. Tested directly in this repo with a deliberately broken staged frontend file, **both** the original (unfixed) and the fixed `.husky/pre-commit` content correctly aborted the commit (`git hook run pre-commit` exit 1 in both cases). The pre-commit gate was never actually broken.

F1 is downgraded from CRITICAL to OBSERVATION accordingly. The applied fix (shebang + `set -e` on `.husky/pre-commit` itself) is harmless and kept as defense-in-depth — it protects against direct invocation outside husky's wrapper and against husky's own deprecation note that its legacy indirection mechanism changes in v10 — but it was not fixing a live bug.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Root pre-commit dispatcher had no shebang/`set -e` of its own (defense-in-depth only — not a live bug)

- **Severity**: 🔵 OBSERVATION (originally reported as ❌ CRITICAL; downgraded after further verification — see Correction above)
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `.husky/pre-commit:1-2`
- **Detail**: The dispatcher's original content was:
  ```
  frontend/scripts/pre-commit.sh
  backend/scripts/pre-commit-tests.sh
  ```
  No shebang, no `set -e`, no `&&` chaining. In isolated POSIX shell semantics this would exit with the status of its last command, not the first failure — and that's what an initial scratch reproduction (bypassing husky's wrapper) showed. But husky v9's real `_/h` wrapper (`.husky/_/pre-commit` → `. $(dirname $0)/h` → `sh -e "$s" "$@"`) runs the target hook file with `sh -e` applied externally. Verified with `git hook run pre-commit` against a real staged, deliberately-broken frontend file: the commit was correctly blocked with **both** the original two-line content and the fixed content. The gate was never actually bypassable through husky's real invocation path.
- **Fix**: Added a shebang and `set -e` to `.husky/pre-commit` anyway, as defense-in-depth (protects against direct invocation outside husky's `h` wrapper, and against husky's documented plan to change this indirection mechanism in v10):
  ```sh
  #!/usr/bin/env sh
  set -e
  frontend/scripts/pre-commit.sh
  backend/scripts/pre-commit-tests.sh
  ```
- **Decision**: FIXED (kept as hardening, not required for correctness)

### F2 — Inconsistent cwd-resolution pattern between the two dispatched scripts

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `frontend/scripts/pre-commit.sh:4`
- **Detail**: `frontend/scripts/pre-commit.sh` hard-codes `cd frontend`, correct only when invoked with cwd = repo root (true today via the dispatcher). `backend/scripts/pre-commit-tests.sh` instead uses `cd "$(dirname "$0")/.."`, which resolves correctly regardless of invocation cwd. Minor inconsistency between the two sibling scripts introduced in the same change.
- **Fix**: Align `frontend/scripts/pre-commit.sh` to the same `cd "$(dirname "$0")/.."`-style resolution used in the backend script, for robustness and consistency.
- **Decision**: FIXED (changed `cd frontend` to `cd "$(dirname "$0")/.."`)
