// The Daily Five and the Sunday Mock as ONE slim row (Revision 2 of the spec: they stay on the home page, LK282 being newer
// than LK267, and the Daily Five's UI was understood, LK293). The heading says the rhythm in a few words; each card is one
// link to the page that has the whole thing (/daily, /sunday-mock), with its desk object, its name and one line. Every
// figure is the product's own constant: the five's size (src/lib/dailyFive.mjs) and the Sunday paper's count and minutes
// (src/lib/sundayMock.mjs, the full mock's own). Server-drawn; nothing moves.
import '@/app/marketing.css'; // draws the system's section parts (mm-wrap, lp-h2)
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { DAILY_FIVE_PATH, DAILY_FIVE_SIZE } from '@/lib/dailyFive.mjs';
import { PAPER_COUNT, PAPER_MINUTES } from '@/lib/sundayMock.mjs';
import { RHYTHM } from './homeNextCopy.mjs';

export const RHYTHM_CARDS = Object.freeze([
  Object.freeze({ href: DAILY_FIVE_PATH, icon: 'today', name: 'Daily Five', line: `${DAILY_FIVE_SIZE} questions a day, free, no sign-up.` }),
  Object.freeze({ href: '/sunday-mock', icon: 'papers', name: 'Sunday Mock', line: `${PAPER_COUNT} questions in ${PAPER_MINUTES} minutes, every Sunday, free.` }),
]);

export default function RhythmRow() {
  return (
    <section className="lp-sec hn-sec hn-rhythm" id="daily-and-sunday" aria-labelledby="rhythm-title">
      <div className="mm-wrap hn-rhythm__wrap">
        <h2 className="lp-h2 hn-rhythm__h" id="rhythm-title">{RHYTHM.h2}</h2>
        <ul className="hn-rhythm__cards">
          {RHYTHM_CARDS.map((card) => (
            <li key={card.href}>
              <Link href={card.href} className="hn-rhythm__card">
                <BrandIcon name={card.icon} size={44} className="hn-rhythm__icon" />
                <span className="hn-rhythm__text"><b>{card.name}</b><span>{card.line}</span></span>
                <ChevronRight size={18} aria-hidden="true" className="hn-rhythm__go" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
