import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Trans } from "@lingui/react/macro";
import { createSupabaseServerClient } from "../../lib/supabase/server";

const exchangeCodeFn = createServerFn({ method: "GET" })
  .inputValidator((data: { code: string }) => data)
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(data.code);

    if (error) {
      console.error("OAuth callback error:", error.message);
      return { success: false } as const;
    }

    return { success: true } as const;
  });

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: (search.code as string) || "",
    next: (search.next as string) || "/events",
  }),
  loaderDeps: ({ search }) => ({ code: search.code, next: search.next }),
  loader: async ({ deps }) => {
    if (!deps.code) {
      throw redirect({
        to: "/login",
        search: { redirect: "", mode: "signin" },
      });
    }

    const result = await exchangeCodeFn({ data: { code: deps.code } });

    if (!result.success) {
      throw redirect({
        to: "/login",
        search: { redirect: "", mode: "signin" },
      });
    }

    const safeNext =
      deps.next && deps.next.startsWith("/") && !deps.next.startsWith("//")
        ? deps.next
        : "/events";
    throw redirect({ to: safeNext });
  },
  component: CallbackPage,
});

function CallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-(--ink-soft)">
        <Trans>Completing sign in...</Trans>
      </p>
    </main>
  );
}
