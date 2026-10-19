"use client";
// A Mob paper's result while the paper is still open for the Mob (C-dec 2 item 1, src/lib/mob/paperHold.mjs). The server
// sends the marks and the counts and when the answers open, and nothing that gives an answer away, so this page shows the
// same summary as any result (the score, right, wrong, blank) and, in place of the answers, one plain panel: when they open
// and why. The Mob row under it leads back to the Mob. When the moment passes with the page open, it reads the result
// again and the full result takes its place.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ResultHero from '@/components/result/ResultHero';
import { MobResultRow } from '@/components/mob/MobResultRow';
import { AppIcon } from '@/components/ui/Glyph';
import { receiptLine } from '@/../data/result_next_move.mjs';
import { practiceSubjectId } from '@/lib/paperCopy.mjs';
import { GAP } from '@/../data/session_recovery';
import { mobiReaction } from './reaction';
import { opensIn } from '@/lib/mob/paperHold.mjs';
import './held.css';

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export default function HeldResult({ attempt, subjectName, celebrations = 'full', onOpened }) {
  const hold = attempt.mobHold;
  const until = Date.parse(hold.until);
  const [now, setNow] = useState(() => Date.now());
  // The countdown moves once a minute; at the moment itself the page reads the result again (the answers are open then).
  useEffect(() => {
    if (!Number.isFinite(until)) return undefined;
    const left = until - Date.now();
    if (left <= 0) { onOpened?.(); return undefined; }
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    // A timer further than about 24 days away overflows; the minute tick covers it then.
    const open = left < 20 * 86_400_000 ? window.setTimeout(() => onOpened?.(), left + 1500) : null;
    return () => { window.clearInterval(tick); if (open) window.clearTimeout(open); };
  }, [until, onOpened]);

  const right = n(attempt.correct);
  const wrong = n(attempt.wrong);
  const blank = n(attempt.unattempted);
  const max = n(attempt.total) * 5;
  const scored = right * 5 - wrong;
  const marks = { scored, max, gap: max - scored, gapWrong: wrong * GAP.wrong, gapBlank: blank * GAP.blank, right, wrong, blank };
  const finding = { line: 'Your marks are in. Which answers were right, and why, opens with the answers.' };
  const receipt = receiptLine({ subjectName, mode: attempt.mode || 'quick', completedAt: attempt.completedAt });
  const reaction = mobiReaction(attempt, { celebrations });
  const tag = attempt.selectionMeta?.mobPaper || { mobId: hold.mobId, weekStart: hold.weekStart, ...(hold.extraId ? { extraId: hold.extraId } : {}) };

  return (
    <div className="container-narrow student-page student-page--result rp rx rl-page pb-20">
      <ResultHero receipt={receipt} marks={marks} finding={finding} reaction={reaction} />
      <section className="rh-hold mk-rise" aria-labelledby="rh-hold-title">
        <span className="rh-hold__icon" aria-hidden="true"><AppIcon name="lock" size={20} /></span>
        <div className="rh-hold__text">
          <h2 id="rh-hold-title">{hold.title}</h2>
          <p>{hold.line}</p>
          <p className="rh-hold__when">
            <AppIcon name="clock" size={15} />
            <span>They open <time dateTime={hold.until}>{opensIn(until, now)}</time>, right here on this page.</span>
          </p>
        </div>
      </section>
      <MobResultRow mobPaper={tag} />
      <nav className="rp-links" aria-label="While you wait">
        <Link href={`/dashboard?${new URLSearchParams({ subject: practiceSubjectId(attempt.subject), mode: 'quick' })}`}><AppIcon name="practice" size={16} />Practise {subjectName || 'this subject'} while you wait</Link>
        <Link href="/review"><AppIcon name="review" size={16} />All saved mistakes</Link>
      </nav>
    </div>
  );
}
