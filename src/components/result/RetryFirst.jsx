"use client";
// The free step before the key, on the result's "Your mistakes" (owner item W-032: "Repair lets the student retry before seeing
// the key"). A wrong answer or a blank that is not repaired opens sealed: the question and the student's own pick are on the row
// above, and here the student either tries it again or asks for the answer. Neither costs anything, neither is recorded, and
// nothing in this file reaches the server; the paid Repair is not mounted until the page has revealed the key (renderBody in
// ResultPageClient.jsx), and even then it waits for the student's own tap.
//
// The pieces are Review's free answer sheet (components/review/freeSteps.jsx: "Try it again" with the key hidden, the note and
// the two keys), so the two pages cannot drift. The words come from data/retry_first.mjs.
import { useEffect, useRef, useState } from 'react';
import { RETRY_COPY } from '@/../data/retry_first.mjs';
import { FreeKeys, HiddenNote, TryAgain } from '@/components/review/freeSteps';
import './retry-first.css';

/**
 * q           the question as the free steps read it (questionModel)
 * number      its number on the paper
 * repairable  a wrong answer the paid Repair can follow: one fine line says where Repair went and what it costs
 * onTried     ({ pick, right }) the student picked an option: the page reveals the key and the book explanation
 * onShow      the student asked for the answer
 */
export default function RetryFirst({ q, number, repairable = false, onTried, onShow }) {
  const [mode, setMode] = useState('hidden'); // hidden | try
  const sheet = useRef(null);
  // "Try it again" takes its key away, so the focus moves to the first option instead of being lost.
  useEffect(() => {
    if (mode === 'try') sheet.current?.querySelector('button.rvw-opt')?.focus();
  }, [mode]);
  return (
    <div className="rvw-sheet rx-retry" data-mode={mode} ref={sheet}>
      {mode === 'try' ? <TryAgain q={q} number={number} showStem={false} tagPick onPick={onTried} onShow={onShow} /> : <HiddenNote />}
      <FreeKeys mode={mode} onTry={() => setMode('try')} onShow={onShow} />
      {repairable ? <p className="rvw-sheet__fine">{RETRY_COPY.repairComes(number)}</p> : null}
    </div>
  );
}

/**
 * What the try said, above the key and the book explanation it revealed. It takes the focus once, so a screen reader reads it and a
 * keyboard student lands on the new content instead of on the key that went away.
 */
export function RetrySaid({ said }) {
  const line = useRef(null);
  useEffect(() => { line.current?.focus(); }, []);
  return <p className="rx-retry__said" tabIndex={-1} ref={line} data-k={said.right ? 'right' : 'wrong'}><b>{said.lead}</b> {said.rest}</p>;
}
