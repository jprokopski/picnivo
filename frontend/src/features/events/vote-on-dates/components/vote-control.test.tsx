import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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

// The wide (desktop) and narrow (mobile) variants both render in the DOM;
// which one is visible is decided by CSS media queries, not React state, so
// jsdom always exposes both. Grab the wide one by its distinguishing class.
function getWideGroup() {
  return screen
    .getAllByRole("group", { name: "Vote" })
    .find((group) => group.className.includes("max-[720px]:hidden"))!;
}

function getNarrowGroup() {
  return screen
    .getAllByRole("group", { name: "Vote" })
    .find((group) => group.className.includes("max-[720px]:flex"))!;
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.mocked(castVotesFn).mockReset().mockResolvedValue({ error: null });
  vi.mocked(toast.error).mockClear();
  invalidate.mockClear();
});

describe("VoteControl", () => {
  it("renders both the desktop and mobile variants for each vote choice", () => {
    render(
      <Wrapper>
        <VoteControl token="tok1" dateOptionId="d1" />
      </Wrapper>,
    );

    expect(screen.getAllByRole("button", { name: "Yes" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Maybe" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "No" })).toHaveLength(2);
  });

  it("pre-selects the current vote in both variants", () => {
    render(
      <Wrapper>
        <VoteControl token="tok1" dateOptionId="d1" value="yes" />
      </Wrapper>,
    );

    for (const button of screen.getAllByRole("button", { name: "Yes" })) {
      expect(button.getAttribute("aria-pressed")).toBe("true");
    }
    for (const button of screen.getAllByRole("button", { name: "No" })) {
      expect(button.getAttribute("aria-pressed")).toBe("false");
    }
  });

  it("calls castVotesFn and invalidates the router on change", async () => {
    render(
      <Wrapper>
        <VoteControl token="tok1" dateOptionId="d1" />
      </Wrapper>,
    );

    fireEvent.click(
      within(getWideGroup()).getByRole("button", { name: "Yes" }),
    );

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

    fireEvent.click(
      within(getWideGroup()).getByRole("button", { name: "Yes" }),
    );

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

    fireEvent.click(
      within(getWideGroup()).getByRole("button", { name: "Yes" }),
    );

    expect(castVotesFn).not.toHaveBeenCalled();
  });

  it("hides the mobile segmented fallback by default, showing it only under the mobile breakpoint", () => {
    render(
      <Wrapper>
        <VoteControl token="tok1" dateOptionId="d1" />
      </Wrapper>,
    );

    const narrowGroup = getNarrowGroup();
    expect(narrowGroup.className).toContain("hidden");
    expect(narrowGroup.className).toContain("max-[720px]:flex");

    const wideGroup = getWideGroup();
    expect(wideGroup.className).toContain("max-[720px]:hidden");
  });
});
