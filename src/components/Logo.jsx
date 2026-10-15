import React from 'react';
import Link from 'next/link';
import { Icon } from './ui/Icons';
import { BRAND_FLAGS } from '@/../data/brand_flags.mjs';
import { LOGO_B } from './landing/logoB';

// The wordmark. brand_flags.logo picks the form (web IA plan 7, D17): 'bolt' is today's mark;
// 'b' is the app's logo B, Mobi as the second "o" of "mockmob". Logo B's letters take the text
// colour, so one drawing serves Night and Day; Mobi keeps his volt body and charcoal visor.
// `variant` overrides the flag (development previews show both sides at Gate A).
export function Logo({ className = '', variant = BRAND_FLAGS.logo, href = '/' }) {
  if (variant === 'b') {
    return (
      <Link href={href} className={`logo logo--b ${className}`} aria-label="MockMob home">
        <svg className="logo-b" viewBox={LOGO_B.viewBox} role="img" aria-hidden="true" focusable="false">
          <path fill="currentColor" d={LOGO_B.letters} />
          <g className="logo-b__mobi">
            <path fill="#D2F000" d={LOGO_B.body} />
            <path fill="#12110E" d={LOGO_B.visor} />
            <path fill="#F3EFE4" fillRule="evenodd" d={LOGO_B.eyes} />
          </g>
        </svg>
      </Link>
    );
  }
  return (
    <Link href={href} className={`logo ${className}`}>
      <span className="bolt">
        <Icon name="zap" style={{ width: '14px', height: '14px', color: '#000' }} />
      </span>
      <span className="logo__word">MockMob<span className="dot">.</span></span>
    </Link>
  );
}
