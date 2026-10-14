import React from 'react';
import Link from 'next/link';
import { Logo } from './Logo';
import { FOOTER_COLUMNS, FOOTER_MEMBER_LINKS } from '@/lib/navigation';

// Links come from src/lib/navigation.js. Guests see the columns they always had; a signed-in student
// gets their own column first (shown through <html data-visitor>, so the server HTML is the same for
// everyone). The non-affiliation line stays here (owner decision D8).
export function MarketingFooter() {
  return (
    <footer className="mm-foot">
      <div className="mm-wrap">
        <div className="mm-foot__cols">
          <div>
            <Logo />
            <p className="mm-foot__blurb">
              Discover where marks slip away, practise a specific change, and check it on
              fresh material. Recovery is being prepared for English, Accountancy, Business Studies and Economics.
            </p>
            <a
              className="mm-foot__social"
              href="https://www.instagram.com/mockmob.in/"
              target="_blank"
              rel="noreferrer"
            >
              <span aria-hidden="true">IG</span>
              Follow @mockmob.in
            </a>
          </div>

          <div className="vs-member-only">
            <h3>Your practice</h3>
            <ul>
              {FOOTER_MEMBER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.id}>
              <h3>{column.label}</h3>
              <ul>
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mm-foot__base">
          <p>
            &copy; {new Date().getFullYear()} MockMob. MockMob is an independent exam preparation
            platform and is not affiliated with NTA, Delhi University, or any official examining
            body. CUET is a trademark of its respective owner.
          </p>
        </div>
      </div>
    </footer>
  );
}
