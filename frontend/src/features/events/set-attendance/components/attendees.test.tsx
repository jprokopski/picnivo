import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "../../../../lib/i18n";
import type { ParticipantDto } from "@/api/picnivo-api";
import { Attendees } from "./attendees";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

afterEach(() => cleanup());

const participants: ParticipantDto[] = [
  {
    id: "p1",
    displayName: "Maya",
    isOrganizer: true,
    attendance: 1,
    votes: [],
  },
  {
    id: "p2",
    displayName: "Alice",
    isOrganizer: false,
    attendance: 2,
    votes: [],
  },
  {
    id: "p3",
    displayName: "Bob",
    isOrganizer: false,
    attendance: 1,
    votes: [{ dateOptionId: "d1", choice: 3 }],
  },
  {
    id: "p4",
    displayName: "Cara",
    isOrganizer: false,
    attendance: 1,
    votes: [{ dateOptionId: "d1", choice: 2 }],
  },
];

describe("Attendees", () => {
  it("renders a flat list when the date isn't locked", () => {
    render(
      <Wrapper>
        <Attendees
          participants={participants}
          chosenDateOptionId={null}
          locked={false}
          myParticipantId={null}
        />
      </Wrapper>,
    );

    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("Bob")).toBeDefined();
    expect(screen.queryByText(/Coming ·/i)).toBeNull();
  });

  it("splits Coming / Undecided / Can't make it once the date is locked", () => {
    render(
      <Wrapper>
        <Attendees
          participants={participants}
          chosenDateOptionId="d1"
          locked={true}
          myParticipantId={null}
        />
      </Wrapper>,
    );

    expect(screen.getByText(/Coming · 1/i)).toBeDefined();
    expect(screen.getByText(/Undecided · 2/i)).toBeDefined();
    expect(screen.getByText(/Can't make it · 1/i)).toBeDefined();
  });

  it("places a maybe-voter under Undecided rather than Coming, without a Maybe label", () => {
    render(
      <Wrapper>
        <Attendees
          participants={participants}
          chosenDateOptionId="d1"
          locked={true}
          myParticipantId={null}
        />
      </Wrapper>,
    );

    expect(screen.getByText("Cara")).toBeDefined();
    expect(screen.queryByText("Maybe")).toBeNull();
  });

  it("hides a section entirely when no one is in it", () => {
    const allUndecided: ParticipantDto[] = [
      {
        id: "p1",
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
    ];
    render(
      <Wrapper>
        <Attendees
          participants={allUndecided}
          chosenDateOptionId="d1"
          locked={true}
          myParticipantId={null}
        />
      </Wrapper>,
    );

    expect(screen.getByText(/Undecided · 2/i)).toBeDefined();
    expect(screen.queryByText(/Coming ·/i)).toBeNull();
    expect(screen.queryByText(/Can't make it ·/i)).toBeNull();
  });

  it("labels the current viewer as You and tags the organizer as HOST", () => {
    render(
      <Wrapper>
        <Attendees
          participants={participants}
          chosenDateOptionId={null}
          locked={false}
          myParticipantId="p2"
        />
      </Wrapper>,
    );

    expect(screen.getByText("You")).toBeDefined();
    expect(screen.queryByText("Alice")).toBeNull();
    expect(screen.getByText("HOST")).toBeDefined();
  });
});
