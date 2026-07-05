# Picnivo Frontend

TanStack Start (React 19) + Tailwind CSS v4 frontend for [Picnivo](../README.md), deployed to Cloudflare
Workers.

## Prerequisites

- [pnpm](https://pnpm.io/)
- Backend running locally (see [`../backend/README.md`](../backend/README.md)), or use `../dev.sh` from
  the repo root to boot everything together

## Getting Started

```bash
pnpm install
pnpm dev
```

The app runs at `http://localhost:3000`.

## Commands

| Task                  | Command                  |
| --------------------- | ------------------------ |
| Dev server            | `pnpm dev`               |
| Build                 | `pnpm build`             |
| Tests                 | `pnpm test`              |
| E2E tests             | `pnpm test:e2e`          |
| E2E tests (UI runner) | `pnpm test:e2e:ui`       |
| Type check            | `pnpm exec tsc --noEmit` |
| Lint                  | `pnpm lint`              |
| Format                | `pnpm format`            |
| Regenerate API client | `pnpm orval`             |
| Deploy (production)   | `pnpm deploy`            |
| Deploy (preview)      | `pnpm deploy:preview`    |
| Local CF preview      | `pnpm preview:cf`        |
| Tail CF logs          | `pnpm cf:tail`           |

Prettier also runs automatically on save via an editor hook.

## Project Structure

```
frontend/
├── src/
│   ├── features/
│   │   └── <Feature>/
│   │       └── <Action>/     # schema, server functions, tests, and components for one action
│   ├── components/           # shared, feature-agnostic components (shadcn/ui primitives, layout chrome)
│   ├── lib/                  # cross-cutting infrastructure (Supabase clients, auth middleware)
│   ├── middleware/           # auth middleware for server functions
│   ├── routes/               # TanStack Router file-based routes
│   ├── locales/              # Lingui i18n message catalogs
│   └── api/                  # Orval-generated API client (do not edit manually)
├── tests/e2e/                # Playwright end-to-end tests (see test-plan.md §6.7)
│   ├── setup/                # auth + global setup, shared helpers, .auth state
│   └── <case>/               # one folder per test case (e.g. seed/, vote-persistence/)
└── context/                  # frontend-specific architecture & conventions
```

A component lives in `<Feature>/<Action>/components/` unless two or more actions use it, in which case it
moves up to `src/components/`. Routes import from `src/features/`, never the reverse. See
[`AGENTS.md`](AGENTS.md) for the full conventions.

## API Client

[Orval](https://orval.dev/) generates the typed client (`src/api/picnivo-api.ts`) from the backend's
OpenAPI spec (`backend/Picnivo.API/Picnivo.API.json`). Run `pnpm orval` after backend endpoint changes.

## Authentication

Supabase Auth via `@supabase/ssr` for cookie-based sessions. The `_authenticated` layout route guards
protected pages, redirecting to `/login` when there's no session. See
[`AGENTS.md`](AGENTS.md#authentication) for client/server setup details.

## Design

UI follows the references in `context/foundation/design/` (JSX mockups and CSS) — check there before
improvising layout or styling. Built with [shadcn/ui](https://ui.shadcn.com/) on Tailwind v4, which
configures design tokens via a CSS `@theme` block in `src/styles.css` rather than `tailwind.config.js`.

## Deployment

Deployed to Cloudflare Workers via Wrangler. Local secrets go in `.dev.vars` (git-ignored); production
secrets are set with `wrangler secret put KEY`. CI runs on every PR touching `frontend/`
(`.github/workflows/ci-frontend.yml`); the Playwright suite runs against the real stack via
`.github/workflows/ci-e2e.yml` on PRs touching `frontend/`, `backend/`, `supabase/`, or `dev.sh`.
