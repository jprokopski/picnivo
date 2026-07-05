import type { Locator } from "@playwright/test";

// Vite's dev server transforms each route's client bundle lazily, on first
// request from a real browser — cold enough after a fresh `pnpm dev` that a
// test's first interaction can race past hydration and get silently dropped
// (the fill lands before React's onChange is attached, and never replays).
// `networkidle` can't detect this: TanStack Devtools keeps an SSE console
// pipe open in dev, so the network never goes idle. Instead we wait for the
// root route's post-hydration `useEffect` to stamp `data-hydrated` on
// `<html>` (see `__root.tsx`) — a real, deterministic hydration signal.
export async function wakeHydration(field: Locator) {
  await field
    .page()
    .waitForSelector("html[data-hydrated='true']", { state: "attached" });
  await field.click();
}
