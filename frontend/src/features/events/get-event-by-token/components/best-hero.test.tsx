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
  vi.mocked(selectFinalDateFn).mockReset().mockResolvedValue({
    error: null,
    changed: false,
    currentBestDateOptionId: null,
  });
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

const otherDate: DateOptionDto = {
  id: "d2",
  startsAt: "2099-06-27T19:00:00.000Z",
  yesCount: 3,
  maybeCount: 0,
  noCount: 0,
};

const dateOptions = [heroDate, otherDate];

describe("BestHero", () => {
  it("renders the best date", () => {
    render(
      <Wrapper>
        <BestHero
          token="tok1"
          heroDate={heroDate}
          dateOptions={dateOptions}
          location="Ocean Beach"
          organizerName="Maya"
          isOrganizer={false}
          locked={false}
          comingNames={["Alice"]}
          totalParticipants={3}
        />
      </Wrapper>,
    );

    expect(screen.getAllByText(/Jun/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Best date so far")).toBeDefined();
    expect(screen.getByText(/1 of 3 can make it/i)).toBeDefined();
  });

  it("shows the lock button only for the organizer", () => {
    const { rerender } = render(
      <Wrapper>
        <BestHero
          token="tok1"
          heroDate={heroDate}
          dateOptions={dateOptions}
          organizerName="Maya"
          isOrganizer={false}
          locked={false}
          comingNames={[]}
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
          dateOptions={dateOptions}
          organizerName="Maya"
          isOrganizer={true}
          locked={false}
          comingNames={[]}
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
          dateOptions={dateOptions}
          organizerName="Maya"
          isOrganizer={true}
          locked={false}
          comingNames={[]}
          totalParticipants={3}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: /lock in this date/i }));

    await waitFor(() => {
      expect(selectFinalDateFn).toHaveBeenCalledWith({
        data: { token: "tok1", dateOptionId: "d1", force: false },
      });
    });
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalled();
    });
  });

  it("shows an error toast and does not invalidate when the lock fails", async () => {
    vi.mocked(selectFinalDateFn).mockResolvedValue({
      error: "Not the organizer.",
      changed: false,
      currentBestDateOptionId: null,
    });
    render(
      <Wrapper>
        <BestHero
          token="tok1"
          heroDate={heroDate}
          dateOptions={dateOptions}
          organizerName="Maya"
          isOrganizer={true}
          locked={false}
          comingNames={[]}
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
          dateOptions={dateOptions}
          organizerName="Maya"
          isOrganizer={true}
          locked={true}
          comingNames={[]}
          totalParticipants={3}
        />
      </Wrapper>,
    );

    expect(screen.getByText(/it's official/i)).toBeDefined();
    expect(
      screen.queryByRole("button", { name: /lock in this date/i }),
    ).toBeNull();
  });

  it("opens a confirm dialog naming the new leader when the lock is stale", async () => {
    vi.mocked(selectFinalDateFn).mockResolvedValueOnce({
      error: null,
      changed: true,
      currentBestDateOptionId: "d2",
    });
    render(
      <Wrapper>
        <BestHero
          token="tok1"
          heroDate={heroDate}
          dateOptions={dateOptions}
          organizerName="Maya"
          isOrganizer={true}
          locked={false}
          comingNames={[]}
          totalParticipants={3}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: /lock in this date/i }));

    expect(await screen.findByText(/the leading date changed/i)).toBeDefined();
    expect(screen.getAllByText(/Jun 27/i).length).toBeGreaterThan(0);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("resends with force on confirm and invalidates the router", async () => {
    vi.mocked(selectFinalDateFn)
      .mockResolvedValueOnce({
        error: null,
        changed: true,
        currentBestDateOptionId: "d2",
      })
      .mockResolvedValueOnce({
        error: null,
        changed: false,
        currentBestDateOptionId: null,
      });
    render(
      <Wrapper>
        <BestHero
          token="tok1"
          heroDate={heroDate}
          dateOptions={dateOptions}
          organizerName="Maya"
          isOrganizer={true}
          locked={false}
          comingNames={[]}
          totalParticipants={3}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: /lock in this date/i }));
    await screen.findByText(/the leading date changed/i);

    fireEvent.click(screen.getByRole("button", { name: /lock it in anyway/i }));

    await waitFor(() => {
      expect(selectFinalDateFn).toHaveBeenLastCalledWith({
        data: { token: "tok1", dateOptionId: "d1", force: true },
      });
    });
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalled();
    });
  });

  it("locks immediately with no dialog when the leader has not moved", async () => {
    render(
      <Wrapper>
        <BestHero
          token="tok1"
          heroDate={heroDate}
          dateOptions={dateOptions}
          organizerName="Maya"
          isOrganizer={true}
          locked={false}
          comingNames={[]}
          totalParticipants={3}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: /lock in this date/i }));

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalled();
    });
    expect(screen.queryByText(/the leading date changed/i)).toBeNull();
  });
});
