import { createFileRoute } from "@tanstack/react-router";
import {
  EventDetailView,
  EventNotFound,
} from "../../../features/events/get-event-by-token/components/event-detail-view";
import {
  getEventByTokenFn,
  getShareOriginFn,
} from "../../../features/events/get-event-by-token/functions";

export const Route = createFileRoute("/_app/e/$token")({
  loader: async ({ params, context }) => {
    const [event, origin] = await Promise.all([
      getEventByTokenFn({ data: { token: params.token } }),
      getShareOriginFn(),
    ]);
    const isOrganizer = event ? context.user?.id === event.organizerId : false;
    return { event, isOrganizer, shareUrl: `${origin}/e/${params.token}` };
  },
  component: EventPage,
});

function EventPage() {
  const { event, isOrganizer, shareUrl } = Route.useLoaderData();
  const { token } = Route.useParams();

  if (!event) return <EventNotFound />;

  return (
    <EventDetailView
      event={event}
      token={token}
      isOrganizer={isOrganizer}
      shareUrl={shareUrl}
    />
  );
}
