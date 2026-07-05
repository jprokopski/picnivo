<p align="center">
  <img src="frontend/public/favicon.svg" alt="Picnivo basket logo" width="120" />
</p>

<h1 align="center">Picnivo</h1>

<p align="center">
  The MVP event coordinator for small groups — pick a date, split the logistics, stop losing plans in group chat.
</p>

<p align="center">
  <a href="https://picnivo.com">picnivo.com</a>
</p>

## What is this?

Organizing a grill, picnic, or trip with friends usually dies in a pile of chat messages: date polls,
"who's bringing what," and reminders nobody sees. Picnivo gives the organizer one link that covers all
of it — propose date options, share it, and let participants vote and claim items. The event page always
shows the current best date and who's bringing what.

See [`context/foundation/prd.md`](context/foundation/prd.md) for the full product spec.

## Monorepo Structure

This repo holds two independent projects plus shared product context:

```
picnivo/
├── frontend/   TanStack Start (React 19) + Tailwind CSS v4 — see frontend/README.md
├── backend/    .NET 10 ASP.NET Core Web API — see backend/README.md
├── supabase/   Local Postgres + Auth config (config.toml), shared by both projects
├── context/    Product vision, PRD, and cross-cutting architecture decisions
└── dev.sh      Spins up Supabase, the backend, and the frontend together
```

## Quick Start

Requires [Supabase CLI](https://supabase.com/docs/guides/cli), [.NET 10 SDK](https://dotnet.microsoft.com/), and [pnpm](https://pnpm.io/).

```bash
./dev.sh
```

This starts Supabase (Postgres + Auth), applies EF Core migrations, and boots both apps:

| Service  | URL                     |
| -------- | ----------------------- |
| Frontend | http://localhost:3000   |
| Backend  | http://localhost:5000   |
| Auth     | http://localhost:54321  |
| Database | localhost:54322          |

For working on just one side, see the setup steps in [`frontend/README.md`](frontend/README.md) or
[`backend/README.md`](backend/README.md).

## Git Workflow

Feature branches off `main`, merged via pull request. CI runs per-project (`.github/workflows/`) and only
triggers on changes under `frontend/` or `backend/` respectively. `ci-e2e.yml` additionally runs the
Playwright suite against the real stack (`dev.sh`) on any PR touching `frontend/`, `backend/`,
`supabase/`, or `dev.sh`.
