---
date: 2026-07-05T09:23:06+02:00
researcher: Jakub Prokopski
git_commit: 7b62976618fa2472bca492271eab2bf5dd09afb7
branch: main
repository: jprokopski/picnivo
topic: "Wire per-edit and pre-commit quality gates for claim/auth/tally risk files (test-plan §3 Phase 4)"
tags: [research, codebase, quality-gates, hooks, husky, lint-staged, testing, dotnet, vitest]
status: complete
last_updated: 2026-07-05
last_updated_by: Jakub Prokopski
---

# Research: Quality-gates wiring (per-edit + pre-commit scoped tests on risk files)

**Date**: 2026-07-05T09:23:06+02:00
**Researcher**: Jakub Prokopski
**Git Commit**: 7b62976618fa2472bca492271eab2bf5dd09afb7
**Branch**: main
**Repository**: jprokopski/picnivo

## Research Question

Phase 4 of `context/foundation/test-plan.md` §3: fire scoped tests on claim/auth/tally
risk files **per-edit** (agent loop) and **pre-commit** (git hook), locking in the
protections built in Phases 1–3 (risks #1–#5). Where does the current gate wiring
already cover this, what's the exact gap, where do the risk files live, and what are
the concrete wiring points and constraints — especially for running "related" backend
(.NET/xUnit) tests, which have no `vitest related` equivalent?

## Summary

**The gate scaffolding already exists — Phase 4 is an *extension*, not a build-from-scratch.**
The per-edit layer (`.claude/settings.json` PostToolUse) and the pre-commit layer
(husky + lint-staged) are both live and already run format/lint/typecheck, and the
pre-commit layer already runs `vitest related` on staged frontend files. Three gaps
remain, all on the **test-running** dimension:

1. **No per-edit test hook.** `.claude/settings.json` runs prettier/eslint/tsc
   (frontend) and csharpier (backend) on `Write|Edit`, but **runs no tests** — neither
   frontend `vitest related` nor any backend test. This is the primary per-edit gap.
2. **No backend gate in pre-commit.** `frontend/.husky/pre-commit` is frontend-only
   (`cd frontend && npx lint-staged`). Backend `.cs` risk files (Claims, Events, Items,
   Votes, Participants) — which are **4 of the 5 risk areas** — get no local test gate
   at all before CI.
3. **Existing `vitest related` is not scoped to risk files.** `frontend/.lintstagedrc.js`
   runs `vitest related` on *every* staged `*.{ts,tsx}`, not just claim/auth/tally
   risk-area files. Whether to narrow it (per test-plan intent) or leave it broad is a
   design choice for the plan.

**Two hard constraints shape the design:**

- **Backend "related tests" is mechanical but coarse.** The xUnit test project mirrors
  `Features/<Area>/<Action>/` 1:1 with namespaces `Picnivo.Tests.Features.<Area>.<Action>`,
  so an edited path → `dotnet test --filter "FullyQualifiedName~Features.<Area>.<Action>"`
  mapping is purely mechanical (no lookup table). But there is **no dependency graph** —
  cross-cutting edits (`Data/**`, `Program.cs`, test fixtures) map to no slice and need an
  explicit "run everything" escalation rule.
- **A fast/slow test split already exists and dictates layering.** Backend `*HandlerTests`
  + `*ValidatorTests` use in-memory SQLite / no DB (fast — per-edit candidates);
  `*EndpointTests` + `CastVotesConstraintTests` spin a **real Postgres Testcontainer**
  (multi-second startup — too slow for per-edit, belong at pre-commit/CI). Plus the backend
  build runs an **NSwag client-generation step**, making naive `dotnet test` per-edit
  expensive.

**Tooling note:** root `AGENTS.md`/`CLAUDE.md` (Lesson 3) discusses `lefthook.yml`, but
there is **no lefthook in the repo** and the guidance itself says "if Husky already works,
don't migrate." The real target is **extending husky + lint-staged**, not introducing
lefthook.

CI already runs the **full** suite per project on PRs, so local Phase 4 gates should stay
**scoped** to avoid duplicating CI coverage. Both gates are marked **recommended** (not
required) in test-plan §5 — deferral is legitimate if cost/signal is poor.

## Detailed Findings

### Area 1 — Current gate wiring (what exists today)

**Per-edit layer — `.claude/settings.json`** (`PostToolUse`, matcher `Write|Edit`), four hooks:
1. prettier `--write` on `frontend/*` files
2. csharpier `format` on `backend/*.cs` files
3. eslint `--fix --quiet` on frontend `*.ts`/`*.tsx` — **blocking** (`exit 2` on failure, stderr → agent context)
4. `tsc --noEmit` on frontend `*.ts`/`*.tsx` — **blocking** (`exit 2`); note this is a **whole-project** typecheck, not scoped

→ **Runs no tests.** This is where per-edit scoped tests must be added.

**Pre-commit layer — `frontend/.husky/pre-commit`:**
```
cd frontend && npx lint-staged
pnpm run i18n:sync
```
`git config core.hooksPath` = `frontend/.husky/_` (husky is wired at repo level but the
hook body only enters `frontend/`). `frontend/package.json` holds the tooling
(`husky ^9.1.7`, `lint-staged ^17.0.8`, `prepare: "cd .. && husky frontend/.husky"`).

**`frontend/.lintstagedrc.js`:**
```js
export default {
  "*.{ts,tsx}": (files) => [
    `eslint --fix ${files.join(" ")}`,
    `prettier --write ${files.join(" ")}`,
    `vitest related ${files.join(" ")} --run`,   // <-- scoped tests already here
    "tsc --noEmit",
  ],
  "*.{js,jsx,json,css,md}": (files) => [`prettier --write ${files.join(" ")}`],
};
```
→ Already runs `vitest related` on staged frontend ts/tsx — but **unconditionally** (not
gated to risk-area files) and **frontend-only** (no `dotnet` gate for staged `.cs`).

**Frontend run commands** (`frontend/package.json`): `test` = `vitest run`,
`typecheck` = `tsc --noEmit`, `lint` = `eslint src/`. `vitest related <file> --run` is the
scoped form (subcommand, not a flag). `related` is a subcommand — use `--run` to avoid watch mode.

### Area 2 — Risk-area file map (what the gates must target)

Backend API `Features/` ↔ test `Features/` mirror 1:1. Risk-area slices:

| Risk | Area/Action | API path | Test path |
|------|-------------|----------|-----------|
| #1 Claim FCFS | `Claims/ClaimItem`, `Claims/ReleaseClaim` | `backend/Picnivo.API/Features/Claims/**` | `backend/Picnivo.Tests/Features/Claims/**` |
| #2 Eligibility gate | `Participants/SetAttendance` | `…/Features/Participants/SetAttendance/**` | `…/Tests/Features/Participants/SetAttendance/**` |
| #3 Authorization/IDOR | `Items/RemoveItem` (+ Events organizer actions) | `…/Features/Items/RemoveItem/**` | `…/Tests/Features/Items/RemoveItem/**` |
| #4 Vote integrity | `Votes/CastVotes` | `…/Features/Votes/CastVotes/**` | `…/Tests/Features/Votes/CastVotes/**` |
| #5 Best-date aggregation | `Events/GetEventByToken` + frontend | `…/Features/Events/GetEventByToken/**` | `…/Tests/Features/Events/GetEventByToken/**` |

**Frontend risk files** (`frontend/src/features/events/`):
- Risk #5: `get-event-by-token/functions.ts`, `.../schema.ts`,
  `.../components/event-detail-view.tsx`, `best-hero.tsx`, `announce-hero.tsx` — with
  colocated `*.test.ts(x)` (`functions.test.ts`, `event-detail-view.test.tsx`, etc.)
- Risk #2/#5: `set-attendance/schema.ts`, `set-attendance/functions.ts` + `schema.test.ts`

**Glob patterns a hook can use to decide "is this a risk file?":**
```
backend/Picnivo.API/Features/{Claims,Events/GetEventByToken,Items/RemoveItem,Participants/SetAttendance,Votes/CastVotes}/**/*.cs
backend/Picnivo.Tests/Features/{Claims,Events/GetEventByToken,Items/RemoveItem,Participants/SetAttendance,Votes/CastVotes}/**/*.cs
frontend/src/features/events/{get-event-by-token,set-attendance}/**/*.{ts,tsx}
```
(A simpler, coarser backend variant is `Features/{Claims,Events,Items,Votes,Participants}/**` —
whole-area rather than per-slice. The plan should pick precision-vs-simplicity here.)

### Area 3 — Backend scoped-test feasibility (the hard part)

**Namespaces mirror folders 1:1**, verified across five files:
- `ClaimItemHandlerTests.cs:8` → `namespace Picnivo.Tests.Features.Claims.ClaimItem;`
- `GetEventByTokenHandlerTests.cs:8` → `namespace Picnivo.Tests.Features.Events.GetEventByToken;`
- `CastVotesConstraintTests.cs:7` → `namespace Picnivo.Tests.Features.Votes.CastVotes;`
- `SetAttendanceEndpointTests.cs:7` → `namespace Picnivo.Tests.Features.Participants.SetAttendance;`

Every test method's FQN is `Picnivo.Tests.Features.<Area>.<Action>.<Class>.<Method>` —
**fully derivable from the file path.** No `[Trait]`/`[Category]` attributes exist anywhere,
so filtering must go through `FullyQualifiedName`.

**Path → filter mapping (mechanical, no lookup table):** take the path segment after
`Features/`, keep `<Area>/<Action>`, join with `.`, prefix `Features.`:
- `…/Features/Claims/ClaimItem/ClaimItem.cs` → `--filter "FullyQualifiedName~Features.Claims.ClaimItem"`
- Works identically whether the edited file is under `Picnivo.API/Features/**` **or**
  `Picnivo.Tests/Features/**`. All 13 slice names are **identical 1:1** across API and
  tests (diffed) — **no divergence, no special-casing.**

**Fast/slow test tiers (by fixture):**
- **SLOW (Postgres Testcontainer)** — `ApiFixture.cs:22` starts `postgres:16-alpine`
  (`InitializeAsync`, line 31) and pre-migrates a **pool of 10 DBs** (`PoolSize = 10`,
  lines 20, 33-38); multi-second startup. All 14 `*EndpointTests` + `CastVotesConstraintTests`
  use `[Collection("Api")]` + full `WebApplicationFactory<Program>` HTTP stack.
  → **pre-commit / CI only.** (Container-startup cost is fixed regardless of how many slices
  the filter selects, so scoping a Postgres run saves little on the dominant cost.)
- **FAST (SQLite in-memory)** — `TestDb.cs:13` builds an in-memory SQLite `PicnivoDbContext`
  via `EnsureCreated` (no container, no HTTP). The 12 `*HandlerTests` use this.
- **FASTEST (no DB)** — 6 pure-unit files (`*ValidatorTests`, `ShareTokenGeneratorTests`).
  → FAST + FASTEST are the **per-edit candidates.**

To keep a per-edit backend run to SQLite/unit only, filter *and* exclude endpoint/constraint
tests (no traits, so use name substrings):
`--filter "FullyQualifiedName~Features.<Area>.<Action>&FullyQualifiedName!~EndpointTests&FullyQualifiedName!~ConstraintTests"`

**Build cost is the sharp edge.** `Picnivo.Tests.csproj` runs an **NSwag client-generation
`Exec` target on `CoreCompile`** (`GenerateApiClient` → `dotnet nswag run nswag.json`), so a
naive per-edit `dotnet test` pays build + client regeneration each time. Options:
- `dotnet test --no-build` / `dotnet vstest …dll` — fast but **stale-assembly risk** (tests
  old code if the edit wasn't built); `vstest` is also being deprecated. Not safe standalone.
- `dotnet test --no-restore` — safe small win (skips NuGet restore, keeps build).
- **Safe middle ground:** incremental `dotnet build` + `dotnet test --no-build --no-restore
  --filter …`. Editing a *test* file doesn't retrigger NSwag (separate incremental target).
- Floor: MSBuild cold-start JIT (~1–2s) on every `dotnet` invocation regardless.

**Cross-cutting escalation (the unsolved case for any scoped strategy):** edits under
`Picnivo.API/Data/**`, `Program.cs`, `EndpointExtensions.cs`, `ValidationEndpointFilter.cs`,
`ExceptionHandling/**`, or test fixtures (`ApiFixture.cs`, `TestDb.cs`, `TestAuthHandler.cs`,
`Client/**`) map to **no slice** → the plan needs an explicit rule: run full suite, or defer
to pre-commit/CI, or a coarse "Data change → run everything".

**Pre-commit staged-file mapping:** filter `*.cs` under `…/Features/**`, extract
`Features.<Area>.<Action>` per file, dedupe, OR-join into one run:
`--filter "FullyQualifiedName~Features.Claims.ClaimItem|FullyQualifiedName~Features.Votes.CastVotes"`.
Pre-commit tolerates the Postgres cost, so it *can* include endpoint tests (one container
start amortizes across all selected slices). Same cross-cutting escalation rule applies.

### Area 4 — CI (what already runs, so local gates don't duplicate)

- **`ci-frontend.yml`** — trigger `pull_request` only, path filter `frontend/**`.
  `working-directory: frontend`: pnpm install `--frozen-lockfile` → `pnpm test` (full vitest)
  → `pnpm build`. No standalone lint/typecheck (typecheck folds into build).
- **`ci-backend.yml`** — trigger `pull_request` only, path filter `backend/**`.
  `working-directory: backend`: `dotnet tool restore` → `dotnet restore` → `dotnet build
  --no-restore -c Release` → `dotnet test --no-restore -c Release` (full suite).

→ CI runs the **full** suite per project on PRs. Local Phase 4 gates stay **scoped** to
edited/staged risk files; they exist to shorten the feedback loop, not replace CI.

## Code References

- `.claude/settings.json` — PostToolUse `Write|Edit` hooks: prettier/csharpier/eslint/tsc; **no test hook** (per-edit gap)
- `frontend/.husky/pre-commit` — `cd frontend && npx lint-staged` + `pnpm run i18n:sync` (frontend-only; no backend gate)
- `frontend/.lintstagedrc.js` — `eslint`/`prettier`/`vitest related --run`/`tsc` on staged ts/tsx (unconditional, not risk-scoped)
- `frontend/package.json:12-14` — `test`=`vitest run`, `typecheck`=`tsc --noEmit`, `lint`=`eslint src/`; `prepare` wires husky
- `backend/Picnivo.Tests/Picnivo.Tests.csproj` — `GenerateApiClient` NSwag `Exec` target (build cost)
- `backend/Picnivo.Tests/ApiFixture.cs:20-38,170` — Postgres Testcontainer + 10-DB pool (slow tier)
- `backend/Picnivo.Tests/TestDb.cs:13` — in-memory SQLite context (fast tier)
- `backend/Picnivo.Tests/Features/**` — `*HandlerTests` (SQLite), `*EndpointTests` (Postgres), `*ValidatorTests` (no DB)
- `backend/Picnivo.API/Features/{Claims,Events/GetEventByToken,Items/RemoveItem,Participants/SetAttendance,Votes/CastVotes}/**` — risk-area sources
- `frontend/src/features/events/{get-event-by-token,set-attendance}/**` — frontend risk sources + colocated tests
- `.github/workflows/ci-frontend.yml`, `.github/workflows/ci-backend.yml` — full-suite CI on PR
- `context/foundation/test-plan.md:69` (§3 Phase 4 row), `:96-108` (§5 gates), `:155-158` (§6.7 phase notes)

## Architecture Insights

- **Extend, don't rebuild.** Three of four hook layers already exist; Phase 4 adds test
  execution to two of them. The per-edit test hook is new `.claude/settings.json` entries;
  the pre-commit backend gate extends husky (a new lint-staged glob for `*.cs`, or a
  separate step in the `pre-commit` script since lint-staged's cwd is `frontend/`).
- **Convention pays off.** The strict vertical-slice mirror (`Features/<Area>/<Action>/`,
  namespaces = folders) makes backend scoped runs a pure string transform — the same
  convention documented in memory `[[project_vertical-slice-architecture]]` and
  `[[feedback_frontend-feature-structure]]`.
- **Cost/signal per layer is already encoded in the fixtures.** SQLite/unit tests are the
  natural per-edit unit; Postgres endpoint tests are the natural pre-commit/CI unit. The
  split isn't something to invent — it's readable from which fixture a test class uses.
- **Blocking convention exists.** The eslint/tsc hooks already use `exit 2` + stderr to feed
  the agent context; a per-edit test hook should follow the same shape so failures self-correct
  in the next turn.
- **Recommended, not required.** test-plan §5 marks both scoped gates *recommended after
  Phase 4* — consistent with Lesson-3 guidance that a plan may defer per-edit hooks when the
  cost/signal ratio (esp. the backend Postgres + NSwag build cost) doesn't justify them.

## Historical Context (from prior changes)

- **Phase 1** `context/archive/2026-07-04-testing-claim-path-integrity/` — established that
  backend contention/constraint tests need Docker/Postgres (Testcontainers); fast handler
  tests use SQLite. `plan-brief.md:59`. Also §6.7: the 409-vs-500 mapping only fires when
  `ApiFixture.cs` matches `Program.cs` wiring.
- **Phase 2** `context/archive/2026-07-04-testing-authorization-boundaries/` — run commands
  `dotnet test backend/Picnivo.Tests`, filtered as `--filter "FullyQualifiedName~…"`
  (`impl-review.md`). Confirms the filter approach already used by hand.
- **Phase 3** `context/changes/testing-aggregation-correctness/` — frontend runs
  `pnpm --dir frontend test`; backend `dotnet test --filter "FullyQualifiedName~GetEventByToken"`
  (`impl-review.md:59`). No phase touched husky/lint-staged/CI — gate wiring is genuinely new
  work deferred to Phase 4.
- **Gate wiring commit history:**
  - `7d64aad` `chore(frontend): add Husky + lint-staged pre-commit hook` — the key commit
    ("staged files get eslint, prettier, related vitest tests, and a typecheck even when they
    bypass the per-edit agent hook").
  - `57b4e20` `fix(get-event-by-token): resync stale Lingui catalog, auto-sync on commit` —
    why `pre-commit` also runs `pnpm run i18n:sync`.
  - `c7ef29f` `chore(backend): add CSharpier per-edit formatting hook`.
  - `676b7a4` `ci: add build and test workflows for pull requests`.

## Related Research

- `context/foundation/test-plan.md` §3 (phased rollout), §4 (stack), §5 (quality gates),
  §6.1–6.7 (cookbook patterns — reference tests per risk area), §6.7 (per-phase notes).
- Root `AGENTS.md`/`CLAUDE.md` Module 3 Lesson 3 (hook lifecycle, exit codes, layer router) —
  the conceptual frame; its `lefthook.yml` references are illustrative (see Open Questions).

## Open Questions

These are **plan decisions**, surfaced by research — not blockers:

1. **Scope breadth for the existing frontend `vitest related`** — narrow to risk-area globs
   (test-plan intent) or leave broad on all staged ts/tsx (current behavior, arguably fine
   since `vitest related` is already cheap and precise)?
2. **Per-edit backend tests: include or defer?** SQLite/unit slice tests are fast enough, but
   every `dotnet` call pays ~1–2s MSBuild cold-start + potential incremental build. Is the
   signal worth blocking the agent loop, or is backend testing better left to pre-commit only?
3. **Build strategy for a backend per-edit/pre-commit hook** — safe incremental
   `dotnet build` + `dotnet test --no-build --no-restore --filter` vs accepting full
   `dotnet test`. `--no-build` alone is unsafe (stale assembly).
4. **Cross-cutting escalation rule** — what does a hook do when a staged/edited `.cs` maps to
   no slice (`Data/**`, `Program.cs`, fixtures)? Run full suite, or defer to CI?
5. **Pre-commit backend wiring mechanism** — extend `.lintstagedrc.js` with a `*.cs` glob
   (but lint-staged runs with cwd `frontend/`), or add a separate backend step directly in the
   `frontend/.husky/pre-commit` script? The husky `prepare` is `cd .. && husky frontend/.husky`
   — the hooks dir is under `frontend/`, so a backend step must `cd` to repo root / `backend/`.
6. **Confirm the lefthook non-migration** in the plan explicitly (guidance mentions it; repo
   has none; keep husky).
