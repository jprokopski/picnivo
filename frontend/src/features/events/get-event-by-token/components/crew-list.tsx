import type { ParticipantDto } from "@/api/picnivo-api";
import { Avatar } from "@/components/avatar";

interface CrewListProps {
  participants: ParticipantDto[];
}

export function CrewList({ participants }: CrewListProps) {
  return (
    <div className="flex flex-col gap-3">
      {participants.map((p) => (
        <div key={p.id} className="flex items-center gap-2.5">
          <Avatar name={p.displayName} size={36} />
          <span className="text-[14px] font-bold">{p.displayName}</span>
        </div>
      ))}
    </div>
  );
}
