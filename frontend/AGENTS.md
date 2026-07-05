# Frontend — AGENTS.md

## Commands

- Dev server: `pnpm dev`
- Build: `pnpm build`
- Tests: `pnpm test` (Vitest + Testing Library)
- E2E: `pnpm test:e2e` (Playwright — full workflow/rules in `context/foundation/test-plan.md` §6.7)
- Type check: `pnpm exec tsc --noEmit`
- Lint: `pnpm lint` (ESLint)
- Format: `pnpm format` (Prettier — also runs automatically via hook on every edit)
- Deploy: `pnpm deploy` (production) / `pnpm deploy:preview` (staging)
- Local CF preview: `pnpm preview:cf`
- Tail logs: `pnpm cf:tail`

## Conventions

- File-based routing via TanStack Router — routes live in `src/routes/`
- Server functions for API calls (TanStack Start pattern, not separate API routes)
- Tailwind v4 uses CSS `@theme` block in `styles.css` instead of tailwind.config.js
- Design tokens defined as CSS custom properties (--sea-ink, --lagoon, --palm, --sand, --foam)
- Cloudflare Workers deployment — see `context/foundation/infrastructure.md` for platform rationale
- Cloudflare env vars: access via `import { env } from 'cloudflare:workers'` inside server functions only (never at module scope). Local dev secrets go in `.dev.vars` (git-ignored). Production secrets set via `wrangler secret put KEY`

## Feature Structure

Feature code lives in `src/features/<Feature>/<Action>/`, mirroring the backend vertical-slice layout. Each action folder owns everything it needs:

```
src/features/
  events/
    create-event/
      schema.ts          # Zod input schema + inferred types
      functions.ts       # createServerFn handlers
      schema.test.ts     # unit tests co-located with schema
      components/        # components used ONLY by this action
        CreateEventForm.tsx
        ShareLinkDialog.tsx
    list-events/
      functions.ts
      components/
        EventCard.tsx
    get-event-by-token/
      schema.ts
      functions.ts
      components/
        EventDetailView.tsx
```

**Rules:**

- A component belongs in `<Feature>/<Action>/components/` when it is only ever used by that one action. If two or more actions need it, move it up to `src/components/`.
- `src/components/` is **only** for truly shared, feature-agnostic components: shadcn/ui primitives, layout chrome, global UI utilities. Never put a component there just because it "might" be reused — it must actually be shared by multiple features.
- `src/lib/` is for cross-cutting infrastructure (Supabase clients, auth middleware). No feature-specific logic here.
- Routes stay in `src/routes/` (TanStack Router file-based convention). Routes import from `src/features/`, not the reverse.
- Tests are co-located with the file they cover (`schema.test.ts` beside `schema.ts`, `ComponentName.test.tsx` inside `components/`).

## API Client

- **Orval** generates the typed API client from the backend OpenAPI spec (`backend/Picnivo.API/Picnivo.API.json`)
- Generated client lives in `src/api/picnivo-api.ts` — do not edit manually
- Regenerate after backend endpoint changes: `pnpm orval` (or whatever script is configured)
- Import generated hooks/functions from `src/api/` in components and server functions

## Design

- Follow the design references in `context/foundation/design/` when building or changing UI — these JSX mockups (`picnivo-web-*.jsx`, `picnivo-kit.jsx`, `tweaks-panel.jsx`) and CSS (`picnivo.css`, `picnivo-web.css`) are the source of truth for layout, components, and visual styling. Match them before improvising.
- Use shadcn UI.

## Authentication

- Supabase Auth with `@supabase/ssr` for cookie-based SSR sessions
- Server client (`src/lib/supabase/server.ts`): per-request factory using `import.meta.env.VITE_*` — called inside server functions and `beforeLoad`, never at module scope
- Browser client (`src/lib/supabase/client.ts`): singleton for client-side OAuth triggers and `onAuthStateChange`
- Auth middleware (`src/middleware/auth.ts`): validates session and injects `user` + `supabase` into server function context — use for protected server functions
- `_authenticated` layout route guards nested routes — redirects to `/login` if `context.user` is null
- Env vars: `.dev.vars` for server secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`), `.env` for client (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)

## E2E Testing (Playwright)

Full workflow, rules, and gotchas (auth setup, hydration race, locators):
`context/foundation/test-plan.md` §6.7.

<!-- intent-skills:start -->

# Skill mappings - load `use` with `npx @tanstack/intent@latest load <use>`.

skills:

- when: "Install TanStack Devtools, pick framework adapter (React/Vue/Solid/Preact), register plugins via plugins prop, configure shell (position, hotkeys, theme, hideUntilHover, requireUrlFlag, eventBusConfig). TanStackDevtools component, defaultOpen, localStorage persistence."
  use: "@tanstack/devtools#devtools-app-setup"
- when: "Publish plugin to npm and submit to TanStack Devtools Marketplace. PluginMetadata registry format, plugin-registry.ts, pluginImport (importName, type), requires (packageName, minVersion), framework tagging, multi-framework submissions, featured plugins."
  use: "@tanstack/devtools#devtools-marketplace"
- when: "Build devtools panel components that display emitted event data. Listen via EventClient.on(), handle theme (light/dark), use @tanstack/devtools-ui components. Plugin registration (name, render, id, defaultOpen), lifecycle (mount, activate, destroy), max 3 active plugins. Two paths: Solid.js core with devtools-ui for multi-framework support, or framework-specific panels."
  use: "@tanstack/devtools#devtools-plugin-panel"
- when: "Handle devtools in production vs development. removeDevtoolsOnBuild, devDependency vs regular dependency, conditional imports, NoOp plugin variants for tree-shaking, non-Vite production exclusion patterns."
  use: "@tanstack/devtools#devtools-production"
- when: "Two-way event patterns between devtools panel and application. App-to-devtools observation, devtools-to-app commands, time-travel debugging with snapshots and revert. structuredClone for snapshot safety, distinct event suffixes for observation vs commands, serializable payloads only."
  use: "@tanstack/devtools-event-client#devtools-bidirectional"
- when: "Create typed EventClient for a library. Define event maps with typed payloads, pluginId auto-prepend namespacing, emit()/on()/onAll()/onAllPluginEvents() API. Connection lifecycle (5 retries, 300ms), event queuing, enabled/disabled state, SSR fallbacks, singleton pattern. Unique pluginId requirement to avoid event collisions."
  use: "@tanstack/devtools-event-client#devtools-event-client"
- when: "Analyze library codebase for critical architecture and debugging points, add strategic event emissions. Identify middleware boundaries, state transitions, lifecycle hooks. Consolidate events (1 not 15), debounce high-frequency updates, DRY shared payload fields, guard emit() for production. Transparent server/client event bridging."
  use: "@tanstack/devtools-event-client#devtools-instrumentation"
- when: "Configure @tanstack/devtools-vite for source inspection (data-tsd-source, inspectHotkey, ignore patterns), console piping (client-to-server, server-to-client, levels), enhanced logging, server event bus (port, host, HTTPS), production stripping (removeDevtoolsOnBuild), editor integration (launch-editor, custom editor.open). Must be FIRST plugin in Vite config. Vite ^6 || ^7 only."
  use: "@tanstack/devtools-vite#devtools-vite-plugin"
- when: "Step-by-step migration from Next.js App Router to TanStack Start: route definition conversion, API mapping, server function conversion from Server Actions, middleware conversion, data fetching pattern changes."
  use: "@tanstack/react-start#lifecycle/migrate-from-nextjs"
- when: "React bindings for TanStack Start: createStart, StartClient, StartServer, React-specific imports, re-exports from @tanstack/react-router, full project setup with React, useServerFn hook."
  use: "@tanstack/react-start#react-start"
- when: "Implement, review, debug, and refactor TanStack Start React Server Components in React 19 apps. Use when tasks mention @tanstack/react-start/rsc, renderServerComponent, createCompositeComponent, CompositeComponent, renderToReadableStream, createFromReadableStream, createFromFetch, Composite Components, React Flight streams, loader or query owned RSC caching, router.invalidate, structuralSharing: false, selective SSR, stale names like renderRsc or .validator, or migration from Next App Router RSC patterns. Do not use for generic SSR or non-TanStack RSC frameworks except brief comparison."
  use: "@tanstack/react-start#react-start/server-components"
- when: "Framework-agnostic core concepts for TanStack Router: route trees, createRouter, createRoute, createRootRoute, createRootRouteWithContext, addChildren, Register type declaration, route matching, route sorting, file naming conventions. Entry point for all router skills."
  use: "@tanstack/router-core#router-core"
- when: "Route protection with beforeLoad, redirect()/throw redirect(), isRedirect helper, authenticated layout routes (\_authenticated), non-redirect auth (inline login), RBAC with roles and permissions, auth provider integration (Auth0, Clerk, Supabase), router context for auth state."
  use: "@tanstack/router-core#router-core/auth-and-guards"
- when: "Automatic code splitting (autoCodeSplitting), .lazy.tsx convention, createLazyFileRoute, createLazyRoute, lazyRouteComponent, getRouteApi for typed hooks in split files, codeSplitGroupings per-route override, splitBehavior programmatic config, critical vs non-critical properties."
  use: "@tanstack/router-core#router-core/code-splitting"
- when: "Route loader option, loaderDeps for cache keys, staleTime/gcTime/ defaultPreloadStaleTime SWR caching, pendingComponent/pendingMs/ pendingMinMs, errorComponent/onError/onCatch, beforeLoad, router context and createRootRouteWithContext DI pattern, router.invalidate, Await component, deferred data loading with unawaited promises."
  use: "@tanstack/router-core#router-core/data-loading"
- when: "Link component, useNavigate, Navigate component, router.navigate, ToOptions/NavigateOptions/LinkOptions, from/to relative navigation, activeOptions/activeProps, preloading (intent/viewport/render), preloadDelay, navigation blocking (useBlocker, Block), createLink, linkOptions helper, scroll restoration, MatchRoute."
  use: "@tanstack/router-core#router-core/navigation"
- when: "notFound() function, notFoundComponent, defaultNotFoundComponent, notFoundMode (fuzzy/root), errorComponent, CatchBoundary, CatchNotFound, isNotFound, NotFoundRoute (deprecated), route masking (mask option, createRouteMask, unmaskOnReload)."
  use: "@tanstack/router-core#router-core/not-found-and-errors"
- when: "Dynamic path segments ($paramName), splat routes ($ / \_splat), optional params ({-$paramName}), prefix/suffix patterns ({$param}.ext), useParams, params.parse/stringify, pathParamsAllowedCharacters, i18n locale patterns."
  use: "@tanstack/router-core#router-core/path-params"
- when: "validateSearch, search param validation with Zod/Valibot/ArkType adapters, fallback(), search middlewares (retainSearchParams, stripSearchParams), custom serialization (parseSearch, stringifySearch), search param inheritance, loaderDeps for cache keys, reading and writing search params."
  use: "@tanstack/router-core#router-core/search-params"
- when: "Non-streaming and streaming SSR, RouterClient/RouterServer, renderRouterToString/renderRouterToStream, createRequestHandler, defaultRenderHandler/defaultStreamHandler, HeadContent/Scripts components, head route option (meta/links/styles/scripts), ScriptOnce, automatic loader dehydration/hydration, memory history on server, data serialization, document head management."
  use: "@tanstack/router-core#router-core/ssr"
- when: "Full type inference philosophy (never cast, never annotate inferred values), Register module declaration, from narrowing on hooks and Link, strict:false for shared components, getRouteApi for code-split typed access, addChildren with object syntax for TS perf, LinkProps and ValidateLinkOptions type utilities, as const satisfies pattern."
  use: "@tanstack/router-core#router-core/type-safety"
- when: "TanStack Router bundler plugin for route generation and automatic code splitting. Supports Vite, Webpack, Rspack, and esbuild. Configures autoCodeSplitting, routesDirectory, target framework, and code split groupings."
  use: "@tanstack/router-plugin#router-plugin"
- when: "Core overview for TanStack Start: tanstackStart() Vite plugin, getRouter() factory, root route document shell (HeadContent, Scripts, Outlet), client/server entry points, routeTree.gen.ts, tsconfig configuration. Entry point for all Start skills."
  use: "@tanstack/start-client-core#start-core"
- when: "Server-side authentication primitives for TanStack Start: session cookies (HttpOnly, Secure, SameSite, \_\_Host- prefix), session read/issue/destroy via createServerFn and middleware, OAuth authorization-code flow with state and PKCE, password-reset enumeration defense, CSRF for non-GET RPCs, rate limiting auth endpoints, session rotation on privilege change. Pairs with router-core/auth-and-guards for the routing side."
  use: "@tanstack/start-client-core#start-core/auth-server-primitives"
- when: "Deploy to Cloudflare Workers, Netlify, Vercel, Node.js/Docker, Bun, Railway. Selective SSR (ssr option per route), SPA mode, static prerendering, ISR with Cache-Control headers, SEO and head management."
  use: "@tanstack/start-client-core#start-core/deployment"
- when: "Isomorphic-by-default principle, environment boundary functions (createServerFn, createServerOnlyFn, createClientOnlyFn, createIsomorphicFn), ClientOnly component, useHydrated hook, import protection, dead code elimination, environment variable safety (VITE\_ prefix, process.env)."
  use: "@tanstack/start-client-core#start-core/execution-model"
- when: "createMiddleware, request middleware (.server only), server function middleware (.client + .server), context passing via next({ context }), sendContext for client-server transfer, global middleware via createStart in src/start.ts, middleware factories, method order enforcement, fetch override precedence."
  use: "@tanstack/start-client-core#start-core/middleware"
- when: "createServerFn (GET/POST), inputValidator (Zod or function), useServerFn hook, server context utilities (getRequest, getRequestHeader, setResponseHeader, setResponseStatus), error handling (throw errors, redirect, notFound), streaming, FormData handling, file organization (.functions.ts, .server.ts)."
  use: "@tanstack/start-client-core#start-core/server-functions"
- when: "Server-side API endpoints using the server property on createFileRoute, HTTP method handlers (GET, POST, PUT, DELETE), createHandlers for per-handler middleware, handler context (request, params, context), request body parsing, response helpers, file naming for API routes."
  use: "@tanstack/start-client-core#start-core/server-routes"
- when: "Server-side runtime for TanStack Start: createStartHandler, request/response utilities (getRequest, setResponseHeader, setCookie, getCookie, useSession), three-phase request handling, AsyncLocalStorage context."
  use: "@tanstack/start-server-core#start-server-core"
- when: "Programmatic route tree building as an alternative to filesystem conventions: rootRoute, index, route, layout, physical, defineVirtualSubtreeConfig. Use with TanStack Router plugin's virtualRouteConfig option."
use: "@tanstack/virtual-file-routes#virtual-file-routes"
<!-- intent-skills:end -->
