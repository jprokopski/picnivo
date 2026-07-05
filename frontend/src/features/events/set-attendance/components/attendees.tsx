import { Trans } from "@lingui/react/macro";
import { Avatar } from "@/components/avatar";
import type { ParticipantDto } from "@/api/picnivo-api";
import { isEffectivelyComing, isEffectivelyOut } from "../schema";

interface AttendeesProps {
  participants: ParticipantDto[];
  chosenDateOptionId: string | null;
  locked: boolean;
  myParticipantId: string | null;
}

export function Attendees({
  participants,
  chosenDateOptionId,
  locked,
  myParticipantId,
}: AttendeesProps) {
  if (!locked || !chosenDateOptionId) {
    return (
      <div className="flex flex-col gap-3">
        {participants.map((p) => (
          <PersonRow
            key={p.id}
            participant={p}
            myParticipantId={myParticipantId}
          />
        ))}
      </div>
    );
  }

  const coming = participants.filter((p) =>
    isEffectivelyComing(p.attendance, p.votes, chosenDateOptionId),
  );
  const out = participants.filter((p) =>
    isEffectivelyOut(p.attendance, p.votes, chosenDateOptionId),
  );
  const decidedIds = new Set([...coming, ...out].map((p) => p.id));
  const undecided = participants.filter((p) => !decidedIds.has(p.id));

  const showComing = coming.length > 0;
  const showUndecided = undecided.length > 0;
  const showOut = out.length > 0;

  return (
    <div className="flex flex-col gap-4.5">
      {showComing && (
        <div>
          <p className="mb-2.75 font-mono text-[11px] font-medium tracking-[0.14em] text-(--yes) uppercase">
            <Trans>Coming · {coming.length}</Trans>
          </p>
          <div className="flex flex-col gap-3">
            {coming.map((p) => (
              <PersonRow
                key={p.id}
                participant={p}
                myParticipantId={myParticipantId}
              />
            ))}
          </div>
        </div>
      )}
      {showUndecided && (
        <>
          {showComing && <hr className="border-border" />}
          <div>
            <p className="mb-2.75 font-mono text-[11px] font-medium tracking-[0.14em] text-(--ink-soft) uppercase">
              <Trans>Undecided · {undecided.length}</Trans>
            </p>
            <div className="flex flex-col gap-3">
              {undecided.map((p) => (
                <PersonRow
                  key={p.id}
                  participant={p}
                  myParticipantId={myParticipantId}
                />
              ))}
            </div>
          </div>
        </>
      )}
      {showOut && (
        <>
          {(showComing || showUndecided) && <hr className="border-border" />}
          <div>
            <p className="mb-2.75 font-mono text-[11px] font-medium tracking-[0.14em] text-(--no) uppercase">
              <Trans>Can't make it · {out.length}</Trans>
            </p>
            <div className="flex flex-col gap-3 opacity-90">
              {out.map((p) => (
                <PersonRow
                  key={p.id}
                  participant={p}
                  myParticipantId={myParticipantId}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface PersonRowProps {
  participant: ParticipantDto;
  myParticipantId: string | null;
}

function PersonRow({ participant, myParticipantId }: PersonRowProps) {
  const isMe = participant.id === myParticipantId;

  return (
    <div className="flex items-center justify-between gap-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={participant.displayName} size={36} />
        <div className="min-w-0 leading-tight">
          <div className="text-[14px] font-bold wrap-break-word">
            {isMe ? <Trans>You</Trans> : participant.displayName}
          </div>
          {participant.isOrganizer && (
            <div className="font-mono text-[9.5px] text-(--ink-soft)">
              <Trans>HOST</Trans>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
