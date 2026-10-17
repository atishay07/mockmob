"use client";

import { cn } from '@/lib/utils';
import './prepos-orb.css';

// Mobi's orb: a small glass marble with lime light settled at its base (N9, 17 Oct night). It is an object, not a
// light source: no halo or glow leaves its edge, so it sits in the sidebar, a sheet header or a row like any other
// icon. The light inside drifts slowly; `active` (the panel is open) lets it turn a little faster, and reduced
// motion holds it still.
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
      <span className="prepos-orb__liquid" />
      <span className="prepos-orb__glass" />
      {letters.length ? (
        <span className="prepos-orb__letters">
          {letters.map((letter, index) => (
            <span key={`${letter}_${index}`}>{letter}</span>
          ))}
        </span>
      ) : null}
    </span>
  );
}
