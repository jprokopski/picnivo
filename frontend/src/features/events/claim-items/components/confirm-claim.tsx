import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useRouter } from "@tanstack/react-router";
import { HandIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { VoteChoiceKey } from "../../vote-on-dates/schema";
import { setAttendanceFn } from "../../set-attendance/functions";

interface ConfirmClaimProps {
  token: string;
  myVote?: VoteChoiceKey;
}

export function ConfirmClaim({ token, myVote }: ConfirmClaimProps) {
  const { t } = useLingui();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const reason =
    myVote === "no"
      ? t`You're marked can't-make-it for this date.`
      : myVote === "maybe"
        ? t`You're down as a maybe for this date.`
        : t`You haven't confirmed this date yet.`;

  async function handleConfirm() {
    setPending(true);
    const result = await setAttendanceFn({
      data: { token, status: "coming" },
    });
    if (result.error) {
      toast.error(result.error || t`Something went wrong. Please try again.`);
    } else {
      await router.invalidate();
    }
    setPending(false);
  }

  return (
    <div className="mb-3.5 flex items-center gap-2.5 rounded-(--r-md) border-[1.5px] border-(--accent) bg-(--marigold-tint) px-3.5 py-2.75">
      <HandIcon size={17} color="var(--accent-deep)" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="text-[14px] font-bold">
          <Trans>Confirm you're coming to claim. </Trans>
        </span>
        <span className="text-[13px] text-(--ink-soft)">{reason}</span>
      </div>
      <Button
        size="sm"
        className="shrink-0"
        disabled={pending}
        onClick={() => void handleConfirm()}
      >
        <Trans>I'm in</Trans>
      </Button>
    </div>
  );
}
