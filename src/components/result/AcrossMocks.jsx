"use client";
// Across your mocks (spec tmp/mistake-lab-v4/SPEC.md 4.9): what the student's timed mocks show together. A folded block
// at the end of the Mistake Lab, and the same component on Radar (Analytics). Every sentence comes finished from the
// server (data/across_mocks.js, contract_across_v1.json); this file only lays them out: at most 3 lines, ranked by marks
// lost, and the rest behind "Show all". A line below its own gate states the gate in words and is set quieter.
//
// Motion: opening the block (or Show all) brings each line up 6 px and in, 180 ms, 45 ms apart; the chevron turns on
// 180 ms. Reduced motion: the final state at once.
import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { withNumbers } from './MarksLedger';
import './lab-loop.css';

// A ruled list: no icon tiles; a line below its gate is set quieter, in words.
function Line({ line, i }) {
  return (
    <li className="am-line" data-id={line.id} data-gated={line.gated || undefined} style={{ '--i': i }}>
      <p className="am-line__text">{line.gated ? line.text : withNumbers(line.text)}</p>
    </li>
  );
}

/**
 * AcrossMocks({ across, defaultOpen, surface, footer }): `across` is lab.acrossMocks or GET /api/me/rules acrossMocks.
 * surface 'inset' sits inside the Lab card (a hairline, no second card); 'card' stands on its own (Radar).
 * `footer` is an optional node under the lines (Radar's link to the Rule book). Renders nothing without a contract.
 */
export default function AcrossMocks({ across, defaultOpen = false, surface = 'inset', footer = null }) {
  const uid = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [all, setAll] = useState(false);
  if (!across || typeof across.state !== 'string') return null;
  const lines = Array.isArray(across.lines) ? across.lines : [];
  const more = Array.isArray(across.more) ? across.more : [];
  const ready = across.state === 'ready' && lines.length > 0;
  const shown = all ? [...lines, ...more] : lines;
  // Folded, the head carries the first line (or the gate message), so the block is never an empty promise.
  const teaser = ready ? lines[0].text : across.message;
  const bodyId = `${uid}-body`;

  return (
    <section className="am" data-surface={surface} data-open={open || undefined} data-state={across.state} aria-labelledby={`${uid}-title`}>
      <h3 className="am-h">
        <button type="button" className="am-head" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((v) => !v)}>
          <span className="am-head__text">
            <span className="am-head__title" id={`${uid}-title`}>{across.title || 'Across your mocks'}</span>
            {!open && teaser ? <span className="am-head__teaser">{teaser}</span> : null}
          </span>
          <ChevronDown className="am-head__chev" size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </h3>
      <div className="am-body" id={bodyId} hidden={!open}>
        {ready ? (
          <>
            <ol className="am-lines">
              {shown.map((line, i) => <Line key={`${line.id}:${line.subject || ''}`} line={line} i={all && i >= lines.length ? i - lines.length : i} />)}
            </ol>
            {more.length ? (
              <button type="button" className="am-more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
                {all ? across.showFewer || 'Show fewer' : across.showAll || `Show all ${lines.length + more.length}`}
              </button>
            ) : null}
          </>
        ) : across.message ? <p className="am-message">{across.message}</p> : null}
        {across.basis ? <p className="am-basis">{across.basis}</p> : null}
        {footer}
      </div>
    </section>
  );
}
