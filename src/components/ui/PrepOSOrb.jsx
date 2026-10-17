"use client";

import { cn } from '@/lib/utils';

export function PrepOSOrb({
  size = 48,
  label = '',
  active = false,
  className = '',
}) {
  const letters = label ? String(label).split('') : [];

  return (
    <span
      className={cn('prepos-orb', active && 'prepos-orb--active', className)}
      style={{ '--prepos-size': `${size}px` }}
      aria-hidden="true"
    >
      <span className="prepos-orb__field" />
      <span className="prepos-orb__ring" />
      {letters.length ? (
        <span className="prepos-orb__letters">
          {letters.map((letter, index) => (
            <span key={`${letter}_${index}`} style={{ animationDelay: `${index * 0.09}s` }}>
              {letter}
            </span>
          ))}
        </span>
      ) : null}
      <style>{`
        @property --prepos-angle {
          syntax: "<angle>";
          inherits: false;
          initial-value: 0deg;
        }

        .prepos-orb {
          position: relative;
          display: inline-grid;
          width: var(--prepos-size);
          height: var(--prepos-size);
          place-items: center;
          isolation: isolate;
          border-radius: 999px;
          color: #f6f7ee;
          transform: translateZ(0);
        }

        .prepos-orb__field,
        .prepos-orb__ring {
          position: absolute;
          inset: 0;
          border-radius: inherit;
        }

        /* No glow and no constant motion (W-076): a still, lamp-lit volt disc with a hairline ring. */
        .prepos-orb__field {
          background: radial-gradient(circle at 34% 30%, #f3ff9a, #d2f000 46%, #7f9400 100%);
          box-shadow: inset 0 -2px 4px rgba(10,12,8,.28);
          z-index: 1;
        }

        .prepos-orb__ring {
          border: 1px solid rgba(10,12,8,.22);
          z-index: 2;
        }

        .prepos-orb::after { content: none; }

        .prepos-orb__letters {
          position: relative;
          z-index: 4;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: .01em;
          font-family: var(--font-mono);
          font-size: calc(var(--prepos-size) * .105);
          font-weight: 800;
          letter-spacing: .04em;
          text-transform: uppercase;
          color: rgba(246,247,238,.82);
        }

        .prepos-orb__letters span {
          animation: prepos-orb-letter 2.8s ease-in-out infinite;
        }

        .prepos-orb--active .prepos-orb__ring { border-color: rgba(10,12,8,.4); }

        @keyframes prepos-orb-spin {
          to { --prepos-angle: 360deg; }
        }

        @keyframes prepos-orb-ring {
          0%, 100% { transform: rotate(90deg); }
          50% { transform: rotate(270deg); }
        }

        @keyframes prepos-orb-letter {
          0%, 100% { opacity: .38; transform: translateY(0); }
          24% { opacity: .95; transform: scale(1.11); }
          44% { opacity: .66; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .prepos-orb__field,
          .prepos-orb__ring,
          .prepos-orb__letters span {
            animation: none;
          }
        }
      `}</style>
    </span>
  );
}
