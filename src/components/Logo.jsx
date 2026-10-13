import React from 'react';
import Link from 'next/link';

// Two SVGs, one per theme. CSS (globals.css, .logo__img) shows the one that
// matches html[data-theme]; the footer always uses the dark-theme art.
export function Logo({ className = '' }) {
  return (
    <Link href="/" className={`logo ${className}`} aria-label="mockmob">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo__img logo__img--dark" src="/brand/logo-header-dark.svg" alt="" width="180" height="28" decoding="async" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo__img logo__img--light" src="/brand/logo-header-light.svg" alt="" width="180" height="28" decoding="async" />
    </Link>
  );
}
