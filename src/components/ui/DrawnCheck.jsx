// A tick that inks itself in. Shown only after the server has confirmed something (a save, a
// payment step); never as hope. Reduced motion shows it finished. See .mk-draw in motion-kit.css.
export function DrawnCheck({ size = 16, delay = 0, className = '' }) {
  return (
    <svg className={`drawn-check ${className}`.trim()} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path className="mk-draw" pathLength="1" d="M5 12.5 L10 17.5 L19 7" style={{ '--mk-draw-delay': `${delay}ms` }} />
    </svg>
  );
}
