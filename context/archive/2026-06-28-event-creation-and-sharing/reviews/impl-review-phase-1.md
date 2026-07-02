<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Event Creation and Sharing (S-01)

- **Plan**: context/changes/event-creation-and-sharing/plan.md
- **Scope**: Phase 1 of 6 — Backend Data Model & Migration
- **Date**: 2026-06-28
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 1 observation

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

### F1 — Migration NOT NULL backfill defaults assume an empty Events table

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: backend/Picnivo.API/Data/Migrations/20260627231938_AddEventDetailsDateOptionsAndItems.cs:28-41, 86-90, 102-108
- **Detail**: OrganizerId (uuid NOT NULL, zero-GUID default) gains an FK to Organizers ON DELETE CASCADE, and Token (NOT NULL, "" default) gains a UNIQUE index. On any pre-existing Events row the FK fails (zero-GUID matches no Organizer) and two+ rows collide on Token="". Fails loud (deploy aborts), not silent corruption. Prod almost certainly empty (no create endpoint until S-01). Plan's Migration Notes assert this but admit "scaffold proof-of-concept rows" may exist.
- **Fix A ⭐ Recommended**: Keep migration as-is; verify Events is empty before applying; document the assumption inline.
  - Strength: Matches reality (pre-launch); constraints self-protect by aborting rather than corrupting.
  - Tradeoff: Relies on an out-of-band check; a stray POC row blocks deploy.
  - Confidence: HIGH — InitialCreate Events had only Id/Title/CreatedAt; nothing writes events today.
  - Blind spot: Haven't queried the actual prod DB for residual rows.
- **Fix B**: Restructure as add-nullable → backfill → enforce NOT NULL/FK.
  - Strength: Survives a populated table without manual pre-checks.
  - Tradeoff: Overkill for an empty pre-launch table; no sensible OrganizerId to backfill orphans with.
  - Confidence: MED.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — added an inline NOTE comment in the migration's Up() documenting the empty-table assumption and the fail-loud behavior.

### F2 — Inconsistent timestamptz column-type mapping style

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: backend/Picnivo.API/Data/Configurations/DateOptionConfiguration.cs:13-15 vs EventConfiguration.cs:30-31
- **Detail**: DateOption.StartsAt used explicit HasColumnType("timestamp with time zone") while Event.CreatedAt (and Organizer.CreatedAt) rely on Npgsql's DateTimeOffset → timestamptz convention. Both produce timestamptz.
- **Fix**: Align to the established convention. Verified the model snapshot records the resolved column type for all three regardless, so dropping the fluent call produces no snapshot/migration drift.
- **Decision**: FIXED — removed `.HasColumnType("timestamp with time zone")` from DateOptionConfiguration, leaving `.IsRequired()` to match the convention used by Event/Organizer CreatedAt.

### F3 — Child FKs configured on the principal (Event) side, not in each child config

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: backend/Picnivo.API/Data/Configurations/EventConfiguration.cs:39-47
- **Detail**: Plan wording for the child configs said "FK to Event," but FKs are declared once on the Event side via HasMany(...).WithOne(...).HasForeignKey(...). EF resolves the relationship and cascade correctly — purely a placement choice.
- **Fix**: Accept as-is, or move each FK into its child config for symmetry.
- **Decision**: SKIPPED — functionally correct; single source of truth on the Event side is acceptable.

## Notes (outside findings)

- Token generator (ShareTokenGenerator.cs) is sound: cryptographic RandomNumberGenerator.GetInt32 (rejection-sampled, no modulo bias), base62, default length 10 ≈ 59.5 bits entropy, URL-safe, pure/unit-testable.
- Collision-retry referenced in the generator comment lives at the insert site = Phase 2 scope. Confirm it lands with POST /api/events.
- The p1 commit also carried design-mock .jsx files and doc edits referenced by later phases — benign bundling, not scope creep.
- Success criteria: `dotnet build` passes (re-verified post-fix). Migration apply/revert (1.2, 1.3) require a live Postgres and were verified at implementation time (marked [x] against c9cb421); not re-run here.
