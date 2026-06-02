# Backend — AGENTS.md

## Commands

- Run: `dotnet run` (from `Picnivo.API/`)
- Build: `dotnet build` (from `Picnivo.API/`)
- Test: `dotnet test` (from `backend/`)
- Deploy (manual): `fly deploy` (from `backend/`)
- Logs: `fly logs --app picnivo`
- SSH: `fly ssh console --app picnivo`

## Local Database

Local Postgres runs via Supabase CLI on port 54322.

- Start (Postgres-only): `supabase start -x gotrue,realtime,storage-api,imgproxy,kong,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor,mailpit`
- Stop: `supabase stop`
- Restore tools: `dotnet tool restore` (one-time after clone)
- Apply migrations: `dotnet ef database update --project Picnivo.API` (from `backend/`)
- Add migration: `dotnet ef migrations add <Name> --project Picnivo.API --output-dir Data/Migrations` (from `backend/`)

## Conventions

- Minimal API style (not controllers)
- No HTTPS redirection in app code — Fly.io terminates TLS at proxy
- Health check at `/healthz` — keep it fast, no heavy dependencies
- Secrets via `fly secrets set KEY=VALUE` — never in `fly.toml` or `appsettings`
