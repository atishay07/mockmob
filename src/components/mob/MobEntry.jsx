"use client";
// The Mob's entry lines (SOCIAL-SPEC section 9, "present, not in the face"; FEATURE-ADOPTION-2026-10-17 item 8, each
// feature at its moment). One calm line on Today, Practice and Review for a member, with an outlined key or a text link:
// the page's one volt stays the page's own (rule 7). For a student in no Mob, Today alone carries a one-time invitation,
// and only after a week's run (a study week met, or 7 saved sessions): inline, dismissable for good, never a pop-up, gone
// after 7 days. Nothing here when MOB_ENABLED is off, the Mob read fails (Today is a glance: /mob says why), or the
// line has nothing true to say. Each page imports this once and passes nothing it does not already have.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { entryFor, inviteMoment } from './mobEntryModel.mjs';
import { MobRing } from './MobRing';
import { useMob } from './useMob';
import { useMobEnabled } from './MobFlag';
import './mob.css';

const INVITE_KEY = 'mm:mob-invite-line:v1';
const INVITE_DAYS = 7;

/** The invitation's memory on this device: { first, done }. A per-viewer convenience; losing it shows the line again. */
function readInvite() {
  try { return JSON.parse(window.localStorage.getItem(INVITE_KEY) || 'null') || {}; } catch { return {}; }
}
function writeInvite(v) {
  try { window.localStorage.setItem(INVITE_KEY, JSON.stringify(v)); } catch { /* shown again next time */ }
}

function Line({ entry, data, where }) {
  return (
    <section className="mob-entry" aria-label="Your Mob" data-where={where}>
      {entry.ring ? <MobRing compact track={false} size={data.week.size} sat={data.week.sat} week={data.week.start} /> : null}
      <p className="mob-entry__text"><b>{entry.title}</b><span>{entry.line}</span></p>
      <span className="mob-entry__actions"><Link className="mob-key" href={entry.href}>{entry.key || 'See your Mob'}</Link></span>
    </section>
  );
}

/** Today's one-time invitation for a student in no Mob, at the moment it is useful. */
function Invitation({ reason }) {
  const [state, setState] = useState('hidden');
  useEffect(() => {
    const t = window.setTimeout(() => {
      const v = readInvite();
      if (v.done) return;
      const first = Number(v.first) || Date.now();
      if (Date.now() - first > INVITE_DAYS * 86_400_000) { writeInvite({ ...v, done: true }); return; }
      if (!v.first) writeInvite({ first });
      setState('shown');
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  if (state !== 'shown') return null;
  const done = () => { writeInvite({ ...readInvite(), done: true }); setState('hidden'); };
  return (
    <section className="mob-entry" aria-label="Study with friends" data-where="invite">
      <p className="mob-entry__text">
        <b>Sit one paper a week with friends</b>
        <span>{reason} A Mob is up to 5 friends on the same 10 questions each week, free of credits. Only people you send the link to can join.</span>
      </p>
      <span className="mob-entry__actions">
        <Link className="mob-key" href="/mob" onClick={done}>Start a Mob</Link>
        <button type="button" className="mob-link mob-entry__dismiss" onClick={done}>Not now</button>
      </span>
    </section>
  );
}

/**
 * where: 'today' | 'practice' | 'review'. mob: the page's own useMob state when it already reads the Mob (Today), so
 * the Mob is read once. rhythm: Today's rhythm read ({ status, data }), for the invitation's moment.
 */
export function MobEntry({ where, mob: given = null, rhythm = null, inviteOnly = false }) {
  const enabled = useMobEnabled();
  const { user } = useAuth();
  const own = useMob(enabled && !given ? user?.id || null : null);
  const mob = given || own;
  if (!enabled || mob.status !== 'ready') return null;
  const data = mob.mob;
  if (!data) {
    if (where !== 'today') return null;
    const reason = rhythm?.status === 'ready' ? inviteMoment(rhythm.data) : null;
    return reason ? <Invitation reason={reason} /> : null;
  }
  const entry = entryFor(where, data);
  if (!entry) return null;
  if (where === 'review') {
    // Review's rows under Also in Review (Rules, Saved questions): the Mob's row matches them.
    return (
      <Link className="rv8-qrow mk-press mob-rv-entry" href={entry.href}>
        <b>{entry.title}</b>
        <span>{entry.line}</span>
        <svg className="rv8-chev" data-dir="right" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </Link>
    );
  }
  return <Line entry={entry} data={data} where={where} />;
}

export default MobEntry;
