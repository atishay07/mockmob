// Pieces every DU cutoff page shares: the year line, where the numbers come from, and the closing sign-up. Server only.
import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { CHECKED_LINE, YEAR_LINE, cutoffSources } from '@/lib/du/cutoffPages.mjs';
import { keepTogether } from '@/lib/keepTogether.mjs';

/** The phone bar's note on these pages: what signing up gives a student reading cutoffs. */
export const DOCK_NOTE = 'Keep up to 8 DU colleges on your list, free.';

export function YearNote() {
  return <p className="dc-year">{keepTogether(YEAR_LINE)}</p>;
}

/** After the tables: why a round 3 score can sit above round 2 (DU's own note on its round 3 list). */
export function RoundNote() {
  return (
    <p className="dc-note">
      Round 3 also took students who joined DU’s process partway through, so DU says its round 3 scores stand apart from
      rounds 1 and 2. A round 3 score can be higher than an earlier one.
    </p>
  );
}

export function CutoffSources({ withBulletin = true }) {
  const sources = cutoffSources().filter((s) => withBulletin || s.id !== 'boi');
  return (
    <section className="mm-article__section dc-sources" aria-labelledby="dc-sources-title">
      <h2 className="mm-h2" id="dc-sources-title">Where these numbers come from</h2>
      <p>
        After each round, DU’s Admission Branch published the lowest score that got a seat in every course at every college,
        as a PDF. DU calls it the minimum allocation score. Every score here is read from those PDFs and printed the way DU
        printed it. If DU corrects a list, its PDF is the one to trust.
      </p>
      <ul className="dc-docs">
        {sources.map((s) => (
          <li key={s.id}>
            <a href={s.url} target="_blank" rel="noreferrer noopener" className="dc-doc">
              <span>
                <strong>{s.label}</strong>
                <em>{s.use}. Released {s.released.replace(/ /g, ' ')}.</em>
              </span>
              <ExternalLink size={16} aria-hidden="true" />
              <span className="dc-sr"> (PDF, opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="dc-checked">{CHECKED_LINE}</p>
    </section>
  );
}

export function CutoffClose({ calculatorHref, calculatorLabel }) {
  return (
    <aside className="mm-close">
      <div className="mm-wrap mm-wrap--tight">
        <h2 className="mm-h2">Aim above the 2026 score.</h2>
        <p className="mm-body">
          {keepTogether('Sign up free to keep up to 8 colleges on your list and sit timed CUET mocks marked like the real paper. No card needed.')}
        </p>
        <div className="mm-actions">
          <Link href="/signup" className="mm-btn mm-btn--primary">Sign up free</Link>
          <Link href={calculatorHref} className="mm-btn mm-btn--secondary">{calculatorLabel}</Link>
        </div>
      </div>
    </aside>
  );
}
