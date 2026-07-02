import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "../../../../lib/i18n";
import { JoinBar } from "./join-bar";

const invalidate = vi.fn().mockResolvedValue(undefined);
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate }),
}));

vi.mock("../functions", () => ({
  joinEventFn: vi.fn(),
}));

import { joinEventFn } from "../functions";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.mocked(joinEventFn).mockReset();
  invalidate.mockClear();
});

describe("JoinBar", () => {
  it("blocks join for a short name", () => {
    render(
      <Wrapper>
        <JoinBar eventToken="tok1" participantNames={[]} />
      </Wrapper>,
    );

    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "A" },
    });

    expect(
      (screen.getByRole("button", { name: /join/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(joinEventFn).not.toHaveBeenCalled();
  });

  it("shows a non-blocking warning for a duplicate name without disabling join", () => {
    render(
      <Wrapper>
        <JoinBar eventToken="tok1" participantNames={["Alice"]} />
      </Wrapper>,
    );

    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "alice" },
    });

    expect(screen.getByText(/already using that name/i)).toBeDefined();
    expect(
      (screen.getByRole("button", { name: /join/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("submits and invalidates the router", async () => {
    vi.mocked(joinEventFn).mockResolvedValue({
      participantId: "p-1",
      duplicateName: false,
      error: null,
    });

    render(
      <Wrapper>
        <JoinBar eventToken="tok1" participantNames={[]} />
      </Wrapper>,
    );

    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "Bob" },
    });
    fireEvent.click(screen.getByRole("button", { name: /join/i }));

    await waitFor(() => {
      expect(joinEventFn).toHaveBeenCalledWith({
        data: { token: "tok1", displayName: "Bob" },
      });
    });
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalled();
    });
  });

  it("shows an error message when the join call fails", async () => {
    vi.mocked(joinEventFn).mockResolvedValue({
      participantId: null,
      duplicateName: false,
      error: "Server error",
    });

    render(
      <Wrapper>
        <JoinBar eventToken="tok1" participantNames={[]} />
      </Wrapper>,
    );

    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "Bob" },
    });
    fireEvent.click(screen.getByRole("button", { name: /join/i }));

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeDefined();
    });
  });
});
