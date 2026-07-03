import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useRouter } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EventItemDto } from "@/api/picnivo-api";
import { addItemFn } from "../functions";

interface AddItemProps {
  token: string;
  items: EventItemDto[];
  joined: boolean;
  active: boolean;
}

export function AddItem({ token, items, joined, active }: AddItemProps) {
  const { t } = useLingui();
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState(false);

  const trimmed = label.trim();
  const duplicate = items.some(
    (i) => i.label.toLowerCase() === trimmed.toLowerCase(),
  );

  async function handleAdd() {
    if (!trimmed || !active || pending || duplicate) return;
    setPending(true);
    const result = await addItemFn({ data: { token, label: trimmed } });
    if (result.error) {
      toast.error(result.error || t`Something went wrong. Please try again.`);
    } else {
      setLabel("");
      await router.invalidate();
    }
    setPending(false);
  }

  const disabled = !active || pending;

  return (
    <div className="mt-3.5 max-w-105">
      <div className="flex items-center gap-2.5">
        <Input
          value={label}
          placeholder={
            active
              ? t`Add something you'll bring…`
              : joined
                ? t`Confirm you're coming to add`
                : t`Join to add items`
          }
          disabled={disabled}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAdd();
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t`Add item`}
          disabled={disabled || !trimmed || duplicate}
          onClick={() => void handleAdd()}
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
      {duplicate && (
        <p role="alert" className="mt-1.5 text-[13px] text-(--no)">
          <Trans>That's already on the list.</Trans>
        </p>
      )}
    </div>
  );
}
