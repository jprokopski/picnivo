import { Trans } from "@lingui/react/macro";
import { ClockIcon } from "lucide-react";
import { AvatarStack } from "@/components/avatar";
import type { DateOptionDto } from "@/api/picnivo-api";
import { formatInstantParts } from "@/lib/format-instant";
import { VoteControl } from "./vote-control";
import type { VoteChoiceKey } from "../schema";

interface DateRowProps {
  token: string;
  date: DateOptionDto;
  isBest: boolean;
  locked: boolean;
  joined: boolean;
  myVote?: VoteChoiceKey;
  yesVoterNames: string[];
}

export function DateRow({
  token,
  date,
  isBest,
  locked,
  joined,
  myVote,
  yesVoterNames,
}: DateRowProps) {
  const parts = formatInstantParts(date.startsAt);
  const yes = Number(date.yesCount);
  const maybe = Number(date.maybeCount);
  const no = Number(date.noCount);
  const total = Math.max(yes + maybe + no, 1);

  return (
    <div
      className="flex flex-wrap items-center gap-5 rounded-(--r-md) border px-5 py-4 transition-colors max-[720px]:items-start max-[720px]:gap-3.5 max-[720px]:px-4 max-[720px]:py-3.5"
      style={
        isBest
          ? {
              borderColor: "var(--accent)",
              background: "var(--accent-tint)",
              boxShadow: "inset 0 0 0 1px var(--accent)",
            }
          : { borderColor: "var(--line)", background: "var(--card)" }
      }
    >
      <div className="w-14.5 shrink-0 text-center leading-none max-[720px]:pt-0.5">
        <div className="font-mono text-[11px] text-(--accent-deep)">
          {parts.dow.toUpperCase()}
        </div>
        <div className="my-0.5 font-display text-[30px]">{parts.day}</div>
        <div className="font-mono text-[10px] text-(--ink-soft)">
          {parts.mon}
        </div>
      </div>
      <div className="min-w-50 flex-1 max-[720px]:min-w-0">
        <div className="mb-2.25 flex flex-wrap items-center gap-2.5">
          <span className="font-display text-[16px] font-extrabold">
            {parts.dow}, {parts.mon} {parts.day}
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[13px] text-(--ink-soft)">
            <ClockIcon size={13} />
            {parts.time}
          </span>
          {isBest && (
            <span className="rounded-full bg-(--accent) px-2.25 py-0.75 text-[11px] font-bold text-white max-[720px]:hidden">
              {locked ? <Trans>✓ Locked</Trans> : <Trans>Leading</Trans>}
            </span>
          )}
        </div>
        <div className="flex h-2.25 overflow-hidden rounded-full bg-(--line)">
          {yes > 0 && (
            <span
              style={{
                width: `${(yes / total) * 100}%`,
                background: "var(--yes)",
              }}
            />
          )}
          {maybe > 0 && (
            <span
              style={{
                width: `${(maybe / total) * 100}%`,
                background: "var(--maybe)",
              }}
            />
          )}
          {no > 0 && (
            <span
              style={{
                width: `${(no / total) * 100}%`,
                background: "var(--no)",
              }}
            />
          )}
        </div>
        <div className="mt-2.25 flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-bold whitespace-nowrap text-(--yes)">
            <Trans>{yes} yes</Trans>
          </span>
          <span className="text-[13px] font-bold whitespace-nowrap text-(--maybe)">
            <Trans>{maybe} maybe</Trans>
          </span>
          <span className="text-[13px] font-bold whitespace-nowrap text-(--no)">
            <Trans>{no} no</Trans>
          </span>
          {yesVoterNames.length > 0 && (
            <span className="max-[480px]:hidden">
              <AvatarStack names={yesVoterNames} size={22} max={5} />
            </span>
          )}
        </div>
      </div>
      {joined && (
        <div className="shrink-0 max-[720px]:w-full">
          <VoteControl
            token={token}
            dateOptionId={date.id}
            value={myVote}
            disabled={locked}
            isBest={isBest}
          />
        </div>
      )}
    </div>
  );
}
