"use client";

import MobiReact from '@/components/brand/MobiReact';
import { useMobiScope } from '@/components/brand/mobiEvents';
import { DemoDrill } from './DemoDrill';

// The hero's live sample with its one Mobi (web IA plan 4.1 and 4.3: the hero seat reacts to the
// sample). Mobi sits beside the card, never over a question or an option; the sample tells him
// what happened through mobiAct('sample', ...). He is decorative: the sample says everything in text.
export function SampleStage() {
  const mobi = useMobiScope('sample', 'hello');
  return (
    <div className="lp-sample" id="try">
      {/* Older links point here (/#try-practice); keep them landing on the sample. */}
      <span id="try-practice" className="lp-anchor" aria-hidden="true" />
      <p className="lp-sample__head"><span className="lp-sample__live" aria-hidden="true" />5 sample questions, no sign-up</p>
      <div className="lp-sample__card"><DemoDrill /></div>
      <div className="lp-sample__mobi" aria-hidden="true">
        <MobiReact key={mobi.n} act={mobi.act} onDone={mobi.onDone} size={72} />
      </div>
    </div>
  );
}
