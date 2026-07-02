import { createFileRoute } from "@tanstack/react-router";
import { EventsList } from "../../../features/events/list-events/components/events-list";
import { listEventsFn } from "../../../features/events/list-events/functions";

export const Route = createFileRoute("/_app/_authenticated/events")({
  loader: async () => {
    const events = await listEventsFn();
    return { events };
  },
  component: EventsPage,
});

function EventsPage() {
  const { events } = Route.useLoaderData();
  const { user } = Route.useRouteContext();

  const hostName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "You";

  return <EventsList events={events} hostName={hostName} />;
}
