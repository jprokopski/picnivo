import { useId } from "react";

// [x, y, w, h, fill] — pixel data for the basket logo art
const BASKET_PIXELS: [number, number, number, number, string][] = [
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

function BasketPixels({ prefix }: { prefix: string }) {
  return (
    <>
      {BASKET_PIXELS.map((p, i) => (
        <rect
          key={prefix + i}
          x={p[0]}
          y={p[1]}
          width={p[2]}
          height={p[3]}
          fill={p[4]}
        />
      ))}
    </>
  );
}

const PICNIC_SKIES = {
  sunset: {
    top: "#ffd58a",
    mid: "#ff9d6b",
    low: "#f1633f",
    grass: "#52b271",
    grassDark: "#3f9e63",
  },
  sea: {
    top: "#bfe3ec",
    mid: "#6db7cd",
    low: "#2e7e9a",
    grass: "#52b271",
    grassDark: "#3f9e63",
  },
  grove: {
    top: "#d8eebf",
    mid: "#8fce86",
    low: "#3f9e63",
    grass: "#3f9e63",
    grassDark: "#2f7d4d",
  },
  berry: {
    top: "#f6cfe0",
    mid: "#e08ab0",
    low: "#c75b8b",
    grass: "#52b271",
    grassDark: "#3f9e63",
  },
};

type Variant = keyof typeof PICNIC_SKIES;
type Slot = "card" | "wide";

interface PicnicSceneProps {
  variant?: Variant;
  slot?: Slot;
  className?: string;
  style?: React.CSSProperties;
}

export function PicnicScene({
  variant = "sunset",
  slot = "card",
  className = "",
  style,
}: PicnicSceneProps) {
  const gid = useId();
  const sky = PICNIC_SKIES[variant] ?? PICNIC_SKIES.sunset;

  const W = slot === "wide" ? 48 : 24;
  const sx = slot === "wide" ? W - 16 : W - 5;

  type Cell = [number, number, number, number, string];
  const back: Cell[] = [
    [0, 0, W, 2, sky.top],
    [0, 2, W, 1, sky.mid],
    [0, 3, W, 1, sky.low],
    [sx + 1, 0, 3, 1, "#ffe7a3"],
    [sx, 1, 5, 1, "#ffce80"],
    [sx, 2, 5, 1, "#ffba63"],
    [sx + 1, 3, 3, 1, "#ff9e48"],
    [3, 1, 4, 1, "#fff6e6"],
    [2, 2, 5, 1, "#fff6e6"],
    [0, 4, W, 1, sky.grass],
    [4, 3, 6, 1, sky.grass],
    [0, 5, W, 1, sky.grassDark],
  ];

  const bh = 60;
  const bw = Math.round((bh * 240) / 252);
  const bx = (W * 8) / 2 - bw / 2;
  const by = (96 - bh) / 2;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${W * 8} 96`}
      preserveAspectRatio="xMidYMid slice"
      style={{ display: "block", width: "100%", height: "100%", ...style }}
      role="img"
      aria-hidden="true"
    >
      <defs>
        <pattern id={gid} width="32" height="32" patternUnits="userSpaceOnUse">
          <rect width="32" height="32" fill="#fbe6c4" />
          <rect width="16" height="32" fill="rgba(220,86,68,0.5)" />
          <rect width="32" height="16" fill="rgba(220,86,68,0.5)" />
        </pattern>
      </defs>
      <g shapeRendering="crispEdges">
        {back.map(([c, r, w, h, fill], i) => (
          <rect
            key={"b" + i}
            x={c * 8}
            y={r * 8}
            width={w * 8}
            height={h * 8}
            fill={fill}
          />
        ))}
        {/* gingham blanket (rows 6–12) */}
        <rect x="0" y="48" width={W * 8} height="48" fill={`url(#${gid})`} />
        <rect
          x="0"
          y="48"
          width={W * 8}
          height="3"
          fill="rgba(255,247,225,0.5)"
        />
        {/* logo basket centred on blanket */}
        <svg
          x={bx}
          y={by}
          width={bw}
          height={bh}
          viewBox="60 46 240 252"
          overflow="visible"
        >
          <g shapeRendering="crispEdges">
            <BasketPixels prefix="sc" />
          </g>
        </svg>
      </g>
    </svg>
  );
}
