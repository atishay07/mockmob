"use client";
// After a Mob paper (the attempt's selectionMeta.mobPaper), one quiet row under the result's hero (SOCIAL-SPEC 7 and 9):
// the ring, how many sat, what you have in common with members who show their score, and the way back to /mob. It is the
// loop's payoff surface for a Mob of two, where the trap (3 or more sitters) never shows. Outlined key only: the result's
// Repair key stays the one volt (AGENT_RULES 7). No rank (P5), no non-sitter named (P6). Nothing until the server answers.
import Link from 'next/link';
import { ringLine, togetherLine, trapLine } from '@/lib/mob/model.mjs';
import { MobRing } from './MobRing';
import { useMob } from './useMob';
import './mob.css';

export function MobResultRow({ mobPaper }) {
  const mob = useMob(mobPaper ? 'mob-paper' : null);
  const data = mob.mob;
  if (!mobPaper || mob.status !== 'ready' || !data) return null;
  const { week } = data;
  // A paper from an earlier week: this week's ring would describe a different paper, so the row only leads back.
  const thisWeek = !mobPaper.weekStart || mobPaper.weekStart === week.start;
  return (
    <section className="mob-result" aria-labelledby="mob-result-h">
      {thisWeek ? <MobRing compact size={week.size} sat={week.sat} week={week.start} /> : null}
      <div className="mob-result__text">
        <h2 id="mob-result-h" className="mob-h3">{thisWeek ? `Your Mob: ${ringLine(week.sat, week.size)}` : 'This was one of your Mob\'s weekly papers'}</h2>
        {thisWeek && data.together ? <p className="mob-note">{togetherLine(data.together)}</p> : null}
        {thisWeek && data.trap ? <p className="mob-note">{trapLine(data.trap)}</p> : null}
        <Link className="mob-key" href="/mob">See your Mob</Link>
      </div>
    </section>
  );
}

export default MobResultRow;
