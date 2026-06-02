# Backend — AGENTS.md

## Commands

- Run: `dotnet run` (from `Picnivo.API/`)
- Build: `dotnet build` (from `Picnivo.API/`)
- Test: `dotnet test` (from `backend/`)
- Deploy (manual): `fly deploy` (from `backend/`)
- Logs: `fly logs --app picnivo`
- SSH: `fly ssh console --app picnivo`

## Conventions

- Minimal API style (not controllers)
- No HTTPS redirection in app code — Fly.io terminates TLS at proxy
- Health check at `/healthz` — keep it fast, no heavy dependencies
- Secrets via `fly secrets set KEY=VALUE` — never in `fly.toml` or `appsettings`
