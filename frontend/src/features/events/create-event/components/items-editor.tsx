import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { PlusIcon, XIcon } from "lucide-react";

interface ItemsEditorProps {
  items: string[];
  onAdd: (label: string) => void;
  onRemove: (index: number) => void;
}

export function ItemsEditor({ items, onAdd, onRemove }: ItemsEditorProps) {
  const { t } = useLingui();
  const [custom, setCustom] = useState("");
  const labelSet = new Set(items.map((i) => i.toLowerCase()));
  const suggestions = [
    t`Cups & plates`,
    t`Dessert`,
    t`Beach umbrella`,
    t`Watermelon`,
    t`Trash bags`,
    t`Bug spray`,
  ].filter((s) => !labelSet.has(s.toLowerCase()));

  function addItem(label: string) {
    const trimmed = label.trim();
    if (!trimmed || labelSet.has(trimmed.toLowerCase())) return;
    onAdd(trimmed);
    setCustom("");
  }

  return (
    <div>
      {items.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2.25">
          {items.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-accent py-1.75 pr-1.75 pl-3.25 text-[13px] font-semibold text-foreground"
            >
              {item}
              <button
                type="button"
                aria-label={t`Remove ${item}`}
                onClick={() => onRemove(i)}
                className="flex cursor-pointer border-0 bg-transparent p-0.5"
              >
                <XIcon size={13} color="var(--accent-deep)" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex max-w-105 items-center gap-2.5">
        <input
          className="w-full rounded-(--r-sm) border-[1.5px] border-border bg-card px-3.25 py-2.75 font-sans text-[15px] text-foreground transition-[border-color,box-shadow] duration-140 outline-none placeholder:text-(--ink-faint) focus:border-primary focus:shadow-[0_0_0_4px_var(--accent-tint)]"
          value={custom}
          placeholder={t`Add an item…`}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem(custom);
            }
          }}
        />
        <button
          type="button"
          aria-label={t`Add item`}
          onClick={() => addItem(custom)}
          className="inline-flex shrink-0 cursor-pointer appearance-none items-center justify-center gap-2.25 rounded-full border border-border bg-card px-3.5 py-2.75 font-sans text-sm leading-none font-bold whitespace-nowrap text-foreground shadow-(--sh-sm) transition-[transform,box-shadow,background] duration-160 hover:-translate-y-px hover:bg-(--card-2)"
        >
          <PlusIcon size={16} color="var(--ink)" />
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-4">
          <p className="mb-2.25 font-mono text-[11px] font-medium tracking-[0.14em] text-(--accent-deep) uppercase">
            <Trans>Tap to add</Trans>
          </p>
          <div className="flex flex-wrap gap-2.25">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addItem(s)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3.25 py-1.75 text-[13px] font-semibold text-muted-foreground transition-transform duration-120 ease-in-out active:scale-[0.97]"
              >
                <PlusIcon size={14} color="var(--ink-soft)" /> {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
