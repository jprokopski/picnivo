import { Trans, useLingui } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import { ClockIcon, SparklesIcon } from "lucide-react";
import { Avatar, AvatarStack } from "@/components/avatar";
import { PicnicScene } from "@/components/picnic-scene";
import type { EventSummaryResponse } from "@/api/picnivo-api";
import { formatInstantParts } from "@/lib/format-instant";
import { deriveEventStatus } from "../schema";

const SCENE_VARIANTS = ["sunset", "sea", "grove", "berry"] as const;

function sceneFor(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n + id.charCodeAt(i)) % 4;
  return SCENE_VARIANTS[n];
}

interface EventCardProps {
  event: EventSummaryResponse;
  hostName: string;
}

export function EventCard({ event, hostName }: EventCardProps) {
  const { t } = useLingui();
  const dateOptionCount = Number(event.dateOptionCount);
  const itemCount = Number(event.itemCount);
  const claimedCount = Number(event.claimedCount);
  const participantCount = Number(event.participantCount);
  const participantNames = event.participantNames;
  const status = deriveEventStatus(event);

  // The design's dashboard card carries status through the date chip's text
  // itself (e.g. "3 dates · voting open" vs a formatted single date), not a
  // separate status badge — once a date is chosen, show that date rather
  // than the pre-lock "N dates" count.
  const whenLabel =
    status === "voting"
      ? dateOptionCount > 1
        ? t`${dateOptionCount} dates · voting open`
        : t`Voting open`
      : status === "now"
        ? t`Today · happening now`
        : (() => {
            const displayDate = event.chosenDateStartsAt ?? event.soonestDate;
            if (!displayDate) return t`No dates yet`;
            const parts = formatInstantParts(displayDate);
            return `${parts.dow}, ${parts.mon} ${parts.day} · ${parts.time}`;
          })();

  const itemsLabel =
    status === "past"
      ? t`Wrapped`
      : itemCount === 0
        ? t`Nothing on the list yet`
        : t`${claimedCount} / ${itemCount} claimed`;

  return (
    <article className="group border-border bg-card hover:border-primary relative flex flex-col overflow-hidden rounded-(--r-lg) border shadow-(--sh-md) transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-(--sh-lg)">
      <Link
        to="/e/$token"
        params={{ token: event.token }}
        aria-label={t`Open ${event.title}`}
        className="focus-visible:outline-primary absolute inset-0 z-10 rounded-(--r-lg) focus-visible:outline-3 focus-visible:outline-offset-2"
      />

      <div className="relative h-40 overflow-hidden bg-[linear-gradient(180deg,#ffd58a_0%,#ff9d6b_40%,#f1633f_78%,#e0492a_100%)]">
        <PicnicScene variant={sceneFor(event.id)} slot="card" />
        <span className="absolute top-3.25 left-3.5 inline-flex items-center gap-1.5 rounded-full bg-(--ink) px-2.75 py-1.25 text-[12px] font-extrabold tracking-[0.01em] text-white shadow-(--sh-sm)">
          <SparklesIcon size={12} />
          <Trans>Hosting</Trans>
        </span>
      </div>

      <div className="bg-primary h-1.25 shrink-0" />

      <div className="flex flex-1 flex-col px-5 pt-4.5 pb-5">
        <p className="mb-0 overflow-hidden font-mono text-[11px] font-medium tracking-[0.14em] text-ellipsis whitespace-nowrap text-(--accent-deep) uppercase">
          {event.location || t`To be defined`}
        </p>
        <h3 className="font-display m-0 mt-1.25 text-[23px] font-bold tracking-[-0.01em] wrap-break-word">
          {event.title}
        </h3>

        <div className="mt-3.25 flex items-center gap-2">
          <Avatar name={hostName} size={24} />
          <span className="text-[13px] font-bold text-(--ink-soft)">
            <Trans>Hosted by you</Trans>
          </span>
        </div>

        <div className="border-border mt-3.5 flex flex-wrap items-center gap-2 border-t pt-3.5">
          {status === "past" ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3.25 py-1.75 text-[13px] font-extrabold"
              style={{
                background: "rgba(43,32,24,0.06)",
                color: "var(--ink-soft)",
              }}
            >
              <span className="text-[12px]" aria-hidden="true">
                🏁
              </span>
              {whenLabel}
            </span>
          ) : status === "now" ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3.25 py-1.75 text-[13px] font-extrabold motion-safe:animate-[web-nowpulse_4s_ease-in-out_infinite]"
              style={{ background: "var(--yes-tint)", color: "var(--yes)" }}
            >
              <span className="text-[12px]" aria-hidden="true">
                🟢
              </span>
              {whenLabel}
            </span>
          ) : (
            <span className="border-border text-foreground inline-flex items-center gap-1.5 rounded-full border bg-(--card-2) px-3.25 py-1.75 text-[13px] font-semibold">
              <ClockIcon size={13} color="var(--ink-soft)" />
              {whenLabel}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {participantNames.length > 0 && (
              <AvatarStack names={participantNames} size={26} max={4} />
            )}
            <span className="text-[13px] font-bold text-(--ink-soft)">
              {participantCount === 0 ? (
                <Trans>Nobody yet</Trans>
              ) : (
                <Trans>{participantCount} going</Trans>
              )}
            </span>
          </div>
          <span className="inline-flex shrink-0 -translate-x-1 items-center gap-1.5 text-[14px] font-extrabold text-(--accent-deep) opacity-0 transition-[opacity,transform,gap] duration-160 group-hover:translate-x-0 group-hover:gap-2.25 group-hover:opacity-100">
            <Trans>Open event</Trans> <span aria-hidden="true">→</span>
          </span>
        </div>

        <div className="border-border mt-3.25 border-t pt-3.25">
          <span className="text-[13px] font-semibold text-(--ink-faint)">
            {itemsLabel}
          </span>
        </div>
      </div>
    </article>
  );
}
