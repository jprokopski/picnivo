import { BASKET_PIXELS } from "../../../components/logo";

type Rect = [number, number, number, number, string?];

function drawRects(rects: Rect[], keyPrefix: string, defaultFill?: string) {
  return rects.map(([c, r, w, h, fill], i) => (
    <rect
      key={`${keyPrefix}${i}`}
      x={c * 8}
      y={r * 8}
      width={w * 8}
      height={h * 8}
      fill={fill ?? defaultFill}
    />
  ));
}

// Purpose-built pixel beach-sunset postcard for the auth brand panel, ported
// from context/foundation/design/picnivo-web-auth.jsx (viewBox 480x224, 60x28
// cells @ 8px).
const CLOUDS: Rect[] = [
  [9, 6, 7, 1, "#fff6e6"],
  [8, 7, 9, 1, "#fff6e6"],
  [10, 5, 4, 1, "#fffdf4"],
  [42, 4, 6, 1, "#fff6e6"],
  [41, 5, 8, 1, "#fff6e6"],
  [43, 3, 3, 1, "#fffdf4"],
  [20, 3, 4, 1, "#fff6e6"],
  [21, 2, 2, 1, "#fffdf4"],
];
const BIRDS: Rect[] = [
  [16, 5, 1, 1],
  [17, 6, 1, 1],
  [18, 5, 1, 1],
  [34, 3, 1, 1],
  [35, 4, 1, 1],
  [36, 3, 1, 1],
];
const SUN: Rect[] = [
  [28, 3, 5, 1, "#fff6d8"],
  [27, 4, 7, 1, "#ffeeb0"],
  [26, 5, 9, 1, "#ffe199"],
  [25, 6, 11, 1, "#ffd285"],
  [25, 7, 11, 1, "#ffc873"],
  [25, 8, 11, 1, "#ffba63"],
  [25, 9, 11, 1, "#ffac54"],
  [26, 10, 9, 1, "#ffa24e"],
  [27, 11, 7, 1, "#ff9444"],
];
const SUN_HI: Rect[] = [
  [28, 5, 3, 1, "#fff4d2"],
  [28, 6, 4, 1, "#ffe6a8"],
];
const BOAT: Rect[] = [
  [43, 7, 1, 3, "#cfa97a"],
  [44, 7, 1, 1, "#fff7ea"],
  [44, 8, 2, 1, "#fff7ea"],
  [44, 9, 3, 1, "#fff7ea"],
  [42, 9, 1, 1, "#ffe9c8"],
  [40, 10, 7, 1, "#b5742e"],
  [41, 10, 5, 1, "#d89a4f"],
];
const SEA: Rect[] = [
  [0, 11, 60, 1, "#8fcad9"],
  [0, 12, 60, 2, "#6db7cd"],
  [0, 14, 60, 2, "#4fa0bc"],
  [0, 16, 60, 2, "#3a8ca8"],
  [0, 18, 60, 2, "#2e7e9a"],
];
const FOAM: Rect[] = [
  [10, 13, 4, 1, "#d8f0f6"],
  [40, 13, 5, 1, "#d8f0f6"],
  [22, 15, 4, 1, "#c2e6f0"],
  [48, 15, 4, 1, "#c2e6f0"],
  [8, 17, 5, 1, "#bfe0ea"],
  [44, 17, 4, 1, "#bfe0ea"],
];
const REFLECT: Rect[] = [
  [27, 12, 7, 1, "#ffd9a0"],
  [28, 13, 5, 1, "#ffca8a"],
  [26, 14, 3, 1, "#ffd9a0"],
  [30, 14, 2, 1, "#ffd9a0"],
  [33, 14, 2, 1, "#ffca8a"],
  [28, 15, 5, 1, "#ffca8a"],
  [25, 16, 4, 1, "#ffd09a"],
  [31, 16, 2, 1, "#ffd09a"],
  [34, 16, 2, 1, "#ffca8a"],
  [28, 17, 5, 1, "#ffc78f"],
  [27, 18, 3, 1, "#ffc78f"],
  [31, 18, 3, 1, "#ffc078"],
  [29, 19, 3, 1, "#ffc078"],
];
const SAND: Rect[] = [
  [0, 20, 60, 1, "#f6e0b4"],
  [0, 21, 60, 2, "#f0d49a"],
  [0, 23, 60, 2, "#e8c585"],
  [0, 25, 60, 3, "#dcb673"],
];
const PEBBLE: Rect[] = [
  [14, 24, 1, 1],
  [50, 23, 1, 1],
  [33, 27, 1, 1],
  [45, 25, 1, 1],
];
const SHELL: Rect[] = [
  [38, 24, 1, 1],
  [20, 27, 1, 1],
  [9, 26, 1, 1],
];
const BLANKET: Rect[] = [
  [9, 24, 13, 1, "#fff2d8"],
  [9, 25, 13, 2, "#ffe9c8"],
  [11, 24, 1, 3, "#f3b6a0"],
  [15, 24, 1, 3, "#f3b6a0"],
  [19, 24, 1, 3, "#f3b6a0"],
];
const UMBRELLA: Rect[] = [
  [46, 18, 1, 1, "#f15a37"],
  [44, 19, 5, 1, "#f15a37"],
  [43, 20, 7, 1, "#e0492a"],
  [45, 19, 1, 1, "#fff7ea"],
  [47, 19, 1, 1, "#fff7ea"],
  [44, 20, 1, 1, "#fff7ea"],
  [46, 20, 1, 1, "#fff7ea"],
  [48, 20, 1, 1, "#fff7ea"],
  [43, 21, 1, 1, "#e0492a"],
  [45, 21, 1, 1, "#e0492a"],
  [47, 21, 1, 1, "#e0492a"],
  [49, 21, 1, 1, "#e0492a"],
  [46, 21, 1, 5, "#8a5420"],
];
const BALL: Rect[] = [
  [34, 22, 2, 1, "#f2a93c"],
  [33, 23, 4, 1, "#f15a37"],
  [33, 24, 4, 1, "#fff7ea"],
  [34, 25, 2, 1, "#2e7e9a"],
];
const STAR: Rect[] = [
  [24, 25, 1, 1],
  [23, 26, 3, 1],
  [24, 27, 1, 1],
  [24, 26, 1, 1],
];

export function AuthScene() {
  return (
    <svg
      className="absolute inset-x-0 bottom-0 block h-[46%] w-full"
      viewBox="0 0 480 224"
      preserveAspectRatio="xMidYMax slice"
      role="img"
      aria-hidden="true"
    >
      <g shapeRendering="crispEdges">
        {drawRects(CLOUDS, "cl")}
        {drawRects(BIRDS, "bd", "#b5742e")}
        {drawRects(SUN, "sun")}
        {drawRects(SUN_HI, "sh")}
        {drawRects(BOAT, "bo")}
        {drawRects(SEA, "sea")}
        {drawRects(FOAM, "fm")}
        {drawRects(REFLECT, "rf")}
        {drawRects(SAND, "sd")}
        {drawRects(PEBBLE, "pb", "#c99a52")}
        {drawRects(SHELL, "sl", "#fff2d8")}
        {drawRects(BLANKET, "bk")}
        {drawRects(BALL, "bl")}
        {drawRects(STAR, "st", "#f2a93c")}
        {drawRects(UMBRELLA, "um")}
        <svg
          x={96}
          y={150}
          width={64}
          height={72}
          viewBox="60 46 240 252"
          overflow="visible"
        >
          <g shapeRendering="crispEdges">
            {BASKET_PIXELS.map(([x, y, w, h, fill], i) => (
              <rect
                key={`as${i}`}
                x={x}
                y={y}
                width={w}
                height={h}
                fill={fill}
              />
            ))}
          </g>
        </svg>
      </g>
    </svg>
  );
}
