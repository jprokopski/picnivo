---
project: picnivo
researched_at: 2026-06-02
recommended_platform: cloudflare-workers
runner_up: netlify
context_type: mvp
tech_stack:
  language: typescript
  framework: tanstack-start
  runtime: cloudflare-workers
---

## Recommendation

**Deploy on Cloudflare Workers.**

Cloudflare Workers is the strongest fit for the Picnivo frontend: it is an official TanStack Start deployment partner with first-class support via `@cloudflare/vite-plugin`, scored 5/5 on agent-friendly criteria (the only platform to do so), and runs entirely within the free tier at MVP scale (~3M requests/month allowed vs. 10k-100k expected). The developer's existing Cloudflare familiarity, zero cold starts (V8 isolates, not containers), and the richest agent ecosystem (llms.txt, multiple GA MCP servers) sealed the decision. The tech-stack hint (`cloudflare-pages`) aligns — Cloudflare is consolidating Pages into Workers, and TanStack Start targets the Workers path directly.

## Platform Comparison

| Platform | CLI-first (Critical) | Managed/Serverless (Critical) | Agent-readable docs (Medium) | Stable deploy API (Critical) | MCP/Integration (Light) | Est. Cost/mo |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Pass | $0 (free tier) |
| **Netlify** | Partial | Pass | Pass | Pass | Pass | $0 (credit-based) |
| **Railway** | Partial | Pass | Pass | Pass | Pass | ~$5 |
| **Render** | Partial | Pass | Pass | Pass | Pass | $0-7 |
| **Vercel** | Pass | Pass | Partial | Pass | Partial | $0 (non-commercial) |
| **Fly.io** | Pass | Pass | Partial | Pass | Partial | ~$5-10 |

**Scoring notes:**
- Cloudflare is the only platform with a perfect 5/5 — full CLI with `wrangler rollback`, serverless with zero cold starts, llms.txt + multiple GA MCP servers, deterministic `wrangler deploy`, and official TanStack Start partnership.
- CLI-first Partial = no CLI rollback command (Netlify, Railway, Render — dashboard/API only).
- Vercel's Hobby plan is restricted to non-commercial use; Pro ($20/mo) is required for commercial apps. MCP is beta.
- Fly.io's MCP server is experimental; no llms.txt. Requires Docker and has no free tier.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Cloudflare wins across every dimension. TanStack Start has first-class Workers support via `@cloudflare/vite-plugin` — no Nitro adapters needed. The free tier (100k requests/day) provides massive headroom for an MVP. Zero cold starts from V8 isolates eliminate the latency penalty that container-based platforms impose. The CLI (`wrangler deploy/rollback/tail`) is the most complete among all candidates. Multiple GA MCP servers and published `llms.txt` make it the most agent-friendly platform evaluated. Co-located services (KV, R2, D1, Durable Objects) are all GA and available on the free tier. The developer has existing Cloudflare experience.

#### 2. Netlify

Netlify is also an official TanStack Start partner with a dedicated Vite plugin (`@netlify/vite-plugin-tanstack-start`). The free tier (300 credits/month) covers MVP-scale traffic. GA MCP server and llms.txt make it agent-friendly. The gap vs. Cloudflare: no CLI rollback command, no WebSocket support, credit-based pricing adds complexity, and serverless functions have higher cold-start latency than Workers' V8 isolates.

#### 3. Railway

Railway offers a full Node.js runtime (no compatibility layer concerns), an official TanStack Start deployment guide, and a GA MCP server with remote endpoint. WebSocket support is native. The gap vs. Cloudflare: $5/mo (no free tier), no CLI rollback, and Railpack (the build system) is still in beta. However, it avoids all the workerd runtime compatibility risks — if the Cloudflare Workers path proves too constrained, Railway is the cleanest fallback.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **10ms CPU time limit on the free tier is razor-thin for SSR.** TanStack Start renders React 19 components server-side on every request. Typical SSR takes 2-8ms, but pages with heavy data loading or complex component trees can spike to 15-20ms, silently terminating the request.
2. **`process.env` is undefined at module scope.** Any library or config that reads environment variables at import time (outside a request handler) gets `undefined`. Debugging these failures is time-consuming because they manifest as empty config values, not errors.
3. **The workerd runtime is not Node.js.** Despite `nodejs_compat`, missing APIs include `fs`, `child_process`, `net`, and `dns.lookup`. Transitive npm dependencies that use these fail at runtime, not at build time.
4. **No automatic preview deployments on the Workers path.** Unlike Netlify or the older Pages path, Workers require manual preview environment configuration. Extra CI/CD work for a solo dev.
5. **128MB memory limit is hard-capped.** Unlike containers where you can size the VM, Workers cannot exceed 128MB. Large React component trees or in-memory caching can push against this.

### Pre-Mortem — How This Could Fail

The developer deployed Picnivo's TanStack Start frontend on Cloudflare Workers, drawn by the $0/mo price and first-class integration. The basic event page rendered fine. Then the event page with 10 participants, 8 date options, and 15 items — the realistic Picnivo use case — took 12ms to SSR. On the free tier's 10ms CPU limit, it failed silently. The $5/mo paid plan resolved this, but the developer only discovered the issue after users reported blank pages.

Authentication integration came next. The auth library used `process.env.AUTH_SECRET` at module scope during initialization. On Cloudflare, this was `undefined`, producing cryptographic errors only in production — `wrangler dev` behaved differently. Fixing it required restructuring auth middleware to accept Cloudflare bindings, burning two evenings. A later dependency update pulled in a library that called `dns.lookup` internally. The build succeeded, but production requests crashed. Tracking down the transitive dependency took another evening. By week three, the developer was spending more time on runtime compatibility than feature work.

### Unknown Unknowns

- **Static asset requests count against the free tier quota.** A single page load triggers 10-20 asset requests (CSS, JS bundles, images). At 5k daily visitors × 15 assets = 75k requests/day for static files alone, approaching the 100k/day limit. Monitor with `wrangler tail`.
- **`wrangler dev` does not perfectly replicate production.** Local dev simulates workerd but some behaviors differ — particularly `process.env`, module resolution, and timing. `pnpm dev` (Vite dev server) uses Node.js, not workerd, so it's even further from production.
- **Workers have a 6 concurrent connection limit for outbound `fetch()`.** Server functions calling the .NET backend API on Fly.io via `fetch()` can hit this limit if multiple loaders fire in parallel, causing queued requests.
- **Cloudflare's Pages-to-Workers consolidation is ongoing.** Some documentation references both old Pages and new Workers workflows. Guides may be outdated for the current state of the integration.

## Operational Story

- **Preview deploys**: Workers do not auto-generate preview URLs from Git branches. Create a preview environment with `wrangler deploy --env preview` and a corresponding `[env.preview]` section in `wrangler.jsonc`. Alternatively, configure a GitHub Actions workflow that deploys to a preview environment on PR events. Netlify and Vercel provide this automatically — Workers trade convenience for control.
- **Secrets**: `wrangler secret put KEY` stores encrypted secrets per Worker. Secrets are injected as Cloudflare bindings at runtime (not `process.env`). Access via `import { env } from 'cloudflare:workers'` in server functions. List with `wrangler secret list`. Rotation: `wrangler secret put KEY` with the new value triggers a rolling update.
- **Rollback**: `wrangler rollback [version-id]` reverts to a previous deployment. `wrangler deployments list` shows available versions. Typical time-to-revert: under 30 seconds globally (edge propagation). No data migrations to worry about — the frontend is stateless.
- **Approval**: Deploying, setting secrets, and managing routes are all CLI operations an agent can perform. `wrangler delete` requires confirmation. No built-in approval gates — add them via GitHub Actions environment protection rules.
- **Logs**: `wrangler tail` streams real-time logs from all edge locations. Filter with `--format json` for structured output. For persistent logs, configure a Logpush job to R2 or an external provider. Workers analytics dashboard provides request counts, CPU time, and error rates.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 10ms CPU limit exceeded during SSR | Devil's advocate | Medium | High | Monitor SSR render times with `wrangler tail`. Upgrade to $5/mo paid plan (30s CPU) if any page exceeds 8ms. Use React Suspense boundaries to stream partial content. |
| `process.env` undefined at module scope | Devil's advocate | High | Medium | Access env vars only inside request handlers via `import { env } from 'cloudflare:workers'`. Audit all auth/config libraries for module-scope env reads before deploying. |
| Transitive dependency uses unsupported Node.js API | Pre-mortem | Medium | High | Run `wrangler deploy --dry-run` to catch build errors. Test every dependency upgrade in `wrangler dev` before deploying. Pin dependencies to known-good versions. |
| Static assets consume free-tier request quota | Unknown unknowns | Medium | Medium | Configure aggressive `Cache-Control` headers for static assets (immutable, long max-age). Monitor daily request counts via Cloudflare dashboard. Budget for $5/mo paid plan if needed. |
| `wrangler dev` behavior differs from production | Unknown unknowns | High | Low | Test critical flows (auth, API calls) on a deployed preview environment, not just local dev. Add a `preview` environment to `wrangler.jsonc`. |
| Outbound fetch() concurrency limit (6 connections) | Unknown unknowns | Low | Medium | Avoid parallel server function calls to the backend API where possible. Use `Promise.all` judiciously — batch API calls or serialize them if hitting the limit. |
| Pages-to-Workers migration creates doc confusion | Unknown unknowns | Low | Low | Follow only the TanStack Start official docs and the `@cloudflare/vite-plugin` README. Ignore any guide referencing the old Pages Functions workflow. |

## Getting Started

1. **Install wrangler and the Cloudflare Vite plugin:**
   ```bash
   cd frontend
   pnpm add -D @cloudflare/vite-plugin wrangler
   ```

2. **Add `@cloudflare/vite-plugin` to `vite.config.ts`** (must come before TanStack plugins):
   ```typescript
   import { cloudflare } from '@cloudflare/vite-plugin'

   export default defineConfig({
     plugins: [
       cloudflare({ viteEnvironment: { name: 'ssr' } }),
       tanstackStart(),
       // ...
     ],
   })
   ```

3. **Create `wrangler.jsonc`** in the frontend root:
   ```jsonc
   {
     "name": "picnivo",
     "main": "@tanstack/react-start/server-entry",
     "compatibility_flags": ["nodejs_compat"],
     "assets": { "binding": "ASSETS" }
   }
   ```

4. **Deploy:**
   ```bash
   pnpm build && wrangler deploy
   ```

5. **Tail logs to verify:**
   ```bash
   wrangler tail
   ```

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
