"use client";
// After a Mob paper (the attempt's selectionMeta.mobPaper), one quiet row under the result's hero (SOCIAL-SPEC 7 and 9):
// the ring, how many sat, what you have in common with members who show their score, and the way back to /mob. It is the
// loop's payoff surface for a Mob of two, where the trap (3 or more sitters) never shows. Outlined key only: the result's
// Repair key stays the one volt (AGENT_RULES 7). No rank (P5), no non-sitter named (P6). Nothing is claimed until the
// server answers: while it reads, the row holds its place so the result does not jump when it arrives.
import Link from 'next/link';
import { ringLine, togetherLine, trapLine } from '@/lib/mob/model.mjs';
import { MobRing } from './MobRing';
import { useMob } from './useMob';
import './mob.css';

export function MobResultRow({ mobPaper }) {
  const mob = useMob(mobPaper ? 'mob-paper' : null, { mobId: mobPaper?.mobId });
  const data = mob.mob;
  if (!mobPaper) return null;
  if (mob.status === 'disabled') return null;
  if (!data) {
    if (mob.status === 'error') {
      return (
        <section className="mob-result mob-result--plain" aria-labelledby="mob-result-h">
          <div className="mob-result__text">
            <h2 id="mob-result-h" className="mob-h3">Your sitting counts toward your Mob</h2>
            <p className="mob-note">The ring did not load here. It will be up to date on your Mob page.</p>
            <Link className="mob-key" href="/mob">Back to your Mob</Link>
          </div>
        </section>
      );
    }
    if (mob.status === 'ready') return null; // left the Mob since: nothing to say
    return (
      <section className="mob-result" aria-busy="true" aria-label="Loading your Mob">
        <span className="mob-skel mob-skel--ring72" />
        <div className="mob-result__text"><span className="mob-skel mob-skel--line" /><span className="mob-skel mob-skel--line" /></div>
      </section>
    );
  }
  const { week } = data;
  const extra = mobPaper.extraId ? (data.extras || []).find((x) => x.id === mobPaper.extraId) : null;
  // A paper from an earlier week: this week's ring would describe a different paper, so the row only leads back.
  const thisWeek = !extra && (!mobPaper.weekStart || mobPaper.weekStart === week.start);
  const teaser = thisWeek ? data.compare?.teaser?.text : extra?.compare?.teaser?.text;
  return (
    <section className="mob-result" aria-labelledby="mob-result-h">
      {thisWeek ? <MobRing compact track={false} size={week.size} sat={week.sat} week={week.start} /> : null}
      <div className="mob-result__text">
        <h2 id="mob-result-h" className="mob-h3">
          {thisWeek ? `Your Mob: ${ringLine(week.sat, week.size)}` : extra ? `Your Mob's extra paper: ${extra.sat} of ${week.size} sat` : 'This was one of your Mob\'s weekly papers'}
        </h2>
        {thisWeek && data.together ? <p className="mob-note">{togetherLine(data.together)}</p> : null}
        {teaser && !(thisWeek && data.together) ? <p className="mob-note">{teaser}</p> : null}
        {thisWeek && data.trap ? <p className="mob-note">{trapLine(data.trap)}</p> : null}
        <Link className="mob-key" href="/mob">Back to your Mob</Link>
      </div>
    </section>
  );
}

export default MobResultRow;
