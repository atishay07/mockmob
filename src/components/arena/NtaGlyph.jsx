// The NTA mode's tile picture, the app's own: a light screen with the exam's blue bar and a palette of
// answered (green), not answered (orange), marked (purple) and not visited (grey) cells. Drawn, so it
// is sharp at any size and the same in Night and Day; the screen itself stays light, as the exam's does.
// Decorative: the tile prints its words beside it.
const GREEN = '#2f9d18';
const ORANGE = '#e0480a';
const PURPLE = '#58289b';

// Row by row: a = answered, n = not answered, m = marked for review, o = not visited.
const CELLS = ['a', 'a', 'n', 'm', 'a', 'o', 'o', 'o', 'o'];

export default function NtaGlyph({ size = 44, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="nta-glyph-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbfaf5" />
          <stop offset="1" stopColor="#e4e1d6" />
        </linearGradient>
      </defs>
      <rect x="6" y="3.5" width="32" height="37" rx="6" fill="url(#nta-glyph-face)" />
      <path d="M6 9.5a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v3H6z" fill="#2f4f8d" />
      <rect x="10.5" y="7" width="12" height="2" rx="1" fill="#b9c8e6" />
      {CELLS.map((kind, i) => {
        const x = 11 + (i % 3) * 8.6;
        const y = 17 + Math.floor(i / 3) * 8.6;
        if (kind === 'm') return <circle key={i} cx={x + 3.3} cy={y + 3.3} r="3.6" fill={PURPLE} />;
        if (kind === 'o') return <rect key={i} x={x} y={y} width="6.6" height="6.6" rx="1.7" fill="#eceae1" stroke="#b9b6ab" strokeWidth="1.1" />;
        return <rect key={i} x={x} y={y} width="6.6" height="6.6" rx="1.7" fill={kind === 'a' ? GREEN : ORANGE} />;
      })}
    </svg>
  );
}
