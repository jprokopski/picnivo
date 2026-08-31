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
import { buildEventCard } from "../../../features/events/get-event-by-token/seo";
import { buildMeta } from "../../../lib/seo/meta";
import {
  DEFAULT_DESCRIPTION,
  OG_CARD_ALT,
  SITE_NAME,
} from "../../../lib/seo/constants";
import { i18n } from "../../../lib/i18n";

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
  // `head` runs before the component, so it must tolerate the same `null`
  // event the component guards against below — emitting generic site
  // metadata rather than a broken card referencing a nonexistent event.
  // Always `noindex` — event pages must stay crawlable for social scrapers
  // (see robots.txt) but never reach Google. `shareUrl` is already an
  // absolute URL from the loader, so no extra origin resolution is needed
  // here; it doubles as the source for both `path` and `origin` in either
  // branch.
  head: ({ loaderData, match }) => {
    // `loaderData` is undefined only before the loader has resolved (e.g. a
    // pending initial render) — root's own defaults cover that instant, so
    // this just needs a valid origin to still produce a well-formed result.
    if (!loaderData) {
      return buildMeta({
        title: SITE_NAME,
        description: i18n._(DEFAULT_DESCRIPTION),
        path: match.pathname,
        origin: match.context.origin,
        imageAlt: i18n._(OG_CARD_ALT),
        noindex: true,
      });
    }

    const shareUrl = new URL(loaderData.shareUrl);
    const { title, description } = loaderData.event
      ? buildEventCard(loaderData.event)
      : { title: SITE_NAME, description: i18n._(DEFAULT_DESCRIPTION) };

    return buildMeta({
      title,
      description,
      path: shareUrl.pathname,
      origin: shareUrl.origin,
      imageAlt: i18n._(OG_CARD_ALT),
      noindex: true,
    });
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
