# Cloudflare Workers Integration Plan

## Context

The Picnivo frontend (TanStack Start + React 19 + Vite 8) needs to be deployable to Cloudflare Workers per the infrastructure decision in `context/foundation/infrastructure.md`. The app is currently in a clean state: 3 static routes, zero server functions, zero env vars, zero middleware. This makes the integration straightforward, but there are known plugin compatibility issues that require careful handling.

**Key finding from research:** `@tanstack/devtools-vite` and `@cloudflare/vite-plugin` have an open conflict (devtools imports solid-js server symbols that crash in Cloudflare's workerd SSR environment). The solution is conditional plugin loading: devtools in dev, Cloudflare in production builds.

---

## Phase 1: Install Dependencies

- [x] Install packages: `pnpm add -D @cloudflare/vite-plugin wrangler @cloudflare/workers-types`
- [x] Verify wrangler: `pnpm exec wrangler --version`

**Edge case — Vite 8 peer dep conflict:** If `@cloudflare/vite-plugin` rejects Vite 8, check the plugin's latest releases. The plugin added Vite 8 support recently but if it hasn't landed yet, this blocks the entire plan. Fallback: temporarily pin Vite to `^7`.

**Edge case — devtools-vite Vite version:** The devtools skill mapping says "Vite ^6 || ^7 only". If devtools breaks after the install, it may need a version pin or an update. Currently it works in the project with Vite 8, so this is likely stale info.

---

## Phase 2: Configure Vite (Conditional Plugin Loading)

**File:** `frontend/vite.config.ts`

Use an async config function with dynamic imports to avoid loading conflicting plugins in the same context:

```typescript
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(async ({ mode }) => {
  const plugins = [];

  if (mode === "development") {
    const { devtools } = await import("@tanstack/devtools-vite");
    plugins.push(devtools());
  } else {
    const { cloudflare } = await import("@cloudflare/vite-plugin");
    plugins.push(cloudflare({ viteEnvironment: { name: "ssr" } }));
  }

  plugins.push(tailwindcss(), tanstackStart(), viteReact());

  return {
    resolve: { tsconfigPaths: true },
    plugins,
  };
});
```

- [x] Update `vite.config.ts` with conditional plugin loading
- [x] Verify `pnpm dev` starts without errors (devtools loaded, no Cloudflare)
- [x] Verify `pnpm build` completes without errors (Cloudflare loaded, no devtools)

**Why dynamic imports:** Static imports of both plugins would cause the devtools solid-js crash even when the plugin isn't used. Dynamic `await import()` ensures only the needed plugin's code is loaded. Vite's `defineConfig` supports async config functions.

**Plugin order:** Cloudflare must come before `tanstackStart()`. Devtools must be first when included. The array construction ensures this in both modes.

---

## Phase 3: Create `wrangler.jsonc`

**File to create:** `frontend/wrangler.jsonc`

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "picnivo",
  "compatibility_date": "2026-06-02",
  "compatibility_flags": ["nodejs_compat"],
  "main": "@tanstack/react-start/server-entry",
  "observability": { "enabled": true },
  "assets": {
    "binding": "ASSETS",
    "html_handling": "none",
    "not_found_handling": "none",
  },
  "env": {
    "preview": {
      "name": "picnivo-preview",
    },
  },
}
```

- [x] Create `wrangler.jsonc`
- [x] Validate config: `pnpm exec wrangler deploy --dry-run`

**Key config rationale:**

- `nodejs_compat` — required for TanStack Start (uses Node streams/buffers)
- `html_handling: "none"` / `not_found_handling: "none"` — TanStack Start handles SSR and 404s, not Cloudflare
- `observability` — enables request metrics for monitoring the 10ms CPU limit
- `env.preview` — separate worker for PR/staging deploys at `picnivo-preview.<subdomain>.workers.dev`

---

## Phase 4: Update package.json Scripts

**File:** `frontend/package.json`

Add these scripts alongside existing ones:

```json
"preview:cf": "pnpm build && wrangler dev",
"deploy": "pnpm build && wrangler deploy",
"deploy:preview": "pnpm build && wrangler deploy --env preview",
"deploy:dry-run": "pnpm build && wrangler deploy --dry-run",
"cf:tail": "wrangler tail",
"cf:tail:preview": "wrangler tail --env preview"
```

- [x] Add new scripts to `package.json`
- [x] Keep existing `preview` script (still useful for quick Node.js-based previews)

**Note:** `vite preview` won't work for Cloudflare builds (output targets workerd, not Node). Use `preview:cf` for accurate local testing.

---

## Phase 5: TypeScript Configuration

**File:** `frontend/tsconfig.json`

Add `@cloudflare/workers-types` to the existing `types` array:

```json
"types": ["vite/client", "@cloudflare/workers-types"]
```

- [x] Update `tsconfig.json` types array
- [x] Verify: `pnpm exec tsc --noEmit` passes cleanly

This enables IDE autocomplete for `cloudflare:workers` imports when server functions are added later. The Workers types coexist with DOM types without conflict (Workers types are scoped to `cloudflare:*` module namespace).

---

## Phase 6: Gitignore and Documentation

**File:** `frontend/.gitignore` — add `.dev.vars` (for future local Cloudflare secrets):

```
.dev.vars
```

`.wrangler` is already in `.gitignore`.

**File:** `frontend/CLAUDE.md` — add to the Conventions section:

```markdown
- Cloudflare Workers deployment — see `context/foundation/infrastructure.md` for platform rationale
- Cloudflare env vars: access via `import { env } from 'cloudflare:workers'` inside server functions only (never at module scope). Local dev secrets go in `.dev.vars` (git-ignored). Production secrets set via `wrangler secret put KEY`
```

And add to the Commands section:

```markdown
- Deploy: `pnpm deploy` (production) / `pnpm deploy:preview` (staging)
- Local CF preview: `pnpm preview:cf`
- Tail logs: `pnpm cf:tail`
```

- [x] Add `.dev.vars` to `.gitignore`
- [x] Update `CLAUDE.md` with Cloudflare conventions and commands

**No `.dev.vars` file created yet** — the app has zero secrets. Create it when the first secret is needed.

---

## Phase 7: Verification

- [x] **Dev server regression check:** `pnpm dev` — starts on port 3000, devtools visible, no errors
- [x] **Production build:** `pnpm build` — completes without solid-js or devtools errors
- [x] **Local CF preview:** `pnpm preview:cf` — app accessible at `localhost:8787`, all routes render with SSR, static assets load, theme toggle works
- [x] **Dry-run deploy:** `pnpm deploy:dry-run` — validates config and build output
- [x] **Type check:** `pnpm exec tsc --noEmit` — no errors
- [x] **First production deploy:** `pnpm deploy` — worker live at `picnivo.jakubprokopski.workers.dev`
- [ ] **Tail logs:** `pnpm cf:tail` — monitor CPU time per request (expect 1-3ms for static pages)
- [x] **Preview deploy:** `pnpm deploy:preview` — live at `picnivo-preview.<subdomain>.workers.dev`

---

## Phase 8: Cloudflare Workers Builds — Auto-Deploy on Push to Main

Cloudflare Workers Builds provides native Git integration — auto-deploys on push to main and preview deploys on PRs with automatic PR comments. No GitHub Actions needed.

**No files to create** — this is configured via the Cloudflare dashboard after the initial manual deploy.

### Prerequisites

Before enabling Workers Builds:

1. The Worker must exist (created via the first `pnpm deploy` in Phase 7)
2. The repo must have a GitHub remote

**Setting up the remote (no remote exists yet):**

```bash
# Create the GitHub repo and push:
gh repo create picnivo --private --source=. --push
# Or manually:
git remote add origin git@github.com:<user>/picnivo.git
git push -u origin main
```

### Setup Steps

- [x] **1. Deploy the Worker for the first time:** `pnpm deploy` (must be done before connecting Git)
- [ ] **2. Push repo to GitHub** (see prerequisites above)
- [ ] **3. Connect GitHub repo in Cloudflare Dashboard:**
  - Go to **Workers & Pages > picnivo > Settings > Builds > Connect**
  - Authorize the **Cloudflare Workers & Pages** GitHub App
  - Select the `picnivo` repository
- [ ] **4. Configure build settings in the dashboard:**
  - **Production branch:** `main`
  - **Build command:** `cd frontend && npx pnpm install --frozen-lockfile && npx pnpm build`
  - **Deploy command:** `cd frontend && npx wrangler deploy` (default, usually auto-detected)
  - **Root directory:** `/` (monorepo root — the `cd frontend` in commands handles navigation)
- [ ] **5. Enable preview builds for PRs:**
  - In **Settings > Builds > Branch control**, check **"Build non-production branches"**
  - This auto-creates preview URLs and posts them as PR comments
- [ ] **6. Verify by pushing a test commit to main** — check that the build triggers and deploys

### How It Works

- **Push to `main`:** Cloudflare runs `pnpm build` then `wrangler deploy` → production at `picnivo.<subdomain>.workers.dev`
- **PR opened/updated:** Cloudflare runs `pnpm build` then `wrangler versions upload` → preview URL posted as PR comment
- **Environment variables:** `CI=true`, `WORKERS_CI=1`, `WORKERS_CI_COMMIT_SHA`, `WORKERS_CI_BRANCH` are injected automatically

### Edge Cases

**Monorepo build trigger:** Workers Builds doesn't have a `paths` filter like GitHub Actions. Every push to `main` triggers a build, even for backend-only changes. The build will succeed (it just re-deploys the same frontend). If this becomes wasteful, a future option is to add a build check script that skips deploy when no frontend files changed.

**Build environment:** Workers Builds runs on Cloudflare's infrastructure with Node.js 22 and common package managers pre-installed. pnpm is available via `npx pnpm` or `corepack enable`.

**No `wrangler.jsonc` changes needed:** The `build` key in `wrangler.jsonc` is NOT used by Workers Builds. Build commands are configured in the dashboard only.

---

## Edge Case Support

### If `@cloudflare/vite-plugin` doesn't support Vite 8

Check `pnpm info @cloudflare/vite-plugin peerDependencies`. If Vite 8 is not in the range:

1. Check GitHub issues on `cloudflare/workers-sdk` for Vite 8 support status
2. Temporary fix: `pnpm add -D vite@^7` (downgrade)
3. Long-term: wait for the plugin update, then upgrade back

### If devtools crash persists even with conditional loading

The dynamic import should prevent this, but if it doesn't:

1. Remove the devtools Vite plugin entirely from production config
2. The React devtools components in `__root.tsx` (`<TanStackDevtools>`, `<TanStackRouterDevtoolsPanel>`) are safe — they're no-ops in production and don't cause the conflict
3. Add `removeDevtoolsOnBuild: true` to the devtools plugin config as a belt-and-suspenders

### If the 10ms CPU limit is hit on future pages

Current pages are safe (~1-3ms). When data-fetching routes are added:

1. Monitor with `pnpm cf:tail` and check CPU time per request
2. If any page exceeds 8ms consistently, upgrade to the $5/mo paid plan (30s CPU limit)
3. Use React Suspense boundaries to stream partial content and reduce initial CPU burst
4. Avoid heavy computation in loaders — defer to the .NET backend API

### If `wrangler dev` behaves differently from production

`wrangler dev` simulates workerd locally but isn't identical to production. Critical differences:

1. `process.env` may work locally but is `undefined` in production
2. Module resolution can differ
3. For accurate testing, deploy to the preview environment: `pnpm deploy:preview`

### Cloudflare authentication for first deploy

Before `wrangler deploy` can work, the developer must authenticate:

1. Run `wrangler login` (opens browser for OAuth)
2. Or set `CLOUDFLARE_API_TOKEN` env var for CI/headless environments
3. The `wrangler.jsonc` config doesn't need an account ID — wrangler resolves it from the auth token

---

## Files Changed Summary

| File                      | Action     | Lines Changed                                    |
| ------------------------- | ---------- | ------------------------------------------------ |
| `frontend/package.json`   | Modify     | +3 devDeps, +6 scripts                           |
| `frontend/vite.config.ts` | Modify     | Rewrite to async config with conditional plugins |
| `frontend/wrangler.jsonc` | **Create** | ~18 lines                                        |
| `frontend/tsconfig.json`  | Modify     | +1 type entry                                    |
| `frontend/.gitignore`     | Modify     | +1 line (`.dev.vars`)                            |
| `frontend/CLAUDE.md`      | Modify     | +5 lines (conventions + commands)                |

**Cloudflare Workers Builds** (Phase 8) is configured via the Cloudflare dashboard — no files to create.
