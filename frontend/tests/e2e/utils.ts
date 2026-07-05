import type { Locator } from "@playwright/test";

// TanStack Start streams each route and defers hydrating an interactive
// boundary until it sees a real user event land on it. Playwright's
// `.fill()` sets a value without dispatching a click, so filling a field as
// the very first interaction on a freshly navigated page can silently no-op
// against not-yet-hydrated React state. A genuine click on the first field
// wakes hydration before any subsequent fill/click in the flow.
export async function wakeHydration(field: Locator) {
  await field.click();
}
