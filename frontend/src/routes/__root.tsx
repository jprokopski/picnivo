import { useEffect } from "react";
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { I18nProvider } from "@lingui/react";
import { Toaster } from "../components/ui/sonner";
import { i18n } from "../lib/i18n";
import { getSessionFn } from "../lib/supabase/session";
import type { RouterContext } from "../router";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => {
    const user = await getSessionFn();
    return { user };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Picnivo" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  // Playwright's e2e suite needs a deterministic hydration-complete signal —
  // networkidle never fires in dev (TanStack Devtools keeps an SSE console
  // pipe open), and the client bundle can still be mid-transform on a cold
  // `pnpm dev`. See setup/utils.ts's wakeHydration.
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <I18nProvider i18n={i18n}>
          {children}
          <Toaster />
          <TanStackDevtools
            config={{ position: "bottom-right" }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        </I18nProvider>
        <Scripts />
      </body>
    </html>
  );
}
