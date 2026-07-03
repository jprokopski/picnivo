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
import { AttendanceCard } from "./attendance-card";

const invalidate = vi.fn().mockResolvedValue(undefined);
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate }),
}));

vi.mock("../functions", () => ({
  setAttendanceFn: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

import { setAttendanceFn } from "../functions";
import { toast } from "sonner";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

afterEach(() => cleanup());

beforeEach(() => {
  vi.mocked(setAttendanceFn).mockReset().mockResolvedValue({ error: null });
  vi.mocked(toast.error).mockClear();
  invalidate.mockClear();
});

const date: DateOptionDto = {
  id: "d1",
  startsAt: "2099-06-20T19:00:00.000Z",
  yesCount: 2,
  maybeCount: 0,
  noCount: 1,
};

describe("AttendanceCard", () => {
  it("shows the recovery card for an implicit no-vote and offers both actions", () => {
    render(
      <Wrapper>
        <AttendanceCard
          token="tok1"
          date={date}
          status="out"
          isExplicitOut={false}
          isAnnouncement={false}
        />
      </Wrapper>,
    );

    expect(screen.getByText(/you voted no/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /I'll make it/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Count me out/i })).toBeDefined();
  });

  it("shows the explicit-out recovery card with only the re-join action", () => {
    render(
      <Wrapper>
        <AttendanceCard
          token="tok1"
          date={date}
          status="out"
          isExplicitOut={true}
          isAnnouncement={false}
        />
      </Wrapper>,
    );

    expect(screen.getByText(/marked: can't make it/i)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Actually, I'll make it/i }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: /Count me out/i })).toBeNull();
  });

  it("mentions the claimed item so bowing out is an informed choice", () => {
    render(
      <Wrapper>
        <AttendanceCard
          token="tok1"
          date={date}
          status="out"
          isExplicitOut={false}
          isAnnouncement={false}
          myClaim={{
            id: "i1",
            label: "Watermelon",
            claimedByParticipantId: "p1",
            claimedByName: "You",
            addedByParticipantId: null,
            orphanedFromName: null,
          }}
        />
      </Wrapper>,
    );

    expect(screen.getByText(/down for/i)).toBeDefined();
    expect(screen.getByText("Watermelon")).toBeDefined();
  });

  it("counting out calls setAttendanceFn with out and invalidates", async () => {
    render(
      <Wrapper>
        <AttendanceCard
          token="tok1"
          date={date}
          status="out"
          isExplicitOut={false}
          isAnnouncement={false}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Count me out/i }));

    await waitFor(() => {
      expect(setAttendanceFn).toHaveBeenCalledWith({
        data: { token: "tok1", status: "out" },
      });
    });
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
  });

  it("shows an error toast and does not invalidate when the mutation fails", async () => {
    vi.mocked(setAttendanceFn).mockResolvedValue({ error: "Network error." });
    render(
      <Wrapper>
        <AttendanceCard
          token="tok1"
          date={date}
          status="out"
          isExplicitOut={false}
          isAnnouncement={false}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: /I'll make it/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Network error.");
    });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("shows a coming confirmation with a single back-out action when status is in", () => {
    render(
      <Wrapper>
        <AttendanceCard
          token="tok1"
          date={date}
          status="in"
          isExplicitOut={false}
          isAnnouncement={false}
        />
      </Wrapper>,
    );

    expect(screen.getByText(/you're in/i)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Can't make it anymore\?/i }),
    ).toBeDefined();
  });

  it("backing out from coming calls setAttendanceFn with out", async () => {
    render(
      <Wrapper>
        <AttendanceCard
          token="tok1"
          date={date}
          status="in"
          isExplicitOut={false}
          isAnnouncement={false}
        />
      </Wrapper>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Can't make it anymore\?/i }),
    );

    await waitFor(() => {
      expect(setAttendanceFn).toHaveBeenCalledWith({
        data: { token: "tok1", status: "out" },
      });
    });
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
  });

  it("offers both actions when the participant never voted on the locked date", () => {
    render(
      <Wrapper>
        <AttendanceCard
          token="tok1"
          date={date}
          status="undecided"
          isExplicitOut={false}
          isAnnouncement={false}
        />
      </Wrapper>,
    );

    expect(screen.getByText(/are you still coming/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /I'm in/i })).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Can't make it/i }),
    ).toBeDefined();
  });

  it("drops the voting-specific copy for an announcement", () => {
    render(
      <Wrapper>
        <AttendanceCard
          token="tok1"
          date={date}
          status="undecided"
          isExplicitOut={false}
          isAnnouncement={true}
        />
      </Wrapper>,
    );

    expect(screen.getByText(/are you coming\?/i)).toBeDefined();
    expect(screen.queryByText(/the group locked/i)).toBeNull();
  });

  it("shows an announcement-flavored confirmation when coming", () => {
    render(
      <Wrapper>
        <AttendanceCard
          token="tok1"
          date={date}
          status="in"
          isExplicitOut={false}
          isAnnouncement={true}
        />
      </Wrapper>,
    );

    expect(screen.getByText(/see you there/i)).toBeDefined();
    expect(screen.queryByText(/the group locked/i)).toBeNull();
  });

  it("shows an announcement-flavored recovery card when explicitly out", () => {
    render(
      <Wrapper>
        <AttendanceCard
          token="tok1"
          date={date}
          status="out"
          isExplicitOut={true}
          isAnnouncement={true}
        />
      </Wrapper>,
    );

    expect(screen.getByText(/doesn't work for you/i)).toBeDefined();
    expect(screen.queryByText(/the group locked/i)).toBeNull();
  });
});
