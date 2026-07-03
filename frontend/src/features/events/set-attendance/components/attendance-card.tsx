import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useRouter } from "@tanstack/react-router";
import { CheckIcon, HandIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { DateOptionDto, EventItemDto } from "@/api/picnivo-api";
import { formatInstantParts } from "@/lib/format-instant";
import { setAttendanceFn } from "../functions";

interface AttendanceCardProps {
  token: string;
  date: DateOptionDto;
  status: "in" | "out" | "undecided";
  isExplicitOut: boolean;
  isAnnouncement: boolean;
  myClaim?: EventItemDto;
}

export function AttendanceCard({
  token,
  date,
  status,
  isExplicitOut,
  isAnnouncement,
  myClaim,
}: AttendanceCardProps) {
  const { t } = useLingui();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const parts = formatInstantParts(date.startsAt);

  async function setStatus(next: "coming" | "out") {
    setPending(true);
    const result = await setAttendanceFn({ data: { token, status: next } });
    if (result.error) {
      toast.error(result.error || t`Something went wrong. Please try again.`);
    } else {
      await router.invalidate();
    }
    setPending(false);
  }

  if (status === "in") {
    return (
      <div className="rounded-(--r-lg) border-[1.5px] border-(--yes) bg-(--yes-tint) px-6.5 py-6 shadow-(--sh-md)">
        <span className="inline-flex items-center rounded-full bg-card px-2.5 py-1 text-[13px] font-bold text-(--yes)">
          <Trans>You're in</Trans>
        </span>
        <h3 className="mt-3 font-display text-[24px] font-bold">
          <Trans>
            See you {parts.dow}, {parts.mon} {parts.day} 🎉
          </Trans>
        </h3>
        <p className="mt-2 text-(--ink-soft)">
          {isAnnouncement ? (
            <Trans>You're down to come — see you there.</Trans>
          ) : (
            <Trans>The group locked this date and you're down to come.</Trans>
          )}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          disabled={pending}
          onClick={() => void setStatus("out")}
        >
          <Trans>Can't make it anymore?</Trans>
        </Button>
      </div>
    );
  }

  if (status === "out" && isExplicitOut) {
    return (
      <div className="rounded-(--r-lg) border-[1.5px] border-(--no) bg-(--no-tint) px-6.5 py-6 shadow-(--sh-md)">
        <span className="inline-flex items-center rounded-full bg-card px-2.5 py-1 text-[13px] font-bold text-(--no)">
          <Trans>You're marked: can't make it</Trans>
        </span>
        <h3 className="mt-3 font-display text-[24px] font-bold">
          <Trans>No worries — we'll catch you next time 🌅</Trans>
        </h3>
        <p className="mt-2 text-(--ink-soft)">
          {isAnnouncement ? (
            <Trans>
              You said{" "}
              <strong className="text-foreground">
                {parts.dow}, {parts.mon} {parts.day}
              </strong>{" "}
              doesn't work for you. Let us know if that changes.
            </Trans>
          ) : (
            <Trans>
              The group locked{" "}
              <strong className="text-foreground">
                {parts.dow}, {parts.mon} {parts.day}
              </strong>
              , which you said doesn't work.
            </Trans>
          )}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          disabled={pending}
          onClick={() => void setStatus("coming")}
        >
          <Trans>Actually, I'll make it</Trans>
        </Button>
      </div>
    );
  }

  const heading =
    status === "out" ? (
      <Trans>
        The group locked {parts.dow}, {parts.mon} {parts.day} — you voted no.
      </Trans>
    ) : isAnnouncement ? (
      <Trans>
        {parts.dow}, {parts.mon} {parts.day} — are you coming?
      </Trans>
    ) : (
      <Trans>
        The group locked {parts.dow}, {parts.mon} {parts.day} — are you still
        coming?
      </Trans>
    );
  const body =
    status === "out" ? (
      <Trans>
        That's the date that worked for most people. Can you still swing by, or
        should we count you out?
      </Trans>
    ) : (
      <Trans>Let the group know so the haul and headcount stay accurate.</Trans>
    );

  return (
    <div className="rounded-(--r-lg) border-2 border-border bg-card px-6.5 py-6 shadow-(--sh-md)">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-(--marigold-tint) px-2.5 py-1 text-[13px] font-bold text-(--accent-deep)">
        <SparklesIcon size={13} />
        <Trans>Heads up</Trans>
      </span>
      <h3 className="mt-3 font-display text-[24px] font-bold">{heading}</h3>
      <p className="mt-2 text-(--ink-soft)">{body}</p>
      {myClaim && (
        <div className="mt-3.5 flex items-center gap-2.5 rounded-(--r-sm) border border-(--line) bg-(--card-2) px-3.5 py-2.75">
          <HandIcon size={18} color="var(--accent-deep)" className="shrink-0" />
          <span className="text-[13px] font-semibold">
            <Trans>
              You're down for <strong>{myClaim.label}</strong>. If you bow out,
              we'll free it up for someone else.
            </Trans>
          </span>
        </div>
      )}
      <div className="mt-4.5 flex flex-wrap gap-2.5">
        <Button disabled={pending} onClick={() => void setStatus("coming")}>
          <CheckIcon size={16} />
          {status === "out" ? (
            <Trans>I'll make it</Trans>
          ) : (
            <Trans>I'm in</Trans>
          )}
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => void setStatus("out")}
        >
          {status === "out" ? (
            <Trans>Count me out</Trans>
          ) : (
            <Trans>Can't make it</Trans>
          )}
        </Button>
      </div>
    </div>
  );
}
