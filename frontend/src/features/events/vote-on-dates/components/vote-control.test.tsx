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
import { VoteControl } from "./vote-control";

const invalidate = vi.fn().mockResolvedValue(undefined);
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate }),
}));

vi.mock("../functions", () => ({
  castVotesFn: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

import { castVotesFn } from "../functions";
import { toast } from "sonner";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.mocked(castVotesFn).mockReset().mockResolvedValue({ error: null });
  vi.mocked(toast.error).mockClear();
  invalidate.mockClear();
  mockMatchMedia(false);
});

describe("VoteControl", () => {
  it("renders the reaction control for each vote choice", () => {
    render(
      <Wrapper>
        <VoteControl token="tok1" dateOptionId="d1" />
      </Wrapper>,
    );

    expect(screen.getByRole("button", { name: "Yes" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Maybe" })).toBeDefined();
    expect(screen.getByRole("button", { name: "No" })).toBeDefined();
  });

  it("pre-selects the current vote", () => {
    render(
      <Wrapper>
        <VoteControl token="tok1" dateOptionId="d1" value="yes" />
      </Wrapper>,
    );

    expect(
      screen.getByRole("button", { name: "Yes" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "No" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("calls castVotesFn and invalidates the router on change", async () => {
    render(
      <Wrapper>
        <VoteControl token="tok1" dateOptionId="d1" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => {
      expect(castVotesFn).toHaveBeenCalledWith({
        data: { token: "tok1", votes: [{ dateOptionId: "d1", choice: "yes" }] },
      });
    });
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalled();
    });
  });

  it("shows an error toast and does not invalidate when the vote fails", async () => {
    vi.mocked(castVotesFn).mockResolvedValue({
      error: "Join the event before voting.",
    });
    render(
      <Wrapper>
        <VoteControl token="tok1" dateOptionId="d1" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Join the event before voting.");
    });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("does not call castVotesFn when disabled", () => {
    render(
      <Wrapper>
        <VoteControl token="tok1" dateOptionId="d1" disabled />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    expect(castVotesFn).not.toHaveBeenCalled();
  });

  it("renders the narrow segmented fallback under the mobile breakpoint", () => {
    mockMatchMedia(true);
    render(
      <Wrapper>
        <VoteControl token="tok1" dateOptionId="d1" />
      </Wrapper>,
    );

    const group = screen.getByRole("group", { name: "Vote" });
    expect(group.className).toContain("w-full");
  });
});
