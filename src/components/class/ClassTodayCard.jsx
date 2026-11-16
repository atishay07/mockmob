"use client";
// The class league on Today: one card under the Sunday Mock's, only when it has something to say.
//   figure    Sunday from 11:05 PM and Monday, in a class with a closed Sunday: the class average and your marks, per subject in
//             one line ("Accountancy: class 142, you 168 of 250. 31 sat it."), or the floor's line. It opens /sunday#class.
//   invite    a class code this tab kept through sign-up (the join page's "Sign up free to join"): the class's name and Join,
//             a quiet key (Today's volt stays the lead card's). Joining takes that one tap.
// Nothing on other days, while it is off, for a student in no class, or while the page lands (`hold`).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, School } from 'lucide-react';
import { istDow, sundayWindow } from '@/lib/sundayMock.mjs';
import { CLASS_COPY, CLASS_FULL_MARKS } from '@/lib/classLeague/model.mjs';
import { classWrite, forgetClassCode, pendingClassCode, useClassLeague, useClassLookup } from './useClassLeague';
import './class.css';

const Mark = () => <span className="tcls__mark" aria-hidden="true"><School size={20} strokeWidth={2} /></span>;

/** The card's one line for a closed Sunday: every subject, the class next to you. */
export function todayLine(data) {
  const figs = data?.week?.figures || [];
  if (!figs.length) return '';
  return figs.map((f) => {
    if (!f.enough) return `${f.name}: fewer than 5 sat it, so the average stays hidden.`;
    return `${f.name}: class ${f.average}${f.you ? `, you ${f.you.scored}` : ''} of ${CLASS_FULL_MARKS}. ${f.sat} sat it.`;
  }).join(' ');
}

function PendingInvite({ code, onJoined }) {
  const lookup = useClassLookup(code, true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (lookup.status !== 'ready' || lookup.data?.you === 'member') return null;
  const join = async () => {
    setBusy(true);
    setError('');
    const r = await classWrite('/api/class/join', { code });
    setBusy(false);
    if (r.ok) { forgetClassCode(); onJoined(r.data); return; }
    setError(r.message);
  };
  return (
    <section className="tcls tcls--keyed" aria-labelledby="tcls-h">
      <Mark />
      <div className="tcls__text">
        <b id="tcls-h">{`Join ${lookup.data.name}`}</b>
        <span>{error || 'Your class link from sign-up. Sit the Sunday Mock with them and see the class average each Monday.'}</span>
      </div>
      <button type="button" className="cls-key" onClick={join} disabled={busy} aria-busy={busy || undefined}>{busy ? CLASS_COPY.joining : CLASS_COPY.joinThis}</button>
    </section>
  );
}

export default function ClassTodayCard({ hold = false }) {
  // Read only when the card can have something to say: Sunday or Monday on this device's IST clock (the server's clock then
  // decides), or a class code this tab kept through sign-up. Tuesday to Saturday Today asks for nothing.
  const [dow] = useState(() => istDow(Date.now()));
  const [code, setCode] = useState(null);
  useEffect(() => { const t = setTimeout(() => setCode(pendingClassCode()), 0); return () => clearTimeout(t); }, []);
  const league = useClassLeague(!hold && (dow === 0 || dow === 1 || Boolean(code)));
  if (hold || league.status !== 'ready') return null;
  const data = league.data;
  if (!data?.class) return code ? <PendingInvite code={code} onJoined={(d) => { setCode(null); league.accept(d); }} /> : null;
  const week = data.week?.week;
  if (!week) return null;
  // Sunday from 11:05 PM and Monday (the server's clock): the days the figure is news. Later in the week it waits on the
  // Sunday Mock page.
  const now = Number(data.serverNow);
  const fresh = (istDow(now) === 0 && now >= sundayWindow(week).answersAt) || istDow(now) === 1;
  if (!fresh) return null;
  return (
    <Link className="tcls" href="/sunday#class">
      <Mark />
      <span className="tcls__text"><b>{`Your class: ${data.class.name}`}</b><span>{todayLine(data)}</span></span>
      <ChevronRight className="tcls__go" size={18} strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}
