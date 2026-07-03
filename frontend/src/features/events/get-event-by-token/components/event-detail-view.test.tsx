import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "../../../../lib/i18n";
import { EventDetailView, EventNotFound } from "./event-detail-view";
import type { EventDetailResponse } from "@/api/picnivo-api";

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
}));

afterEach(() => cleanup());

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

const baseEvent: EventDetailResponse = {
  title: "Sunset Beach Picnic",
  description: "Bring your good vibes.",
  location: "Ocean Beach",
  organizerId: "org-1",
  organizerName: "Maya",
  bestDateOptionId: "d1",
  chosenDateOptionId: null,
  dateOptions: [
    {
      id: "d1",
      startsAt: "2099-06-20T19:00:00.000Z",
      yesCount: 1,
      maybeCount: 0,
      noCount: 0,
    },
    {
      id: "d2",
      startsAt: "2099-06-21T19:00:00.000Z",
      yesCount: 0,
      maybeCount: 0,
      noCount: 0,
    },
  ],
  items: [
    {
      id: "i1",
      label: "Watermelon",
      claimedByParticipantId: null,
      claimedByName: null,
      addedByParticipantId: null,
      orphanedFromName: null,
    },
    {
      id: "i2",
      label: "Cups & plates",
      claimedByParticipantId: null,
      claimedByName: null,
      addedByParticipantId: null,
      orphanedFromName: null,
    },
  ],
  participants: [
    {
      id: "p1",
      displayName: "Alice",
      attendance: 1,
      votes: [{ dateOptionId: "d1", choice: 1 }],
    },
  ],
  you: null,
};

describe("EventDetailView", () => {
  it("renders the event title, organizer, and description", () => {
    render(
      <Wrapper>
        <EventDetailView
          event={baseEvent}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={false}
        />
      </Wrapper>,
    );
    expect(screen.getByText("Sunset Beach Picnic")).toBeDefined();
    expect(screen.getByText(/Maya is hosting/i)).toBeDefined();
    expect(screen.getByText("Bring your good vibes.")).toBeDefined();
  });

  it("renders each date option", () => {
    render(
      <Wrapper>
        <EventDetailView
          event={baseEvent}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={false}
        />
      </Wrapper>,
    );
    expect(screen.getAllByText(/Jun/i).length).toBeGreaterThan(0);
  });

  it("renders each item label", () => {
    render(
      <Wrapper>
        <EventDetailView
          event={baseEvent}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={false}
        />
      </Wrapper>,
    );
    expect(screen.getByText("Watermelon")).toBeDefined();
    expect(screen.getByText("Cups & plates")).toBeDefined();
  });

  it("shows the join bar for an unrecognized visitor", () => {
    render(
      <Wrapper>
        <EventDetailView
          event={baseEvent}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={false}
        />
      </Wrapper>,
    );
    expect(screen.getByText(/Add your name to join in/i)).toBeDefined();
  });

  it("hides the join bar for the organizer, even without a participant cookie", () => {
    render(
      <Wrapper>
        <EventDetailView
          event={baseEvent}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={true}
        />
      </Wrapper>,
    );
    expect(screen.queryByText(/Add your name to join in/i)).toBeNull();
  });

  it("renders the best-date hero", () => {
    render(
      <Wrapper>
        <EventDetailView
          event={baseEvent}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={false}
        />
      </Wrapper>,
    );
    expect(screen.getByText("Best date so far")).toBeDefined();
  });

  it("renders the crew list with each participant", () => {
    render(
      <Wrapper>
        <EventDetailView
          event={baseEvent}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={false}
        />
      </Wrapper>,
    );
    expect(screen.getByText("Alice")).toBeDefined();
  });

  it("hides the dates section for a single-date announcement", () => {
    const single: EventDetailResponse = {
      ...baseEvent,
      dateOptions: [baseEvent.dateOptions[0]],
    };
    render(
      <Wrapper>
        <EventDetailView
          event={single}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={false}
        />
      </Wrapper>,
    );
    expect(screen.queryByText("Vote on the dates")).toBeNull();
  });

  it("counts the organizer as able to make it for a single-date announcement", () => {
    const single: EventDetailResponse = {
      ...baseEvent,
      dateOptions: [{ ...baseEvent.dateOptions[0], yesCount: 1 }],
      participants: [],
    };
    render(
      <Wrapper>
        <EventDetailView
          event={single}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={false}
        />
      </Wrapper>,
    );
    expect(screen.getByText(/1 of 0 can make it/i)).toBeDefined();
    expect(screen.getByLabelText("Maya")).toBeDefined();
  });
});

describe("EventNotFound", () => {
  it("renders a not-found message", () => {
    render(
      <Wrapper>
        <EventNotFound />
      </Wrapper>,
    );
    expect(screen.getByText(/couldn't find that event/i)).toBeDefined();
  });
});
