// picnivo-kit.jsx — seed data, helpers, shared UI components
// Exports to window for use by other babel scripts.

const { useState, useEffect, useRef } = React;

// ---------------------------------------------------------------
// Avatar colors (warm palette)
// ---------------------------------------------------------------
const PV_COLORS = ['#F15A37', '#F2A93C', '#2E7E9A', '#3F9E63', '#C75B8B', '#7A5BD1', '#E0492A', '#1F8A7A'];
function pvColorFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PV_COLORS[h % PV_COLORS.length];
}
function pvInitials(name) {
  const p = name.trim().split(/\s+/);
  return (p[0]?.[0] || '?').toUpperCase() + (p[1]?.[0] ? p[1][0].toUpperCase() : '');
}

// ---------------------------------------------------------------
// Seed event — "Sunset Beach Picnic"
// ---------------------------------------------------------------
function makeSeedEvent() {
  return {
    title: 'Sunset Beach Picnic',
    location: 'Baker Beach · north cove',
    host: 'Maya',
    note: "Golden-hour hang on the sand — bring something to share and good vibes. We'll lock the date once everyone votes.",
    dateOptions: [
      { id: 'd1', dow: 'Sat', day: '14', mon: 'Jun', time: '4:30 PM' },
      { id: 'd2', dow: 'Sun', day: '15', mon: 'Jun', time: '3:00 PM' },
      { id: 'd3', dow: 'Sat', day: '21', mon: 'Jun', time: '5:00 PM' },
    ],
    items: [
      { id: 'i1', label: 'Picnic blanket', by: 'Maya' },
      { id: 'i2', label: 'Cooler + drinks', by: 'Leo' },
      { id: 'i3', label: 'Sandwiches', by: null },
      { id: 'i4', label: 'Fruit + snacks', by: 'Priya' },
      { id: 'i5', label: 'Bluetooth speaker', by: 'Noah' },
      { id: 'i6', label: 'Frisbee + games', by: null },
      { id: 'i7', label: 'Sunscreen', by: 'Sam' },
    ],
    participants: ['Maya', 'Leo', 'Priya', 'Sam', 'Noah'],
    // votes[name][dateId] = 'yes' | 'maybe' | 'no'
    votes: {
      Maya:  { d1: 'yes',   d2: 'maybe', d3: 'yes' },
      Leo:   { d1: 'yes',   d2: 'no',    d3: 'maybe' },
      Priya: { d1: 'yes',   d2: 'yes',   d3: 'no' },
      Sam:   { d1: 'no',    d2: 'no',    d3: 'yes' },
      Noah:  { d1: 'no',    d2: 'maybe', d3: 'no' },
    },
  };
}

// tally a date option's votes
function pvTally(ev, dateId) {
  let yes = 0, maybe = 0, no = 0;
  for (const name of ev.participants) {
    const v = ev.votes[name]?.[dateId];
    if (v === 'yes') yes++;
    else if (v === 'maybe') maybe++;
    else if (v === 'no') no++;
  }
  return { yes, maybe, no, total: yes + maybe + no };
}

// best date: most yes, ties broken by fewest no
function pvBestDate(ev) {
  let best = null, bestT = null;
  for (const d of ev.dateOptions) {
    const t = pvTally(ev, d.id);
    if (!best || t.yes > bestT.yes || (t.yes === bestT.yes && t.no < bestT.no)) {
      best = d; bestT = t;
    }
  }
  return { date: best, tally: bestT };
}

// ---------------------------------------------------------------
// Components
// ---------------------------------------------------------------
function Sun({ size = 18 }) {
  return <span className="pv-sun" style={{ width: size, height: size }} />;
}

// The picnic basket from the logo, as reusable pixel data (viewBox 0 0 360 360).
// [x, y, w, h, fill]
const BASKET_PIXELS = [
  [120, 70, 20, 20, '#8a5420'], [140, 50, 80, 20, '#8a5420'], [220, 70, 20, 20, '#8a5420'],
  [120, 90, 20, 40, '#8a5420'], [220, 90, 20, 40, '#8a5420'],
  [100, 90, 44, 44, '#e8584c'], [112, 78, 20, 12, '#6ab058'], [120, 102, 12, 12, '#f47a6e'],
  [230, 96, 56, 34, '#e0a85c'], [230, 96, 56, 10, '#c98a3e'],
  [80, 130, 200, 20, '#f5f0e6'],
  [100, 130, 20, 20, '#e8584c'], [160, 130, 20, 20, '#e8584c'], [220, 130, 20, 20, '#e8584c'],
  [60, 150, 240, 24, '#8a5420'],
  [80, 174, 200, 120, '#b5742e'], [80, 174, 200, 16, '#8a5420'], [80, 278, 200, 16, '#8a5420'],
  [96, 202, 20, 20, '#d89a4f'], [136, 202, 20, 20, '#d89a4f'], [176, 202, 20, 20, '#d89a4f'],
  [216, 202, 20, 20, '#d89a4f'], [256, 202, 20, 20, '#d89a4f'],
  [116, 238, 20, 20, '#d89a4f'], [156, 238, 20, 20, '#d89a4f'], [196, 238, 20, 20, '#d89a4f'],
  [236, 238, 20, 20, '#d89a4f'], [96, 238, 20, 20, '#d89a4f'],
];
function renderBasketPixels(prefix) {
  return BASKET_PIXELS.map((p, i) => (
    <rect key={prefix + i} x={p[0]} y={p[1]} width={p[2]} height={p[3]} fill={p[4]} />
  ));
}

function BasketMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 360 360" role="img" aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}>
      <g shapeRendering="crispEdges">
        {renderBasketPixels('bm')}
      </g>
    </svg>
  );
}

// The basket inside a soft rounded tile, cropped + centred so the pixel
// art reads as one contained mark that locks up cleanly with the wordmark.
function BasketTile({ size = 30 }) {
  return (
    <span className="pv-logo__tile" style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}>
      <svg width="100%" height="100%" viewBox="44 34 258 276" preserveAspectRatio="xMidYMid meet"
        role="img" aria-hidden="true" style={{ display: 'block' }}>
        <g shapeRendering="crispEdges">{renderBasketPixels('bt')}</g>
      </svg>
    </span>
  );
}

/* ============================================================
   PicnicScene — 8-bit picnic cover art (matches the basket logo)
   A pixel landscape painted as crisp-edges blocks on a 32×16
   grid (viewBox 192×96, unit U=6). Sky + pixel sun + clouds +
   rolling grass + a red-gingham blanket laid with a basket,
   sandwich, apple, lemonade and a wandering ant. Only the sky
   + grass swap per `variant`; the picnic spread stays constant
   so every screen reads as the same picnic.
   `slot` anchors the slice: 'wide' bottom-anchors (keeps the
   spread) for short/wide banners; 'card' centres it.
   ============================================================ */
const PICNIC_SKIES = {
  sunset: { top: '#ffd58a', mid: '#ff9d6b', low: '#f1633f', grass: '#52b271', grassDark: '#3f9e63' },
  sea:    { top: '#bfe3ec', mid: '#6db7cd', low: '#2e7e9a', grass: '#52b271', grassDark: '#3f9e63' },
  grove:  { top: '#d8eebf', mid: '#8fce86', low: '#3f9e63', grass: '#3f9e63', grassDark: '#2f7d4d' },
  berry:  { top: '#f6cfe0', mid: '#e08ab0', low: '#c75b8b', grass: '#52b271', grassDark: '#3f9e63' },
};
let __ginghamSeq = 0;

function PicnicScene({ variant = 'sunset', slot = 'card', className = '', style }) {
  const sky = PICNIC_SKIES[variant] || PICNIC_SKIES.sunset;
  const gid = React.useMemo(() => 'pv-gingham-' + (++__ginghamSeq), []);

  // Coarse grid (each cell 8px), big legible pixels. The grid widens for
  // `wide` banners so the SAME composition — sky, sun, grass, gingham
  // blanket and one centred basket — fills short/wide covers without the
  // square scene being zoom-cropped into a giant basket.
  const W = slot === 'wide' ? 48 : 24;     // columns
  const cx = W / 2;                         // basket centre column
  // sun column. Wide banners are sliced (preserveAspectRatio slice) on narrow
  // mobile covers, which crops the right edge — so pull the sun inward there
  // so it stays inside the visible window.
  const sx = slot === 'wide' ? W - 16 : W - 5;

  // [col, row, wCells, hCells, fill]
  const back = [
    // sky bands (full width)
    [0, 0, W, 2, sky.top], [0, 2, W, 1, sky.mid], [0, 3, W, 1, sky.low],
    // big pixel sun (top-right)
    [sx + 1, 0, 3, 1, '#ffe7a3'],
    [sx, 1, 5, 1, '#ffce80'],
    [sx, 2, 5, 1, '#ffba63'],
    [sx + 1, 3, 3, 1, '#ff9e48'],
    // one simple cloud
    [3, 1, 4, 1, '#fff6e6'], [2, 2, 5, 1, '#fff6e6'],
    // rolling grass horizon
    [0, 4, W, 1, sky.grass], [4, 3, 6, 1, sky.grass],
    [0, 5, W, 1, sky.grassDark],
  ];

  // One clear hero basket (the logo basket), centred big on the blanket.
  // Embedded as a nested SVG so it scales from the logo's 360-grid art.
  const bh = 60;                         // basket box height in scene units
  const bw = Math.round(bh * 240 / 252); // keep the basket's aspect
  const bx = (W * 8) / 2 - bw / 2;       // centre horizontally
  const by = (96 - bh) / 2;              // centred vertically on the cover

  const R = (c, r, w, h, fill, i) => (
    <rect key={i} x={c * 8} y={r * 8} width={w * 8} height={h * 8} fill={fill} />
  );

  return (
    <svg className={'pv-pixscene ' + className} viewBox={`0 0 ${W * 8} 96`}
      preserveAspectRatio="xMidYMid slice"
      style={style} role="img" aria-hidden="true">
      <defs>
        <pattern id={gid} width="32" height="32" patternUnits="userSpaceOnUse">
          <rect width="32" height="32" fill="#fbe6c4" />
          <rect width="16" height="32" fill="rgba(220,86,68,0.5)" />
          <rect width="32" height="16" fill="rgba(220,86,68,0.5)" />
        </pattern>
      </defs>
      <g shapeRendering="crispEdges">
        {back.map((c, i) => R(c[0], c[1], c[2], c[3], c[4], 'b' + i))}
        {/* gingham blanket (rows 6–12) */}
        <rect x="0" y="48" width={W * 8} height="48" fill={`url(#${gid})`} />
        <rect x="0" y="48" width={W * 8} height="3" fill="rgba(255,247,225,0.5)" />
        {/* big logo basket */}
        <svg x={bx} y={by} width={bw} height={bh} viewBox="60 46 240 252" overflow="visible">
          <g shapeRendering="crispEdges">{renderBasketPixels('sc')}</g>
        </svg>
      </g>
    </svg>
  );
}

function Logo({ size = 17 }) {
  return (
    <span className="pv-logo" style={{ fontSize: size }}>
      <BasketTile size={Math.round(size * 1.62)} />
      <span className="pv-logo__word">Picnivo</span>
    </span>
  );
}

function Avatar({ name, size = 34 }) {
  return (
    <span className="pv-avatar" style={{ width: size, height: size, background: pvColorFor(name), fontSize: size * 0.38 }}>
      {pvInitials(name)}
    </span>
  );
}

function AvatarStack({ names, max = 5, size = 30 }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <div className="pv-avatar-stack">
      {shown.map((n) => <Avatar key={n} name={n} size={size} />)}
      {extra > 0 && (
        <span className="pv-avatar" style={{ width: size, height: size, background: 'var(--ink-soft)', fontSize: size * 0.34, marginLeft: -9 }}>
          +{extra}
        </span>
      )}
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <button className="pv-back" onClick={onClick} aria-label="Back">
      <svg viewBox="0 0 16 16" fill="none">
        <path d="M10 3L5 8l5 5" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function Button({ variant = 'primary', block, size, children, style, ...rest }) {
  const cls = ['pv-btn', `pv-btn--${variant}`, block && 'pv-btn--block', size === 'sm' && 'pv-btn--sm'].filter(Boolean).join(' ');
  return <button className={cls} style={style} {...rest}>{children}</button>;
}

// small icon set (simple strokes only)
const Icon = {
  check: (c = 'currentColor', w = 18) => (
    <svg width={w} height={w} viewBox="0 0 20 20" fill="none"><path d="M4 10.5l4 4 8-9" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  plus: (c = 'currentColor', w = 18) => (
    <svg width={w} height={w} viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke={c} strokeWidth="2.2" strokeLinecap="round" /></svg>
  ),
  close: (c = 'currentColor', w = 16) => (
    <svg width={w} height={w} viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke={c} strokeWidth="2.2" strokeLinecap="round" /></svg>
  ),
  link: (c = 'currentColor', w = 18) => (
    <svg width={w} height={w} viewBox="0 0 20 20" fill="none"><path d="M8 12l4-4M7.5 6.5l1-1a3.5 3.5 0 015 5l-1 1M12.5 13.5l-1 1a3.5 3.5 0 01-5-5l1-1" stroke={c} strokeWidth="1.8" strokeLinecap="round" /></svg>
  ),
  copy: (c = 'currentColor', w = 18) => (
    <svg width={w} height={w} viewBox="0 0 20 20" fill="none"><rect x="7" y="7" width="9" height="9" rx="2" stroke={c} strokeWidth="1.8" /><path d="M4 12V5a1 1 0 011-1h7" stroke={c} strokeWidth="1.8" strokeLinecap="round" /></svg>
  ),
  pin: (c = 'currentColor', w = 16) => (
    <svg width={w} height={w} viewBox="0 0 20 20" fill="none"><path d="M10 18s6-5.3 6-10a6 6 0 10-12 0c0 4.7 6 10 6 10z" stroke={c} strokeWidth="1.7" strokeLinejoin="round" /><circle cx="10" cy="8" r="2" stroke={c} strokeWidth="1.7" /></svg>
  ),
  clock: (c = 'currentColor', w = 16) => (
    <svg width={w} height={w} viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke={c} strokeWidth="1.7" /><path d="M10 6v4.5l3 2" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  share: (c = 'currentColor', w = 18) => (
    <svg width={w} height={w} viewBox="0 0 20 20" fill="none"><path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 11v4a2 2 0 002 2h6a2 2 0 002-2v-4" stroke={c} strokeWidth="1.8" strokeLinecap="round" /></svg>
  ),
  hand: (c = 'currentColor', w = 16) => (
    <svg width={w} height={w} viewBox="0 0 20 20" fill="none"><path d="M7 9V4.5a1.3 1.3 0 012.6 0V9m0-3.5a1.3 1.3 0 012.6 0V9m0-2a1.3 1.3 0 012.6 0v5a4.5 4.5 0 01-4.5 4.5h-1A4.6 4.6 0 015.6 13l-1-2.2a1.3 1.3 0 012.2-1.3L7.4 10" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  spark: (c = 'currentColor', w = 16) => (
    <svg width={w} height={w} viewBox="0 0 20 20" fill="none"><path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6L10 3z" fill={c} /></svg>
  ),
  calendar: (c = 'currentColor', w = 18) => (
    <svg width={w} height={w} viewBox="0 0 20 20" fill="none"><rect x="3.5" y="4.5" width="13" height="12" rx="2" stroke={c} strokeWidth="1.7" /><path d="M3.5 8h13M7 3v3M13 3v3" stroke={c} strokeWidth="1.7" strokeLinecap="round" /></svg>
  ),
  lock: (c = 'currentColor', w = 16) => (
    <svg width={w} height={w} viewBox="0 0 20 20" fill="none"><rect x="4.5" y="9" width="11" height="8" rx="2" stroke={c} strokeWidth="1.7" /><path d="M7 9V6.5a3 3 0 016 0V9" stroke={c} strokeWidth="1.7" strokeLinecap="round" /></svg>
  ),
  signout: (c = 'currentColor', w = 16) => (
    <svg width={w} height={w} viewBox="0 0 20 20" fill="none"><path d="M8 16H5a1.5 1.5 0 01-1.5-1.5v-9A1.5 1.5 0 015 4h3M13 13l3-3-3-3M16 10H8" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
};

// ---------------------------------------------------------------
// Vote glyphs (warm semantic)
// ---------------------------------------------------------------
const VOTE_META = {
  yes:   { label: 'Yes',   color: 'var(--yes)',   tint: 'var(--yes-tint)',   emoji: '🙌' },
  maybe: { label: 'Maybe', color: 'var(--maybe)', tint: 'var(--maybe-tint)', emoji: '🤔' },
  no:    { label: 'No',    color: 'var(--no)',    tint: 'var(--no-tint)',    emoji: '🙅' },
};

function VoteGlyph({ kind, size = 16, color = '#fff' }) {
  if (kind === 'yes') return Icon.check(color, size);
  if (kind === 'maybe') return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="6.4" stroke={color} strokeWidth="2.2" /></svg>
  );
  return Icon.close(color, size);
}

// ---------------------------------------------------------------
// Toast hook
// ---------------------------------------------------------------
function useToast() {
  const [toast, setToast] = useState(null);
  const tRef = useRef();
  function show(msg) {
    setToast(msg);
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToast(null), 1900);
  }
  const node = toast ? (
    <div className="pv-toast" key={toast}>
      {Icon.check('#fff', 16)} {toast}
    </div>
  ) : null;
  return [node, show];
}

Object.assign(window, {
  PV_COLORS, pvColorFor, pvInitials, makeSeedEvent, pvTally, pvBestDate,
  Sun, Logo, PicnicScene, Avatar, AvatarStack, BackButton, Button, Icon, VOTE_META, VoteGlyph, useToast,
});
