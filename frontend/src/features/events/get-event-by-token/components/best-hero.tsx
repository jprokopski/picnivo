import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useRouter } from "@tanstack/react-router";
import { ClockIcon, MapPinIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AvatarStack } from "@/components/avatar";
import type { DateOptionDto } from "@/api/picnivo-api";
import { formatInstantParts } from "@/lib/format-instant";
import { selectFinalDateFn } from "../../select-final-date/functions";

interface BestHeroProps {
  token: string;
  heroDate: DateOptionDto;
  location?: string | null;
  organizerName: string;
  isOrganizer: boolean;
  locked: boolean;
  yesVoterNames: string[];
  totalParticipants: number;
}

export function BestHero({
  token,
  heroDate,
  location,
  organizerName,
  isOrganizer,
  locked,
  yesVoterNames,
  totalParticipants,
}: BestHeroProps) {
  const router = useRouter();
  const { t } = useLingui();
  const [locking, setLocking] = useState(false);
  const parts = formatInstantParts(heroDate.startsAt);
  const yes = Number(heroDate.yesCount);

  async function handleLock() {
    setLocking(true);
    const result = await selectFinalDateFn({
      data: { token, dateOptionId: heroDate.id },
    });
    if (result.error) {
      toast.error(result.error || t`Something went wrong. Please try again.`);
    } else {
      await router.invalidate();
    }
    setLocking(false);
  }

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
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.75 py-1 text-[13px] font-semibold"
            style={{
              background: locked ? "var(--yes-tint)" : "var(--marigold-tint)",
              color: locked ? "var(--yes)" : "var(--accent-deep)",
            }}
          >
            {locked ? (
              <Trans>✓ It's official</Trans>
            ) : (
              <>
                <SparklesIcon size={13} />
                <Trans>Best date so far</Trans>
              </>
            )}
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
            {yesVoterNames.length > 0 && (
              <AvatarStack names={yesVoterNames} size={30} max={6} />
            )}
            <span className="text-[14px] font-bold">
              <Trans>
                {yes} of {totalParticipants} can make it
              </Trans>
            </span>
          </div>
          {isOrganizer && !locked ? (
            <Button
              className="mt-4.5"
              disabled={locking}
              onClick={() => void handleLock()}
            >
              <Trans>Lock in this date</Trans>
            </Button>
          ) : (
            !locked && (
              <p className="mt-3.5 flex items-center gap-1.5 text-[14px] text-(--ink-soft)">
                <SparklesIcon size={14} color="var(--marigold)" />
                <Trans>
                  {organizerName} picks the final date once everyone's voted.
                </Trans>
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
