import { Flag, Clock3 } from 'lucide-react';

// Static, server-rendered stills of the signed-in product, drawn in the
// marketing system's night register. Everything here is illustrative layout
// and says so in its caption: no peer percentages, no invented student data.

const PALETTE = Array.from({ length: 50 }, (_, i) => {
  const n = i + 1;
  let state = 'unseen';
  if (n <= 21) state = 'answered';
  if ([4, 9, 15].includes(n)) state = 'flagged';
  if (n === 22) state = 'current';
  if ([6, 12, 18].includes(n)) state = 'skipped';
  return { n, state };
});

export function ArenaScreen() {
  return (
    <figure className="mm-screen lp-arena">
      <div className="mm-screen__bar">
        <span className="mm-screen__live" aria-hidden="true" />
        Arena · Full mock
        <span className="lp-arena__timer mm-measure">
          <Clock3 size={15} aria-hidden="true" />
          38:12
        </span>
      </div>
      <div className="mm-screen__body">
        <div className="lp-arena__q">
          <span className="lp-arena__qnum mm-measure">Q22 / 50</span>
          <p>A partner’s capital account shows a debit balance. Where is it shown in the balance sheet?</p>
          <ul className="lp-arena__opts" aria-hidden="true">
            <li><b>A</b>Liabilities side</li>
            <li data-picked="true"><b>B</b>Assets side</li>
            <li><b>C</b>Reserves and surplus</li>
          </ul>
          <div className="lp-arena__row">
            <span className="lp-arena__flag"><Flag size={15} aria-hidden="true" />Marked for review</span>
            <span className="lp-arena__save">Save question</span>
          </div>
        </div>
        <div className="lp-palette" aria-hidden="true">
          {PALETTE.map(({ n, state }) => (
            <span key={n} data-state={state} className="mm-measure" style={{ '--n': n }}>{n}</span>
          ))}
        </div>
        <ul className="lp-legend" aria-hidden="true">
          <li data-state="answered">Answered</li>
          <li data-state="flagged">Flagged</li>
          <li data-state="skipped">Skipped</li>
          <li data-state="unseen">Unseen</li>
        </ul>
      </div>
      <figcaption className="lp-caption">Illustrative layout of a 50-question, 60-minute mock.</figcaption>
    </figure>
  );
}

const FITS = [
  ['Eligibility', 'Programme rules', 'likely'],
  ['Cutoffs', 'Year and round', 'stretch'],
  ['Category', 'Published scores', 'likely'],
];

export function CompassScreen() {
  return (
    <figure className="mm-screen lp-compass">
      <div className="mm-screen__bar">
        Admission Compass
        <span className="lp-badge">Example</span>
      </div>
      <div className="mm-screen__body mm-compass">
        <p className="mm-compass__score mm-measure">
          DU<span>historical comparison</span>
        </p>
        <p className="mm-compass__band">Programme eligibility · category · allocation round.</p>
        <ul className="mm-compass__rows">
          {FITS.map(([course, label, fit], i) => (
            <li key={course} style={{ '--i': i }}>
              {course}
              <em data-fit={fit}>{label}</em>
            </li>
          ))}
        </ul>
        <p className="lp-compass__next">
          <strong>Next move</strong>
          Check the published source for the selected year and round. Mock marks are not admission scores.
        </p>
      </div>
      <figcaption className="lp-caption">
        Illustrative only. The live calculator uses official DU sources; this example is not an admission prediction.
      </figcaption>
    </figure>
  );
}

const PLAN = [
  ['Practice', 'Available ordinary questions', '10 min', 'now'],
  ['Review', 'Saved mistake explanations', 'Alternative', 'next'],
  ['Choose', 'Another subject', 'Alternative', 'later'],
];

export function PlanScreen() {
  return (
    <figure className="mm-screen lp-plan-screen">
      <div className="mm-screen__bar">
        PrepOS · Today
        <span className="lp-badge">Example</span>
      </div>
      <div className="mm-screen__body">
        <p className="lp-plan-screen__ask">What should I do tonight?</p>
        <ol className="lp-plan-list">
          {PLAN.map(([kind, what, time, state], i) => (
            <li key={what} data-state={state} className="rv-item" style={{ '--i': i }}>
              <span className="lp-plan-list__kind">{kind}</span>
              <span className="lp-plan-list__what">{what}</span>
              <span className="lp-plan-list__time mm-measure">{time}</span>
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="lp-caption">Illustrative plan. The live next action comes from the same record used by Today and Radar.</figcaption>
    </figure>
  );
}
