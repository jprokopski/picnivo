const AVATAR_COLORS = [
  "#F15A37",
  "#F2A93C",
  "#2E7E9A",
  "#3F9E63",
  "#C75B8B",
  "#7A5BD1",
  "#E0492A",
  "#1F8A7A",
];

export function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return (
    (p[0]?.[0] || "?").toUpperCase() + (p[1]?.[0] ? p[1][0].toUpperCase() : "")
  );
}

export function Avatar({
  name,
  size = 34,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-sans font-extrabold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: avatarColor(name),
      }}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
