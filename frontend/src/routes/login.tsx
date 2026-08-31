import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { AuthPanel } from "../features/auth/components/auth-panel";
import { i18n } from "../lib/i18n";
import { buildMeta } from "../lib/seo/meta";
import {
  DEFAULT_DESCRIPTION,
  OG_CARD_ALT,
  PRODUCT_TITLE,
} from "../lib/seo/constants";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: (search.redirect as string) || "",
    mode: search.mode === "signup" ? ("signup" as const) : ("signin" as const),
  }),
  // Ignores `search` entirely — `?mode=signup` and `?redirect=...` are UI
  // state, not distinct pages, so the canonical must stay a bare /login for
  // every variant rather than fragmenting across query strings.
  head: ({ match }) => {
    const { origin } = match.context;
    return buildMeta({
      title: i18n._(PRODUCT_TITLE),
      description: i18n._(DEFAULT_DESCRIPTION),
      path: "/login",
      origin,
      imageAlt: i18n._(OG_CARD_ALT),
    });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate({ from: "/login" });
  const { redirect, mode } = useSearch({ from: "/login" });

  function handleToggleMode() {
    navigate({
      search: (prev) => ({
        ...prev,
        mode: prev.mode === "signup" ? "signin" : "signup",
      }),
      replace: true,
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-[clamp(20px,4vw,56px)] max-[480px]:items-stretch max-[480px]:p-0">
      <AuthPanel
        mode={mode}
        redirect={redirect}
        onToggleMode={handleToggleMode}
      />
    </main>
  );
}
