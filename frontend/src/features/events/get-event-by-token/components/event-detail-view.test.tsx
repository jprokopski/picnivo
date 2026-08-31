import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "../../../../lib/i18n";
import { EventDetailView, EventNotFound } from "./event-detail-view";
import type { EventDetailResponse } from "@/api/picnivo-api";

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
  useNavigate: () => vi.fn(),
}));

window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})) as unknown as typeof window.matchMedia;

// jsdom has no EventSource; useEventStream opens one on mount, so stub a
// no-op implementation for the component to connect to.
class FakeEventSource {
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  close = vi.fn();
}
vi.stubGlobal("EventSource", FakeEventSource);

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
      isOrganizer: false,
      attendance: 1,
      votes: [{ dateOptionId: "d1", choice: 1 }],
    },
  ],
  you: null,
  revision: 1,
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
          myParticipantId={null}
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
          myParticipantId={null}
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
          myParticipantId={null}
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
          myParticipantId={null}
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
          myParticipantId={null}
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
          myParticipantId={null}
        />
      </Wrapper>,
    );
    expect(screen.getByText("Best date so far")).toBeDefined();
  });

  it("falls back to the first date option when neither chosenDateOptionId nor bestDateOptionId is set", () => {
    const noBestDate: EventDetailResponse = {
      ...baseEvent,
      bestDateOptionId: null,
      chosenDateOptionId: null,
    };
    render(
      <Wrapper>
        <EventDetailView
          event={noBestDate}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={false}
          myParticipantId={null}
        />
      </Wrapper>,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: /Jun 20/i }),
    ).toBeDefined();
  });

  it("shows the delete-event control only for the organizer", () => {
    const { rerender } = render(
      <Wrapper>
        <EventDetailView
          event={baseEvent}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={false}
          myParticipantId={null}
        />
      </Wrapper>,
    );
    expect(screen.queryByRole("button", { name: "Delete event" })).toBeNull();

    rerender(
      <Wrapper>
        <EventDetailView
          event={baseEvent}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={true}
          myParticipantId={null}
        />
      </Wrapper>,
    );
    expect(screen.getByRole("button", { name: "Delete event" })).toBeDefined();
  });

  it("renders the crew list with each participant", () => {
    render(
      <Wrapper>
        <EventDetailView
          event={baseEvent}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={false}
          myParticipantId={null}
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
          myParticipantId={null}
        />
      </Wrapper>,
    );
    expect(screen.queryByText("Vote on the dates")).toBeNull();
  });

  it("does not assume the organizer is coming to a single-date announcement by default", () => {
    const single: EventDetailResponse = {
      ...baseEvent,
      dateOptions: [baseEvent.dateOptions[0]],
      participants: [
        {
          id: "org-1",
          displayName: "Maya",
          isOrganizer: true,
          attendance: 1,
          votes: [],
        },
      ],
    };
    render(
      <Wrapper>
        <EventDetailView
          event={single}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={false}
          myParticipantId={null}
        />
      </Wrapper>,
    );
    expect(screen.getByText(/0 of 1 coming/i)).toBeDefined();
  });

  it("counts the organizer as coming once they've confirmed for a single-date announcement", () => {
    const single: EventDetailResponse = {
      ...baseEvent,
      dateOptions: [baseEvent.dateOptions[0]],
      participants: [
        {
          id: "org-1",
          displayName: "Maya",
          isOrganizer: true,
          attendance: 2,
          votes: [],
        },
      ],
    };
    render(
      <Wrapper>
        <EventDetailView
          event={single}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={false}
          myParticipantId={null}
        />
      </Wrapper>,
    );
    expect(screen.getByText(/1 of 1 coming/i)).toBeDefined();
  });
});

describe("EventDetailView announcement RSVP", () => {
  it("lets the organizer RSVP on a single-date announcement instead of showing a no-voting message", () => {
    const single: EventDetailResponse = {
      ...baseEvent,
      dateOptions: [baseEvent.dateOptions[0]],
      participants: [
        {
          id: "org-1",
          displayName: "Maya",
          isOrganizer: true,
          attendance: 1,
          votes: [],
        },
      ],
      you: { votes: [], claimedItemIds: [], attendance: 1 },
    };
    render(
      <Wrapper>
        <EventDetailView
          event={single}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={true}
          myParticipantId="org-1"
        />
      </Wrapper>,
    );

    expect(screen.getByRole("button", { name: /I'm in/i })).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Can't make it/i }),
    ).toBeDefined();
    expect(screen.queryByText(/No voting needed/i)).toBeNull();
  });

  it("does not count a freshly joined guest as coming until they RSVP", () => {
    const single: EventDetailResponse = {
      ...baseEvent,
      dateOptions: [baseEvent.dateOptions[0]],
      participants: [
        {
          id: "org-1",
          displayName: "Maya",
          isOrganizer: true,
          attendance: 1,
          votes: [],
        },
        {
          id: "p2",
          displayName: "Bob",
          isOrganizer: false,
          attendance: 1,
          votes: [],
        },
      ],
      you: { votes: [], claimedItemIds: [], attendance: 1 },
    };
    render(
      <Wrapper>
        <EventDetailView
          event={single}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={false}
          myParticipantId="p2"
        />
      </Wrapper>,
    );

    expect(screen.getByText(/0 of 2 coming/i)).toBeDefined();
    expect(screen.getByText(/are you coming\?/i)).toBeDefined();
    expect(screen.queryByText(/you're in/i)).toBeNull();
  });
});

describe("EventDetailView attendance card", () => {
  const locked: EventDetailResponse = {
    ...baseEvent,
    chosenDateOptionId: "d1",
  };

  it("lets a coming guest back out once the date is locked", () => {
    render(
      <Wrapper>
        <EventDetailView
          event={{
            ...locked,
            you: {
              votes: [{ dateOptionId: "d1", choice: 1 }],
              claimedItemIds: [],
              attendance: 1,
            },
          }}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={false}
          myParticipantId="p2"
        />
      </Wrapper>,
    );

    expect(screen.getByText(/you're in/i)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Can't make it anymore\?/i }),
    ).toBeDefined();
  });

  it("prompts an undecided guest who never voted on the locked date", () => {
    render(
      <Wrapper>
        <EventDetailView
          event={{
            ...locked,
            you: { votes: [], claimedItemIds: [], attendance: 1 },
          }}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={false}
          myParticipantId="p2"
        />
      </Wrapper>,
    );

    expect(screen.getByText(/are you still coming/i)).toBeDefined();
  });

  it("shows the attendance card to the organizer too", () => {
    render(
      <Wrapper>
        <EventDetailView
          event={{
            ...locked,
            you: { votes: [], claimedItemIds: [], attendance: 1 },
          }}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={true}
          myParticipantId="org-1"
        />
      </Wrapper>,
    );

    expect(screen.getByText(/are you still coming/i)).toBeDefined();
  });

  it("hides the attendance card for a guest who hasn't joined", () => {
    render(
      <Wrapper>
        <EventDetailView
          event={locked}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={false}
          myParticipantId={null}
        />
      </Wrapper>,
    );

    expect(screen.queryByText(/are you still coming/i)).toBeNull();
    expect(screen.queryByText(/you're in/i)).toBeNull();
  });

  it("counts an RSVP'd guest toward the locked date's tally even without a matching vote", () => {
    const lockedWithRsvp: EventDetailResponse = {
      ...locked,
      participants: [
        ...locked.participants,
        {
          id: "p2",
          displayName: "Bob",
          isOrganizer: false,
          attendance: 2,
          votes: [],
        },
      ],
    };
    render(
      <Wrapper>
        <EventDetailView
          event={lockedWithRsvp}
          token="tok1"
          shareUrl="https://picnivo.test/e/tok1"
          isOrganizer={false}
          myParticipantId={null}
        />
      </Wrapper>,
    );

    expect(screen.getByText(/2 of 2 can make it/i)).toBeDefined();
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
