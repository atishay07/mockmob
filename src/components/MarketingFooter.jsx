import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import { CORRECTIONS_LISTED } from '@/../data/corrections_listed.mjs';
import React from 'react';
import Link from 'next/link';
import { Logo } from './Logo';
import { FooterStart } from './FooterStart';
import { FooterHelpLink } from './FooterHelpLink';
import { SUBJECT_CLAIM } from '../../data/subject_claim.js';
import { NewTag } from './NavBar';
import { Unfold } from './landing/Unfold';
import './new-tag.css';

const PRODUCT_LINKS = [
  ['DU eligibility and cutoff calculator', '/cuet-cutoff-calculator'],
  ['CUET subject combination planner', '/cuet-subject-combination'],
  ['Free CUET mock test', '/cuet-mock-test-free'],
  ['Previous year questions', '/cuet-previous-year-questions'],
  ['Online practice tests', '/cuet-practice-tests-online'],
  ['Features', '/features'],
  // The third item marks a commerce link: hidden in the app's Custom Tabs (src/app/app-view.css).
  ['Pricing', '/pricing', true],
];

const SUBJECT_LINKS = [
  ['English', '/cuet/english'],
  ['Accountancy', '/cuet/accountancy'],
  ['Economics', '/cuet/economics'],
  ['Business Studies', '/cuet/business-studies'],
  ['All 15 CUET subjects', '/cuet'],
  // A no-break space: "CUET 2027" never parts at a line end (night 1105).
  ['CUET\u00a02027 guide', '/cuet-2027'],
];

// Help is chosen by sign-in (FooterHelpLink): /help for a student, the landing's public questions for a guest.
// Corrections (16 Nov 2026): the public log of what we found wrong in our questions (src/app/corrections).
const COMPANY_LINKS = [
  ['About', '/about'],
  ...(CORRECTIONS_LISTED ? [['Corrections', '/corrections']] : []),
  ['Help', '/help'],
  ['Contact', '/contact'],
  ['Privacy', '/privacy'],
  ['Terms', '/terms'],
  ['Refunds', '/refunds'],
];

const HOME_TOOLS = [
  ['Free CUET mock test', '/cuet-mock-test-free'],
  ['DU cutoff calculator', '/cuet-cutoff-calculator'],
  ['Subject combination planner', '/cuet-subject-combination'],
];

// One group of links. On a phone each group is a disclosure row, closed by default and open from 720 px (Unfold), so the footer
// costs about one screen instead of two; every link stays. The home page did this first (round 2 of 18 Nov 2026, lane home-b;
// its styles are r19-home-b.css); every other public page folds the same way since 19 Nov 2026 (lane pub-c): its footer carries
// `mm-foot--page`, and the fold's styles for it sit with the footer's own in marketing.css, so the home page is untouched.
function FootGroup({ title, children }) {
  return (
    <div className="mm-foot__group">
      <Unfold from={720} className="lp-fold--foot" summary={<h3>{title}</h3>} head={<h3>{title}</h3>}>{children}</Unfold>
    </div>
  );
}

export function MarketingFooter({ home = false }) {
  return (
    <footer className={home ? 'mm-foot' : 'mm-foot mm-foot--page'}>
      <div className="mm-wrap">
        {home ? (
          <nav className="mm-foot__tools" aria-label="Free CUET tools">
            <h2>Free CUET tools</h2>
            <ul>
              {HOME_TOOLS.map(([label, href]) => (
                <li key={href}><Link href={href}>{label}</Link></li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div className="mm-foot__cols">
          <div>
            <Logo />
            <p className="mm-foot__blurb">
              Timed CUET practice, a clear read of every mistake, and one next step for tonight.
              {' '}
              {SUBJECT_CLAIM.short}.
            </p>
            <FooterStart />
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

          <FootGroup title="Product">
            <ul>
              {PRODUCT_LINKS.filter(([, href]) => !home || !HOME_TOOLS.some(([, toolHref]) => toolHref === href)).map(([label, href, commerce]) => (
                <li key={href} data-commerce={commerce ? '' : undefined}>
                  <Link href={href}>{label}{href === '/cuet-cutoff-calculator' ? <NewTag /> : null}</Link>
                </li>
              ))}
            </ul>
          </FootGroup>

          <FootGroup title="Subjects">
            <ul>
              {SUBJECT_LINKS.map(([label, href]) => (
                <li key={href}>
                  <Link href={href}>{label}</Link>
                </li>
              ))}
            </ul>
          </FootGroup>

          <FootGroup title="Company">
            <ul>
              {COMPANY_LINKS.map(([label, href]) => (
                <li key={href}>
                  {href === '/help' ? <FooterHelpLink>{label}</FooterHelpLink> : <Link href={href}>{label}</Link>}
                </li>
              ))}
            </ul>
          </FootGroup>
        </div>

        <div className="mm-foot__base">
          <p>
            &copy; {new Date().getFullYear()} MockMob
          </p>
        </div>
      </div>
    </footer>
  );
}
