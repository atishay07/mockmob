import Link from 'next/link';
import { Marked } from '@/components/doodle/Doodle';
import { COVERAGE_COPY as C, COVERAGE_PATH, coverageTeaser } from './coverage2026.mjs';
import './coverage-proof.css';

/**
 * The CUET 2026 coverage teaser on the home page (owner, 22 Nov 2026; LK368). A server component with no script: the share of
 * the real 2026 papers that MockMob's questions and Key cards already teach, as one big figure, a bar for each subject (each a
 * link to that subject's question-by-question page), and one key to /cuet-2026-coverage. Every number is from
 * data/coverage/cuet2026/public/summary.json (coverage2026.mjs). Nothing moves and nothing floats.
 */
export default function CoverageProof() {
  const { total, subjects } = coverageTeaser();
  if (!subjects.length) return null;
  return (
    <section className="lp-sec lp-cov" id="cuet-2026" aria-labelledby="cov-title">
      <div className="mm-wrap lp-cov__inner">
        <div className="lp-cov__head">
          <p className="lp-cov__kicker">{C.kicker}</p>
          <h2 className="lp-h2" id="cov-title"><Marked text={C.h2} marks={[[C.mark, { mark: 'underline', tone: 'brand' }]]} /></h2>
        </div>
        <div className="lp-cov__card">
          <div className="lp-cov__lead">
            <p className="lp-cov__total">
              <b>{total.pct}<span>%</span></b>
              <span>{C.totalLabel(total.of)}</span>
            </p>
            <p className="lp-cov__go"><Link href={COVERAGE_PATH} className="mm-btn mm-btn--primary">{C.key}</Link></p>
          </div>
          <ul className="lp-cov__rows">
            {subjects.map((s) => (
              <li key={s.id}>
                <Link href={s.href} className="lp-cov__link">
                  <span className="lp-cov__row">
                    <span className="lp-cov__name">{s.name}</span>
                    <b className="lp-cov__pct">{s.pct}%</b>
                  </span>
                  <span className="lp-cov__bar" role="img" aria-label={`${s.name}: ${C.row(s.covered, s.of)}, ${s.pct} percent`}>
                    <i style={{ width: `${s.pct}%` }} />
                  </span>
                  <span className="lp-cov__count">{C.row(s.covered, s.of)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="lp-cov__note">{C.note}</p>
        </div>
      </div>
    </section>
  );
}
