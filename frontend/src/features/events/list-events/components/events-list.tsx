import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import type { EventSummaryResponse } from "@/api/picnivo-api";
import { cn } from "@/lib/utils";
import { EventCard } from "./event-card";

interface EventsListProps {
  events: EventSummaryResponse[];
  hostName: string;
}

type EventFilter = "all" | "ongoing" | "past";

function isPastEvent(event: EventSummaryResponse) {
  return event.soonestDate !== null && new Date(event.soonestDate) < new Date();
}

export function EventsList({ events, hostName }: EventsListProps) {
  const { t } = useLingui();
  const [filter, setFilter] = useState<EventFilter>("ongoing");

  const counts = {
    all: events.length,
    ongoing: events.filter((event) => !isPastEvent(event)).length,
    past: events.filter(isPastEvent).length,
  };

  const visibleEvents = events.filter((event) => {
    if (filter === "all") return true;
    return filter === "past" ? isPastEvent(event) : !isPastEvent(event);
  });

  const filters: { id: EventFilter; label: string }[] = [
    { id: "all", label: t`All` },
    { id: "ongoing", label: t`Ongoing` },
    { id: "past", label: t`Past` },
  ];

  const emptyFilterLabel: Record<EventFilter, string> = {
    all: t`No events yet.`,
    ongoing: t`No ongoing events yet.`,
    past: t`No past events yet.`,
  };

  return (
    <div className="mx-auto max-w-295 animate-[pv-fade_420ms_cubic-bezier(0.16,1,0.3,1)_both] pt-12 pr-[max(var(--web-gutter),env(safe-area-inset-right))] pb-24 pl-[max(var(--web-gutter),env(safe-area-inset-left))] max-[720px]:pt-7 max-[720px]:pb-16">
      <div className="mb-6.5 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-2.5 font-mono text-[11px] font-medium tracking-[0.14em] text-(--accent-deep) uppercase">
            <Trans>Your events</Trans>
          </p>
          <h1 className="font-display text-foreground m-0 text-[44px] leading-[1.08] font-extrabold tracking-tight text-balance max-[900px]:text-[36px] max-[720px]:text-[32px] max-[480px]:text-[28px]">
            <Trans>Events you're hosting.</Trans>
          </h1>
          <p className="text-muted-foreground m-0 mt-3.5 max-w-[52ch] text-[17px] leading-normal max-[720px]:mt-2.5 max-[720px]:text-[15.5px]">
            <Trans>
              The plans you've set up. Share the link and see who's in.
            </Trans>
          </p>
        </div>
      </div>

      {events.length > 0 && (
        <div
          className="mb-6.5 flex flex-wrap gap-1.75"
          role="tablist"
          aria-label={t`Filter events`}
        >
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.75 rounded-full border px-4 py-2.25 font-sans text-sm font-bold shadow-(--sh-sm) transition-[color,background,border-color,transform] duration-140 hover:-translate-y-px",
                filter === f.id
                  ? "border-primary bg-primary text-white shadow-(--sh-pop)"
                  : "border-border text-muted-foreground bg-card hover:text-foreground",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.75 py-0.25 font-mono text-[11px] font-medium",
                  filter === f.id ? "bg-white/25" : "bg-black/7",
                )}
              >
                {counts[f.id]}
              </span>
            </button>
          ))}
        </div>
      )}

      {visibleEvents.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(322px,1fr))] gap-6 max-[480px]:grid-cols-1 max-[480px]:gap-4.5">
          {visibleEvents.map((event) => (
            <EventCard key={event.id} event={event} hostName={hostName} />
          ))}
        </div>
      ) : events.length > 0 ? (
        <div className="rounded-[18px] border-[1.5px] border-dashed border-(--line) bg-(--card-2) px-6 py-14 text-center">
          <p className="text-[17px] text-(--ink-soft)">
            {emptyFilterLabel[filter]}
          </p>
        </div>
      ) : (
        <div className="rounded-[18px] border-[1.5px] border-dashed border-(--line) bg-(--card-2) px-6 py-14 text-center">
          <p className="text-[17px] text-(--ink-soft)">
            <Trans>No events yet.</Trans>
          </p>
          <Link
            to="/create"
            className="bg-primary mt-4 inline-flex cursor-pointer appearance-none items-center justify-center gap-2.25 rounded-full border-0 px-4 py-2.5 font-sans text-[14px] leading-none font-bold whitespace-nowrap text-white no-underline shadow-(--sh-pop) transition-[transform,box-shadow,background] duration-160 hover:-translate-y-0.5 hover:bg-(--accent-deep) active:translate-y-0"
          >
            <PlusIcon size={16} />
            <Trans>Create your first event</Trans>
          </Link>
        </div>
      )}
    </div>
  );
}
