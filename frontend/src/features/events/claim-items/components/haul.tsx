import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useRouter } from "@tanstack/react-router";
import { CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { EventItemDto, ParticipantDto, YouDto } from "@/api/picnivo-api";
import {
  isEffectivelyComing,
  isEffectivelyOut,
} from "../../set-attendance/schema";
import { voteChoiceKeyFromValue } from "../../vote-on-dates/schema";
import { claimItemFn, releaseClaimFn, removeItemFn } from "../functions";
import { AddItem } from "./add-item";
import { ConfirmClaim } from "./confirm-claim";
import { HaulGated } from "./haul-gated";

interface HaulProps {
  token: string;
  items: EventItemDto[];
  participants: ParticipantDto[];
  chosenDateOptionId: string | null;
  locked: boolean;
  joined: boolean;
  isOrganizer: boolean;
  organizerName: string;
  you: YouDto | null;
  myParticipantId: string | null;
}

export function Haul({
  token,
  items,
  participants,
  chosenDateOptionId,
  locked,
  joined,
  isOrganizer,
  organizerName,
  you,
  myParticipantId,
}: HaulProps) {
  if (!locked) {
    return (
      <HaulGated
        items={items}
        isOrganizer={isOrganizer}
        organizerName={organizerName}
      />
    );
  }

  const canClaim = you
    ? isEffectivelyComing(you.attendance, you.votes, chosenDateOptionId)
    : false;
  const comingCount = participants.filter(
    (p) => !isEffectivelyOut(p.attendance, p.votes, chosenDateOptionId),
  ).length;
  const myVoteChoice = chosenDateOptionId
    ? you?.votes.find((v) => v.dateOptionId === chosenDateOptionId)?.choice
    : undefined;
  const active = joined && canClaim;

  return (
    <div>
      {joined &&
        (canClaim ? (
          <p className="mb-3.5 flex items-center gap-1.75 text-[14px]">
            <CheckIcon size={15} color="var(--yes)" className="shrink-0" />
            <span>
              <Trans>
                <strong>{comingCount} coming</strong> — grab what you'll bring.
              </Trans>
            </span>
          </p>
        ) : (
          <ConfirmClaim
            token={token}
            myVote={voteChoiceKeyFromValue(myVoteChoice)}
          />
        ))}
      <div className="border-border bg-card overflow-hidden rounded-(--r-md) border">
        {items.map((item, index) => (
          <ItemRow
            key={item.id}
            token={token}
            item={item}
            active={active}
            joined={joined}
            mine={you?.claimedItemIds.includes(item.id) ?? false}
            canRemove={
              isOrganizer ||
              (!!myParticipantId &&
                item.addedByParticipantId === myParticipantId)
            }
            isLast={index === items.length - 1}
          />
        ))}
      </div>
      <AddItem token={token} items={items} joined={joined} active={active} />
    </div>
  );
}

interface ItemRowProps {
  token: string;
  item: EventItemDto;
  active: boolean;
  joined: boolean;
  mine: boolean;
  canRemove: boolean;
  isLast: boolean;
}

function ItemRow({
  token,
  item,
  active,
  joined,
  mine,
  canRemove,
  isLast,
}: ItemRowProps) {
  const { t } = useLingui();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const claimed = !!item.claimedByParticipantId;
  const orphan = !claimed && !!item.orphanedFromName;
  const clickable = active && (!claimed || mine);

  async function handleToggle() {
    if (!clickable || pending) return;
    setPending(true);
    const result = claimed
      ? await releaseClaimFn({ data: { token, itemId: item.id } })
      : await claimItemFn({ data: { token, itemId: item.id } });
    if (result.error) {
      toast.error(result.error);
    }
    // Refetch regardless of outcome — a 409 means someone else just claimed
    // this item, so the caller needs the fresh server state either way.
    await router.invalidate();
    setPending(false);
  }

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    const result = await removeItemFn({ data: { token, itemId: item.id } });
    if (result.error) {
      toast.error(result.error);
    } else {
      await router.invalidate();
    }
    setPending(false);
  }

  const trailingLabel = claimed
    ? mine
      ? t`You`
      : (item.claimedByName ?? "")
    : active
      ? orphan
        ? t`I'll cover it`
        : t`Claim`
      : joined
        ? t`Confirm to claim`
        : t`Join to claim`;

  return (
    <div
      className={cn(
        "flex items-center gap-3.5 px-4.5 py-3.5",
        !isLast && "border-border border-b",
      )}
    >
      <button
        type="button"
        disabled={!clickable || pending}
        onClick={() => void handleToggle()}
        className="flex min-w-0 flex-1 items-center gap-3.25 text-left disabled:cursor-default"
      >
        <span
          className="flex size-6.5 shrink-0 items-center justify-center rounded-full"
          style={{
            background: claimed ? "var(--yes)" : "transparent",
            border: claimed
              ? "none"
              : orphan
                ? "2px solid var(--no)"
                : "2px solid var(--line)",
          }}
        >
          {claimed && <CheckIcon size={15} color="#fff" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-[15px] font-bold wrap-break-word">
            {item.label}
          </span>
          {orphan && (
            <span className="block text-[13px] font-bold text-(--no)">
              <Trans>Was {item.orphanedFromName}'s — needs a new owner</Trans>
            </span>
          )}
        </span>
        <span
          className="shrink-0 text-[13px] font-bold"
          style={{
            color: claimed
              ? mine
                ? "var(--accent-deep)"
                : "var(--ink-soft)"
              : orphan
                ? "var(--no)"
                : active
                  ? "var(--accent-deep)"
                  : "var(--ink-faint)",
          }}
        >
          {trailingLabel}
        </span>
      </button>
      {canRemove && (
        <button
          type="button"
          aria-label={t`Remove ${item.label}`}
          disabled={pending}
          onClick={(e) => void handleRemove(e)}
          className="shrink-0 p-1"
        >
          <XIcon size={14} color="var(--ink-faint)" />
        </button>
      )}
    </div>
  );
}
