import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { ErrorFallback } from "./components/error-fallback";
import { routeTree } from "./routeTree.gen";

export type RouterContext = {
  user: User | null;
  origin: string;
};

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ErrorFallback,
    context: { user: null, origin: "" },
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
