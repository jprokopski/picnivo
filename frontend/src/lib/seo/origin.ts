import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";

// Shared origin resolution for site-level metadata (og:image, og:url,
// canonical) — root and other non-event routes call this rather than
// depending on `window.location`, which would either mismatch during SSR
// hydration or require a post-mount effect. The event-page path keeps its
// own `getShareOriginFn` (see get-event-by-token/functions.ts) — this is a
// deliberate duplicate, not a shared call site, since re-pointing that
// SSE-adjacent function is unrelated churn.
export const getOriginFn = createServerFn({ method: "GET" }).handler(
  async () => getRequestUrl().origin,
);
