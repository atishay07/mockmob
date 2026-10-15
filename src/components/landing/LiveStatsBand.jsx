"use client";

import { PLAN_FACTS } from '@/../data/plan_facts.mjs';
import { useLiveStats } from './useLiveStats';

const SUBJECTS = PLAN_FACTS.subjects.count.value;

// Live bank numbers for the proof section (web IA plan 4.2, section 6). Only numbers the stats
// route returns render; while it loads the figures hold their space, and if it fails the band is
// left out entirely. No invented headcount and no testimonials.
export function LiveStatsBand() {
  const { status, bankSize, subjectsCovered } = useLiveStats();
  if (status === 'failed' || (status === 'ready' && bankSize === null)) return null;
  const ready = status === 'ready';
  return (
    <dl className="lp-figures" aria-busy={!ready}>
      <div>
        <dt>questions in the practice bank today</dt>
        <dd className="mm-measure">{ready ? bankSize.toLocaleString('en-IN') : <span className="lp-figures__wait" aria-hidden="true" />}</dd>
      </div>
      {subjectsCovered !== null || !ready ? (
        <div>
          <dt>{`of ${SUBJECTS} CUET subjects have practice questions`}</dt>
          <dd className="mm-measure">{ready ? subjectsCovered : <span className="lp-figures__wait" aria-hidden="true" />}</dd>
        </div>
      ) : null}
    </dl>
  );
}

/** The hero's quiet line: "Free to start. No card. 12,480 questions across 15 subjects." */
export function HeroLine() {
  const { status, bankSize, subjectsCovered } = useLiveStats();
  const live = status === 'ready' && bankSize > 0 && subjectsCovered > 0;
  return (
    <p className="lp-quiet">
      Free to start. No card.
      {/* Its own line, with its height held, so the late number never moves the page. */}
      <span className="lp-quiet__live" data-live={live ? 'true' : 'false'}>{live ? `${bankSize.toLocaleString('en-IN')} questions across ${subjectsCovered} subjects.` : ' '}</span>
    </p>
  );
}
