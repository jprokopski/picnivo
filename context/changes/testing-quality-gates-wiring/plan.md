# Quality-Gates Wiring (Per-Edit + Pre-Commit Scoped Tests) Implementation Plan

## Overview

Phase 4 of `context/foundation/test-plan.md` §3: fire scoped tests on the claim/auth/tally
risk-area files at two local gate layers — **per-edit** (Claude Code `PostToolUse` agent hook)
and **pre-commit** (husky git hook) — to lock in the protections built in test-plan Phases 1–3
(risks #1–#5). The gate scaffolding already exists; this change adds *test execution* to it and
restructures the pre-commit layer so the backend gate is decoupled from the frontend.

## Current State Analysis

Three of the four gate mechanisms already exist and run format/lint/typecheck. The gaps are all
on the **test-running** dimension:

- **Per-edit (`.claude/settings.json`, `PostToolUse` matcher `Write|Edit`)** runs four hooks —
  prettier (`--write`, frontend), csharpier (`format`, backend `.cs`), eslint (`--fix --quiet`,
  blocking `exit 2`), and `tsc --noEmit` (blocking `exit 2`). It **runs no tests.** This is the
  primary per-edit gap.
- **Pre-commit (`frontend/.husky/pre-commit`)** is `cd frontend && npx lint-staged` +
  `pnpm run i18n:sync`. `frontend/.lintstagedrc.js` already runs `vitest related <files> --run`
  on staged `*.{ts,tsx}` — but the hook is **frontend-only**: staged backend `.cs` risk files
  (4 of the 5 risk areas) get no local test gate before CI.
- **Husky wiring:** husky `^9.1.7` is a *frontend* devDependency (there is **no root
  `package.json`**). `frontend/package.json` `prepare: "cd .. && husky frontend/.husky"` sets
  `core.hooksPath=frontend/.husky/_`. The generated `_/` dir and the `pre-commit` script both
  live under `frontend/`.

**Backend scoped-test mapping is a pure string transform.** The xUnit test project mirrors
`Features/<Area>/<Action>/` 1:1 with namespaces `Picnivo.Tests.Features.<Area>.<Action>`
(verified across five files; no `[Trait]`/`[Category]` attributes exist, so filtering must go
through `FullyQualifiedName`). An edited/staged path → filter mapping needs no lookup table:
take the segment after `Features/`, keep `<Area>/<Action>`, join with `.`, prefix `Features.`.

**A fast/slow split is baked into the fixtures.** `*HandlerTests` use in-memory SQLite
(`TestDb.cs:13`), `*ValidatorTests`/`ShareTokenGeneratorTests` use no DB — both fast.
`*EndpointTests` + `CastVotesConstraintTests` spin a real Postgres Testcontainer
(`ApiFixture.cs:20-38`, 10-DB pool, multi-second startup) — too slow for per-edit. The test
build also runs an **NSwag client-generation `Exec` target on `CoreCompile`**
(`Picnivo.Tests.csproj`), so a naive `dotnet test` rebuilds the client each time.

**CI already runs the full suite per project on PRs** (`ci-frontend.yml`, `ci-backend.yml`,
`pull_request` trigger, path-filtered). Local Phase 4 gates stay scoped to shorten the feedback
loop, not duplicate CI. Both gates are **recommended (not required)** in test-plan §5.

## Desired End State

1. **Per-edit:** editing a frontend risk-area file (`get-event-by-token` or `set-attendance`)
   triggers `vitest related <file> --run`; a failing related test blocks (`exit 2`) and its
   output flows into the agent context for self-correction, exactly like the eslint/tsc hooks.
   Editing a non-risk frontend file, or any backend file, does **not** run tests per-edit.
2. **Pre-commit:** husky lives at the repo root as a project-neutral dispatcher that invokes two
   independent, decoupled scripts — `frontend/scripts/pre-commit.sh` (existing lint-staged +
   i18n behavior, unchanged) and `backend/scripts/pre-commit-tests.sh` (new backend gate).
3. **Backend pre-commit gate:** committing staged risk-area `.cs` files runs the mapped
   `Features.<Area>.<Action>` slice tests via incremental `dotnet build` + `dotnet test
   --no-build --no-restore --filter …`; a staged `.cs` that maps to no slice (`Data/**`,
   `Program.cs`, shared infra, test fixtures) escalates to the **full backend suite**; a failed
   test aborts the commit (non-zero exit).

**Verification:** touch a risk-area frontend file and confirm the per-edit hook runs its related
test; stage a risk `.cs` and confirm the mapped slice runs; stage a `Data/**` file and confirm
full-suite escalation; run a real commit and confirm the existing frontend lint-staged/i18n path
still fires from the relocated dispatcher.

### Key Discoveries:

- Per-edit hooks run **no tests** today — `.claude/settings.json` (primary gap).
- Backend path → filter is mechanical: `…/Features/Claims/ClaimItem/*.cs` →
  `--filter "FullyQualifiedName~Features.Claims.ClaimItem"` (research.md Area 3; identical 1:1
  across `Picnivo.API/Features/**` and `Picnivo.Tests/Features/**`).
- No root `package.json`; husky is frontend-scoped (`frontend/package.json` `prepare`,
  `core.hooksPath=frontend/.husky/_`). Relocation must update both.
- Fast/slow tier is readable from the fixture a test class uses (`TestDb.cs` SQLite = fast;
  `ApiFixture.cs` Postgres = slow) — the split is not something to invent.
- The eslint/tsc hooks already establish the blocking convention (`out=$(…); code=$?; if … exit 2`)
  — the new frontend per-edit test hook should copy it.
- No lefthook in the repo; root `AGENTS.md`/`CLAUDE.md` Lesson-3 lefthook references are
  illustrative — the guidance itself says "if Husky already works, don't migrate." Keep husky.

## What We're NOT Doing

- **No per-edit backend tests.** Every `dotnet` call pays MSBuild cold-start + potential NSwag
  rebuild; blocking the agent loop on that is poor cost/signal (decision). Backend tests live at
  pre-commit and CI only.
- **Not narrowing the existing frontend pre-commit `vitest related`.** It stays broad on all
  staged `*.{ts,tsx}` — `vitest related` is already cheap and precise; narrowing would remove
  coverage from non-risk files for no real saving (decision).
- **Not introducing lefthook.** Extend/relocate husky.
- **Not touching CI workflows** (`ci-*.yml`) — they already run full suites; local gates front CI.
- **Not adding Postgres/endpoint tests to the per-edit layer** — Testcontainer startup is too slow.
- **Not editing test-plan §3 Phase 4 status vocabulary** — status transitions are the
  `/10x-test-plan` orchestrator's job, not this change's.
- **Not writing new test code** — Lesson-2/Phase-1–3 work; hooks only *run* existing tests.

## Implementation Approach

Three independent, sequenced phases, each behavior-preserving where possible and independently
verifiable:

1. **Per-edit frontend hook** (isolated, `.claude/settings.json` only) — earliest win, no husky risk.
2. **Relocate husky to a root dispatcher** — pure structural refactor that preserves the current
   frontend gate behavior and creates the decoupled seam Phase 3 plugs into.
3. **Backend pre-commit gate** — the new gate, added as a self-contained `backend/` script wired
   into the root dispatcher.

Phase 2 precedes Phase 3 because the backend gate attaches to the relocated, project-neutral
dispatcher — adding backend logic before relocating would couple it to the frontend hook.

## Critical Implementation Details

- **Husky relocation is install-wiring sensitive.** husky must still be *executed* by an install
  step, and husky lives only in `frontend/node_modules`. The `prepare` script runs when
  `pnpm install` runs in `frontend/`. Relocating means changing `prepare` to target a root
  `.husky/` dir (`cd .. && husky .husky`) so `core.hooksPath` becomes `.husky/_`, then moving the
  `pre-commit` hook file to root `.husky/pre-commit`. Verify husky v9.1.7 semantics against
  current docs before editing — `husky <dir>` initializes hooks in that dir and points
  `core.hooksPath` at `<dir>/_`. After the change, re-run the install/prepare step and confirm
  `git config core.hooksPath` reports the new root path.
- **`--no-build` alone is unsafe.** It would test a stale assembly if the staged edit wasn't
  compiled. The safe form is incremental `dotnet build` (recompiles only what changed; editing a
  *test* file does not retrigger the NSwag target) followed by `dotnet test --no-build
  --no-restore --filter …`.
- **Cross-cutting escalation is a safety inversion if wrong.** A staged `.cs` outside any
  `Features/<Area>/<Action>/` slice (Data, Program.cs, `EndpointExtensions.cs`,
  `ValidationEndpointFilter.cs`, `ExceptionHandling/**`, fixtures under `Picnivo.Tests/`) can
  break any slice — so it must run the **full** backend suite, never "the slices that happened to
  be staged too" (which silently skips the gate on a pure-infra commit).

---

## Phase 1: Per-Edit Frontend Scoped-Test Hook

### Overview

Add test execution to the per-edit layer for frontend risk-area files, closing the primary
per-edit gap. Frontend-only; no husky changes.

### Changes Required:

#### 1. Per-edit hook entry

**File**: `.claude/settings.json`

**Intent**: Add a fifth `PostToolUse` hook (matcher `Write|Edit`) that, when the edited file is a
frontend risk-area file, runs its Vitest related tests and blocks on failure so the agent can
self-correct next turn.

**Contract**: A new command hook in the existing `Write|Edit` hooks array. It reads
`.tool_input.file_path // .tool_response.filePath` via `jq -r` (same as the existing hooks),
matches the risk-area globs, and runs `vitest related` scoped to the file. Follow the existing
eslint/tsc blocking shape exactly: capture output, on non-zero print to stderr and `exit 2`.
Gate to the two risk-area directories:
`/Users/jpro/code/picnivo/frontend/src/features/events/get-event-by-token/*` and
`/Users/jpro/code/picnivo/frontend/src/features/events/set-attendance/*` (both `*.ts` and `*.tsx`).
Run from `frontend/` via `pnpm exec vitest related "$f" --run` (`related` is a subcommand; `--run`
avoids watch mode).

### Success Criteria:

#### Automated Verification:

- [ ] `.claude/settings.json` is valid JSON: `jq . .claude/settings.json`
- [ ] Frontend scoped test command works standalone from `frontend/`: `pnpm exec vitest related src/features/events/get-event-by-token/functions.ts --run`

#### Manual Verification:

- [ ] Editing `frontend/src/features/events/get-event-by-token/functions.ts` via the agent triggers the related test run in the hook
- [ ] A deliberately failing related test blocks (`exit 2`) and its output appears in agent context
- [ ] Editing a non-risk frontend file (e.g. `frontend/src/lib/**`) does NOT trigger a test run

**Implementation Note**: After Phase 1 automated verification passes, pause for human confirmation
of the manual per-edit behavior before starting Phase 2.

---

## Phase 2: Relocate Husky to a Repo-Root Dispatcher

### Overview

Move husky's hooks to the repo root as a project-neutral dispatcher and extract the current
frontend pre-commit behavior into `frontend/scripts/pre-commit.sh`. Behavior-preserving: the
frontend lint-staged + i18n gate must fire exactly as before. This establishes the decoupled seam
for Phase 3.

### Changes Required:

#### 1. Extract frontend pre-commit script

**File**: `frontend/scripts/pre-commit.sh` (new, executable)

**Intent**: Hold the current frontend gate logic (`lint-staged` + `i18n:sync`) so it lives under
`frontend/` and is owned by the frontend project.

**Contract**: A shell script that reproduces today's `frontend/.husky/pre-commit` body —
`cd` into `frontend/` (relative to repo root, since the dispatcher runs from root), then
`npx lint-staged` and `pnpm run i18n:sync`. Must exit non-zero if either step fails.

#### 2. Root dispatcher hook

**File**: `.husky/pre-commit` (new, at repo root)

**Intent**: A thin, project-neutral dispatcher that calls each project's independent gate script;
belongs to neither project.

**Contract**: Invokes `frontend/scripts/pre-commit.sh` (Phase 2) and, later,
`backend/scripts/pre-commit-tests.sh` (Phase 3). Runs from repo root (hooks execute at
`core.hooksPath` root). Aborts the commit if any invoked script exits non-zero. Phase 2 wires the
frontend call only; Phase 3 adds the backend call.

#### 3. Update husky install wiring

**File**: `frontend/package.json`

**Intent**: Point husky at the new root `.husky/` dir so `core.hooksPath` resolves to `.husky/_`.

**Contract**: Change the `prepare` script from `cd .. && husky frontend/.husky` to initialize the
root dir (`cd .. && husky .husky`). After running the prepare/install step, `git config
core.hooksPath` must report the root `.husky/_` path. Remove the old `frontend/.husky/pre-commit`
and the stale `frontend/.husky/` husky dir once the root dir is generated and verified. Verify
husky v9.1.7 `husky <dir>` semantics against current docs before editing.

### Success Criteria:

#### Automated Verification:

- [ ] `frontend/scripts/pre-commit.sh` and `.husky/pre-commit` are executable: `test -x frontend/scripts/pre-commit.sh && test -x .husky/pre-commit`
- [ ] After running the prepare step, hooks path is the root dir: `git config core.hooksPath` reports `.husky/_`
- [ ] `frontend/package.json` remains valid JSON and `prepare` targets the root `.husky`

#### Manual Verification:

- [ ] A real commit touching a staged frontend `*.ts` file runs eslint/prettier/`vitest related`/tsc via the relocated dispatcher (unchanged behavior)
- [ ] `pnpm run i18n:sync` still runs on commit
- [ ] The old `frontend/.husky/pre-commit` no longer fires (no double-run)

**Implementation Note**: After Phase 2 automated verification passes, pause for human confirmation
that a real commit exercises the relocated frontend gate before starting Phase 3.

---

## Phase 3: Backend Pre-Commit Scoped-Test Gate

### Overview

Add the new, decoupled backend gate: map staged risk `.cs` files to slice filters, escalate
cross-cutting edits to the full suite, and run the tests with the safe incremental build strategy.
Wire it into the root dispatcher.

### Changes Required:

#### 1. Backend pre-commit test script

**File**: `backend/scripts/pre-commit-tests.sh` (new, executable)

**Intent**: The backend gate — collect staged backend test-relevant `.cs`, decide slice-scoped vs
full-suite, and run the tests. Fully self-contained under `backend/`, no frontend coupling.

**Contract**: A shell script (run from repo root by the dispatcher) that:
- Lists staged `.cs` files under `backend/` via `git diff --cached --name-only --diff-filter=ACM`.
- If none, exit 0 (no-op).
- For each staged `.cs` under `backend/**/Features/<Area>/<Action>/**`, derive the filter token
  `Features.<Area>.<Action>` (segment after `Features/`, first two path parts, joined by `.`);
  collect the unique set.
- If **any** staged `.cs` is under `backend/` but maps to **no** slice (anything outside a
  `Features/<Area>/<Action>/` path — `Data/**`, `Program.cs`, `EndpointExtensions.cs`,
  `ValidationEndpointFilter.cs`, `ExceptionHandling/**`, `Picnivo.Tests/` fixtures like
  `ApiFixture.cs`/`TestDb.cs`/`TestAuthHandler.cs`, `Client/**`), set a `run_full` flag.
- Build the run: incremental `dotnet build` on the test project, then
  `dotnet test --no-build --no-restore` with either no filter (`run_full`) or
  `--filter "FullyQualifiedName~Features.<A>.<B>|FullyQualifiedName~Features.<C>.<D>|…"`
  (OR-joined slice tokens).
- Exit non-zero if the test run fails, aborting the commit.

Build/run commands operate from `backend/` (or with explicit project paths); confirm the test
project path from `research.md` (`backend/Picnivo.Tests`). Editing a test file does not retrigger
the NSwag target — the incremental build handles it.

#### 2. Wire backend into the dispatcher

**File**: `.husky/pre-commit`

**Intent**: Add the backend gate call after the frontend call.

**Contract**: Append an invocation of `backend/scripts/pre-commit-tests.sh` to the root
dispatcher; a non-zero exit aborts the commit. Order relative to the frontend call does not matter
functionally — keep frontend first for continuity.

### Success Criteria:

#### Automated Verification:

- [ ] `backend/scripts/pre-commit-tests.sh` is executable and passes `bash -n` (syntax check)
- [ ] Path → filter mapping is correct for a known risk file: staging `backend/Picnivo.API/Features/Claims/ClaimItem/ClaimItem.cs` yields filter token `Features.Claims.ClaimItem`
- [ ] A scoped run executes standalone: `dotnet build backend/Picnivo.Tests && dotnet test backend/Picnivo.Tests --no-build --no-restore --filter "FullyQualifiedName~Features.Claims.ClaimItem"`

#### Manual Verification:

- [ ] Committing a staged risk `.cs` (e.g. under `Features/Votes/CastVotes/`) runs only the mapped slice tests
- [ ] Committing multiple staged risk `.cs` across slices runs the OR-joined union
- [ ] Staging a cross-cutting file (e.g. `backend/Picnivo.API/Data/*.cs` or `Program.cs`) escalates to the full backend suite
- [ ] A failing backend test aborts the commit
- [ ] A commit with no staged backend `.cs` skips the backend gate (no `dotnet` invocation)

**Implementation Note**: After Phase 3 automated verification passes, pause for human confirmation
of the full pre-commit behavior (scoped run, cross-cutting escalation, failure abort).

---

## Testing Strategy

This change wires gates that *run* existing tests; it adds no new test code. "Testing" here means
verifying the gate mechanics.

### Unit / mechanical checks:

- JSON validity of `.claude/settings.json` and `frontend/package.json` (`jq .`).
- Shell syntax of the new scripts (`bash -n`).
- Path → filter derivation for each risk slice (spot-check Claims, CastVotes, GetEventByToken).

### Integration (gate behavior):

- Per-edit hook fires on a risk-area frontend edit, blocks on failure, ignores non-risk files.
- Relocated dispatcher preserves the frontend lint-staged/i18n gate.
- Backend gate: scoped run on staged risk `.cs`; full-suite escalation on cross-cutting; commit
  abort on failure; no-op when no backend `.cs` is staged.

### Manual Testing Steps:

1. Agent-edit `get-event-by-token/functions.ts`; confirm the related test runs in the hook.
2. Stage a frontend `*.ts` and commit; confirm eslint/prettier/vitest/tsc + i18n run via the root dispatcher.
3. Stage `Features/Votes/CastVotes/CastVotes.cs` and commit; confirm only the CastVotes slice runs.
4. Stage `Data/**` (or `Program.cs`) and commit; confirm the full backend suite runs.
5. Introduce a failing backend test in a staged slice; confirm the commit is aborted.

## Performance Considerations

- Per-edit stays fast: only `vitest related` on risk-area edits (no backend, no full suite).
- Pre-commit backend run pays one MSBuild cold-start + incremental build; scoped filter keeps the
  test set small for the common single-slice commit. Cross-cutting commits accept a full-suite run
  (incl. Postgres container) — the safe, deliberate trade for shared-code edits.
- Keep the per-edit hook timeout aligned with the existing hooks (30s); the vitest related run on a
  single slice is well within budget.

## Migration Notes

- The husky relocation removes `frontend/.husky/pre-commit` and the stale `frontend/.husky/` dir
  after the root `.husky/` is generated. Anyone with the repo cloned re-runs `pnpm install` in
  `frontend/` (fires `prepare`) to regenerate `core.hooksPath` at the new root. Note this in the
  commit message so collaborators re-install.
- No data migration; config/scripts only.

## References

- Research: `context/changes/testing-quality-gates-wiring/research.md`
- Test plan: `context/foundation/test-plan.md` §3 (Phase 4 row), §5 (gates), §6.7 (per-phase notes)
- Current per-edit hooks: `.claude/settings.json`
- Current pre-commit: `frontend/.husky/pre-commit`, `frontend/.lintstagedrc.js`
- Backend risk slices: `backend/Picnivo.API/Features/{Claims,Events/GetEventByToken,Items/RemoveItem,Participants/SetAttendance,Votes/CastVotes}/**`
- Fast/slow fixtures: `backend/Picnivo.Tests/TestDb.cs:13` (SQLite), `backend/Picnivo.Tests/ApiFixture.cs:20-38` (Postgres)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Per-Edit Frontend Scoped-Test Hook

#### Automated

- [x] 1.1 `.claude/settings.json` is valid JSON (`jq .`) — 29f1f39
- [x] 1.2 Frontend scoped test command works standalone (`pnpm exec vitest related … --run`) — 29f1f39

#### Manual

- [x] 1.3 Editing a risk-area file triggers the related test run in the hook — 29f1f39
- [x] 1.4 A failing related test blocks (`exit 2`) and output appears in agent context — 29f1f39
- [x] 1.5 Editing a non-risk frontend file does NOT trigger a test run — 29f1f39

### Phase 2: Relocate Husky to a Repo-Root Dispatcher

#### Automated

- [x] 2.1 `frontend/scripts/pre-commit.sh` and `.husky/pre-commit` are executable
- [x] 2.2 `git config core.hooksPath` reports the root `.husky/_` after prepare
- [x] 2.3 `frontend/package.json` valid JSON; `prepare` targets root `.husky`

#### Manual

- [x] 2.4 A real commit runs the frontend gate via the relocated dispatcher (unchanged behavior)
- [x] 2.5 `pnpm run i18n:sync` still runs on commit
- [x] 2.6 The old `frontend/.husky/pre-commit` no longer fires (no double-run)

### Phase 3: Backend Pre-Commit Scoped-Test Gate

#### Automated

- [ ] 3.1 `backend/scripts/pre-commit-tests.sh` executable and passes `bash -n`
- [ ] 3.2 Path → filter mapping correct for a known risk file (`Features.Claims.ClaimItem`)
- [ ] 3.3 A scoped run executes standalone (`dotnet build … && dotnet test --no-build --no-restore --filter …`)

#### Manual

- [ ] 3.4 Committing a staged risk `.cs` runs only the mapped slice tests
- [ ] 3.5 Multiple staged risk `.cs` across slices run the OR-joined union
- [ ] 3.6 Staging a cross-cutting file escalates to the full backend suite
- [ ] 3.7 A failing backend test aborts the commit
- [ ] 3.8 A commit with no staged backend `.cs` skips the backend gate
