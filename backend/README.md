# Picnivo Backend

.NET 10 ASP.NET Core Web API for [Picnivo](../README.md) — a minimal-API backend built with vertical-slice
architecture, EF Core, and Supabase Auth.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local Postgres + Auth)
- [Fly CLI](https://fly.io/docs/flyctl/) (for deployment)

## Getting Started

```bash
dotnet tool restore    # one-time after clone, from backend/

cd ..    # supabase/config.toml lives at the repo root, shared with the frontend
supabase start -x realtime,storage-api,imgproxy,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor

cd backend
dotnet ef database update --project Picnivo.API

cd Picnivo.API
dotnet run
```

The API listens on `http://localhost:5000` (see `dev.sh` in the repo root to boot Postgres, backend, and
frontend together in one command).

## Commands

| Task            | Command                                                                    |
| --------------- | --------------------------------------------------------------------------- |
| Run             | `dotnet run` (from `Picnivo.API/`)                                          |
| Build           | `dotnet build` (from `Picnivo.API/`)                                        |
| Test            | `dotnet test` (from `backend/`)                                             |
| Add migration   | `dotnet ef migrations add <Name> --project Picnivo.API --output-dir Data/Migrations` |
| Apply migrations| `dotnet ef database update --project Picnivo.API`                           |
| Deploy (manual) | `fly deploy` (from `backend/`)                                              |
| Logs            | `fly logs --app picnivo`                                                    |

## Project Structure

```
backend/
├── Picnivo.API/
│   ├── Data/                    # PicnivoDbContext, EF Core configurations, migrations
│   ├── Features/
│   │   └── <FeatureName>/
│   │       └── <ActionName>/    # handler + DTOs + endpoint, one folder per action
│   ├── EndpointExtensions.cs    # MapEndpoints() — auto-discovers IEndpoint via reflection
│   └── Program.cs
└── Picnivo.Tests/
    └── Features/                # mirrors Picnivo.API/Features/, one test file per action
```

Each action folder owns everything it needs — handler, request/response DTOs, and an
`IEndpoint`-implementing endpoint class. Nothing is shared across action folders. See
[`AGENTS.md`](AGENTS.md) for the full conventions (validation, auth, testing patterns).

## Authentication

Supabase Auth handles identity (email/password + Google OAuth). The API validates JWTs via JWKS discovery —
no shared secret needed. Protected endpoints use `.RequireAuthorization()`, and the `sub` claim carries the
Supabase user ID.

## Deployment

Deployed to [Fly.io](https://fly.io/) via Docker (see `Dockerfile` and `fly.toml`). Production secrets are
set with `fly secrets set KEY=VALUE` — never committed to `fly.toml` or `appsettings`. CI builds and tests
on every PR touching `backend/` (`.github/workflows/ci-backend.yml`); deploys run via
`.github/workflows/deploy-backend.yml`.
