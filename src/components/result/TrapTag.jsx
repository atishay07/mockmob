"use client";
// The trap tag under a wrong option in an opened answer (spec tmp/mistake-lab-v4/SPEC.md 4.7, second part): "Trap: a
// look-alike term", with where the name comes from in small text ("Named by Mistake Repair" or "From the question format"),
// and for a format trap the one sentence that says why ("This option and the key agree on both statements; only the link
// differs."). Every sentence comes finished from the server (lab.traps, data/trap_atlas.js, contract_traps_v1.json); the
// tag never claims a cause and never names the student's mind. It shows only on the student's own wrong option, only when
// the server sent one (no held key, no key-quality flag, no repair that disagrees), and it adds a row under the option's
// text, so it never covers anything.
import { TriangleAlert } from 'lucide-react';
import './traps-later.css';

export default function TrapTag({ trap }) {
  if (!trap || typeof trap.text !== 'string' || !trap.text) return null;
  return (
    <div className="tt" data-source={trap.source || undefined}>
      <TriangleAlert className="tt__icon" size={15} strokeWidth={2.1} aria-hidden="true" />
      <p className="tt__text">
        <b>{trap.text}</b>
        {trap.detail ? <span className="tt__detail">{trap.detail}</span> : null}
        {trap.sourceText ? <small className="tt__source">{trap.sourceText}</small> : null}
      </p>
    </div>
  );
}
