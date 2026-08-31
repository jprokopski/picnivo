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
import { getOriginFn } from "../lib/seo/origin";
import { buildMeta } from "../lib/seo/meta";
import {
  DEFAULT_DESCRIPTION,
  OG_CARD_ALT,
  SITE_NAME,
} from "../lib/seo/constants";
import type { RouterContext } from "../router";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => {
    const [user, origin] = await Promise.all([getSessionFn(), getOriginFn()]);
    return { user, origin };
  },
  // Brand-level defaults every route inherits. `links` deliberately omits the
  // `canonical` entry buildMeta() would emit for "/" — TanStack Router only
  // dedupes `meta` by name/property (deepest match wins), not `links` by
  // `rel`, so a route-level canonical would render alongside this one rather
  // than replacing it. Canonical is left to pages that actually describe a
  // URL (login, event); root has none of its own — "/" always redirects.
  head: ({ match }) => {
    const { origin } = match.context;
    const { meta } = buildMeta({
      title: SITE_NAME,
      description: i18n._(DEFAULT_DESCRIPTION),
      path: "/",
      origin,
      imageAlt: i18n._(OG_CARD_ALT),
    });

    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#fbf4e9" },
        ...meta,
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      ],
    };
  },
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
