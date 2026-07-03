import { describe, expect, it } from "vitest";
import type { EventSummaryResponse } from "@/api/picnivo-api";
import { deriveEventStatus } from "./schema";

const baseEvent: EventSummaryResponse = {
  id: "evt-1",
  title: "Sunset Beach Picnic",
  location: "Ocean Beach",
  token: "abc123",
  createdAt: "2026-01-01T00:00:00.000Z",
  dateOptionCount: 2,
  itemCount: 3,
  soonestDate: null,
  participantCount: 0,
  participantNames: [],
  claimedCount: 0,
  chosenDateOptionId: null,
  chosenDateStartsAt: null,
};

describe("deriveEventStatus", () => {
  it("is 'voting' when no date is chosen but a future date exists", () => {
    expect(
      deriveEventStatus({
        ...baseEvent,
        soonestDate: "2099-06-20T19:00:00.000Z",
      }),
    ).toBe("voting");
  });

  it("is 'past' when no date is chosen and no future date exists", () => {
    expect(deriveEventStatus({ ...baseEvent, soonestDate: null })).toBe("past");
  });

  it("is 'past' when no date is chosen and the only date option already passed", () => {
    expect(
      deriveEventStatus({
        ...baseEvent,
        soonestDate: "2020-01-01T00:00:00.000Z",
      }),
    ).toBe("past");
  });

  it("is 'date-set' when the chosen date is in the future", () => {
    expect(
      deriveEventStatus({
        ...baseEvent,
        chosenDateOptionId: "date-1",
        chosenDateStartsAt: "2099-06-20T19:00:00.000Z",
      }),
    ).toBe("date-set");
  });

  it("is 'past' when the chosen date already happened", () => {
    expect(
      deriveEventStatus({
        ...baseEvent,
        chosenDateOptionId: "date-1",
        chosenDateStartsAt: "2020-01-01T00:00:00.000Z",
      }),
    ).toBe("past");
  });

  it("is 'now' within 5 hours of the chosen date starting", () => {
    const startsAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(
      deriveEventStatus({
        ...baseEvent,
        chosenDateOptionId: "date-1",
        chosenDateStartsAt: startsAt,
      }),
    ).toBe("now");
  });

  it("is 'past' once 5 hours have elapsed since the chosen date started", () => {
    const startsAt = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    expect(
      deriveEventStatus({
        ...baseEvent,
        chosenDateOptionId: "date-1",
        chosenDateStartsAt: startsAt,
      }),
    ).toBe("past");
  });

  it("is 'date-set', not 'now', right up to the moment the chosen date starts", () => {
    const startsAt = new Date(Date.now() + 60 * 1000).toISOString();
    expect(
      deriveEventStatus({
        ...baseEvent,
        chosenDateOptionId: "date-1",
        chosenDateStartsAt: startsAt,
      }),
    ).toBe("date-set");
  });
});
