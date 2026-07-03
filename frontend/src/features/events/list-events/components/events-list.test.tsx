import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { i18n } from "../../../../lib/i18n";
import { EventsList } from "./events-list";
import type { EventSummaryResponse } from "@/api/picnivo-api";

afterEach(() => cleanup());

function renderWithRouter(events: EventSummaryResponse[], hostName = "Maya") {
  const rootRoute = createRootRoute({});
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => (
      <I18nProvider i18n={i18n}>
        <EventsList events={events} hostName={hostName} />
      </I18nProvider>
    ),
  });
  const createEventRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/create",
    component: () => null,
  });
  const eventTokenRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/e/$token",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      createEventRoute,
      eventTokenRoute,
    ]),
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
  itemCount: 3,
  soonestDate: "2099-06-20T19:00:00.000Z",
  participantCount: 0,
  participantNames: [],
  claimedCount: 0,
  chosenDateOptionId: null,
  chosenDateStartsAt: null,
};

describe("EventsList", () => {
  it("renders a card for each event summary", async () => {
    renderWithRouter([
      baseEvent,
      { ...baseEvent, id: "evt-2", title: "Rooftop Taco Night" },
    ]);
    expect(await screen.findByText("Sunset Beach Picnic")).toBeDefined();
    expect(screen.getByText("Rooftop Taco Night")).toBeDefined();
  });

  it("shows the empty state with a CTA when there are no events", async () => {
    renderWithRouter([]);
    expect(await screen.findByText(/No events yet/i)).toBeDefined();
    expect(
      screen.getByRole("link", { name: /Create your first event/i }),
    ).toBeDefined();
  });

  it("does not show filters when there are no events", async () => {
    renderWithRouter([]);
    await screen.findByText(/No events yet/i);
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("defaults to the ongoing filter, hiding past events", async () => {
    renderWithRouter([
      { ...baseEvent, id: "evt-ongoing", title: "Sunset Beach Picnic" },
      {
        ...baseEvent,
        id: "evt-past",
        title: "Rooftop Taco Night",
        soonestDate: "2020-01-01T00:00:00.000Z",
      },
    ]);
    expect(await screen.findByText("Sunset Beach Picnic")).toBeDefined();
    expect(screen.queryByText("Rooftop Taco Night")).toBeNull();
  });

  it("switches between all, ongoing and past filters", async () => {
    renderWithRouter([
      { ...baseEvent, id: "evt-ongoing", title: "Sunset Beach Picnic" },
      {
        ...baseEvent,
        id: "evt-past",
        title: "Rooftop Taco Night",
        soonestDate: "2020-01-01T00:00:00.000Z",
      },
    ]);
    await screen.findByText("Sunset Beach Picnic");

    fireEvent.click(screen.getByRole("tab", { name: /Past/i }));
    expect(screen.queryByText("Sunset Beach Picnic")).toBeNull();
    expect(screen.getByText("Rooftop Taco Night")).toBeDefined();

    fireEvent.click(screen.getByRole("tab", { name: /^All/i }));
    expect(screen.getByText("Sunset Beach Picnic")).toBeDefined();
    expect(screen.getByText("Rooftop Taco Night")).toBeDefined();
  });

  it("shows a filter-specific empty state when a filter has no matches", async () => {
    renderWithRouter([
      { ...baseEvent, id: "evt-ongoing", title: "Sunset Beach Picnic" },
    ]);
    await screen.findByText("Sunset Beach Picnic");

    fireEvent.click(screen.getByRole("tab", { name: /Past/i }));
    expect(await screen.findByText(/No past events yet/i)).toBeDefined();
  });
});
