import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react/macro";
import { signInFn } from "../lib/auth/functions";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: (search.redirect as string) || "",
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/login" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signInFn({ data: { email, password } });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    const safe =
      redirect && redirect.startsWith("/") && !redirect.startsWith("//")
        ? redirect
        : "/events";
    navigate({ to: safe });
  }

  async function handleGoogleSignIn() {
    try {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${origin}/auth/callback` },
      });
      if (error) setError(error.message);
    } catch {
      setError(t`Failed to start Google sign-in`);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="island-shell w-full max-w-md rounded-2xl p-8">
        <div className="mb-8 text-center">
          <p className="island-kicker mb-2">
            <Trans>Welcome back</Trans>
          </p>
          <h1 className="display-title text-2xl font-bold">
            <Trans>Sign In</Trans>
          </h1>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-semibold text-(--sea-ink-soft)"
            >
              <Trans>Email</Trans>
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-(--line) bg-(--surface-strong) px-3 py-2 text-(--sea-ink) placeholder:text-(--sea-ink-soft) focus:border-(--lagoon) focus:ring-2 focus:ring-(--lagoon)/25 focus:outline-none"
              placeholder={t`you@example.com`}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-semibold text-(--sea-ink-soft)"
            >
              <Trans>Password</Trans>
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-(--line) bg-(--surface-strong) px-3 py-2 text-(--sea-ink) placeholder:text-(--sea-ink-soft) focus:border-(--lagoon) focus:ring-2 focus:ring-(--lagoon)/25 focus:outline-none"
              placeholder={t`Your password`}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-(--lagoon-deep) px-4 py-2.5 font-semibold text-white transition hover:bg-(--lagoon) disabled:opacity-60"
          >
            {loading ? <Trans>Signing in...</Trans> : <Trans>Sign In</Trans>}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-(--line)" />
          <span className="text-xs font-semibold text-(--sea-ink-soft)">
            <Trans>OR</Trans>
          </span>
          <div className="h-px flex-1 bg-(--line)" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-(--line) bg-(--surface-strong) px-4 py-2.5 font-semibold text-(--sea-ink) transition hover:bg-(--link-bg-hover)"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          <Trans>Sign in with Google</Trans>
        </button>

        <p className="mt-6 text-center text-sm text-(--sea-ink-soft)">
          <Trans>
            Don't have an account?{" "}
            <a href="/register" className="font-semibold">
              Register
            </a>
          </Trans>
        </p>
      </div>
    </main>
  );
}
