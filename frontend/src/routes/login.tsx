import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { AuthPanel } from "../features/auth/components/AuthPanel";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: (search.redirect as string) || "",
    mode: search.mode === "signup" ? ("signup" as const) : ("signin" as const),
  }),
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
