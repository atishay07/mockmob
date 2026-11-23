import { Marked } from '@/components/doodle/Doodle';
import FIRST_PAPER from '@/../data/coverage/cuet2026/home/accountancy.json';
import { coverageExplorer, homeQuestion } from './coverage2026.mjs';
import { EXPLORER as C, howWeCounted } from './coverageWords.mjs';
import CoverageExplorer from './CoverageExplorer';
import CoverageHow from './CoverageHow';
import './coverage-proof.css';

/**
 * The CUET 2026 check on the home page (owner LK427, 23 Nov 2026; it replaced the teaser of LK368): the head and the total,
 * then the explorer (CoverageExplorer.jsx: stream tabs, subject chips, the question strip, NTA's question beside MockMob's).
 * Every number is from data/coverage/cuet2026/public/summary.json (coverage2026.mjs). The pair the section opens on is in
 * this page's HTML, from the first paper's trimmed file; a test holds FIRST_PAPER to the model's first subject.
 */
export default function CoverageProof() {
  const model = coverageExplorer();
  if (!model.first) return null;
  const firstQ = model.first.subject === FIRST_PAPER.id ? homeQuestion(FIRST_PAPER, model.first.n) : null;
  return (
    <section className="lp-sec lp-cov" id="cuet-2026" aria-labelledby="cov-title">
      <div className="mm-wrap lp-cov__inner">
        <CoverageExplorer
          model={model}
          first={firstQ ? { subject: FIRST_PAPER.id, q: firstQ } : null}
          heading={<h2 key="heading" className="lp-h2" id="cov-title"><Marked text={C.h2} marks={[[C.mark, { mark: 'highlight', tone: 'volt' }]]} /></h2>}
          how={<CoverageHow key="how" how={howWeCounted({ total: model.total, before: model.before })} />}
        />
      </div>
    </section>
  );
}
