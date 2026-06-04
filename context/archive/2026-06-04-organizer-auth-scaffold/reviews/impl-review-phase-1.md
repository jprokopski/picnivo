<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Organizer Auth Scaffold

- **Plan**: context/changes/organizer-auth-scaffold/plan.md
- **Scope**: Phase 1 of 4
- **Date**: 2026-06-04
- **Verdict**: APPROVED (after fixes)
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — ValidateAudience disabled on JWT middleware

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: backend/Picnivo.API/Program.cs:39
- **Detail**: ValidateAudience = false skipped JWT audience validation. Supabase tokens consistently set aud = "authenticated".
- **Fix**: Set ValidAudience = "authenticated" (implicitly enables audience validation).
- **Decision**: FIXED

### F2 — Missing FK drop in migration Down method

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: backend/Picnivo.API/Data/Migrations/AddOrganizer.cs
- **Detail**: Down method relied on implicit cascade from DropTable instead of explicit FK drop per plan contract.
- **Fix**: Added explicit ALTER TABLE DROP CONSTRAINT before DropTable.
- **Decision**: FIXED (applied during F3 migration regeneration)

### F3 — Inconsistent table naming: Events (PascalCase) vs organizers (lowercase)

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Pattern Consistency
- **Location**: backend/Picnivo.API/Data/Configurations/OrganizerConfiguration.cs
- **Detail**: EventConfiguration uses default PascalCase "Events"; OrganizerConfiguration had explicit ToTable("organizers").
- **Fix**: Removed ToTable("organizers"), standardized on PascalCase convention. Regenerated migration with "Organizers" table name. Updated all raw SQL references.
- **Decision**: FIXED

### F4 — SECURITY DEFINER trigger missing SET search_path

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: backend/Picnivo.API/Data/Migrations/AddOrganizer.cs
- **Detail**: handle_new_user() used SECURITY DEFINER without SET search_path = public (Supabase best practice).
- **Fix**: Added SET search_path = public to function definition.
- **Decision**: FIXED (applied during F3 migration regeneration)

### F5 — No startup guard for Supabase:Authority config

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: backend/Picnivo.API/Program.cs
- **Detail**: Missing Supabase__Authority env var would silently fail JWT discovery. No startup validation like the connection string guard.
- **Fix**: Added startup guard throwing InvalidOperationException if Supabase:Authority is empty.
- **Decision**: FIXED

### F6 — Kong removal from exclusion list not in plan

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: backend/AGENTS.md:16
- **Detail**: Plan said remove gotrue/mailpit; implementation also removed kong (needed as API gateway for GoTrue). Beneficial deviation.
- **Decision**: SKIPPED (acknowledged as correct adaptation)
