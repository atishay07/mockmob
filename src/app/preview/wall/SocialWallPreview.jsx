"use client";

import { useState } from 'react';
import WallOfLove from '@/components/landing/WallOfLove';

const sampleQuote = 'Preview text only. Real student words appear here only after the student gives permission to share them.';
const longQuote = 'Preview text only. This longer sample checks how a full thought wraps on a narrow screen and whether a three line name stays readable beside its initials. The published version will keep the student’s own wording and omit any claim they did not make.';
const FIXTURES = {
  0: [],
  1: [{ name: 'Jo', detail: '', quote: sampleQuote, consent: true }],
  3: [
    { name: 'Aanya K.', detail: 'Class 12 · Commerce', quote: sampleQuote, consent: true },
    { name: 'Jo', detail: '', quote: sampleQuote, consent: true },
    { name: 'Maya R.', detail: 'CUET aspirant', quote: longQuote, consent: true },
  ],
  4: [
    { name: 'Aanya K.', detail: 'Class 12 · Commerce', quote: sampleQuote, consent: true },
    { name: 'R. Chatterjee', detail: 'CUET aspirant', quote: longQuote, consent: true },
    { name: 'Jo', detail: '', quote: sampleQuote, consent: true },
    { name: 'Saanvi D.', detail: 'Class 12', quote: sampleQuote, consent: true },
  ],
  many: Array.from({ length: 12 }, (_, index) => ({
    name: [
      'Aanya K.', 'R. Chatterjee', 'Jo', 'Saanvi D.', 'Aleksandra Wiśniewska-Kowalczyk',
      'M. Sharma', 'Ananya Rao', 'K. Iyer', 'N. Das', 'S. Khan', 'T. Mehta', 'Y. Sen',
    ][index],
    detail: index === 2 ? '' : 'Preview attribution',
    quote: index === 4 ? longQuote : sampleQuote,
    consent: true,
  })),
};

export default function SocialWallPreview({ initialFixture = '4' }) {
  const [fixture, setFixture] = useState(initialFixture);
  const chooseFixture = (event) => {
    const value = event.target.value;
    setFixture(value);
    const url = new URL(window.location.href);
    url.searchParams.set('count', value);
    window.history.replaceState(null, '', url);
  };

  return (
    <div className="mm lp">
      <main className="lp-sec swp-page">
        <div className="mm-wrap">
          <div className="lp-head lp-head--left">
            <p className="lp-kicker">Wall of love · development preview</p>
            <h1 className="lp-h2">The wall, with test content.</h1>
            <p className="lp-sub">Every name and sentence here is a layout fixture. Nothing on this page is a real student&apos;s quote or endorsement.</p>
          </div>
          <div className="swp-tools">
            <label htmlFor="swp-fixture">Fixture size</label>
            <select id="swp-fixture" value={fixture} onChange={chooseFixture}>
              <option value="0">0 entries</option><option value="1">1 entry</option><option value="3">3 entries</option><option value="4">4 entries</option><option value="many">Many entries (12)</option>
            </select>
            <span>Worst case includes a one-letter name, missing detail, diacritics and a long quote.</span>
          </div>
          {fixture === '0' ? (
            <div className="swp-empty"><b>No cards render.</b><span>The public section stays hidden until a quote has clear consent, a name and student wording.</span></div>
          ) : <WallOfLove voices={FIXTURES[fixture]} placeholder />}
        </div>
      </main>
    </div>
  );
}
