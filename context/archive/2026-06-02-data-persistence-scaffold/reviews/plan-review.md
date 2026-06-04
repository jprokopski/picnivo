<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Data Persistence Scaffold

- **Plan**: context/changes/data-persistence-scaffold/plan.md
- **Mode**: Deep
- **Date**: 2026-06-02
- **Verdict**: SOUND (after fixes)
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 7/7 paths ✓, 2/2 symbols ✓, brief↔plan ✓

## Findings

### F1 — Phase 3 migrate job missing `dotnet tool restore`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — CI/CD Migration Step, contract lines 201-205
- **Detail**: Phase 2 creates a local tool manifest for `dotnet-ef` at `backend/.config/dotnet-tools.json`. Phase 3's migrate job contract listed four steps (checkout, setup .NET, build bundle, run bundle) but omitted `dotnet tool restore`. Without it, the CI runner won't have the `dotnet ef` command available.
- **Fix**: Add `dotnet tool restore` as a step between .NET SDK setup and `dotnet ef migrations bundle` in the Phase 3 contract.
- **Decision**: FIXED — added `dotnet tool restore` step to Phase 3 contract

### F2 — `DateTime` instead of `DateTimeOffset` for CreatedAt

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Event entity, line 70
- **Detail**: The Event entity specified `DateTime CreatedAt`, which Npgsql maps to `timestamp without time zone`. Postgres best practices recommend `timestamptz` (via `DateTimeOffset`). Since this is the real domain entity S-01 will expand, the column type bakes into the initial migration.
- **Fix**: Change `DateTime CreatedAt` to `DateTimeOffset CreatedAt` in the Event entity contract.
- **Decision**: FIXED — changed to `DateTimeOffset CreatedAt`

### F3 — efbundle command should specify runtime target

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — contract line 204
- **Detail**: The bundle command `--self-contained` omitted a runtime target. It defaults to the build machine's runtime (`linux-x64` on `ubuntu-latest`), which works but is fragile if someone builds locally on macOS.
- **Fix**: Append `-r linux-x64` to the bundle command.
- **Decision**: FIXED — added `-r linux-x64` to bundle command
