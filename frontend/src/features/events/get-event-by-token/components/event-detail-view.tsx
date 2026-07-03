import { Trans } from "@lingui/react/macro";
import type { EventDetailResponse } from "@/api/picnivo-api";
import { JoinBar } from "../../join-event/components/join-bar";
import { DateRow } from "../../vote-on-dates/components/date-row";
import {
  VOTE_CHOICE_VALUES,
  voteChoiceKeyFromValue,
} from "../../vote-on-dates/schema";
import { BestHero } from "./best-hero";
import { CrewList } from "./crew-list";
import { EventBand } from "./event-band";
import { SectionCard } from "./section-card";
import { ShareAside } from "./share-aside";

interface EventDetailViewProps {
  event: EventDetailResponse;
  token: string;
  isOrganizer: boolean;
  shareUrl: string;
}

export function EventDetailView({
  event,
  token,
  isOrganizer,
  shareUrl,
}: EventDetailViewProps) {
  const joined = !!event.you;
  const locked = !!event.chosenDateOptionId;
  const isAnnouncement = event.dateOptions.length === 1;
  const claimedCount = event.items.filter(
    (i) => i.claimedByParticipantId,
  ).length;

  const heroDateId = event.chosenDateOptionId ?? event.bestDateOptionId;
  const heroDate =
    event.dateOptions.find((d) => d.id === heroDateId) ?? event.dateOptions[0];

  function yesVoterNamesFor(dateOptionId: string): string[] {
    const participantNames = event.participants
      .filter((p) =>
        p.votes.some(
          (v) =>
            v.dateOptionId === dateOptionId &&
            v.choice === VOTE_CHOICE_VALUES.yes,
        ),
      )
      .map((p) => p.displayName);
    // Single-date events are an announcement (no vote UI) — the organizer who
    // set the date implicitly counts as attending, matching the backend tally.
    if (isAnnouncement) {
      return [event.organizerName, ...participantNames];
    }
    return participantNames;
  }

  return (
    <div className="mx-auto max-w-295 animate-[pv-fade_420ms_cubic-bezier(0.16,1,0.3,1)_both] pt-12 pr-[max(var(--web-gutter),env(safe-area-inset-right))] pb-24 pl-[max(var(--web-gutter),env(safe-area-inset-left))] max-[720px]:pt-7 max-[720px]:pb-16">
      <EventBand
        title={event.title}
        description={event.description}
        organizerName={event.organizerName}
        location={event.location}
        goingCount={event.participants.length}
        claimedCount={claimedCount}
        itemCount={event.items.length}
      />

      {!event.you && !isOrganizer && (
        <JoinBar
          eventToken={token}
          participantNames={event.participants.map((p) => p.displayName)}
        />
      )}

      <div className="grid grid-cols-[1fr_340px] gap-6.5 max-[940px]:grid-cols-1 max-[720px]:gap-5">
        <div className="flex flex-col gap-5.5 max-[720px]:gap-4.5">
          {heroDate && (
            <BestHero
              token={token}
              heroDate={heroDate}
              location={event.location}
              organizerName={event.organizerName}
              isOrganizer={isOrganizer}
              locked={locked}
              yesVoterNames={yesVoterNamesFor(heroDate.id)}
              totalParticipants={event.participants.length}
            />
          )}

          {!isAnnouncement && (
            <SectionCard
              kicker={<Trans>When works?</Trans>}
              title={
                locked ? (
                  <Trans>How everyone voted</Trans>
                ) : (
                  <Trans>Vote on the dates</Trans>
                )
              }
              right={
                <span className="border-border rounded-full border bg-(--card-2) px-2.75 py-0.75 text-[13px] font-semibold">
                  <Trans>{event.participants.length} voted</Trans>
                </span>
              }
            >
              <div className="flex flex-col gap-3">
                {event.dateOptions.map((d) => (
                  <DateRow
                    key={d.id}
                    token={token}
                    date={d}
                    isBest={d.id === heroDate?.id}
                    locked={locked}
                    joined={joined}
                    myVote={voteChoiceKeyFromValue(
                      event.you?.votes.find((v) => v.dateOptionId === d.id)
                        ?.choice,
                    )}
                    yesVoterNames={yesVoterNamesFor(d.id)}
                  />
                ))}
              </div>
            </SectionCard>
          )}

          {event.items.length > 0 && (
            <SectionCard
              kicker={<Trans>The haul</Trans>}
              title={<Trans>Who brings what</Trans>}
            >
              <div className="flex flex-col gap-2.5">
                {event.items.map((item) => (
                  <div
                    key={item.id}
                    className="border-border bg-card flex items-center gap-3.5 rounded-(--r-md) border px-4.5 py-3.5"
                  >
                    <span className="border-border size-2.25 shrink-0 rounded-full border-2" />
                    <span className="text-[15px] font-semibold wrap-break-word">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        <aside className="flex flex-col gap-4.5 max-[940px]:gap-4">
          <SectionCard
            kicker={<Trans>The crew</Trans>}
            title={<Trans>{event.participants.length} invited</Trans>}
          >
            <CrewList participants={event.participants} />
          </SectionCard>
          <ShareAside shareUrl={shareUrl} />
        </aside>
      </div>
    </div>
  );
}

export function EventNotFound() {
  return (
    <div className="mx-auto flex max-w-295 flex-col items-center gap-3 px-[max(var(--web-gutter),env(safe-area-inset-right))] py-24 text-center">
      <h1 className="font-display text-2xl font-bold">
        <Trans>We couldn't find that event.</Trans>
      </h1>
      <p className="text-muted-foreground">
        <Trans>The link may be mistyped, or the event no longer exists.</Trans>
      </p>
    </div>
  );
}
