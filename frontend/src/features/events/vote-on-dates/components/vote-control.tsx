import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { VOTE_META, VOTE_ORDER, type VoteChoiceKey } from "../schema";
import { castVotesFn } from "../functions";

interface VoteControlProps {
  token: string;
  dateOptionId: string;
  value?: VoteChoiceKey;
  disabled?: boolean;
  isBest?: boolean;
}

export function VoteControl({
  token,
  dateOptionId,
  value,
  disabled = false,
  isBest = false,
}: VoteControlProps) {
  const { t } = useLingui();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const labels: Record<VoteChoiceKey, string> = {
    yes: t`Yes`,
    maybe: t`Maybe`,
    no: t`No`,
  };

  async function handleChange(choice: VoteChoiceKey) {
    if (disabled || pending || choice === value) return;
    setPending(true);
    const result = await castVotesFn({
      data: { token, votes: [{ dateOptionId, choice }] },
    });
    if (result.error) {
      toast.error(result.error || t`Something went wrong. Please try again.`);
    } else {
      await router.invalidate();
    }
    setPending(false);
  }

  const isDisabled = disabled || pending;

  return (
    <>
      <div
        role="group"
        aria-label={t`Vote`}
        className="flex gap-2.5 max-[720px]:hidden"
        style={{ opacity: isDisabled ? 0.6 : 1 }}
      >
        {VOTE_ORDER.map((key) => {
          const meta = VOTE_META[key];
          const on = value === key;
          return (
            <button
              key={key}
              type="button"
              title={labels[key]}
              aria-label={labels[key]}
              aria-pressed={on}
              disabled={isDisabled}
              onClick={() => void handleChange(key)}
              className="flex size-11.5 items-center justify-center rounded-full text-[22px] duration-180"
              style={{
                border: on
                  ? `2.5px solid ${meta.color}`
                  : "2px solid var(--line)",
                background: on ? meta.tint : "var(--card-2)",
                transform: on ? "scale(1.08)" : "scale(1)",
                transition: "all 180ms cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              {meta.emoji}
            </button>
          );
        })}
      </div>
      <div
        role="group"
        aria-label={t`Vote`}
        className="hidden w-full gap-1 rounded-full border border-(--line) p-0.75 max-[720px]:flex"
        style={{
          background: isBest ? "var(--card)" : "var(--card-2)",
          opacity: isDisabled ? 0.6 : 1,
        }}
      >
        {VOTE_ORDER.map((key) => {
          const meta = VOTE_META[key];
          const on = value === key;
          return (
            <button
              key={key}
              type="button"
              title={labels[key]}
              aria-label={labels[key]}
              disabled={isDisabled}
              aria-pressed={on}
              onClick={() => void handleChange(key)}
              className="flex flex-1 items-center justify-center rounded-full px-1 py-2 text-[18px] transition-colors"
              style={{
                background: on ? meta.color : "transparent",
                color: on ? "#fff" : "var(--ink-soft)",
              }}
            >
              {meta.emoji}
            </button>
          );
        })}
      </div>
    </>
  );
}
