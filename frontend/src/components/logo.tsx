export const BASKET_PIXELS: [number, number, number, number, string][] = [
  [120, 70, 20, 20, "#8a5420"],
  [140, 50, 80, 20, "#8a5420"],
  [220, 70, 20, 20, "#8a5420"],
  [120, 90, 20, 40, "#8a5420"],
  [220, 90, 20, 40, "#8a5420"],
  [100, 90, 44, 44, "#e8584c"],
  [112, 78, 20, 12, "#6ab058"],
  [120, 102, 12, 12, "#f47a6e"],
  [230, 96, 56, 34, "#e0a85c"],
  [230, 96, 56, 10, "#c98a3e"],
  [80, 130, 200, 20, "#f5f0e6"],
  [100, 130, 20, 20, "#e8584c"],
  [160, 130, 20, 20, "#e8584c"],
  [220, 130, 20, 20, "#e8584c"],
  [60, 150, 240, 24, "#8a5420"],
  [80, 174, 200, 120, "#b5742e"],
  [80, 174, 200, 16, "#8a5420"],
  [80, 278, 200, 16, "#8a5420"],
  [96, 202, 20, 20, "#d89a4f"],
  [136, 202, 20, 20, "#d89a4f"],
  [176, 202, 20, 20, "#d89a4f"],
  [216, 202, 20, 20, "#d89a4f"],
  [256, 202, 20, 20, "#d89a4f"],
  [116, 238, 20, 20, "#d89a4f"],
  [156, 238, 20, 20, "#d89a4f"],
  [196, 238, 20, 20, "#d89a4f"],
  [236, 238, 20, 20, "#d89a4f"],
  [96, 238, 20, 20, "#d89a4f"],
];

function BasketTile({
  size = 28,
  tone = "default",
}: {
  size?: number;
  tone?: "default" | "light";
}) {
  return (
    <span
      className={
        tone === "light"
          ? "inline-flex shrink-0 items-center justify-center bg-[rgba(255,252,246,0.92)] p-[0.12em] shadow-[inset_0_0_0_1px_rgba(43,32,24,0.08),0_1px_2px_rgba(120,72,28,0.12)]"
          : "inline-flex shrink-0 items-center justify-center bg-[linear-gradient(165deg,var(--marigold-tint)_0%,var(--coral-tint)_100%)] p-[0.12em] shadow-[inset_0_0_0_1px_rgba(43,32,24,0.08),0_1px_2px_rgba(120,72,28,0.12)]"
      }
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="44 34 258 276"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        style={{ display: "block" }}
      >
        <g shapeRendering="crispEdges">
          {BASKET_PIXELS.map(([x, y, w, h, fill], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
          ))}
        </g>
      </svg>
    </span>
  );
}

export default function Logo({
  size = 17,
  tone = "default",
}: {
  size?: number;
  tone?: "default" | "light";
}) {
  return (
    <span
      className={
        "font-display inline-flex items-center gap-[0.5em] font-extrabold tracking-[-0.02em] " +
        (tone === "light" ? "text-white" : "text-(--ink)")
      }
      style={{ fontSize: size }}
    >
      <BasketTile size={Math.round(size * 1.62)} tone={tone} />
      <span className="translate-y-[0.02em] leading-none">Picnivo</span>
    </span>
  );
}
