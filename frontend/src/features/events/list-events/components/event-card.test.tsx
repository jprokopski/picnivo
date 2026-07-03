import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { i18n } from "../../../../lib/i18n";
import { EventCard } from "./event-card";
import type { EventSummaryResponse } from "@/api/picnivo-api";
import { formatInstantParts } from "@/lib/format-instant";

function formattedWhen(iso: string) {
  const parts = formatInstantParts(iso);
  return `${parts.dow}, ${parts.mon} ${parts.day} · ${parts.time}`;
}

afterEach(() => cleanup());

function renderCard(event: EventSummaryResponse, hostName = "Maya") {
  const rootRoute = createRootRoute({});
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => (
      <I18nProvider i18n={i18n}>
        <EventCard event={event} hostName={hostName} />
      </I18nProvider>
    ),
  });
  const eventTokenRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/e/$token",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, eventTokenRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

const baseEvent: EventSummaryResponse = {
  id: "evt-1",
  title: "Sunset Beach Picnic",
  location: "Ocean Beach",
  token: "abc123",
  createdAt: "2026-01-01T00:00:00.000Z",
  dateOptionCount: 2,
  itemCount: 5,
  soonestDate: "2099-06-20T19:00:00.000Z",
  participantCount: 3,
  participantNames: ["Maya", "Leo", "Sam"],
  claimedCount: 2,
  chosenDateOptionId: null,
  chosenDateStartsAt: null,
};

describe("EventCard", () => {
  it("shows 'N dates · voting open' when no date is chosen yet", async () => {
    renderCard(baseEvent);
    expect(await screen.findByText("2 dates · voting open")).toBeDefined();
  });

  it("shows the formatted chosen date once locked, not the date count", async () => {
    renderCard({
      ...baseEvent,
      chosenDateOptionId: "date-1",
      chosenDateStartsAt: "2099-06-20T19:00:00.000Z",
    });
    expect(
      await screen.findByText(formattedWhen("2099-06-20T19:00:00.000Z")),
    ).toBeDefined();
    expect(screen.queryByText(/voting open/i)).toBeNull();
  });

  it("shows a flag-styled date chip for a past event", async () => {
    renderCard({
      ...baseEvent,
      chosenDateOptionId: "date-1",
      chosenDateStartsAt: "2020-01-01T00:00:00.000Z",
      soonestDate: null,
    });
    expect(
      await screen.findByText(formattedWhen("2020-01-01T00:00:00.000Z")),
    ).toBeDefined();
    expect(screen.getByText("🏁")).toBeDefined();
  });

  it("shows the going count and crew avatar stack", async () => {
    renderCard(baseEvent);
    expect(await screen.findByText("3 going")).toBeDefined();
  });

  it("shows 'Nobody yet' instead of '0 going'", async () => {
    renderCard({ ...baseEvent, participantCount: 0, participantNames: [] });
    expect(await screen.findByText("Nobody yet")).toBeDefined();
    expect(screen.queryByText("0 going")).toBeNull();
  });

  it("shows the claimed / total items line before wrap-up", async () => {
    renderCard(baseEvent);
    expect(await screen.findByText("2 / 5 claimed")).toBeDefined();
  });

  it("shows 'Nothing on the list yet' instead of '0 / 0 claimed'", async () => {
    renderCard({ ...baseEvent, itemCount: 0, claimedCount: 0 });
    expect(await screen.findByText("Nothing on the list yet")).toBeDefined();
    expect(screen.queryByText("0 / 0 claimed")).toBeNull();
  });

  it("shows 'Wrapped' on the items line once the event is past", async () => {
    renderCard({
      ...baseEvent,
      chosenDateOptionId: "date-1",
      chosenDateStartsAt: "2020-01-01T00:00:00.000Z",
      soonestDate: null,
    });
    expect(await screen.findByText("Wrapped")).toBeDefined();
  });

  it("shows a pulsing 'happening now' chip, keeping the real claimed count on the items line", async () => {
    const startsAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    renderCard({
      ...baseEvent,
      chosenDateOptionId: "date-1",
      chosenDateStartsAt: startsAt,
      soonestDate: null,
    });
    expect(await screen.findByText("Today · happening now")).toBeDefined();
    expect(screen.getByText("🟢")).toBeDefined();
    expect(screen.getByText("2 / 5 claimed")).toBeDefined();
    expect(screen.queryByText("In progress")).toBeNull();
  });

  it("no longer shows 'happening now' 5+ hours after the chosen date started", async () => {
    const startsAt = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    renderCard({
      ...baseEvent,
      chosenDateOptionId: "date-1",
      chosenDateStartsAt: startsAt,
      soonestDate: null,
    });
    expect(screen.queryByText("Today · happening now")).toBeNull();
    expect(await screen.findByText("Wrapped")).toBeDefined();
  });
});
