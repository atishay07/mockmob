"use client";
// Repairs and Revise on Today (TODAY-1018 section 3 row 7; owner D5, Today's half: the repair queue is never hidden).
// Two outlined tiles, because the whole tile is the button (F5: pressable things look pressable):
//   Repairs  the wrong answers on the papers read without a repair yet (F17: a repaired one is never counted open), and
//            the repairs saved but not yet checked on fresh questions;
//   Revise   what comes back today (the API asks at most 10 a day), free.
// Unknown is never zero: a tile whose read failed says so in words.
import Link from 'next/link';
import { openMistakes } from '@/lib/today/move.mjs';

export default function TodayQueue({ papers, repaired, repairRows, revise, dayOne = false, hold = false }) {
  const head = <header className="tg__row"><h2 id="tq-h" className="tg__h">Repairs and Revise</h2></header>;
  if (hold || papers.status === 'loading' || revise.status === 'loading' || repaired.status === 'loading') {
    return <section className="tq tq--wait" aria-labelledby="tq-h" aria-busy="true">{head}<div className="tq__grid" aria-hidden="true"><span className="tq__tile" /><span className="tq__tile" /></div></section>;
  }
  if (dayOne) {
    return (
      <section className="tq" aria-labelledby="tq-h">
        {head}
        <p className="tq__empty">Every wrong answer waits here with its explanation. Repair finds the reason; Revise brings it back after 1, 3, 7 and 21 days.</p>
      </section>
    );
  }
  const list = papers.status === 'ready' ? papers.data || [] : null;
  const map = repaired.status === 'ready' ? repaired.data : null;
  const open = list && map ? list.reduce((n, p) => n + (openMistakes(p, map) || 0), 0) : null;
  const toCheck = Array.isArray(repairRows) ? repairRows.filter((r) => r?.repairedAt && r.checkedState === 'pending').length : null;
  const rv = revise.status === 'ready' ? revise.data : null;
  // Key cards due today join this same Revise line (KEYCARDS-BUILD-SPEC.md section 3: "Revise · 14 due · about 6 minutes",
  // no second line): `keyCards` is null when Key cards are off or unknown, and then the line reads exactly as before.
  const kc = rv && Number.isInteger(rv.keyCards) && rv.keyCards > 0 ? rv.keyCards : 0;
  const due = rv ? rv.due + kc : null;
  const minutes = rv ? (rv.minutes || (rv.due > 0 ? Math.max(5, Math.ceil(rv.due / 5) * 5) : 0)) + (kc ? Number(rv.keyCardsMinutes) || Math.ceil(kc / 4) : 0) : null;
  const reviseSub = !rv ? 'Revise did not load.'
    : due > 0 ? (rv.dueTotal > rv.due ? `${rv.dueTotal + kc} waiting, ${due} today. Free.` : `Free, about ${minutes} min${kc ? `, ${kc === 1 ? '1 Key card' : `${kc} Key cards`} among them` : ''}`)
      : rv.nextDayLabel ? `Nothing due. The next come back ${rv.nextDayLabel}.` : 'Nothing due today.';
  return (
    <section className="tq" aria-labelledby="tq-h">
      {head}
      <div className="tq__grid">
        <Link className="tq__tile" href="/review" aria-label={open == null ? 'Repairs: your open mistakes did not load. Open Your papers.' : `Repairs: ${open} open${toCheck ? `, ${toCheck} repaired and ready to check on fresh questions` : ''}. Open Your papers.`}>
          <span className="tq__h">Repairs</span>
          {open == null ? <span className="tq__s">Your open mistakes did not load.</span> : (
            <>
              <span className="tq__n"><b>{open}</b><span>open</span></span>
              <span className="tq__s">{toCheck ? `${toCheck} repaired, ready to check on fresh questions` : open ? 'Each one waits with its explanation' : 'Every mistake read is repaired'}</span>
            </>
          )}
        </Link>
        <Link className="tq__tile" href="/review/revise" aria-label={due == null ? 'Revise did not load. Open Revise.' : `Revise: ${due} due today. ${reviseSub} Open Revise.`}>
          <span className="tq__h">Revise</span>
          {due == null ? <span className="tq__s">{reviseSub}</span> : (
            <>
              <span className="tq__n"><b>{due}</b><span>due today</span></span>
              <span className="tq__s">{reviseSub}</span>
            </>
          )}
        </Link>
      </div>
    </section>
  );
}
