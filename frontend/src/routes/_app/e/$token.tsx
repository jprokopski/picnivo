import { createFileRoute } from "@tanstack/react-router";
import {
  EventDetailView,
  EventNotFound,
} from "../../../features/events/get-event-by-token/components/event-detail-view";
import {
  getEventByTokenFn,
  getMyParticipantIdFn,
  getShareOriginFn,
} from "../../../features/events/get-event-by-token/functions";

export const Route = createFileRoute("/_app/e/$token")({
  loader: async ({ params, context }) => {
    // Resolve identity first — for a cookie-less organizer this backfills the
    // `pv_p` cookie and yields their participant id, which we thread into the
    // event fetch so `you` resolves on the very first render (a cookie set this
    // request isn't readable this request). `getShareOriginFn` has no such
    // dependency and runs in parallel.
    const [myParticipantId, origin] = await Promise.all([
      getMyParticipantIdFn({ data: { token: params.token } }),
      getShareOriginFn(),
    ]);
    const event = await getEventByTokenFn({
      data: {
        token: params.token,
        participantId: myParticipantId ?? undefined,
      },
    });
    const isOrganizer = event ? context.user?.id === event.organizerId : false;
    return {
      event,
      isOrganizer,
      shareUrl: `${origin}/e/${params.token}`,
      myParticipantId,
    };
  },
  component: EventPage,
});

function EventPage() {
  const { event, isOrganizer, shareUrl, myParticipantId } =
    Route.useLoaderData();
  const { token } = Route.useParams();

  if (!event) return <EventNotFound />;

  return (
    <EventDetailView
      event={event}
      token={token}
      isOrganizer={isOrganizer}
      shareUrl={shareUrl}
      myParticipantId={myParticipantId}
    />
  );
}
