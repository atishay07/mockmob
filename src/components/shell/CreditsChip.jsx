"use client";

// The phone and tablet header's one credits chip (plan 2.1). It names its number ("40 credits")
// and opens a small popover with plain labelled lines from data/plan_facts.mjs and the wallet:
//   "Practice credits 40: pay for mocks and practice."
//   "AI credits 8 of 10 this month: pay for Mistake Repair and Ask Mobi. Renews 1 Nov."
// Esc, a press outside or the chip again closes it, and focus returns to the chip.
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { chipLabel, chipSpoken, popoverLines } from './shellModel.mjs';

export default function CreditsChip({ practiceBalance = null, aiRemaining = null, wallet = null, pro = false, href = '/profile#plan' }) {
  const [open, setOpen] = useState(false);
  const chip = useRef(null);
  const panel = useRef(null);
  const id = useId();
  const label = chipLabel({ practiceBalance, aiRemaining, pro });

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') { setOpen(false); chip.current?.focus(); } };
    const onDown = (event) => { if (!panel.current?.contains(event.target) && !chip.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open]);

  // Nothing known yet: keep the chip's place so the header does not shift when it arrives.
  if (!label) return <span className="sh-chip sh-chip--placeholder" aria-hidden="true" />;
  const lines = popoverLines({ practiceBalance, wallet, pro });
  return (
    <div className="sh-chip-wrap">
      <button ref={chip} type="button" className="sh-chip" aria-expanded={open} aria-controls={id} aria-label={chipSpoken({ practiceBalance, aiRemaining, pro })}
        onClick={() => setOpen((v) => !v)}>
        <span className="sh-chip__dot" aria-hidden="true" />
        <span>{label}</span>
      </button>
      <div ref={panel} id={id} className="sh-popover" role="region" aria-label="Your credits" hidden={!open}>
        <ul>
          {lines.map((line) => <li key={line.id}>{line.text}</li>)}
        </ul>
        <Link href={href} className="sh-popover__link" onClick={() => setOpen(false)}>Plan and credits</Link>
      </div>
    </div>
  );
}
