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

        .prepos-orb__field {
          background:
            conic-gradient(from var(--prepos-angle, 0deg) at 28% 72%, rgba(210,240,0,.92), transparent 18% 72%, rgba(210,240,0,.76)),
            conic-gradient(from calc(var(--prepos-angle, 0deg) * -1.2) at 75% 28%, rgba(85,255,197,.42), transparent 24% 76%, rgba(85,255,197,.26)),
            radial-gradient(circle at 50% 50%, rgba(246,247,238,.92), rgba(210,240,0,.34) 34%, rgba(10,12,8,.95) 72%);
          filter: blur(calc(var(--prepos-size) * .035)) contrast(1.35);
          animation: prepos-orb-spin 14s linear infinite;
          box-shadow:
            inset 0 0 calc(var(--prepos-size) * .11) rgba(246,247,238,.7),
            inset 0 calc(var(--prepos-size) * .12) calc(var(--prepos-size) * .18) rgba(210,240,0,.34),
            0 0 calc(var(--prepos-size) * .36) rgba(210,240,0,.18);
          z-index: 1;
        }

        .prepos-orb__ring {
          border: 1px solid rgba(246,247,238,.16);
          box-shadow:
            inset 0 6px 12px 0 rgba(210,240,0,.42),
            inset 0 18px 24px 0 rgba(10,12,8,.66),
            0 0 0 1px rgba(210,240,0,.12),
            0 0 calc(var(--prepos-size) * .42) rgba(210,240,0,.18);
          animation: prepos-orb-ring 5.4s ease-in-out infinite;
          z-index: 2;
        }

        .prepos-orb::after {
          content: "";
          position: absolute;
          inset: 15%;
          border-radius: inherit;
          background: radial-gradient(circle, rgba(246,247,238,.52), rgba(210,240,0,.12) 42%, transparent 70%);
          mix-blend-mode: screen;
          z-index: 3;
        }

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

        .prepos-orb--active .prepos-orb__ring {
          box-shadow:
            inset 0 6px 12px 0 rgba(210,240,0,.62),
            inset 0 18px 24px 0 rgba(10,12,8,.56),
            0 0 0 1px rgba(210,240,0,.2),
            0 0 calc(var(--prepos-size) * .62) rgba(210,240,0,.3);
        }

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
