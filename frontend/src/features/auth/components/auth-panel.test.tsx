import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { i18n } from "../../../lib/i18n";
import { AuthPanel } from "./auth-panel";

// ---------------------------------------------------------------------------
// vi.mock must be top-level (it is hoisted by vitest)
// ---------------------------------------------------------------------------
vi.mock("../../../lib/auth/functions", () => ({
  signInFn: vi.fn(),
  signUpFn: vi.fn(),
}));

vi.mock("../../../lib/supabase/client", () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: { signInWithOAuth: vi.fn() },
  })),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

const { signInFn, signUpFn } = await import("../../../lib/auth/functions");
const { toast } = await import("sonner");

function renderPanel(
  mode: "signin" | "signup" = "signin",
  onToggleMode = vi.fn(),
) {
  const rootRoute = createRootRoute({});
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => (
      <I18nProvider i18n={i18n}>
        <AuthPanel mode={mode} redirect="" onToggleMode={onToggleMode} />
      </I18nProvider>
    ),
  });
  const eventsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/events",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, eventsRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

afterEach(() => cleanup());

describe("AuthPanel", () => {
  it("renders the name field only in signup mode", async () => {
    renderPanel("signup");
    expect(await screen.findByLabelText(/Your name/i)).toBeDefined();
  });

  it("does not render the name field in signin mode", async () => {
    renderPanel("signin");
    await screen.findByLabelText(/Email/i);
    expect(screen.queryByLabelText(/Your name/i)).toBeNull();
  });

  it("disables submit until email and password are filled", async () => {
    renderPanel("signin");
    const submit = await screen.findByRole("button", { name: /Sign in/i });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "you@example.com" },
    });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: "secret123" },
    });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables submit in signup mode until name, email, and password are filled", async () => {
    renderPanel("signup");
    const submit = await screen.findByRole("button", {
      name: /Create account/i,
    });
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "you@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: "secret123" },
    });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/Your name/i), {
      target: { value: "Maya Chen" },
    });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });

  it("toggles password visibility", async () => {
    renderPanel("signin");
    const password = (await screen.findByLabelText(
      /Password/i,
    )) as HTMLInputElement;
    expect(password.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: /Show/i }));
    expect(password.type).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: /Hide/i }));
    expect(password.type).toBe("password");
  });

  it("calls signInFn on signin submit", async () => {
    vi.mocked(signInFn).mockResolvedValue({ error: null });
    renderPanel("signin");
    fireEvent.change(await screen.findByLabelText(/Email/i), {
      target: { value: "you@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign in/i }));
    await waitFor(() =>
      expect(signInFn).toHaveBeenCalledWith({
        data: { email: "you@example.com", password: "secret123" },
      }),
    );
  });

  it("calls signUpFn on signup submit", async () => {
    vi.mocked(signUpFn).mockResolvedValue({ error: null });
    renderPanel("signup");
    fireEvent.change(await screen.findByLabelText(/Your name/i), {
      target: { value: "Maya Chen" },
    });
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "maya@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create account/i }));
    await waitFor(() =>
      expect(signUpFn).toHaveBeenCalledWith({
        data: {
          email: "maya@example.com",
          password: "secret123",
          displayName: "Maya Chen",
        },
      }),
    );
  });

  it("surfaces an error via toast when the auth function fails", async () => {
    vi.mocked(signInFn).mockResolvedValue({ error: "Invalid credentials" });
    renderPanel("signin");
    fireEvent.change(await screen.findByLabelText(/Email/i), {
      target: { value: "you@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: "wrongpass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign in/i }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Invalid credentials"),
    );
  });
});
