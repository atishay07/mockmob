// The phone hero's study (V16, D191): the app's welcome room, drawn in SVG so it costs no image request and no font.
// Night: a lamp-lit study, a warm cone from a pendant lamp top right, shelves and a city window in the dark, a dotted
// answer sheet on the wall. Day: the same room by day, a cream wall and a sunlight shaft from the window, the lamp off.
// Colours come from hero-scene.css (theme tokens), so one drawing serves both themes. Mobi stands in the light as the
// page's own hero seat (MascotSeat, page.js); this layer is decoration only and shows on phones only (max-width 760 px).
//
// The viewBox is wider than a phone (600 x 380): the scene is cut to the phone's width around its centre (xMidYMax
// slice), so a wider phone or a phone held sideways sees more room, never a stretched one.

// The answer sheet: 5 across, 7 down. 1 marks a filled bubble (Night: a few, as the app's sheet; Day fills more).
const SHEET = [
  [1, 1, 0, 0, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 0, 1, 0],
  [0, 1, 0, 0, 0],
  [0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0],
  [0, 0, 1, 0, 0],
];
const DAY_EXTRA = new Set(['0-2', '1-0', '1-4', '2-1', '3-3', '4-2', '5-3', '6-4', '2-4', '0-4', '4-0', '6-1']);

// Books on the two shelf planks: [x, width, height, tone, lean in degrees].
const BOOKS_TOP = [[216, 8, 38, 1, 0], [225, 10, 44, 2, 0], [236, 7, 35, 3, 0], [244, 9, 41, 1, 0], [256, 8, 33, 4, -16]];
const BOOKS_LOW = [[216, 11, 34, 3, 0], [228, 8, 40, 4, 0], [237, 10, 36, 2, 0], [262, 16, 10, 1, 0], [263, 14, 9, 3, 0]];
const BOOKS_FAR = [[40, 8, 36, 2, 0], [49, 7, 30, 4, 0], [57, 9, 38, 1, 0], [68, 7, 33, 3, 0]];

function Books({ books, base }) {
  return books.map(([x, w, h, tone, lean], i) => {
    // Two flat books stack on the low shelf; the others stand on the plank.
    const y = w > h ? base - h * (i - 2) : base - h;
    return <rect key={`${x}-${i}`} className={`sc-book sc-book--${tone}`} x={x} y={y} width={w} height={h} rx="1" transform={lean ? `rotate(${lean} ${x + w} ${base})` : undefined} />;
  });
}

export function HeroScene() {
  return (
    <div className="lp-scene" aria-hidden="true">
      <svg className="lp-scene__art" viewBox="0 0 600 380" preserveAspectRatio="xMidYMax slice" focusable="false">
        <defs>
          <linearGradient id="sc-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="sc-stop-wall-a" />
            <stop offset="1" className="sc-stop-wall-b" />
          </linearGradient>
          <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="sc-stop-sky-a" />
            <stop offset="1" className="sc-stop-sky-b" />
          </linearGradient>
          <linearGradient id="sc-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="sc-stop-floor-a" />
            <stop offset="1" className="sc-stop-floor-b" />
          </linearGradient>
          <linearGradient id="sc-cone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="sc-stop-cone-a" />
            <stop offset="0.55" className="sc-stop-cone-b" />
            <stop offset="1" className="sc-stop-cone-c" />
          </linearGradient>
          <linearGradient id="sc-shaft" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="sc-stop-shaft-a" />
            <stop offset="1" className="sc-stop-shaft-b" />
          </linearGradient>
          <radialGradient id="sc-pool" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" className="sc-stop-pool-a" />
            <stop offset="0.6" className="sc-stop-pool-b" />
            <stop offset="1" className="sc-stop-pool-c" />
          </radialGradient>
          <radialGradient id="sc-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" className="sc-stop-glow-a" />
            <stop offset="1" className="sc-stop-glow-b" />
          </radialGradient>
          <clipPath id="sc-win">
            <path d="M115 262V104a44 44 0 0 1 88 0v158z" />
          </clipPath>
        </defs>

        {/* The room */}
        <rect className="sc-wall" width="600" height="380" fill="url(#sc-wall)" />

        {/* A tall shelf at the far left, seen only on wider phones */}
        <g className="sc-wood">
          <rect x="32" y="40" width="4" height="278" />
          <rect x="32" y="118" width="58" height="4" />
          <rect x="32" y="196" width="58" height="4" />
        </g>
        <Books books={BOOKS_FAR} base={118} />
        <Books books={BOOKS_FAR.map(([x, w, h, t]) => [x + 2, w, h - 4, (t % 4) + 1, 0])} base={196} />

        {/* The window: the city at night, the hills by day */}
        <g clipPath="url(#sc-win)">
          <rect x="110" y="56" width="100" height="210" fill="url(#sc-sky)" />
          <g className="sc-night-only">
            <circle className="sc-moon" cx="140" cy="94" r="10" />
            <circle className="sc-moon-cut" cx="145" cy="90" r="9" />
            <circle className="sc-star" cx="176" cy="82" r="0.9" />
            <circle className="sc-star" cx="190" cy="118" r="0.7" />
            <circle className="sc-star" cx="126" cy="130" r="0.7" />
            <path className="sc-city" d="M110 266v-52h14v-14h12v26h10v-40h16v30h8v-18h14v24h10v-10h10v54z" />
            <g className="sc-litwin">
              <rect x="150" y="182" width="3" height="4" />
              <rect x="156" y="196" width="3" height="4" />
              <rect x="115" y="222" width="3" height="4" />
              <rect x="178" y="212" width="3" height="4" />
              <rect x="138" y="232" width="3" height="4" />
              <rect x="196" y="236" width="3" height="4" />
            </g>
          </g>
          <g className="sc-day-only">
            <path className="sc-hill-far" d="M110 222c22-14 44-18 66-12s30 4 34 2v54H110z" />
            <path className="sc-hill-near" d="M110 240c30-6 58-2 100-16v42H110z" />
            <path className="sc-house" d="M168 222v-11l7-6 7 6v11z" />
          </g>
        </g>
        <g className="sc-frame">
          <path d="M115 262V104a44 44 0 0 1 88 0v158" fill="none" strokeWidth="6" />
          <path d="M159 61v201M115 150h88M115 206h88" fill="none" strokeWidth="3" />
          <rect x="106" y="261" width="106" height="7" rx="1.5" />
        </g>

        {/* A plant on the floor under the window */}
        <g className="sc-plant">
          <path d="M98 318h26l-4-20h-18z" className="sc-pot" />
          <path d="M111 299c-6-16-20-22-30-22 6 8 14 18 30 22z" />
          <path d="M111 299c2-18 10-30 22-34-2 12-8 26-22 34z" />
          <path d="M111 299c-2-14-8-24-16-30 0 12 6 22 16 30z" />
        </g>

        {/* The shelves by the window */}
        <g className="sc-wood">
          <rect x="210" y="196" width="80" height="5" rx="1" />
          <rect x="210" y="258" width="80" height="5" rx="1" />
        </g>
        <Books books={BOOKS_TOP} base={196} />
        <Books books={BOOKS_LOW} base={258} />

        {/* The answer sheet, pinned to the wall */}
        <g className="sc-sheet" transform="rotate(2.5 444 186)">
          <rect className="sc-paper" x="404" y="132" width="82" height="108" rx="2" />
          <circle className="sc-pin" cx="445" cy="137" r="2.6" />
          {SHEET.map((row, r) => row.map((on, c) => {
            const day = DAY_EXTRA.has(`${r}-${c}`);
            const cls = on ? 'sc-dot sc-dot--on' : day ? 'sc-dot sc-dot--day' : 'sc-dot';
            return <circle key={`${r}-${c}`} className={cls} cx={417 + c * 14} cy={152 + r * 13} r="4" />;
          }))}
        </g>

        {/* The floor, the desk's edge and the light on them */}
        <rect className="sc-floor" x="0" y="318" width="600" height="62" fill="url(#sc-floor)" />
        <rect className="sc-edge" x="0" y="317" width="600" height="1.5" />

        {/* The light: the lamp's cone at night, the sun through the window by day. It comes on first (hero-scene.css). */}
        <g className="sc-light">
          <path className="sc-day-only" d="M150 64h56l272 266H262z" fill="url(#sc-shaft)" />
          <g className="sc-night-only">
            <path d="M372 80h40l92 250H150z" fill="url(#sc-cone)" opacity="0.55" />
            <path d="M378 80h28l44 250H196z" fill="url(#sc-cone)" />
            <circle cx="392" cy="82" r="46" fill="url(#sc-glow)" />
          </g>
          <ellipse cx="308" cy="338" rx="150" ry="24" fill="url(#sc-pool)" />
        </g>

        {/* The pendant lamp */}
        <g className="sc-lamp">
          <path className="sc-cord" d="M392 -2v58" fill="none" strokeWidth="1.5" />
          <rect className="sc-shade" x="386" y="52" width="12" height="6" rx="1.5" />
          <path className="sc-shade" d="M378 58h28l12 22h-52z" />
          <ellipse className="sc-bulb" cx="392" cy="80" rx="20" ry="3.2" />
        </g>
      </svg>
    </div>
  );
}
