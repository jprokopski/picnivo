<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Event Creation and Sharing (S-01)

- **Plan**: context/changes/event-creation-and-sharing/plan.md
- **Mode**: Deep
- **Date**: 2026-06-28
- **Verdict**: REVISE → SOUND (after fixes)
- **Findings**: 0 critical · 4 warnings · 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

9/9 paths ✓, 4/4 symbols ✓ (getSessionFn, authMiddleware, FindFirstValue("sub"), EventConfiguration), brief↔plan ✓, Progress↔Phase mechanical contract ✓ (one `## Progress`, all phases & criteria mirrored, plain bullets in phase blocks).

## Findings

### F1 — Backend-URL env var can't live in src/lib/env.ts on Cloudflare

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 3.1 — Backend base URL config
- **Detail**: Plan says add the backend URL to the Zod schema in `src/lib/env.ts` AND prefer a non-`VITE_` server-only name. These conflict on this stack: `env.ts` does `envSchema.parse(import.meta.env)` at module scope, and only `VITE_*` vars exist there. A bare name would be `undefined` and the module-scope `parse()` throws on boot. CLAUDE.md mandates `cloudflare:workers`/`.dev.vars` for server-runtime vars, never `import.meta.env` at module scope.
- **Fix A ⭐ Recommended**: Use a `VITE_`-prefixed name in `env.ts` (base URL is not secret; reuses existing pattern, build-time inlined).
  - Strength: F-02 "no secrets in bundle" concern doesn't apply; mirrors `VITE_SUPABASE_URL`.
  - Tradeoff: URL visible in client bundle (acceptable — public).
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Fix B**: Read via `cloudflare:workers` inside the server fn (keeps it server-only; needs `.dev.vars` + wrangler wiring).
  - Strength: Server-only; canonical for true secrets.
  - Tradeoff: New access pattern; more deploy wiring.
  - Confidence: MED.
  - Blind spot: Deploy pipeline setting the var is unverified.
- **Decision**: FIXED via Fix A (Phase 3.1 + Critical Implementation Details reconciled)

### F2 — Plan bypasses the existing authMiddleware for protected fns

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 3.2 / 3.3 — authed fetch + server functions
- **Detail**: Repo has `src/middleware/auth.ts` (`authMiddleware`) which validates via `getUser()` and injects `{ user, supabase }`; CLAUDE.md says use it for protected server fns. Plan reads the token directly in each fn and never mentions the middleware. `getUser()` validates but doesn't return the token, so token still comes from `getSession()` on the injected client — middleware and token-forward compose.
- **Fix**: Route createEventFn/listEventsFn through `authMiddleware`; read `access_token` via the injected `supabase.auth.getSession()`. Public getEventByTokenFn stays middleware-free.
- **Decision**: FIXED (Phase 3.2 + 3.3 updated)

### F3 — WebApplicationFactory<Program> won't compile against top-level Program

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2.5 — Backend test project
- **Detail**: `Program.cs` uses top-level statements with no `public partial class Program` (confirmed; no InternalsVisibleTo). The generated `Program` is internal, so `WebApplicationFactory<Program>` can't reference it and the test project won't compile.
- **Fix**: Append `public partial class Program { }` to `Program.cs` as an explicit Phase 2 step.
- **Decision**: FIXED (Phase 2.5 — explicit "Expose Program" step added)

### F4 — Plan says "add the project to the solution" but no .sln exists

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2.5 — Backend test project
- **Detail**: No solution file in `backend/` (only `Picnivo.API/`). With two projects, `dotnet build`/`dotnet test` from `backend/` are ambiguous. Plan assumes a solution that doesn't exist.
- **Fix**: Create `backend/Picnivo.slnx` (modern XML solution format) via `dotnet new sln --format slnx`, add both projects, add Tests→API project reference.
- **Decision**: FIXED via `.slnx` (Phase 2.5 — solution-creation step added)

### F5 — Public event page mock not referenced

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 6.2 / References
- **Detail**: `picnivo-web-event.jsx` (singular) is the likely source-of-truth mock for the public event page, but Phase 6.2 cites no mock and References omits it. CLAUDE.md mandates following design references.
- **Fix**: Reference `picnivo-web-event.jsx` in Phase 6.2 and the References list.
- **Decision**: FIXED (Phase 6.2 + References updated)

### F6 — shadcn dark-mode selector not reconciled with existing tokens

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 4.2 — Map shadcn theme tokens
- **Detail**: Existing dark mode keys off `:root[data-theme="dark"]` + a `prefers-color-scheme` media query; shadcn convention toggles a `.dark` class. Plan says "under :root and the dark selector" without specifying which.
- **Fix**: State shadcn vars are defined under the existing `[data-theme="dark"]` (and media) selectors, not a new `.dark`.
- **Decision**: FIXED (Phase 4.2 updated)

## Triage Summary

- Fixed: F1 (Fix A), F2, F3, F4 (.slnx), F5, F6 (6)
- Skipped / Accepted / Dismissed: none

Verdict after fixes: **REVISE → SOUND**
