"use client";

// Your answer sheet: every question from the sessions in the record, one bubble each, grouped by
// outcome (right, wrong, blank). The bubbles ink in when the sheet scrolls into view. Pointing
// at a bubble, dragging a finger across the sheet, or choosing a group below it lights that group
// and says how many it holds. Order inside a group is not the order the student answered in, and
// the sheet says so. A very long record shows one bubble per few questions and says that too.
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useInView } from '@/lib/motion';

const MAX_BUBBLES = 160;
const KINDS = [
  { k: 'right', name: 'Right' },
  { k: 'wrong', name: 'Wrong' },
  { k: 'skip', name: 'Blank' },
];

/** The scrub label for one group. Exported so the wording is tested in one place. */
export function sheetLabel(kind, right, wrong, blank) {
  const answered = right + wrong;
  if (kind === 'skip') return `Blank, ${blank} of ${answered + blank} left unanswered`;
  const n = kind === 'right' ? right : wrong;
  return `${kind === 'right' ? 'Right' : 'Wrong'}, ${n} of ${answered} answered`;
}

export default function AnswerSheet({ right, wrong, blank }) {
  const [seenRef, seen] = useInView({ threshold: 0.2 });
  const [active, setActive] = useState(null); // 'right' | 'wrong' | 'skip' | null
  const sheet = useRef(null);
  const total = right + wrong + blank;
  const per = Math.max(1, Math.ceil(total / MAX_BUBBLES));
  const counts = { right, wrong, skip: blank };

  const bubbles = useMemo(() => {
    const out = [];
    KINDS.forEach(({ k }) => {
      const n = Math.ceil(counts[k] / per);
      for (let i = 0; i < n; i += 1) out.push(k);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [right, wrong, blank, per]);

  const read = useCallback((event) => {
    const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-k]');
    if (hit && sheet.current?.contains(hit)) setActive(hit.dataset.k);
  }, []);

  if (total === 0) return null;
  const text = active ? sheetLabel(active, right, wrong, blank) : `${right + wrong} answered, ${blank} left blank`;

  return (
    <section aria-labelledby="pp-s" ref={seenRef}>
      <h3 id="pp-s" className="pp-h">Your answer sheet</h3>
      <div
        ref={sheet}
        className="as"
        data-in={seen ? 'true' : 'false'}
        data-active={active || undefined}
        role="img"
        aria-label={`${right} right, ${wrong} wrong, ${blank} blank, across ${total} questions`}
        onPointerMove={read}
        onPointerDown={read}
        onPointerLeave={(event) => { if (event.pointerType === 'mouse') setActive(null); }}
      >
        {bubbles.map((k, i) => <i key={i} data-k={k} style={{ '--i': Math.min(i, 70) }} />)}
      </div>
      <p className="as__label" data-k={active || undefined}>{text}</p>
      <div className="as__legend" role="group" aria-label="Light up a group">
        {KINDS.map(({ k, name }) => (
          <button key={k} type="button" aria-pressed={active === k} data-k={k} onClick={() => setActive((a) => (a === k ? null : k))}>
            <i aria-hidden="true" />{name} {counts[k]}
          </button>
        ))}
      </div>
      <p className="pp-note">Grouped by outcome, so the order inside a group is not the order you answered in.{per > 1 ? ` Each bubble stands for up to ${per} questions.` : ''}</p>
    </section>
  );
}
