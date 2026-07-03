import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinEventFn } from "../functions";

interface JoinBarProps {
  eventToken: string;
  participantNames: string[];
}

export function JoinBar({ eventToken, participantNames }: JoinBarProps) {
  const { t } = useLingui();
  const router = useRouter();
  const [name, setName] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const trimmed = name.trim();
  const valid = trimmed.length > 1;
  const dupe = participantNames.some(
    (p) => p.toLowerCase() === trimmed.toLowerCase(),
  );

  async function handleJoin() {
    if (!valid || isJoining) return;
    setIsJoining(true);

    const result = await joinEventFn({
      data: { token: eventToken, displayName: trimmed },
    });

    if (result.error || !result.participantId) {
      toast.error(result.error ?? t`Something went wrong. Please try again.`);
      setIsJoining(false);
      return;
    }

    await router.invalidate();
    setIsJoining(false);
  }

  return (
    <div className="mb-6.5 flex flex-wrap items-center gap-4 rounded-(--r-lg) border-[1.5px] border-(--accent) bg-[linear-gradient(120deg,var(--accent-tint),var(--card))] px-5.5 py-4.5">
      <div className="min-w-50 flex-1">
        <div className="font-display text-[18px] font-extrabold">
          <Trans>👋 Add your name to join in</Trans>
        </div>
        <p className="pv-body mt-0.75 text-[13px]">
          <Trans>
            Vote on dates and claim what you'll bring — no account needed.
          </Trans>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Input
          value={name}
          placeholder={t`Your name`}
          className="w-50 px-3.5 py-3"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid) void handleJoin();
          }}
        />
        <Button
          disabled={!valid || isJoining}
          onClick={() => void handleJoin()}
        >
          <Trans>Join</Trans>
        </Button>
      </div>
      {dupe && (
        <p role="alert" className="w-full text-[13px] text-(--no)">
          <Trans>Someone's already using that name — add a last initial?</Trans>
        </p>
      )}
    </div>
  );
}
