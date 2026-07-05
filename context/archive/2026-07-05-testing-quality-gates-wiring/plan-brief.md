# Quality-Gates Wiring — Plan Brief

> Full plan: `context/changes/testing-quality-gates-wiring/plan.md`
> Research: `context/changes/testing-quality-gates-wiring/research.md`

## What & Why

Test-plan §3 Phase 4: fire **scoped tests** on the claim/auth/tally risk-area files at two local
gate layers — per-edit (Claude Code `PostToolUse`) and pre-commit (husky) — to lock in the
protections built in Phases 1–3 (risks #1–#5) and shorten the feedback loop before CI. The gate
scaffolding already exists; this change adds *test execution* and decouples the backend gate from
the frontend.

## Starting Point

Per-edit hooks run prettier/csharpier/eslint/tsc but **no tests**. Pre-commit is frontend-only
(`frontend/.husky/pre-commit` → lint-staged runs `vitest related` on staged ts/tsx); staged
backend `.cs` risk files get no local test gate. Husky is a frontend devDependency with
`core.hooksPath=frontend/.husky/_` (no root `package.json`).

## Desired End State

Editing a frontend risk-area file runs its related Vitest tests per-edit and blocks on failure.
Husky lives at the repo root as a project-neutral dispatcher calling two independent scripts:
the unchanged frontend gate and a new backend gate that maps staged risk `.cs` to slice-scoped
`dotnet test` runs (full-suite escalation for cross-cutting edits) and aborts the commit on failure.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Backend per-edit tests | Defer to pre-commit/CI | MSBuild + NSwag build cost blocks the agent loop — poor cost/signal | Plan |
| Frontend per-edit tests | Scoped `vitest related` on risk-area globs only | Closes the primary per-edit gap fast; self-corrects via `exit 2` | Plan |
| Backend build strategy | Incremental build + `test --no-build --no-restore` | Safe (no stale assembly), skips restore, skips NSwag on test-file edits | Plan |
| Cross-cutting `.cs` (no slice) | Run full backend suite | Shared-code edits can break any slice; only full run is safe locally | Plan |
| Frontend pre-commit vitest scope | Leave broad (all staged ts/tsx) | `vitest related` is already cheap/precise; narrowing removes coverage for no gain | Plan |
| Backend gate wiring | Relocate husky to a repo-root dispatcher → per-project scripts | Decouples backend logic from frontend; project-neutral shared hook | Plan (user) |
| lefthook | Keep husky, no migration | Husky already works; Lesson-3 guidance says don't migrate | Research |

## Scope

**In scope:** per-edit frontend scoped-test hook; relocate husky to a root dispatcher; extract
frontend pre-commit script; new backend pre-commit scoped-test gate with cross-cutting escalation.

**Out of scope:** per-edit backend tests; narrowing the frontend pre-commit vitest; new test code;
CI workflow changes; lefthook; Postgres/endpoint tests in the per-edit layer.

## Architecture / Approach

Root `.husky/pre-commit` dispatcher → `frontend/scripts/pre-commit.sh` (lint-staged + i18n) and
`backend/scripts/pre-commit-tests.sh` (staged `.cs` → `Features.<Area>.<Action>` filter, or
full-suite escalation, run via incremental build + `dotnet test --no-build --no-restore`).
Per-edit lives separately in `.claude/settings.json` as a fifth `Write|Edit` hook, gated to the
two frontend risk-area directories, blocking on failure like the existing eslint/tsc hooks.
Backend path → filter is a pure string transform (namespaces mirror `Features/<Area>/<Action>/` 1:1).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Per-edit frontend hook | `vitest related` on risk-area edits, blocking | Glob must match risk dirs only, not all frontend |
| 2. Relocate husky to root dispatcher | Project-neutral hook + extracted frontend script | Install-wiring regression (`prepare`, `core.hooksPath`) |
| 3. Backend pre-commit gate | Staged `.cs` → slice-scoped `dotnet test`, escalation | Correct path→filter mapping + safe build strategy |

**Prerequisites:** Phases 1–3 of the test rollout complete (they are); husky/lint-staged installed
(they are). Phase 2 must land before Phase 3 (backend gate attaches to the relocated dispatcher).
**Estimated effort:** ~1–2 sessions across 3 phases (config + shell scripts, no app code).

## Open Risks & Assumptions

- Husky v9.1.7 `husky <dir>` semantics for the root relocation — verify against current docs
  before editing `prepare`/`core.hooksPath`; re-install regenerates the hooks path.
- `--no-build` is unsafe standalone (stale assembly) — the plan pairs it with an incremental
  `dotnet build`; implementer must keep both.
- Collaborators must re-run `pnpm install` in `frontend/` after the relocation to repoint hooks.

## Success Criteria (Summary)

- Editing a frontend risk-area file runs its related tests per-edit and blocks on failure; non-risk
  edits don't.
- A real commit runs the frontend gate via the relocated dispatcher (unchanged behavior).
- Committing staged risk `.cs` runs the mapped slice; cross-cutting `.cs` escalates to the full
  suite; a failing test aborts the commit; no staged backend `.cs` skips the backend gate.
