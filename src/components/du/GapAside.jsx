import Link from 'next/link';
import { APPROVED } from '../../../data/glossary.mjs';

// "Your gap to each college": the Pro layer on top of the free calculator (web IA plan 4.3: it moved
// here from the home page; plan 6 names it). Three lines say what Pro adds, one line says what it is
// not. Pricing facts live on /pricing, so this block states no price.
export function GapAside() {
  return (
    <aside className="du-gap" aria-labelledby="du-gap-title">
      <div className="du-gap__copy">
        <div className="du-gap__title">
          <h2 id="du-gap-title" className="du-h2">{APPROVED.cutoffToolPro}</h2>
          <span className="du-gap__tag">{APPROVED.proLock}</span>
        </div>
        <p className="du-sub">
          Turn your recorded practice into a paper-by-paper range. Compare it with your DU shortlist and see which paper has the most room to improve.
        </p>
        <Link href="/pricing" className="mm-btn mm-btn--secondary">See what Pro includes</Link>
      </div>
      <ul className="du-gap__list">
        <li><b>Practice projection</b><span>Each paper out of 250, from your attempt rate and accuracy, with an honest range.</span></li>
        <li><b>Your DU shortlist</b><span>Up to 8 college and programme targets, compared with Rounds I to III.</span></li>
        <li><b>Next move</b><span>The paper with the most marks open, and its weakest chapter.</span></li>
      </ul>
      <p className="du-gap__fine">A projection from your own record, not a prediction or an admission chance. The cutoff comparison above stays free.</p>
    </aside>
  );
}
