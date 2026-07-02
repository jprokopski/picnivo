import { Avatar } from "../../../components/avatar";

export function AvatarStack({
  names,
  max = 5,
  size = 30,
}: {
  names: string[];
  max?: number;
  size?: number;
}) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;

  return (
    <div className="flex">
      {shown.map((name, i) => (
        <Avatar
          key={name}
          name={name}
          size={size}
          className={
            "border-2 border-[rgba(255,247,234,0.9)] shadow-(--sh-sm) " +
            (i === 0 ? "" : "-ml-[9px]")
          }
        />
      ))}
      {extra > 0 && (
        <span
          className="-ml-[9px] flex shrink-0 items-center justify-center rounded-full border-2 border-[rgba(255,247,234,0.9)] font-sans font-extrabold text-white shadow-(--sh-sm)"
          style={{
            width: size,
            height: size,
            fontSize: size * 0.34,
            background: "var(--ink-soft)",
          }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
