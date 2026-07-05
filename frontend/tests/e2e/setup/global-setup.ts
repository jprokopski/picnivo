// Vite's dev server transforms each route's module graph lazily, on its
// first request — cold enough on a fresh `pnpm dev` that a test's first
// interaction can race past hydration and get silently dropped (the fill
// lands before React's onChange is attached, and never replays). Fetching
// every route the suite touches once, before any test runs, forces that
// transform up front so the actual tests hit an already-warm server.
const ROUTES = ["/", "/login", "/create", "/events"];

export default async function globalSetup() {
  for (const route of ROUTES) {
    try {
      await fetch(`http://localhost:3000${route}`);
    } catch {
      // Best-effort warmup — a route that fails here will just warm up
      // (more slowly) during the actual test instead.
    }
  }
}
