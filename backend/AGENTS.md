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

- Start: `supabase start -x realtime,storage-api,imgproxy,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`
- Stop: `supabase stop`
- Restore tools: `dotnet tool restore` (one-time after clone)
- Apply migrations: `dotnet ef database update --project Picnivo.API` (from `backend/`)
- Add migration: `dotnet ef migrations add <Name> --project Picnivo.API --output-dir Data/Migrations` (from `backend/`)

## Authentication

- Supabase Auth handles identity (email/password + Google OAuth)
- Backend validates JWTs via JWKS discovery at `Supabase:Authority` — no shared secret needed (ES256 asymmetric signing)
- Protected endpoints use `.RequireAuthorization()` — the `sub` claim carries the Supabase user ID
- `organizers` table auto-provisioned via `handle_new_user()` trigger on `auth.users` INSERT
- Production secrets: `Supabase__Authority`, `Frontend__Url` set via `fly secrets set`
- Local Google OAuth: set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `backend/supabase/.env` (gitignored)

## Conventions

- Minimal API style (not controllers)
- No HTTPS redirection in app code — Fly.io terminates TLS at proxy
- Health check at `/healthz` — keep it fast, no heavy dependencies
- Secrets via `fly secrets set KEY=VALUE` — never in `fly.toml` or `appsettings`
