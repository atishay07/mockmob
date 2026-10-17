"use client";

// Admission Compass on Today: one quiet section in the record, not a card. It says how many DU programmes
// the student's own subjects open (the Compass page's own count, via src/lib/du/compassLine.mjs), has one
// key that opens Compass, and, when My colleges has a first college, shows it with DU's 2026 Round 1
// cutoff. A student with no subjects is asked for them with one key. Nothing is guessed: while the DU
// rules load the line keeps its height, and if they cannot load the section still opens Compass.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useMyColleges } from '@/components/colleges/useMyColleges';
import { loadOfferings, loadRules, readSaved } from '@/lib/du/client';
import {
  COMPASS_HREF, NO_SUBJECTS_KEY, NO_SUBJECTS_LINE, OPEN_KEY, compassState, cutoffLine, roundOneCutoff,
} from '@/lib/du/compassLine.mjs';
import './today-compass.css';

export default function TodayCompass() {
  const { user } = useAuth();
  const userId = user?.id;
  const mine = useMyColleges(userId);
  // The device's own Compass selection is read after mount (the server render cannot see it).
  const [load, setLoad] = useState({ status: 'loading', rules: null, saved: null });
  useEffect(() => {
    let alive = true;
    loadRules()
      .then((rules) => alive && setLoad({ status: 'ready', rules, saved: readSaved() }))
      .catch(() => alive && setLoad({ status: 'failed', rules: null, saved: null }));
    return () => { alive = false; };
  }, []);

  const state = useMemo(
    () => (load.status === 'ready' ? compassState({ rules: load.rules, saved: load.saved, profile: user?.subjects || [] }) : null),
    [load, user?.subjects],
  );

  // The first college on My colleges, and its cutoff once that programme's file is in.
  const first = mine.status === 'ready' && mine.colleges.length ? mine.colleges[0] : null;
  const firstKey = first ? `${first.programmeId}::${first.college}` : '';
  const [offer, setOffer] = useState({ key: '', data: null });
  useEffect(() => {
    if (!first) return undefined;
    let alive = true;
    loadOfferings(first.programmeId)
      .then((data) => alive && setOffer({ key: firstKey, data }))
      .catch(() => alive && setOffer({ key: firstKey, data: null }));
    return () => { alive = false; };
    // The key stands for the entry; the object is a new one on every list change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstKey]);
  const cut = first && offer.key === firstKey && offer.data ? roundOneCutoff(offer.data, first, state?.category || 'UR') : null;

  if (!userId) return null;
  const loading = load.status === 'loading';
  const askForSubjects = state?.status === 'no-subjects';
  const ready = state?.status === 'ready';

  return (
    <section className="tcp" aria-labelledby="tcp-h" data-state={loading ? 'loading' : ready ? 'ready' : askForSubjects ? 'ask' : 'plain'}>
      <div className="tcp__text">
        <h2 id="tcp-h" className="tcp__h">Colleges</h2>
        {loading ? <span className="tcp__bar" aria-hidden="true" /> : null}
        {ready ? (
          <p className="tcp__line">
            <b className="tcp__n">{state.open} of {state.total}</b> DU programmes open to your subjects
          </p>
        ) : null}
        {askForSubjects ? <p className="tcp__line">{NO_SUBJECTS_LINE}</p> : null}
        {!loading && !ready && !askForSubjects ? <p className="tcp__line">See which DU programmes your subjects open, and DU&rsquo;s 2026 cutoffs.</p> : null}
        {ready && first ? (
          <p className="tcp__near">
            First on My colleges: <b>{first.college}</b>
            {cut ? <span>{cutoffLine(cut)}{first.programme ? ` in ${first.programme}` : ''}</span> : null}
          </p>
        ) : null}
      </div>
      <Link className="tcp__key" href={COMPASS_HREF}>{askForSubjects ? NO_SUBJECTS_KEY : OPEN_KEY}</Link>
    </section>
  );
}
