"use client";
// Today's Mob card (SOCIAL-SPEC sections 7 and 9): only when you are in a Mob, the ring and one action. Present, not in
// the face: no Mob means no card, a failed read means no card (Today is a glance, /mob says why and retries).
// Wiring: one import line in src/app/(app)/today/page.jsx after WEB-PASS WP-B merges (WP-B owns that file).
import Link from 'next/link';
import { canAfford, costLine, nudgeLine, paperHref, ringLine } from '@/lib/mob/model.mjs';
import { MobRing } from './MobRing';
import { useMob } from './useMob';
import './mob.css';

export function MobTodayCard({ userId }) {
  const mob = useMob(userId);
  const data = mob.mob;
  if (!userId || mob.status !== 'ready' || !data) return null;
  const { week, nudge } = data;
  const sit = !week.youSat && !week.closed && week.size > 1;
  return (
    <section className="mob-today" aria-labelledby="mob-today-h">
      <MobRing compact size={week.size} sat={week.sat} week={week.start} />
      <div className="mob-today__text">
        <h2 id="mob-today-h" className="mob-h2">Your Mob</h2>
        <p className="mob-note">{ringLine(week.sat, week.size)}.</p>
        {nudge.received ? <p className="mob-note">{nudgeLine(nudge.received.fromName)}</p> : null}
        {sit && canAfford(week.paper.cost)
          ? <><Link className="mob-key" href={paperHref(data)}>Sit this week&apos;s paper</Link><p className="mob-cost">{costLine(week.paper.cost)}</p></>
          : <Link className="mob-key" href="/mob">See your Mob</Link>}
      </div>
    </section>
  );
}

export default MobTodayCard;
