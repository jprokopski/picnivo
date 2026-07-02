import { createFileRoute } from "@tanstack/react-router";
import {
  EventDetailView,
  EventNotFound,
} from "../../features/events/get-event-by-token/components/event-detail-view";
import { getEventByTokenFn } from "../../features/events/get-event-by-token/functions";

export const Route = createFileRoute("/e/$token")({
  loader: async ({ params }) => {
    const event = await getEventByTokenFn({ data: { token: params.token } });
    return { event };
  },
  component: EventPage,
});

function EventPage() {
  const { event } = Route.useLoaderData();

  if (!event) return <EventNotFound />;

  return <EventDetailView event={event} />;
}
