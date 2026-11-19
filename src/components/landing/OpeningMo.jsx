// The home page's opening (LK74; redrawn 17 Nov 2026 for LK299: "grand ... with even some animation falling through it
// ... merge it into the MockMob logo at the top and animate the logo a little bit"). A server component: it renders the
// inline gate script and the layer, and nothing of it waits for React.
//
// The picture: MockMob's own answer sheet. The wordmark (logo B, min(88vw, 960px)) stands on the page's own ground
// (Day paper with ink letters, Night charcoal with warm-white letters, both with the page's hairline grid), and answer
// bubbles, answer rows and question tiles hang in the air around it at three depths. That first pose is whole on its
// own: the layer holds it until the browser reports the first paint (openingGate.mjs), then, from the release:
//
// A first-ever visit:
//   0       the bubbles fall, far ones slow and faint behind the word, near ones large in front of it
//   140     one bubble drops from the top of the screen toward Mobi's empty answer-bubble eye; he looks up at it
//   500     it lands in the eye and inks it; Mobi gives under it and springs back (200 ms)
//   700     hand-off (the page is usable): the ground rises like a curtain (500 ms) while the word FLIPs onto the bar
//           logo; the bubbles still in the air fall on over the page and fade
//   1200    the word lands: it is the bar logo now (the same drawing in the same colours, a one-frame swap)
//   1200    the bar logo settles (opening.css, 300 ms): the last bubble drops in as its volt dot, Mobi blinks and hops
//   1500    still.
// Every new session after that, the same picture at a quicker pace: the eye is already inked and Mobi blinks as the
// first bubble passes (120 ms); hand-off at 720, the word lands at 1,100, still by 1,400 (lengthened 19 Nov 2026, owner LK326). Later in the same session it
// does not play. The beats are custom properties per mode in opening.css.
//
// When it plays at all is openingGate.mjs (first / short / skip). Placed by page.js as the first child of `.mm.lp`.
// The layer is aria-hidden, never focusable and never takes pointer input; any input skips straight to the hand-off.
// It holds no text and no image (it can never be the largest paint), and every volt mark is a fill in this file, not a
// colour in opening.css.

import '@/app/opening.css';
import { LOGO_B_COLORS, LOGO_B_LETTERS, LOGO_B_MOBI } from '@/components/brand/logoB';
import { LOGO_MOBI_PARTS, LOGO_OPEN_BOX, LOGO_OPEN_VIEWBOX } from '@/components/brand/logoLetters.mjs';
import { openingGateScript } from './openingGate.mjs';

const pct = (f) => `${Math.round(f * 1e5) / 1e3}%`;
const origin = ([x, y]) => `${pct(x)} ${pct(y)}`;
// Mobi's feet, as a fraction of the word's box: he gives and springs back about them.
const MOBI_FEET = [((LOGO_MOBI_PARTS.ink[0] + LOGO_MOBI_PARTS.ink[2]) / 2 - LOGO_OPEN_BOX.x) / LOGO_OPEN_BOX.w, 1];
// The tick's rim on Day paper (DESIGN.md, the No-Slab Rule): volt never sits bare on cream.
const VOLT_RIM = 'rgba(82, 103, 0, 0.55)';

function Part({ className, children, style }) {
  return (
    <svg className={`mo-part ${className}`} viewBox={LOGO_OPEN_VIEWBOX} preserveAspectRatio="xMidYMid meet" focusable="false" style={style}>
      {children}
    </svg>
  );
}

// ---- the falling pieces: one small SVG each, no text ----
// kind: 'ring' an empty answer bubble, 'ink' one marked volt, 'dark' one filled in pencil, 'row' a row of four with one
// marked, 'tile' a question tile (two lines and its four bubbles).
const SHAPES = {
  ring: { box: [24, 24], draw: () => <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" /> },
  ink: { box: [24, 24], draw: () => <circle cx="12" cy="12" r="10.25" fill={LOGO_B_COLORS.volt} stroke={VOLT_RIM} strokeWidth="1.5" /> },
  dark: { box: [24, 24], draw: () => <circle cx="12" cy="12" r="11" fill="currentColor" /> },
  row: {
    box: [108, 34],
    draw: (mark = 2) => (
      <>
        <rect className="mo-p__card" x="1" y="1" width="106" height="32" rx="16" />
        {[0, 1, 2, 3].map((i) => (i === mark
          ? <circle key={i} cx={21 + i * 22} cy="17" r="8" fill={LOGO_B_COLORS.volt} stroke={VOLT_RIM} strokeWidth="1.5" />
          : <circle key={i} cx={21 + i * 22} cy="17" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.7" />))}
      </>
    ),
  },
  tile: {
    box: [100, 68],
    draw: (mark = 1) => (
      <>
        <rect className="mo-p__card" x="1" y="1" width="98" height="66" rx="13" />
        <rect x="14" y="14" width="50" height="6" rx="3" fill="currentColor" opacity="0.26" />
        <rect x="14" y="26" width="32" height="6" rx="3" fill="currentColor" opacity="0.14" />
        {[0, 1, 2, 3].map((i) => (i === mark
          ? <circle key={i} cx={21 + i * 19.5} cy="49" r="6.5" fill={LOGO_B_COLORS.volt} stroke={VOLT_RIM} strokeWidth="1.4" />
          : <circle key={i} cx={21 + i * 19.5} cy="49" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />))}
      </>
    ),
  },
};

// Each piece: [kind, depth (0 far, 1 mid, 2 near), x % of the width, y % of the height (where it hangs in the first
// pose; negative: above the screen, it falls in later), width px on a phone (1.5x from 900 px wide), start ms, tilt deg,
// spin deg over the fall, mark (which bubble is inked), wide (drawn from 900 px wide only)].
// The first pose keeps the word's own band (38 to 50 % of the height) clear; pieces only cross it once they fall.
const P = (kind, depth, x, y, size, at, tilt = 0, spin = 0, mark, wide = false) => ({ kind, depth, x, y, size, at, tilt, spin, mark, wide });
const PIECES = [
  // in the air above the word
  P('row', 1, 7, 8, 96, 60, -8, -3, 2),
  P('ring', 0, 71, 5, 13, 150, 0, 0),
  P('ink', 1, 83, 14.5, 22, 110, 0, 0),
  P('tile', 2, 52, 18, 100, 40, 7, 12, 1),
  P('ring', 1, 29, 25, 26, 90, 0, 0),
  P('ring', 0, 13, 31.5, 12, 170, 0, 0),
  P('dark', 0, 91, 33, 10, 130, 0, 0),
  // below it
  P('ring', 2, 75, 54.5, 34, 0, 0, 0),
  P('row', 1, 9, 60, 88, 20, 10, 16, 0),
  P('ink', 0, 47, 66, 12, 80, 0, 0),
  P('ring', 1, 62, 73.5, 20, 30, 0, 0),
  P('tile', 2, 5, 80, 92, 0, -6, -13, 2),
  P('ring', 0, 86, 85, 14, 60, 0, 0),
  // above the screen: these fall in as the first ones leave
  P('ring', 1, 19, -9, 24, 150, 0, 0),
  P('row', 2, 37, -15, 108, 190, -5, 6, 3),
  P('ring', 0, 51, -7, 12, 120, 0, 0),
  P('ink', 2, 69, -24, 30, 260, 0, 0),
  // a wide screen has more air to fill
  P('ring', 1, 38, 9, 22, 100, 0, 0, undefined, true),
  P('tile', 1, 89, 46, 62, 30, -9, -15, 3, true),
  P('ring', 2, 2.5, 43, 30, 50, 0, 0, undefined, true),
  P('ink', 0, 24, 58, 11, 140, 0, 0, undefined, true),
  P('row', 0, 66, 88, 58, 0, 6, 9, 1, true),
  P('ring', 0, 35, 79, 13, 90, 0, 0, undefined, true),
  P('dark', 1, 95.5, 70, 12, 20, 0, 0, undefined, true),
  P('row', 1, 82, -12, 80, 210, 9, 2, 2, true),
  P('ring', 2, 7, -20, 32, 230, 0, 0, undefined, true),
  P('ink', 1, 44, -18, 18, 170, 0, 0, undefined, true),
];
// A full-height fall takes this long at each depth (near pieces pass faster); a shorter fall takes its square root's
// share, as a dropped thing does. opening.css scales both the start and the length by the mode's pace.
const FULL_FALL = [900, 720, 600];
const fallMs = (p) => Math.round(FULL_FALL[p.depth] * Math.sqrt((112 - p.y) / 112));

function Piece({ p }) {
  const shape = SHAPES[p.kind];
  const [w, h] = shape.box;
  const style = { '--x': `${p.x}%`, '--y': `${p.y}%`, '--s': p.size, '--fall': `${Math.round((112 - p.y) * 10) / 10}vh`, '--at': `${p.at}ms`, '--dur': `${fallMs(p)}ms`, '--tilt': `${p.tilt}deg`, '--spin': `${p.tilt + p.spin}deg` };
  return (
    <svg className={`mo-p mo-p--d${p.depth}${p.wide ? ' mo-p--wide' : ''}`} viewBox={`0 0 ${w} ${h}`} focusable="false" style={style}>
      {shape.draw(p.mark)}
    </svg>
  );
}

export default function OpeningMo() {
  const ratio = LOGO_OPEN_BOX.h / LOGO_OPEN_BOX.w;
  const back = PIECES.filter((p) => p.depth < 2);
  const front = PIECES.filter((p) => p.depth === 2);
  return (
    <>
      <script id="mm-opening-gate" dangerouslySetInnerHTML={{ __html: openingGateScript() }} />
      <div className="mo-open" aria-hidden="true" style={{ '--mo-ratio': ratio.toFixed(5) }}>
        <div className="mo-open__ground" />
        <div className="mo-rain mo-rain--back">
          {back.map((p, i) => <Piece key={i} p={p} />)}
        </div>
        <div className="mo-word">
          <Part className="mo-letters">
            <path fill="currentColor" d={LOGO_B_LETTERS} />
          </Part>
          <div className="mo-mobi" style={{ '--feet': origin(MOBI_FEET) }}>
            <Part className="mo-mobi__body">
              <path fill={LOGO_B_COLORS.volt} d={LOGO_B_MOBI.small.body} />
            </Part>
            <Part className="mo-mobi__body mo-mobi__body--full">
              <path fill={LOGO_B_COLORS.volt} d={LOGO_B_MOBI.full.body} />
            </Part>
            <Part className="mo-mobi__visor">
              <path fill={LOGO_B_COLORS.charcoal} d={LOGO_B_MOBI.small.visor} />
            </Part>
            <div className="mo-eyes" style={{ '--eyes': origin(LOGO_MOBI_PARTS.eyesOrigin) }}>
              <div className="mo-eyes__lid">
                <Part className="mo-eyes__full">
                  <path fill={LOGO_B_COLORS.warmWhite} d={LOGO_MOBI_PARTS.eyeLeftFull} />
                  <path fill={LOGO_B_COLORS.warmWhite} fillRule="evenodd" d={LOGO_MOBI_PARTS.eyeRightRing} />
                </Part>
                <Part className="mo-eyes__ink" style={{ '--ink': origin(LOGO_MOBI_PARTS.inkOrigin) }}>
                  <path fill={LOGO_B_COLORS.warmWhite} d={LOGO_MOBI_PARTS.eyeRightInked} />
                </Part>
                <Part className="mo-eyes__small">
                  <path fill={LOGO_B_COLORS.warmWhite} fillRule="evenodd" d={LOGO_B_MOBI.small.eyes} />
                </Part>
              </div>
            </div>
          </div>
          {/* The bubble that inks Mobi's eye (a first visit only): the eye's own oval, round and larger while it falls. */}
          <Part className="mo-drop" style={{ '--ink': origin(LOGO_MOBI_PARTS.inkOrigin) }}>
            <path fill={LOGO_B_COLORS.warmWhite} stroke="currentColor" strokeWidth="7" d={LOGO_MOBI_PARTS.eyeRightInked} />
          </Part>
        </div>
        <div className="mo-rain mo-rain--front">
          {front.map((p, i) => <Piece key={i} p={p} />)}
        </div>
      </div>
    </>
  );
}
