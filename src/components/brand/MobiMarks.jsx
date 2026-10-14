// The small drawn marks around Mobi: what he is doing, said in a shape. Plain SVG in a 100 x 100
// box the height of the art (the art is centred, a little narrower than the box). Every mark is
// transform or opacity only, so the whole thing runs on the compositor. The CSS is in
// src/app/motion-kit.css under .mobi-react.

const STAR = 'M0 -5 C0.9 -1.6 1.6 -0.9 5 0 C1.6 0.9 0.9 1.6 0 5 C-0.9 1.6 -1.6 0.9 -5 0 C-1.6 -0.9 -0.9 -1.6 0 -5Z';

// Confetti leaves the head in a fan: [dx, dy, spin, delay, kind]
const BITS = [
  [-34, -22, -160, 0, 'r'], [-24, -34, 120, 30, 's'], [-12, -42, -90, 0, 'c'], [2, -46, 200, 50, 'r'],
  [14, -42, -120, 10, 's'], [26, -34, 150, 40, 'c'], [36, -20, -200, 0, 'r'], [-40, -6, 100, 60, 'c'],
  [40, -4, -110, 30, 's'], [-18, -26, 180, 80, 'c'], [20, -24, -150, 70, 'r'], [0, -30, 90, 20, 's'],
];

const Star = ({ x, y, s = 1, delay = 0, slow = false }) => (
  <g transform={`translate(${x} ${y})`}><g className="mm-mark mm-spark" data-slow={slow || undefined} style={{ '--d': `${delay}ms`, '--s': s * 1.35 }}><path d={STAR} /></g></g>
);

export function MobiMarks({ act }) {
  let body = null;
  switch (act) {
    case 'celebrate':
      body = (
        <g transform="translate(50 30)">
          {BITS.map(([dx, dy, spin, delay, kind], i) => (
            <g key={i} className="mm-mark mm-bit" style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, '--spin': `${spin}deg`, '--d': `${delay}ms` }} data-kind={kind}>
              {kind === 'r' ? <rect x="-2.6" y="-1.4" width="5.2" height="2.8" rx="0.7" /> : kind === 's' ? <path d={STAR} transform="scale(.75)" /> : <circle r="1.9" />}
            </g>
          ))}
        </g>
      );
      break;
    case 'cheer':
      body = <><Star x={18} y={20} delay={80} /><Star x={84} y={14} s={0.8} delay={0} /><Star x={88} y={44} s={0.6} delay={160} /></>;
      break;
    case 'proud':
      body = <><Star x={22} y={14} s={0.9} delay={500} slow /><Star x={80} y={10} s={1.1} delay={680} slow /><Star x={90} y={38} s={0.7} delay={820} slow /><Star x={12} y={40} s={0.6} delay={960} slow /></>;
      break;
    case 'correct':
      body = (
        <g transform="translate(82 14)"><g className="mm-mark mm-tick">
          <circle className="mm-tick__disc" r="9.5" />
          <path className="mm-tick__path" pathLength="1" d="M-4.6 0.4 L-1.2 4 L5 -3.6" />
        </g></g>
      );
      break;
    case 'think':
      body = <g className="mm-mark mm-think"><circle cx="27" cy="14" r="1.9" /><circle cx="20" cy="7" r="2.8" /><circle cx="10" cy="-1" r="3.8" /></g>;
      break;
    case 'loading':
      body = (
        <g transform="translate(28 8) scale(1.25)"><g className="mm-mark mm-wait">
          <rect className="mm-wait__pill" x="-12" y="-5" width="24" height="10" rx="5" />
          <circle cx="-6" cy="0" r="1.7" /><circle cx="0" cy="0" r="1.7" /><circle cx="6" cy="0" r="1.7" />
        </g></g>
      );
      break;
    case 'read':
      body = (
        <g transform="translate(80 66) rotate(8)"><g className="mm-mark mm-sheet">
          <rect className="mm-sheet__paper" x="-7" y="-9" width="14" height="18" rx="1.8" />
          <path className="mm-sheet__line" pathLength="1" d="M-3.6 -4.5 H3.6" />
          <path className="mm-sheet__line" pathLength="1" d="M-3.6 -0.5 H3.6" />
          <path className="mm-sheet__line" pathLength="1" d="M-3.6 3.5 H1" />
        </g></g>
      );
      break;
    case 'oops':
      body = (
        <g transform="translate(79 15) scale(1.35)"><g className="mm-mark mm-query">
          <path d="M-3.2 -3.6 C-3.2 -7.6 3.4 -7.6 3.4 -3.4 C3.4 -0.6 0.2 -0.6 0.2 2.2" />
          <circle className="mm-query__dot" cx="0.2" cy="5.6" r="1.1" />
        </g></g>
      );
      break;
    case 'point':
    case 'nudge':
      body = <g transform="translate(97 46)"><g className="mm-mark mm-chev"><path d="M0 -4 L4 0 L0 4" /><path d="M7 -4 L11 0 L7 4" /></g></g>;
      break;
    case 'sleepy':
    case 'rest':
      body = (
        <g transform="translate(72 18)">
          {[0, 1, 2].map((i) => <g key={i} className="mm-mark mm-zed" style={{ '--d': `${i * 900}ms`, '--s': 1 + i * 0.3 }}><path d="M-3 -3 H3 L-3 3 H3" /></g>)}
        </g>
      );
      break;
    case 'hello':
    case 'wave':
      body = <g transform="translate(10 46)"><g className="mm-mark mm-arcs"><path d="M-2 -6 Q-6 0 -2 6" /><path d="M-7 -9 Q-13 0 -7 9" /></g></g>;
      break;
    case 'encourage':
      body = <g transform="translate(10 46)"><g className="mm-mark mm-pump"><path d="M-3 -8 L-5.5 -12" /><path d="M-6 -3 L-10 -5.5" /><path d="M-6 3 L-10 5.5" /></g></g>;
      break;
    default:
      return null;
  }
  return <svg className="mobi-react__marks" viewBox="0 0 100 100" aria-hidden="true" focusable="false">{body}</svg>;
}
