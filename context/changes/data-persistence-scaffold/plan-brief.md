# Data Persistence Scaffold — Plan Brief

> Full plan: `context/changes/data-persistence-scaffold/plan.md`

## What & Why

Add a data persistence layer to the Picnivo backend using EF Core and Supabase Postgres. This is foundation F-01 — every downstream slice (event creation, voting, item claims) needs structured data storage. Without it, nothing beyond the current placeholder endpoints can be built.

## Starting Point

The backend is a minimal ASP.NET Core 10 Minimal API deployed to Fly.io with only `/healthz` and a sample `/weatherforecast` endpoint. There is no ORM, no database, no models, and no migration infrastructure. Infrastructure research already concluded that Fly Postgres ($38/mo) is too expensive and recommended an external provider.

## Desired End State

The backend connects to Supabase Postgres via EF Core + Npgsql. A proof-of-concept `Event` entity with a dedicated `IEntityTypeConfiguration` validates the full pipeline. Migrations are managed via `dotnet ef` and applied automatically in CI/CD before each deploy. Local development uses Supabase CLI for a local Postgres instance. Feature slices (S-01, S-02) can immediately start adding entities and migrations without any infrastructure setup.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Database provider | Supabase Postgres (free tier) | External Postgres avoids $38/mo Fly Postgres cost; Supabase free tier offers 500MB storage with EU regions close to Fly's `arn` |
| ORM | EF Core 10 + Npgsql | First-party .NET ORM with code-first migrations, LINQ, and strong tooling — standard choice for ASP.NET |
| Entity configuration | `IEntityTypeConfiguration<T>` classes | Keeps DbContext clean; entity config lives in dedicated files per entity |
| Migration strategy | EF Core code-first migrations | Tightly integrated with model changes; auto-generates migration files |
| Migration application | CI/CD step (before deploy) | Decouples migration from app startup; fails fast before deploy reaches production |
| Local dev database | Supabase CLI (Postgres-only) | Mirrors production engine; runs locally via Docker with minimal footprint using `-x` flag |
| Schema scope | Minimal proof-of-concept | One `Event` entity validates the pipeline without committing to a schema that feature planning may refine |
| Connection string mgmt | `fly secrets` + `appsettings.Development.json` | Standard ASP.NET Core config binding; production secrets never touch code |

## Scope

**In scope:**
- EF Core + Npgsql NuGet packages and DbContext setup
- One `Event` entity with `IEntityTypeConfiguration` and initial migration
- Supabase CLI local dev workflow
- CI/CD migration job in GitHub Actions (using `efbundle`)
- Production connection to Supabase cloud Postgres
- Developer documentation updates

**Out of scope:**
- Full domain model (Events, DateOptions, Items, Participants, Votes)
- Seed data
- Database health check endpoint
- Connection pooling (Supavisor)
- Data Protection key persistence
- Unit/integration test infrastructure

## Architecture / Approach

EF Core connects to Postgres via Npgsql. The DbContext auto-discovers entity configurations via `ApplyConfigurationsFromAssembly`. Migrations are generated with `dotnet ef migrations add --output-dir Data/Migrations` and applied via a bundled executable (`efbundle`) in CI/CD — the CI runner doesn't need the EF CLI tool. Locally, Supabase CLI runs a Postgres container on port 54322. The connection string flows through standard ASP.NET Core configuration: `appsettings.Development.json` for local, `fly secrets` (as env var) for production, GitHub Actions secret for CI/CD migrations.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. EF Core + Npgsql Setup | DbContext, Event entity + config, initial migration | Wrong package versions or Npgsql incompatibility with .NET 10 |
| 2. Local Dev Workflow | Supabase CLI Postgres, dev connection string, verified migration | Docker requirement for Supabase CLI; port conflicts |
| 3. CI/CD Migration Step | GitHub Actions migrate job before deploy | CI runner needs to reach Supabase cloud; secret management |
| 4. Production Wiring + Verification | Live connection, end-to-end deploy, health check | Supabase free tier cold-start; connection string misconfiguration |

**Prerequisites:** Docker Desktop for local Supabase CLI; Supabase account for cloud project; `dotnet-ef` tool
**Estimated effort:** ~1 session across 4 phases

## Open Risks & Assumptions

- Supabase free tier pauses after 7 days of inactivity — low-traffic periods could cause the DB to pause and need manual restart
- Cross-network latency from Fly.io `arn` to Supabase EU region adds ~10-30ms per query — acceptable for MVP
- The `Event` entity created here is the real domain entity that S-01 will expand, not a throwaway

## Success Criteria (Summary)

- `dotnet ef database update` applies the initial migration locally against Supabase CLI Postgres
- GitHub Actions pipeline runs migrations then deploys successfully
- The deployed app on Fly.io starts, connects to Supabase Postgres, and `/healthz` returns 200
