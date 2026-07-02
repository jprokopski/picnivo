import { Trans } from "@lingui/react/macro";
import { ClockIcon } from "lucide-react";
import { PicnicScene } from "@/components/picnic-scene";
import type { EventDetailResponse } from "@/api/picnivo-api";
import { formatInstantParts } from "@/lib/format-instant";

interface EventDetailViewProps {
  event: EventDetailResponse;
}

export function EventDetailView({ event }: EventDetailViewProps) {
  return (
    <div className="mx-auto max-w-295 animate-[pv-fade_420ms_cubic-bezier(0.16,1,0.3,1)_both] pt-12 pr-[max(var(--web-gutter),env(safe-area-inset-right))] pb-24 pl-[max(var(--web-gutter),env(safe-area-inset-left))] max-[720px]:pt-7 max-[720px]:pb-16">
      {/* Band */}
      <div className="mb-7 overflow-hidden rounded-(--r-xl) shadow-(--sh-lg) max-[720px]:mb-5.5 max-[720px]:rounded-(--r-lg)">
        <div className="relative h-57.5 overflow-hidden bg-[linear-gradient(180deg,#ffd58a_0%,#ff9d6b_38%,#f1633f_74%,#e0492a_100%)] max-[720px]:h-37.5">
          <PicnicScene variant="sunset" slot="wide" />
        </div>
        <div className="bg-card flex flex-wrap items-end justify-between gap-6 px-8.5 pt-6 pb-6.5 max-[720px]:gap-4 max-[720px]:px-5.5 max-[720px]:pt-5.5 max-[720px]:pb-6">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-medium tracking-[0.14em] wrap-anywhere text-(--accent-deep) uppercase">
              <Trans>{event.organizerName} is hosting</Trans>
              {event.location && <> · {event.location}</>}
            </p>
            <h1 className="font-display text-foreground m-0 mt-1.5 text-[38px] leading-[1.05] font-extrabold tracking-tight wrap-break-word max-[900px]:text-[32px] max-[720px]:text-[27px]">
              {event.title}
            </h1>
            {event.description && (
              <p className="text-muted-foreground mt-2 max-w-[54ch] wrap-break-word max-[720px]:text-[15px]">
                {event.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-6.5">
            <div className="flex flex-col gap-0.5">
              <span className="font-display text-[26px] leading-none font-extrabold max-[720px]:text-[22px]">
                {event.dateOptions.length}
              </span>
              <span className="text-[12px] font-semibold text-(--ink-soft)">
                <Trans>dates</Trans>
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-display text-[26px] leading-none font-extrabold max-[720px]:text-[22px]">
                {event.items.length}
              </span>
              <span className="text-[12px] font-semibold text-(--ink-soft)">
                <Trans>items</Trans>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6.5 max-[720px]:gap-5">
        {/* When */}
        <section className="border-border bg-card rounded-(--r-lg) border px-7 py-6.5 shadow-(--sh-md) max-[720px]:px-5 max-[720px]:py-5.5">
          <div className="mb-4">
            <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-(--accent-deep) uppercase">
              <Trans>When works?</Trans>
            </p>
            <h2 className="font-display m-0 mt-1 text-[21px] font-bold tracking-[-0.01em]">
              <Trans>Proposed dates</Trans>
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {event.dateOptions.map((d) => {
              const parts = formatInstantParts(d.startsAt);
              return (
                <div
                  key={d.id}
                  className="border-border bg-card flex items-center gap-5 rounded-(--r-md) border px-5 py-4 max-[720px]:gap-3.5 max-[720px]:px-4 max-[720px]:py-3.5"
                >
                  <div className="w-14.5 shrink-0 text-center leading-none">
                    <div className="font-mono text-[11px] text-(--accent-deep)">
                      {parts.dow.toUpperCase()}
                    </div>
                    <div className="font-display my-0.5 text-[30px]">
                      {parts.day}
                    </div>
                    <div className="font-mono text-[10px] text-(--ink-soft)">
                      {parts.mon}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-display text-[16px] font-extrabold">
                      {parts.dow}, {parts.mon} {parts.day}
                    </span>
                    <span className="ml-2.5 inline-flex items-center gap-1.5 font-mono text-[13px] text-(--ink-soft)">
                      <ClockIcon size={13} />
                      {parts.time}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* What to bring */}
        {event.items.length > 0 && (
          <section className="border-border bg-card rounded-(--r-lg) border px-7 py-6.5 shadow-(--sh-md) max-[720px]:px-5 max-[720px]:py-5.5">
            <div className="mb-4">
              <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-(--accent-deep) uppercase">
                <Trans>The haul</Trans>
              </p>
              <h2 className="font-display m-0 mt-1 text-[21px] font-bold tracking-[-0.01em]">
                <Trans>What to bring</Trans>
              </h2>
            </div>
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
          </section>
        )}
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
