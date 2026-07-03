import { Trans } from "@lingui/react/macro";
import type { EventDetailResponse } from "@/api/picnivo-api";
import { Haul } from "../../claim-items/components/haul";
import { JoinBar } from "../../join-event/components/join-bar";
import {
  ATTENDANCE_VALUES,
  isEffectivelyComing,
  isEffectivelyOut,
} from "../../set-attendance/schema";
import { AttendanceCard } from "../../set-attendance/components/attendance-card";
import { Attendees } from "../../set-attendance/components/attendees";
import { DateRow } from "../../vote-on-dates/components/date-row";
import {
  VOTE_CHOICE_VALUES,
  voteChoiceKeyFromValue,
} from "../../vote-on-dates/schema";
import { AnnounceHero } from "./announce-hero";
import { BestHero } from "./best-hero";
import { EventBand } from "./event-band";
import { SectionCard } from "./section-card";
import { ShareAside } from "./share-aside";

interface EventDetailViewProps {
  event: EventDetailResponse;
  token: string;
  isOrganizer: boolean;
  shareUrl: string;
  myParticipantId: string | null;
}

export function EventDetailView({
  event,
  token,
  isOrganizer,
  shareUrl,
  myParticipantId,
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
    return event.participants
      .filter((p) =>
        p.votes.some(
          (v) =>
            v.dateOptionId === dateOptionId &&
            v.choice === VOTE_CHOICE_VALUES.yes,
        ),
      )
      .map((p) => p.displayName);
  }

  // Announcements have no vote UI at all, so "who's coming" can't be read off
  // DateVotes — it's driven entirely by the attendance RSVP. The organizer is
  // already one of `event.participants`, so they're included/excluded on the
  // same footing as any guest — no implicit yes.
  function comingNamesForAnnouncement(dateOptionId: string): string[] {
    return event.participants
      .filter((p) => isEffectivelyComing(p.attendance, p.votes, dateOptionId))
      .map((p) => p.displayName);
  }

  function outNamesForAnnouncement(dateOptionId: string): string[] {
    return event.participants
      .filter((p) => isEffectivelyOut(p.attendance, p.votes, dateOptionId))
      .map((p) => p.displayName);
  }

  const myClaimedItem = event.you
    ? event.items.find((i) => event.you!.claimedItemIds.includes(i.id))
    : undefined;
  const myAttendanceStatus: "in" | "out" | "undecided" = !event.you
    ? "undecided"
    : isEffectivelyComing(
          event.you.attendance,
          event.you.votes,
          event.chosenDateOptionId,
        )
      ? "in"
      : isEffectivelyOut(
            event.you.attendance,
            event.you.votes,
            event.chosenDateOptionId,
          )
        ? "out"
        : "undecided";
  const showAttendanceCard = joined && (isAnnouncement || locked);

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
          <div className="flex flex-col gap-4.5">
            {showAttendanceCard && heroDate && (
              <AttendanceCard
                token={token}
                date={heroDate}
                status={myAttendanceStatus}
                isExplicitOut={event.you?.attendance === ATTENDANCE_VALUES.out}
                isAnnouncement={isAnnouncement}
                myClaim={myClaimedItem}
              />
            )}
            {isAnnouncement && heroDate ? (
              <AnnounceHero
                date={heroDate}
                location={event.location}
                comingNames={comingNamesForAnnouncement(heroDate.id)}
                outNames={outNamesForAnnouncement(heroDate.id)}
                totalParticipants={event.participants.length}
              />
            ) : (
              heroDate && (
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
              )
            )}
          </div>

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

          <SectionCard
            kicker={<Trans>The haul</Trans>}
            title={<Trans>Who brings what</Trans>}
            right={
              locked && (
                <span className="border-border rounded-full border bg-(--card-2) px-2.75 py-0.75 text-[13px] font-semibold">
                  <Trans>
                    {claimedCount}/{event.items.length} covered
                  </Trans>
                </span>
              )
            }
          >
            <Haul
              token={token}
              items={event.items}
              participants={event.participants}
              chosenDateOptionId={event.chosenDateOptionId}
              locked={locked}
              joined={joined}
              isOrganizer={isOrganizer}
              organizerName={event.organizerName}
              you={event.you}
              myParticipantId={myParticipantId}
            />
          </SectionCard>
        </div>

        <aside className="flex flex-col gap-4.5 max-[940px]:gap-4">
          <SectionCard
            kicker={<Trans>The crew</Trans>}
            title={<Trans>{event.participants.length} invited</Trans>}
          >
            <Attendees
              participants={event.participants}
              chosenDateOptionId={event.chosenDateOptionId}
              locked={locked}
              myParticipantId={myParticipantId}
            />
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
