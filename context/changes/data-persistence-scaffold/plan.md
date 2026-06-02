# Data Persistence Scaffold — Implementation Plan

## Overview

Add a data persistence layer to the Picnivo backend so it can persist and retrieve structured data. This is the foundation (F-01) that every downstream slice depends on — event creation (S-01), voting and claims (S-02) all need storage. The scope is deliberately minimal: prove the full pipeline (EF Core + Postgres + migrations + local dev + CI/CD) works end-to-end with one proof-of-concept entity, then get out of the way for feature slices.

## Current State Analysis

The backend is a fresh ASP.NET Core 10 Minimal API with two endpoints (`/healthz`, `/weatherforecast`) and a single NuGet dependency (`Microsoft.AspNetCore.OpenApi`). There is no ORM, no database connection, no models beyond the placeholder `WeatherForecast` record in `Program.cs`. Deployment to Fly.io (Stockholm `arn`, shared-cpu-1x, 512MB) is live with GitHub Actions CI/CD. Infrastructure research already concluded Fly Postgres ($38/mo) is too expensive for MVP.

### Key Discoveries:

- `backend/Picnivo.API/Program.cs:1-30` — Entire app is a single file with inline endpoint definitions and OpenAPI setup
- `backend/Picnivo.API/Picnivo.API.csproj` — Only package is `Microsoft.AspNetCore.OpenApi 10.0.5`, targeting `net10.0`
- `backend/fly.toml` — Production config with `DOTNET_GCHeapHardLimit=0x10000000` (256MB), auto-stop enabled
- `backend/context/foundation/infrastructure.md:52-53` — Explicitly recommends external Postgres (Neon/Supabase free tier) over Fly Postgres
- Supabase CLI can run Postgres-only locally via `-x` flag to exclude unnecessary services

## Desired End State

After this plan is complete:

1. The backend has a `PicnivoDbContext` registered in DI, connected to Postgres via Npgsql
2. One proof-of-concept entity (`Event` with `Id`, `Title`, `CreatedAt`) exists with an `IEntityTypeConfiguration<Event>` class
3. An EF Core migration (`InitialCreate`) exists and can be applied via `dotnet ef database update`
4. Local development uses Supabase CLI (`supabase start -x ...`) to run a local Postgres container
5. The GitHub Actions deploy workflow runs migrations against production Supabase before deploying the new app version
6. The production Fly.io app connects to Supabase cloud Postgres via a connection string stored in `fly secrets`
7. The `/healthz` endpoint still returns 200 (no regression)

**Verification**: `dotnet ef database update` succeeds locally, the CI/CD migration step passes in GitHub Actions, and the deployed app starts successfully with the database connected.

## What We're NOT Doing

- Full domain model (Events with DateOptions, Items, Participants, Votes) — that belongs to S-01/S-02 planning
- Seed data — deferred until a feature slice needs test data
- Database health check in `/healthz` — keep it fast per existing convention
- Supabase client SDK — we're using Supabase purely as a Postgres host, accessed via EF Core + Npgsql
- Connection pooling (Supavisor/PgBouncer) — not needed at MVP traffic levels; direct connection is fine
- Data Protection key persistence — deferred to F-02 (auth scaffold) when cookies/tokens are introduced

## Implementation Approach

EF Core 10 with the Npgsql provider connects to Supabase Postgres (which is standard Postgres). Locally, Supabase CLI runs a Postgres container. Entity configurations live in dedicated `IEntityTypeConfiguration<T>` classes to keep the DbContext clean. Migrations are code-first via `dotnet ef`. In CI/CD, a new job runs migrations before the deploy job, using a bundled `efbundle` executable so the CI runner doesn't need the EF CLI tool or SDK installed.

---

## Phase 1: EF Core + Npgsql Setup

### Overview

Add EF Core with the Npgsql provider, create a minimal DbContext, define a proof-of-concept `Event` entity with a separate configuration class, and generate the initial migration.

### Changes Required:

#### 1. NuGet packages

**File**: `backend/Picnivo.API/Picnivo.API.csproj`

**Intent**: Add EF Core and Npgsql NuGet packages so the project can define a DbContext and generate migrations.

**Contract**: Add `PackageReference` entries for `Npgsql.EntityFrameworkCore.PostgreSQL` and `Microsoft.EntityFrameworkCore.Design`. The Design package is needed for the `dotnet ef` CLI to discover the DbContext at design time.

#### 2. Event entity

**File**: `backend/Picnivo.API/Data/Models/Event.cs` (new)

**Intent**: Define a minimal proof-of-concept entity to validate the full persistence pipeline. This is intentionally bare — feature slices will expand the model.

**Contract**: A `public class Event` with properties `Guid Id`, `string Title`, `DateTimeOffset CreatedAt`. Lives in namespace `Picnivo.API.Data.Models`.

#### 3. Event entity configuration

**File**: `backend/Picnivo.API/Data/Configurations/EventConfiguration.cs` (new)

**Intent**: Configure the Event entity's table mapping, constraints, and column types in a dedicated configuration class rather than inline in the DbContext.

**Contract**: Implements `IEntityTypeConfiguration<Event>`. Configures `Id` as the primary key, `Title` as required with a max length, `CreatedAt` with a default value. Table name `Events`.

#### 4. DbContext

**File**: `backend/Picnivo.API/Data/PicnivoDbContext.cs` (new)

**Intent**: Create the EF Core DbContext that serves as the single entry point for all database operations. Uses `ApplyConfigurationsFromAssembly` to auto-discover entity configurations.

**Contract**: `public class PicnivoDbContext : DbContext` with a `DbSet<Event> Events` property. In `OnModelCreating`, calls `modelBuilder.ApplyConfigurationsFromAssembly(typeof(PicnivoDbContext).Assembly)` to pick up all `IEntityTypeConfiguration<T>` implementations in the project.

#### 5. Service registration

**File**: `backend/Picnivo.API/Program.cs`

**Intent**: Register the DbContext in DI so it's available to endpoints and services. Remove the placeholder `WeatherForecast` endpoint and record since they're no longer needed.

**Contract**: Call `builder.Services.AddDbContext<PicnivoDbContext>(options => options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")))` before `builder.Build()`. Remove the `/weatherforecast` endpoint and the `WeatherForecast` record.

#### 6. Initial migration

**Intent**: Generate the first EF Core migration that creates the `Events` table. This migration file is committed to the repo and applied by CI/CD or locally via `dotnet ef database update`.

**Contract**: Run `dotnet ef migrations add InitialCreate --project Picnivo.API --output-dir Data/Migrations` from `backend/`. This produces a `Data/Migrations/` folder inside `Picnivo.API/` with the migration files.

### Success Criteria:

#### Automated Verification:

- Project builds: `dotnet build` from `backend/Picnivo.API/`
- Migration files exist in `backend/Picnivo.API/Data/Migrations/`
- `dotnet ef migrations list --project Picnivo.API` from `backend/` shows `InitialCreate`

#### Manual Verification:

- Code review: DbContext uses `ApplyConfigurationsFromAssembly`, not inline configuration
- Code review: `EventConfiguration` implements `IEntityTypeConfiguration<Event>` correctly
- Code review: `/weatherforecast` endpoint and `WeatherForecast` record are removed

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Local Dev Workflow

### Overview

Set up Supabase CLI to run a local Postgres instance, configure the development connection string, verify migrations apply locally, and update developer documentation.

### Changes Required:

#### 1. Supabase CLI initialization

**Intent**: Initialize the Supabase CLI configuration in the backend directory so `supabase start` can spin up a local Postgres container for development.

**Contract**: Run `supabase init` from `backend/`, producing a `backend/supabase/` directory with `config.toml`. The config is default — we only use it to run Postgres locally.

#### 2. Git-ignore Supabase local state

**File**: `backend/.gitignore`

**Intent**: Exclude Supabase CLI local state files from version control while keeping the config tracked.

**Contract**: Add entries to ignore Supabase local runtime state (`.temp/`, etc.) but keep `supabase/config.toml` tracked.

#### 3. Development connection string

**File**: `backend/Picnivo.API/appsettings.Development.json`

**Intent**: Configure the connection string for local development to point at the Supabase CLI local Postgres instance.

**Contract**: Add a `ConnectionStrings.DefaultConnection` entry with value `Host=127.0.0.1;Port=54322;Database=postgres;Username=postgres;Password=postgres`.

#### 4. dotnet-ef tool manifest

**Intent**: Add the `dotnet-ef` tool as a local tool manifest so all developers use the same version without requiring a global install.

**Contract**: Run `dotnet new tool-manifest` from `backend/` (if `.config/dotnet-tools.json` doesn't exist), then `dotnet tool install dotnet-ef` from `backend/`. This creates/updates `backend/.config/dotnet-tools.json` tracked in git. Developers run `dotnet tool restore` once, then use `dotnet ef` as normal.

#### 5. Verify migrations apply locally

**Intent**: Prove the full pipeline works: Supabase CLI Postgres is running, EF Core connects, migration applies, table is created.

**Contract**: With `supabase start` running (Postgres-only), run `dotnet ef database update --project Picnivo.API` from `backend/`. Verify the `Events` table exists in the local database.

#### 6. Update developer documentation

**File**: `backend/CLAUDE.md`

**Intent**: Document the new local dev commands so developers (and agents) know how to work with the database.

**Contract**: Add commands for: `supabase start -x gotrue,realtime,storage-api,imgproxy,kong,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor,mailpit` (Postgres-only), `supabase stop`, `dotnet tool restore`, `dotnet ef database update --project Picnivo.API`, `dotnet ef migrations add <Name> --project Picnivo.API --output-dir Data/Migrations`. Add a note that local Postgres runs on port 54322.

### Success Criteria:

#### Automated Verification:

- `supabase start -x gotrue,realtime,storage-api,imgproxy,kong,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor,mailpit` starts Postgres on port 54322
- `dotnet ef database update --project Picnivo.API` applies the `InitialCreate` migration without errors
- `dotnet build` still passes from `backend/Picnivo.API/`

#### Manual Verification:

- Connect to local Postgres (e.g., `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres`) and confirm the `Events` table exists with the expected columns
- `supabase stop` cleanly shuts down the local Postgres

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: CI/CD Migration Step

### Overview

Add a migration job to the GitHub Actions deploy workflow that runs EF Core migrations against the production Supabase Postgres database before deploying the new app version. Uses an EF Core migration bundle so the CI runner doesn't need the .NET SDK or EF CLI tool beyond the build step.

### Changes Required:

#### 1. GitHub Actions workflow update

**File**: `.github/workflows/deploy-backend.yml`

**Intent**: Add a `migrate` job that runs before the existing `deploy` job. The migrate job builds an EF Core bundle, then executes it against the production database. This ensures the schema is up-to-date before the new app code is deployed.

**Contract**: The workflow gains a `migrate` job that:
- Checks out the code
- Sets up .NET SDK 10
- Runs `dotnet tool restore` from `backend/` to install the `dotnet-ef` CLI from the local tool manifest
- Runs `dotnet ef migrations bundle --project Picnivo.API --output efbundle --self-contained -r linux-x64` from `backend/`
- Executes `./efbundle --connection "${{ secrets.DATABASE_CONNECTION_STRING }}"` to apply pending migrations
- The existing `deploy` job adds `needs: [migrate]` so it only runs after migrations succeed

A new GitHub Actions secret `DATABASE_CONNECTION_STRING` is required, containing the Supabase production connection string.

### Success Criteria:

#### Automated Verification:

- `dotnet ef migrations bundle --project Picnivo.API --output efbundle --self-contained -r linux-x64` succeeds locally from `backend/`
- The workflow YAML is valid (no syntax errors)

#### Manual Verification:

- Review the workflow to confirm the `migrate` job runs before `deploy`
- Confirm the `DATABASE_CONNECTION_STRING` secret is referenced correctly
- The secret itself will be set in Phase 4 when the Supabase project exists

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Production Wiring + Verification

### Overview

Create the Supabase cloud project, configure the production connection string as Fly and GitHub secrets, deploy, and verify the full pipeline works end-to-end.

### Changes Required:

#### 1. Supabase cloud project setup (manual)

**Intent**: Create a Supabase project that will host the production Postgres database.

**Contract**: This is a manual step:
- Go to `app.supabase.com` and create a new project in a region close to `arn` (Stockholm) — e.g., EU West (Ireland) or EU Central (Frankfurt)
- Note the project ref, database password, and connection string
- Use the **direct connection** string format: `Host=db.<PROJECT_REF>.supabase.co;Port=5432;Database=postgres;Username=postgres.<PROJECT_REF>;Password=<DB_PASSWORD>`

#### 2. Set Fly secret

**Intent**: Store the production database connection string as a Fly.io secret so the app can connect at runtime.

**Contract**: Run `fly secrets set ConnectionStrings__DefaultConnection="<connection-string>" --app picnivo`. The double-underscore maps to ASP.NET Core's `ConnectionStrings:DefaultConnection` config key.

#### 3. Set GitHub Actions secret

**Intent**: Store the production database connection string as a GitHub Actions secret so the CI/CD migration job can connect.

**Contract**: In the GitHub repo settings, add secret `DATABASE_CONNECTION_STRING` with the same connection string value (using the semicolon-delimited format that EF Core understands).

#### 4. Production connection string configuration

**File**: `backend/Picnivo.API/appsettings.json`

**Intent**: Ensure the production configuration does NOT contain a connection string — it comes exclusively from the Fly secret.

**Contract**: No `ConnectionStrings` section in `appsettings.json`. The Fly secret `ConnectionStrings__DefaultConnection` provides the value at runtime via environment variable binding. Add a startup check that throws a clear error if no connection string is configured, so a misconfigured deploy fails fast rather than silently.

#### 5. Deploy and verify

**Intent**: Push to main and verify the full pipeline: CI/CD migration applies, app deploys, health check passes.

**Contract**: After pushing to `main`, monitor:
- The `migrate` job in GitHub Actions succeeds
- The `deploy` job in GitHub Actions succeeds
- `curl https://picnivo.fly.dev/healthz` returns 200
- `fly logs --app picnivo` shows no database connection errors at startup

### Success Criteria:

#### Automated Verification:

- GitHub Actions `migrate` job passes (green)
- GitHub Actions `deploy` job passes (green)
- `curl https://picnivo.fly.dev/healthz` returns `200 OK`

#### Manual Verification:

- `fly logs --app picnivo` shows successful startup with no database errors
- The Supabase dashboard shows the `Events` table exists in the production database
- No regression: the app starts and responds to requests normally

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- No unit tests in this phase — the proof-of-concept entity is too simple to warrant them. Unit testing patterns will be established in S-01 when business logic is introduced.

### Integration Tests:

- Not in scope for this foundation. Integration test infrastructure (test containers, WebApplicationFactory with test DB) will be set up alongside S-01.

### Manual Testing Steps:

1. Start local Postgres via `supabase start -x ...`
2. Apply migrations: `dotnet ef database update --project Picnivo.API`
3. Run the app: `dotnet run --project Picnivo.API`
4. Verify `/healthz` returns 200
5. Connect to local Postgres and confirm `Events` table exists with expected schema
6. Stop the app and Supabase (`supabase stop`)

## Performance Considerations

- Supabase cloud adds ~10-30ms latency per query from Fly.io `arn` region — acceptable for MVP given the 2-second page load NFR budget
- EF Core connection pooling is enabled by default via Npgsql — no additional configuration needed at MVP scale
- `Database.MigrateAsync()` is NOT called at startup — migrations run in CI/CD, keeping cold-start time minimal

## Migration Notes

- This is the first migration — no existing data to migrate
- Future slices (S-01, S-02) will add migrations for Events, DateOptions, Items, Participants, Votes
- The `Event` entity created here is the real domain entity — S-01 will expand it with additional properties and relationships, not replace it

## References

- Roadmap F-01: `context/foundation/roadmap.md:50-61`
- Infrastructure research: `backend/context/foundation/infrastructure.md`
- Npgsql EF Core provider: https://www.npgsql.org/efcore/
- Supabase CLI docs: https://supabase.com/docs/guides/local-development/cli/getting-started

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: EF Core + Npgsql Setup

#### Automated

- [x] 1.1 Project builds with new NuGet packages — b9f0296
- [x] 1.2 Migration files exist in Data/Migrations/ directory — b9f0296
- [x] 1.3 `dotnet ef migrations list` shows InitialCreate — b9f0296

#### Manual

- [x] 1.4 DbContext uses ApplyConfigurationsFromAssembly — b9f0296
- [x] 1.5 EventConfiguration implements IEntityTypeConfiguration correctly — b9f0296
- [x] 1.6 WeatherForecast endpoint and record removed — b9f0296

### Phase 2: Local Dev Workflow

#### Automated

- [x] 2.1 Supabase CLI starts Postgres-only on port 54322 — 0e4fbce
- [x] 2.2 `dotnet ef database update` applies InitialCreate migration — 0e4fbce
- [x] 2.3 `dotnet build` still passes — 0e4fbce

#### Manual

- [x] 2.4 Events table exists in local Postgres with expected columns — 0e4fbce
- [x] 2.5 `supabase stop` cleanly shuts down — 0e4fbce

### Phase 3: CI/CD Migration Step

#### Automated

- [x] 3.1 `dotnet ef migrations bundle` succeeds locally
- [x] 3.2 Workflow YAML is valid

#### Manual

- [ ] 3.3 Migrate job runs before deploy job in workflow
- [ ] 3.4 DATABASE_CONNECTION_STRING secret referenced correctly

### Phase 4: Production Wiring + Verification

#### Automated

- [ ] 4.1 GitHub Actions migrate job passes
- [ ] 4.2 GitHub Actions deploy job passes
- [ ] 4.3 Health check returns 200 OK

#### Manual

- [ ] 4.4 Fly logs show successful startup with no database errors
- [ ] 4.5 Events table exists in Supabase production database
- [ ] 4.6 No regression in app behavior
