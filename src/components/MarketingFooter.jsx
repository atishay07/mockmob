import React from 'react';
import Link from 'next/link';
import { Logo } from './Logo';
import { FooterStart } from './FooterStart';
import { SUBJECT_CLAIM } from '../../data/subject_claim.js';

const PRODUCT_LINKS = [
  ['DU eligibility and cutoff calculator', '/cuet-cutoff-calculator'],
  ['CUET subject combination planner', '/cuet-subject-combination'],
  ['Free CUET mock test', '/cuet-mock-test-free'],
  ['Previous year questions', '/cuet-previous-year-questions'],
  ['Online practice tests', '/cuet-practice-tests-online'],
  ['Features', '/features'],
  ['Pricing', '/pricing'],
];

const SUBJECT_LINKS = [
  ['English', '/cuet/english'],
  ['Accountancy', '/cuet/accountancy'],
  ['Economics', '/cuet/economics'],
  ['Business Studies', '/cuet/business-studies'],
  ['CUET 2027 guide', '/cuet-2027'],
];

const COMPANY_LINKS = [
  ['About', '/about'],
  ['Help', '/help'],
  ['Contact', '/contact'],
  ['Privacy', '/privacy'],
  ['Terms', '/terms'],
  ['Refunds', '/refunds'],
];

export function MarketingFooter() {
  return (
    <footer className="mm-foot">
      <div className="mm-wrap">
        <div className="mm-foot__cols">
          <div>
            <Logo />
            <p className="mm-foot__blurb">
              Timed CUET practice, a clear read of every mistake, and one next step for tonight.
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

          <div>
            <h3>Product</h3>
            <ul>
              {PRODUCT_LINKS.map(([label, href]) => (
                <li key={href}>
                  <Link href={href}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Subjects</h3>
            <ul>
              {SUBJECT_LINKS.map(([label, href]) => (
                <li key={href}>
                  <Link href={href}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Company</h3>
            <ul>
              {COMPANY_LINKS.map(([label, href]) => (
                <li key={href}>
                  <Link href={href}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>
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
