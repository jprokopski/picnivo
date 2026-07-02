import { Trans, useLingui } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import { ClockIcon, SparklesIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PicnicScene } from "@/components/picnic-scene";
import type { EventSummaryResponse } from "@/api/picnivo-api";
import { formatInstantParts } from "@/lib/format-instant";

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

  const whenLabel = event.soonestDate
    ? dateOptionCount > 1
      ? t`${dateOptionCount} dates`
      : (() => {
          const parts = formatInstantParts(event.soonestDate!);
          return `${parts.dow}, ${parts.mon} ${parts.day} · ${parts.time}`;
        })()
    : t`No dates yet`;

  return (
    <article className="group border-border bg-card hover:border-primary relative flex flex-col overflow-hidden rounded-(--r-lg) border shadow-(--sh-md) transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-(--sh-lg)">
      <Link
        to="/e/$token"
        params={{ token: event.token }}
        target="_blank"
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
          <span className="border-border text-foreground inline-flex items-center gap-1.5 rounded-full border bg-(--card-2) px-3.25 py-1.75 text-[13px] font-semibold">
            <ClockIcon size={13} color="var(--ink-soft)" />
            {whenLabel}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-end gap-3">
          <span className="inline-flex -translate-x-1 items-center gap-1.5 text-[14px] font-extrabold text-(--accent-deep) opacity-0 transition-[opacity,transform,gap] duration-160 group-hover:translate-x-0 group-hover:gap-2.25 group-hover:opacity-100">
            <Trans>Open event</Trans> <span aria-hidden="true">→</span>
          </span>
        </div>

        <div className="border-border mt-3.25 border-t pt-3.25">
          <span className="text-[13px] font-semibold text-(--ink-faint)">
            <Trans>{itemCount} items on the list</Trans>
          </span>
        </div>
      </div>
    </article>
  );
}
