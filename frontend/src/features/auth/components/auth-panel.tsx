import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import { signInFn, signUpFn } from "../../../lib/auth/functions";
import { createSupabaseBrowserClient } from "../../../lib/supabase/client";
import { cn } from "../../../lib/utils";
import Logo from "../../../components/logo";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { AuthScene } from "./auth-scene";
import { AvatarStack } from "./avatar-stack";

type AuthMode = "signin" | "signup";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
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
  );
}

const FIELD_INPUT =
  "h-12 rounded-(--r-sm) border-(--line) bg-(--card) px-4 text-base text-(--ink) shadow-none placeholder:text-(--ink-faint) focus-visible:border-(--accent) focus-visible:ring-(--accent-tint) focus-visible:ring-4";

const FIELD_LABEL = "mb-1.75 block text-[13px] font-bold text-(--ink)";

export type AuthPanelProps = {
  mode: AuthMode;
  redirect: string;
  onToggleMode: () => void;
};

export function AuthPanel({ mode, redirect, onToggleMode }: AuthPanelProps) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const isSignup = mode === "signup";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [prevMode, setPrevMode] = useState(mode);

  if (mode !== prevMode) {
    setPrevMode(mode);
    setError("");
  }

  const canSubmit =
    email.trim() !== "" &&
    password.trim() !== "" &&
    (!isSignup || name.trim() !== "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = isSignup
        ? await signUpFn({ data: { email, password, displayName: name } })
        : await signInFn({ data: { email, password } });

      if (result.error) {
        setError(result.error);
        return;
      }

      if (isSignup) {
        navigate({ to: "/events" });
        return;
      }

      const safe =
        redirect && redirect.startsWith("/") && !redirect.startsWith("//")
          ? redirect
          : "/events";
      navigate({ to: safe });
    } catch {
      setError(t`Something went wrong. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    try {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${origin}/auth/callback` },
      });
      if (oauthError) setError(oauthError.message);
    } catch {
      setError(t`Failed to start Google sign-in`);
    }
  }

  return (
    <div className="grid w-full max-w-250 grid-cols-[1.02fr_0.98fr] overflow-hidden rounded-(--r-xl) border border-(--line) bg-card shadow-(--sh-lg) max-[820px]:max-w-115 max-[820px]:grid-cols-1 max-[480px]:min-h-screen max-[480px]:rounded-none max-[480px]:border-0 max-[480px]:shadow-none">
      {/* brand panel */}
      <aside className="relative flex min-h-145 flex-col justify-start gap-7 overflow-hidden bg-[linear-gradient(168deg,#ffd58a_0%,#ff9d6b_30%,#f1633f_60%,#e0492a_100%)] p-10 text-white max-[820px]:hidden">
        <AuthScene />
        <div className="relative z-2">
          <Logo size={22} tone="light" />
          <h2 className="mt-7.5 font-display text-[32px] leading-[1.04] font-extrabold tracking-tight text-balance [text-shadow:0_2px_14px_rgba(120,42,18,0.28)]">
            {isSignup ? (
              <Trans>Plan the hang — together.</Trans>
            ) : (
              <Trans>Welcome back to the picnic.</Trans>
            )}
          </h2>
          <p className="mt-3.5 max-w-[30ch] text-[15.5px] leading-normal font-medium text-[rgba(255,250,243,0.92)] [text-shadow:0_1px_8px_rgba(120,42,18,0.22)]">
            <Trans>
              From scattered group chat to a ready-to-go plan — pick a date,
              claim what to bring, all on one shared page.
            </Trans>
          </p>
        </div>
        <div className="relative z-2 mt-1 flex items-center gap-3">
          <AvatarStack
            names={["Maya", "Leo", "Priya", "Sam", "Noah"]}
            size={30}
          />
          <span className="text-[13px] font-semibold text-[rgba(255,250,243,0.92)] [text-shadow:0_1px_8px_rgba(120,42,18,0.22)]">
            <Trans>Where good hangs come together</Trans>
          </span>
        </div>
      </aside>

      {/* form panel */}
      <main className="flex flex-col justify-center p-[clamp(34px,4.4vw,52px)]">
        <div className="mb-6.5">
          <span className="font-mono text-[11px] font-medium tracking-[0.14em] text-(--accent-deep) uppercase">
            {isSignup ? <Trans>Create account</Trans> : <Trans>Sign in</Trans>}
          </span>
          <h1 className="mt-2 font-display text-[30px] leading-[1.02] font-extrabold tracking-tight text-balance text-(--ink)">
            {isSignup ? (
              <Trans>Join Picnivo</Trans>
            ) : (
              <Trans>Welcome back</Trans>
            )}
          </h1>
          <p className="mt-2 text-[15px] leading-normal text-(--ink-soft)">
            {isSignup ? (
              <Trans>
                Start planning get-togethers everyone actually shows up to.
              </Trans>
            ) : (
              <Trans>Sign in to pick dates and rally your crew.</Trans>
            )}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-(--r-sm) border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleSignIn}
          className="h-13 w-full gap-2.75 rounded-full border-[1.5px] border-(--line) bg-card text-[15.5px] font-bold text-(--ink) shadow-(--sh-sm) hover:bg-(--card-2)"
        >
          <GoogleIcon />
          <Trans>Continue with Google</Trans>
        </Button>

        <div className="my-5 flex items-center gap-3.5">
          <div className="h-px flex-1 bg-(--line)" />
          <span className="font-mono text-[11px] tracking-[0.12em] text-(--ink-faint) uppercase">
            {isSignup ? (
              <Trans>or sign up with email</Trans>
            ) : (
              <Trans>or sign in with email</Trans>
            )}
          </span>
          <div className="h-px flex-1 bg-(--line)" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isSignup && (
            <div>
              <Label htmlFor="auth-name" className={FIELD_LABEL}>
                <Trans>Your name</Trans>
              </Label>
              <Input
                id="auth-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t`Maya Chen`}
                className={FIELD_INPUT}
              />
            </div>
          )}

          <div>
            <Label htmlFor="auth-email" className={FIELD_LABEL}>
              <Trans>Email</Trans>
            </Label>
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t`you@email.com`}
              className={FIELD_INPUT}
            />
          </div>

          <div>
            <Label htmlFor="auth-password" className={FIELD_LABEL}>
              <Trans>Password</Trans>
            </Label>
            <div className="relative">
              <Input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignup ? t`At least 6 characters` : "••••••••"}
                className={cn(FIELD_INPUT, "pr-14")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-(--r-xs) px-2.5 py-2 text-[12.5px] font-bold text-(--ink-soft) hover:bg-(--line-2) hover:text-(--ink)"
              >
                {showPassword ? <Trans>Hide</Trans> : <Trans>Show</Trans>}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={!canSubmit || submitting}
            className="mt-1 h-13 w-full rounded-full text-[16px] font-bold"
          >
            {isSignup ? (
              submitting ? (
                <Trans>Creating account...</Trans>
              ) : (
                <Trans>Create account</Trans>
              )
            ) : submitting ? (
              <Trans>Signing in...</Trans>
            ) : (
              <Trans>Sign in</Trans>
            )}
          </Button>
        </form>

        <p className="mt-5.5 text-center text-[14.5px] text-(--ink-soft)">
          {isSignup ? (
            <Trans>Already have an account?</Trans>
          ) : (
            <Trans>New to Picnivo?</Trans>
          )}{" "}
          <button
            type="button"
            onClick={onToggleMode}
            className="font-sans text-[14.5px] font-extrabold text-(--accent-deep) hover:underline"
          >
            {isSignup ? <Trans>Sign in</Trans> : <Trans>Create one</Trans>}
          </button>
        </p>
      </main>
    </div>
  );
}
