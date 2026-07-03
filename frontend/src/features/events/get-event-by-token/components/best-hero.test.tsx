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
import type { DateOptionDto } from "@/api/picnivo-api";
import { BestHero } from "./best-hero";

const invalidate = vi.fn().mockResolvedValue(undefined);
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate }),
}));

vi.mock("../../select-final-date/functions", () => ({
  selectFinalDateFn: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

import { selectFinalDateFn } from "../../select-final-date/functions";
import { toast } from "sonner";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

afterEach(() => cleanup());

beforeEach(() => {
  vi.mocked(selectFinalDateFn).mockReset().mockResolvedValue({ error: null });
  vi.mocked(toast.error).mockClear();
  invalidate.mockClear();
});

const heroDate: DateOptionDto = {
  id: "d1",
  startsAt: "2099-06-20T19:00:00.000Z",
  yesCount: 2,
  maybeCount: 0,
  noCount: 0,
};

describe("BestHero", () => {
  it("renders the best date", () => {
    render(
      <Wrapper>
        <BestHero
          token="tok1"
          heroDate={heroDate}
          location="Ocean Beach"
          organizerName="Maya"
          isOrganizer={false}
          locked={false}
          yesVoterNames={["Alice"]}
          totalParticipants={3}
        />
      </Wrapper>,
    );

    expect(screen.getAllByText(/Jun/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Best date so far")).toBeDefined();
    expect(screen.getByText(/2 of 3 can make it/i)).toBeDefined();
  });

  it("shows the lock button only for the organizer", () => {
    const { rerender } = render(
      <Wrapper>
        <BestHero
          token="tok1"
          heroDate={heroDate}
          organizerName="Maya"
          isOrganizer={false}
          locked={false}
          yesVoterNames={[]}
          totalParticipants={3}
        />
      </Wrapper>,
    );
    expect(
      screen.queryByRole("button", { name: /lock in this date/i }),
    ).toBeNull();
    expect(screen.getByText(/Maya picks the final date/i)).toBeDefined();

    rerender(
      <Wrapper>
        <BestHero
          token="tok1"
          heroDate={heroDate}
          organizerName="Maya"
          isOrganizer={true}
          locked={false}
          yesVoterNames={[]}
          totalParticipants={3}
        />
      </Wrapper>,
    );
    expect(
      screen.getByRole("button", { name: /lock in this date/i }),
    ).toBeDefined();
  });

  it("calls selectFinalDateFn and invalidates the router on lock", async () => {
    render(
      <Wrapper>
        <BestHero
          token="tok1"
          heroDate={heroDate}
          organizerName="Maya"
          isOrganizer={true}
          locked={false}
          yesVoterNames={[]}
          totalParticipants={3}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: /lock in this date/i }));

    await waitFor(() => {
      expect(selectFinalDateFn).toHaveBeenCalledWith({
        data: { token: "tok1", dateOptionId: "d1" },
      });
    });
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalled();
    });
  });

  it("shows an error toast and does not invalidate when the lock fails", async () => {
    vi.mocked(selectFinalDateFn).mockResolvedValue({
      error: "Not the organizer.",
    });
    render(
      <Wrapper>
        <BestHero
          token="tok1"
          heroDate={heroDate}
          organizerName="Maya"
          isOrganizer={true}
          locked={false}
          yesVoterNames={[]}
          totalParticipants={3}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: /lock in this date/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Not the organizer.");
    });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("shows the locked chip and hides the lock button once chosen", () => {
    render(
      <Wrapper>
        <BestHero
          token="tok1"
          heroDate={heroDate}
          organizerName="Maya"
          isOrganizer={true}
          locked={true}
          yesVoterNames={[]}
          totalParticipants={3}
        />
      </Wrapper>,
    );

    expect(screen.getByText(/it's official/i)).toBeDefined();
    expect(
      screen.queryByRole("button", { name: /lock in this date/i }),
    ).toBeNull();
  });
});
