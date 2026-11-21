import { Marked } from '@/components/doodle/Doodle';
import { COVERAGE_2026, COVERAGE_COPY as C, coveragePct, coverageTotal } from './coverage2026.mjs';
import './coverage-proof.css';

/**
 * The CUET 2026 coverage section of the home page (owner, 22 Nov 2026). A server component with no script: the share of the
 * real 2026 paper that MockMob's questions and Key cards already teach, as one big figure and a bar for each subject. Every
 * number is from coverage2026.mjs (data/coverage/cuet2026). Nothing moves and nothing floats.
 */
export default function CoverageProof() {
  const total = coverageTotal();
  return (
    <section className="lp-sec lp-cov" id="cuet-2026" aria-labelledby="cov-title">
      <div className="mm-wrap lp-cov__inner">
        <div className="lp-cov__head">
          <p className="lp-cov__kicker">{C.kicker}</p>
          <h2 className="lp-h2" id="cov-title"><Marked text={C.h2} marks={[[C.mark, { mark: 'underline', tone: 'brand' }]]} /></h2>
          <p className="lp-sub">{C.sub}</p>
        </div>
        <div className="lp-cov__card">
          <p className="lp-cov__total">
            <b>{total.pct}<span>%</span></b>
            <span>{C.totalLabel}</span>
          </p>
          <ul className="lp-cov__rows">
            {COVERAGE_2026.subjects.map((s) => {
              const pct = coveragePct(s.covered, s.of);
              return (
                <li key={s.id}>
                  <div className="lp-cov__row">
                    <span className="lp-cov__name">{s.name}</span>
                    <b className="lp-cov__pct">{pct}%</b>
                  </div>
                  <div className="lp-cov__bar" role="img" aria-label={`${s.name}: ${C.row(s.covered, s.of)}, ${pct} percent`}>
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <p className="lp-cov__count">{C.row(s.covered, s.of)}</p>
                </li>
              );
            })}
          </ul>
          <p className="lp-cov__note">{C.note}</p>
        </div>
      </div>
    </section>
  );
}
