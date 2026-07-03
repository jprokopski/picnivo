import { Trans } from "@lingui/react/macro";
import { LockIcon } from "lucide-react";
import type { EventItemDto } from "@/api/picnivo-api";

interface HaulGatedProps {
  items: EventItemDto[];
  isOrganizer: boolean;
  organizerName: string;
}

export function HaulGated({
  items,
  isOrganizer,
  organizerName,
}: HaulGatedProps) {
  return (
    <div>
      <div className="flex items-center gap-2.5 rounded-(--r-md) border-[1.5px] border-dashed border-(--line) bg-(--card-2) px-3.5 py-2.75">
        <LockIcon size={17} color="var(--accent-deep)" className="shrink-0" />
        <div className="min-w-0">
          <span className="text-[14px] font-bold">
            <Trans>Claiming opens once the date's locked. </Trans>
          </span>
          <span className="text-[13px] text-(--ink-soft)">
            {isOrganizer ? (
              <Trans>Lock the date above to open the haul.</Trans>
            ) : (
              <Trans>{organizerName} sets the final date.</Trans>
            )}
          </span>
        </div>
      </div>
      <p className="mt-4.5 mb-2.5 font-mono text-[11px] font-medium tracking-[0.14em] text-(--accent-deep) uppercase">
        <Trans>On the list · {items.length}</Trans>
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.id}
            className="border-border bg-card text-foreground rounded-full border px-3.25 py-1.75 text-[13px] font-semibold wrap-break-word"
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
