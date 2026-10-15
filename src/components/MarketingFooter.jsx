import React from 'react';
import Link from 'next/link';
import { Logo } from './Logo';
import { FOOTER_COLUMNS, NON_AFFILIATION_LINE } from '@/lib/navigation';
import { INSTAGRAM } from '@/lib/social';

// The public footer (web IA plan 2.3): Free tools, Guides, all 15 subjects (each links to its hub
// where one exists) and Company, then one non-affiliation line (D8). No status or "being prepared"
// copy lives here.
export function MarketingFooter() {
  return (
    <footer className="mm-foot">
      <div className="mm-wrap">
        <div className="mm-foot__cols mm-foot__cols--ia">
          <div className="mm-foot__brand">
            <Logo />
            <p className="mm-foot__blurb">CUET UG 2027 mocks in your own subjects. See which chapters cost you marks, and fix them before your next mock.</p>
            <a className="mm-foot__social" href={INSTAGRAM.url} target="_blank" rel="noreferrer">
              <span aria-hidden="true">IG</span>
              Follow @{INSTAGRAM.handle}
            </a>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.id} className={`mm-foot__col mm-foot__col--${column.id}`}>
              <h3>{column.label}</h3>
              <ul>
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href ? <Link href={link.href}>{link.label}</Link> : <span className="mm-foot__plain">{link.label}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mm-foot__base">
          <p>&copy; {new Date().getFullYear()} MockMob. {NON_AFFILIATION_LINE} CUET is a trademark of its owner.</p>
        </div>
      </div>
    </footer>
  );
}
