// The home page's opening (LK74, SPEC-HOME-1104 decisions 1 and 6): the Play app's own "mo" opening
// (flutter_app/lib/core/widgets/brand/brand_opening.dart, OpeningTimeline), ported to CSS. A server component: it renders
// the inline gate script and the layer, and nothing of it waits for React.
//
//   0       the "mo" (the m and Mobi) centred at 2.2x, the other letters folded shut on their hinges
//   150     Mobi blinks (160 ms)
//   320     the empty answer-bubble right eye inks from its centre (200 ms)
//   500     the camera pulls back to the whole word (500 ms, log-scale zoom, cubic-bezier(.5,0,.15,1))
//   520     "mock" unfolds leftwards from the m and the b rightwards from Mobi, nearest first, 40 ms apart, each 300 ms
//   860     Mobi glances toward the word; the volt dot comes in (scale .6 to 1, 160 ms): the last beat of the unfold
//   1000    the composed word: logo B and its dot, exactly the bar logo (Logo.jsx's viewBox)
//   1000    hand-off: the word FLIPs onto the bar logo (280 ms) while the ground fades and lifts 4vh; the hero has been
//           painted underneath since 0 (the h1 is the LCP)
//   1280    gone (visibility hidden, then display none). A first-ever visit holds the word 320 ms more (a 3 % breath,
//           a glance back and a blink): 1,600 ms in all.
//
// When it plays at all is openingGate.mjs (first / short / skip). Placed by page.js as the first child of `.mm.lp`.
// The layer is aria-hidden and never focusable; it takes pointer input only until the hand-off starts, and any input
// skips straight to the hand-off.

import '@/app/opening.css';
import { LOGO_B_COLORS, LOGO_B_MOBI } from '@/components/brand/logoB';
import { LOGO_DOT, LOGO_DOT_ORIGIN, LOGO_LETTER_PARTS, LOGO_MO, LOGO_MOBI_INDEX, LOGO_MOBI_PARTS, LOGO_OPEN_BOX, LOGO_OPEN_VIEWBOX, LOGO_UNFOLD } from '@/components/brand/logoLetters.mjs';
import { openingGateScript } from './openingGate.mjs';

const pct = (f) => `${Math.round(f * 1e5) / 1e3}%`;
const origin = ([x, y]) => `${pct(x)} ${pct(y)}`;
const byIndex = new Map(LOGO_LETTER_PARTS.map((l) => [l.index, l]));
const LEFT = LOGO_UNFOLD.filter((u) => u.side === 'left');
const RIGHT = LOGO_UNFOLD.filter((u) => u.side === 'right');

function Part({ className, children, style }) {
  return (
    <svg className={`mo-part ${className}`} viewBox={LOGO_OPEN_VIEWBOX} preserveAspectRatio="xMidYMid meet" focusable="false" style={style}>
      {children}
    </svg>
  );
}

function Letter({ u }) {
  const letter = byIndex.get(u.index);
  return (
    <Part className={`mo-l mo-l--${u.side}`} style={{ '--hinge': pct(u.hinge), '--k': u.k }}>
      <path fill={LOGO_B_COLORS.warmWhite} d={letter.d} />
    </Part>
  );
}

// "mock" leftwards: each letter scales about its hinge and rides on the slides of every slot between it and the "mo"
// (nested, one slide per slot, so a letter is only ever narrowed, never cut; brand_opening.dart poseAt).
function LeftFold({ at = 0 }) {
  const u = LEFT[at];
  if (!u) return null;
  return (
    <>
      <Letter u={u} />
      {LEFT[at + 1] ? (
        <div className="mo-slide" style={{ '--slot': pct(u.slot), '--k': u.k }}>
          <LeftFold at={at + 1} />
        </div>
      ) : null}
    </>
  );
}

export default function OpeningMo() {
  const m = byIndex.get(LOGO_MOBI_INDEX - 1);
  const ratio = LOGO_OPEN_BOX.h / LOGO_OPEN_BOX.w;
  return (
    <>
      <script id="mm-opening-gate" dangerouslySetInnerHTML={{ __html: openingGateScript() }} />
      <div className="mo-open" aria-hidden="true" style={{ '--mo-ratio': ratio.toFixed(5) }}>
        <div className="mo-open__ground" />
        <div className="mo-word">
          <div className="mo-breath">
            <div className="mo-cam" style={{ '--mo-dx': pct(-LOGO_MO.dx), '--mo-dy': pct(-LOGO_MO.dy) }}>
              <LeftFold />
              <Part className="mo-m">
                <path fill={LOGO_B_COLORS.warmWhite} d={m.d} />
              </Part>
              <div className="mo-mobi">
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
              {RIGHT.map((u) => <Letter key={u.index} u={u} />)}
              <Part className="mo-dot" style={{ '--dot': origin(LOGO_DOT_ORIGIN) }}>
                <circle fill={LOGO_B_COLORS.volt} cx={LOGO_DOT.cx} cy={LOGO_DOT.cy} r={LOGO_DOT.r} />
              </Part>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
