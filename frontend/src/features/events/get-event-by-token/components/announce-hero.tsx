import { Trans } from "@lingui/react/macro";
import { ClockIcon, MapPinIcon } from "lucide-react";
import { AvatarStack } from "@/components/avatar";
import type { DateOptionDto } from "@/api/picnivo-api";
import { formatInstantParts } from "@/lib/format-instant";

interface AnnounceHeroProps {
  date: DateOptionDto;
  location?: string | null;
  comingNames: string[];
  outNames: string[];
  totalParticipants: number;
}

export function AnnounceHero({
  date,
  location,
  comingNames,
  outNames,
  totalParticipants,
}: AnnounceHeroProps) {
  const parts = formatInstantParts(date.startsAt);

  return (
    <div className="overflow-hidden rounded-(--r-lg) shadow-(--sh-lg)">
      <div className="flex flex-wrap items-stretch">
        <div className="flex min-w-37.5 shrink-0 flex-col items-center justify-center bg-(--accent-tint) px-7.5 py-6.5 max-[720px]:hidden">
          <div className="font-mono text-[12px] text-(--accent-deep)">
            {parts.dow.toUpperCase()}
          </div>
          <div className="font-display my-1 text-[64px] leading-none">
            {parts.day}
          </div>
          <div className="font-mono text-[12px] text-(--ink-soft)">
            {parts.mon}
          </div>
        </div>
        <div className="bg-card min-w-60 flex-1 px-7.5 py-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-(--yes-tint) px-2.75 py-1 text-[13px] font-semibold text-(--yes)">
            <Trans>📣 It's happening</Trans>
          </span>
          <h2 className="font-display mt-3 text-[26px] font-bold tracking-[-0.01em]">
            {parts.dow}, {parts.mon} {parts.day}
          </h2>
          <div className="mt-1.5 flex items-center gap-1.75 text-[13px] text-(--ink-soft)">
            <ClockIcon size={14} /> {parts.time}
            {location && (
              <>
                · <MapPinIcon size={14} /> {location}
              </>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2.5">
            {comingNames.length > 0 && (
              <AvatarStack names={comingNames} size={30} max={6} />
            )}
            <span className="text-[14px] font-bold">
              <Trans>
                {comingNames.length} of {totalParticipants} coming
              </Trans>
            </span>
          </div>
          {outNames.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2.25 rounded-(--r-sm) border border-(--no) bg-(--no-tint) px-3.25 py-2.25">
              <AvatarStack names={outNames} size={22} max={4} />
              <span className="text-[13px] font-bold text-(--no)">
                <Trans>{outNames.join(" & ")} can't make it</Trans>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
