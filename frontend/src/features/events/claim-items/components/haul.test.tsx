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
import type { EventItemDto, ParticipantDto, YouDto } from "@/api/picnivo-api";
import { Haul } from "./haul";

const invalidate = vi.fn().mockResolvedValue(undefined);
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate }),
}));

vi.mock("../functions", () => ({
  claimItemFn: vi.fn(),
  releaseClaimFn: vi.fn(),
  addItemFn: vi.fn(),
  removeItemFn: vi.fn(),
}));

vi.mock("../../set-attendance/functions", () => ({
  setAttendanceFn: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

import { claimItemFn, releaseClaimFn } from "../functions";
import { setAttendanceFn } from "../../set-attendance/functions";
import { toast } from "sonner";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

afterEach(() => cleanup());

beforeEach(() => {
  vi.mocked(claimItemFn).mockReset().mockResolvedValue({ error: null });
  vi.mocked(releaseClaimFn).mockReset().mockResolvedValue({ error: null });
  vi.mocked(setAttendanceFn).mockReset().mockResolvedValue({ error: null });
  vi.mocked(toast.error).mockClear();
  invalidate.mockClear();
});

const participants: ParticipantDto[] = [
  {
    id: "p1",
    displayName: "Alice",
    isOrganizer: false,
    attendance: 2,
    votes: [],
  },
];

function item(overrides: Partial<EventItemDto> = {}): EventItemDto {
  return {
    id: "i1",
    label: "Watermelon",
    claimedByParticipantId: null,
    claimedByName: null,
    addedByParticipantId: null,
    orphanedFromName: null,
    ...overrides,
  };
}

const comingYou: YouDto = { votes: [], claimedItemIds: [], attendance: 2 };
const undecidedYou: YouDto = { votes: [], claimedItemIds: [], attendance: 1 };

describe("Haul", () => {
  it("renders a read-only gated haul before the date is locked", () => {
    render(
      <Wrapper>
        <Haul
          token="tok1"
          items={[item()]}
          participants={participants}
          chosenDateOptionId={null}
          locked={false}
          joined={true}
          isOrganizer={false}
          organizerName="Maya"
          you={comingYou}
          myParticipantId="p1"
        />
      </Wrapper>,
    );

    expect(
      screen.getByText(/Claiming opens once the date's locked/i),
    ).toBeDefined();
    expect(screen.getByText("Watermelon")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Claim" })).toBeNull();
  });

  it("shows confirm-claim when the participant hasn't confirmed they're coming", () => {
    render(
      <Wrapper>
        <Haul
          token="tok1"
          items={[item()]}
          participants={participants}
          chosenDateOptionId="d1"
          locked={true}
          joined={true}
          isOrganizer={false}
          organizerName="Maya"
          you={undecidedYou}
          myParticipantId="p1"
        />
      </Wrapper>,
    );

    expect(screen.getByText(/Confirm you're coming to claim/i)).toBeDefined();
    expect(
      (
        screen.getByRole("button", {
          name: /Confirm to claim/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("confirming attendance calls setAttendanceFn with coming", async () => {
    render(
      <Wrapper>
        <Haul
          token="tok1"
          items={[item()]}
          participants={participants}
          chosenDateOptionId="d1"
          locked={true}
          joined={true}
          isOrganizer={false}
          organizerName="Maya"
          you={undecidedYou}
          myParticipantId="p1"
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: "I'm in" }));

    await waitFor(() => {
      expect(setAttendanceFn).toHaveBeenCalledWith({
        data: { token: "tok1", status: "coming" },
      });
    });
  });

  it("allows claiming once effectively coming, and claims call claimItemFn", async () => {
    render(
      <Wrapper>
        <Haul
          token="tok1"
          items={[item()]}
          participants={participants}
          chosenDateOptionId="d1"
          locked={true}
          joined={true}
          isOrganizer={false}
          organizerName="Maya"
          you={comingYou}
          myParticipantId="p1"
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Claim/ }));

    await waitFor(() => {
      expect(claimItemFn).toHaveBeenCalledWith({
        data: { token: "tok1", itemId: "i1" },
      });
    });
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
  });

  it("shows unclaim for your own claimed item, and releases it", async () => {
    render(
      <Wrapper>
        <Haul
          token="tok1"
          items={[item({ claimedByParticipantId: "p1", claimedByName: "You" })]}
          participants={participants}
          chosenDateOptionId="d1"
          locked={true}
          joined={true}
          isOrganizer={false}
          organizerName="Maya"
          you={{ votes: [], claimedItemIds: ["i1"], attendance: 2 }}
          myParticipantId="p1"
        />
      </Wrapper>,
    );

    const row = screen.getByRole("button", { name: /Watermelon/i });
    expect(screen.getByText("You")).toBeDefined();
    fireEvent.click(row);

    await waitFor(() => {
      expect(releaseClaimFn).toHaveBeenCalledWith({
        data: { token: "tok1", itemId: "i1" },
      });
    });
  });

  it("shows an already-claimed message and still refetches on a 409 conflict", async () => {
    vi.mocked(claimItemFn).mockResolvedValue({
      error: "Someone already claimed that.",
    });
    render(
      <Wrapper>
        <Haul
          token="tok1"
          items={[item()]}
          participants={participants}
          chosenDateOptionId="d1"
          locked={true}
          joined={true}
          isOrganizer={false}
          organizerName="Maya"
          you={comingYou}
          myParticipantId="p1"
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Claim/ }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Someone already claimed that.");
    });
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
  });

  it("renders an orphaned item as re-claimable", () => {
    render(
      <Wrapper>
        <Haul
          token="tok1"
          items={[
            item({ orphanedFromName: "Bob", claimedByParticipantId: null }),
          ]}
          participants={participants}
          chosenDateOptionId="d1"
          locked={true}
          joined={true}
          isOrganizer={false}
          organizerName="Maya"
          you={comingYou}
          myParticipantId="p1"
        />
      </Wrapper>,
    );

    expect(screen.getByText(/needs a new owner/i)).toBeDefined();
    expect(screen.getByText("I'll cover it")).toBeDefined();
  });

  it("lets the organizer remove an item they didn't add", () => {
    render(
      <Wrapper>
        <Haul
          token="tok1"
          items={[item({ label: "Watermelon", addedByParticipantId: null })]}
          participants={participants}
          chosenDateOptionId="d1"
          locked={true}
          joined={true}
          isOrganizer={true}
          organizerName="Maya"
          you={comingYou}
          myParticipantId="p1"
        />
      </Wrapper>,
    );

    expect(
      screen.getByRole("button", { name: /Remove Watermelon/i }),
    ).toBeDefined();
  });

  it("hides the remove button for a non-adder, non-organizer guest", () => {
    render(
      <Wrapper>
        <Haul
          token="tok1"
          items={[item({ label: "Watermelon", addedByParticipantId: "p2" })]}
          participants={participants}
          chosenDateOptionId="d1"
          locked={true}
          joined={true}
          isOrganizer={false}
          organizerName="Maya"
          you={comingYou}
          myParticipantId="p1"
        />
      </Wrapper>,
    );

    expect(
      screen.queryByRole("button", { name: /Remove Watermelon/i }),
    ).toBeNull();
  });
});
