"use client";
// Practice's way to the Mob (W-062): while this week's Mob paper is open and you have not sat it, one pressable chip
// under the head, "Sit it with your Mob", with who has sat it. Off (MOB_ENABLED unset), not in a Mob, already sat, or a
// failed read: nothing is drawn and /api/mob is never asked (useMob reads only when given a user id).
import Link from 'next/link';
import { Users } from 'lucide-react';
import { useMobEnabled } from './MobFlag';
import { useMob } from './useMob';
import { canAfford, paperHref } from '@/lib/mob/model.mjs';
import './mob.css';

export default function PracticeMobChip({ userId }) {
  const on = useMobEnabled();
  const mob = useMob(on ? userId : null);
  const data = mob.status === 'ready' ? mob.mob : null;
  const week = data?.week;
  if (!on || !week || week.youSat || week.closed || !(week.size > 1) || week.paper?.blocked === 'free_used' || !canAfford(week.paper?.cost)) return null;
  return (
    <Link className="mob-chip" href={paperHref(data)} aria-label={`Sit this week's paper with your Mob: ${week.sat} of ${week.size} have sat it. ${week.paper?.count || 10} questions.`}>
      <Users size={17} strokeWidth={1.75} aria-hidden="true" />
      <span aria-hidden="true"><b>Sit it with your Mob</b> {week.sat} of {week.size} have sat this week&apos;s {week.paper?.count || 10}-question paper</span>
    </Link>
  );
}
