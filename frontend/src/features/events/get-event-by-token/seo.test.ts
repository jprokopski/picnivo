import { describe, expect, it } from "vitest";
import { buildEventCard, type EventForCard } from "./seo";

const NOW = new Date("2099-06-01T00:00:00.000Z");

function dateOption(id: string, startsAt: string) {
  return { id, startsAt, yesCount: 0, maybeCount: 0, noCount: 0 };
}

const dateOptions = [
  dateOption("d1", "2099-06-20T19:00:00.000Z"),
  dateOption("d2", "2099-06-25T19:00:00.000Z"),
  dateOption("d3", "2099-06-10T19:00:00.000Z"),
];

const baseEvent: EventForCard = {
  title: "Sunset Beach Picnic",
  location: "Ocean Beach",
  chosenDateOptionId: null,
  bestDateOptionId: null,
  dateOptions,
};

describe("buildEventCard", () => {
  it("suffixes the title with the site name", () => {
    const { title } = buildEventCard(baseEvent, NOW);
    expect(title).toBe("Sunset Beach Picnic — Picnivo");
  });

  it("prefers the chosen date over the best date and any other option", () => {
    const { description } = buildEventCard(
      { ...baseEvent, chosenDateOptionId: "d2", bestDateOptionId: "d1" },
      NOW,
    );
    // d2 = 2099-06-25
    expect(description).toContain("Jun 25");
    expect(description).not.toContain("Jun 20");
  });

  it("falls back to the best date when nothing is chosen", () => {
    const { description } = buildEventCard(
      { ...baseEvent, chosenDateOptionId: null, bestDateOptionId: "d1" },
      NOW,
    );
    expect(description).toContain("Jun 20");
  });

  it("falls back to the soonest upcoming date when neither chosen nor best is set", () => {
    const { description } = buildEventCard(
      { ...baseEvent, chosenDateOptionId: null, bestDateOptionId: null },
      NOW,
    );
    // d3 (Jun 10) is the soonest upcoming option relative to NOW.
    expect(description).toContain("Jun 10");
  });

  it("ignores past date options when picking the soonest upcoming one", () => {
    const past = new Date("2099-06-15T00:00:00.000Z");
    const { description } = buildEventCard(
      { ...baseEvent, chosenDateOptionId: null, bestDateOptionId: null },
      past,
    );
    // d3 (Jun 10) is already past `past`; d1 (Jun 20) is the next upcoming one.
    expect(description).toContain("Jun 20");
    expect(description).not.toContain("Jun 10");
  });

  it("announces a no-date fallback when no date option is usable", () => {
    const allPast = new Date("2099-07-01T00:00:00.000Z");
    const { description } = buildEventCard(
      { ...baseEvent, chosenDateOptionId: null, bestDateOptionId: null },
      allPast,
    );
    expect(description).toContain("Pick a date together on Picnivo");
  });

  it("appends the location when present", () => {
    const { description } = buildEventCard(
      { ...baseEvent, chosenDateOptionId: "d1" },
      NOW,
    );
    expect(description).toContain("· Ocean Beach");
  });

  it("omits the location segment when absent", () => {
    const { description } = buildEventCard(
      { ...baseEvent, chosenDateOptionId: "d1", location: null },
      NOW,
    );
    expect(description).not.toContain("·  ");
    expect(description).not.toContain("Ocean Beach");
  });

  it("closes with the call to action", () => {
    const { description } = buildEventCard(
      { ...baseEvent, chosenDateOptionId: "d1" },
      NOW,
    );
    expect(description).toContain("Vote on dates and claim what you'll bring.");
  });

  it("never leaks participant or organizer names, even though the caller could pass them", () => {
    // EventForCard deliberately omits organizerName, participants, items, and
    // the free-text description field, so this asserts the privacy boundary
    // at the type level as well as the output: nothing resembling a name
    // ever reaches the description for a fixture that (if it leaked) would
    // contain "Maya", "Sam", or "Jordan".
    const eventWithBystanderNames = {
      ...baseEvent,
      chosenDateOptionId: "d1",
      title: "Maya's Picnic",
    };
    const { description } = buildEventCard(eventWithBystanderNames, NOW);
    expect(description).not.toContain("Maya");
    expect(description).not.toContain("Sam");
    expect(description).not.toContain("Jordan");
  });
});
