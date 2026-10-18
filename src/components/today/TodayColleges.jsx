"use client";
// Your colleges on Today (TODAY-1018 section 3 row 8; R3's row and data unchanged). The first saved college with its
// 2026 Round 1 unreserved cutoff, the subject-rules fit against the student's subjects (the same engine and starting
// subjects as Compass, so Today never disagrees with it) and "Open in Compass". No estimate and no chance against a
// cutoff here: the practice score and the DU score are different scales, and Compass owns that.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Compass, Plus } from 'lucide-react';
import { useMyColleges } from '@/components/colleges/useMyColleges';
import { decodeSelection, loadOfferings, loadRules, formatScore, readSaved } from '@/lib/du/client';
import { roundOneCutoff, startingList } from '@/lib/du/compassLine.mjs';
import { evaluateGroup, gapSize } from '@/lib/du/eligibility';

// Does the student's subject list meet the programme's DU subject rules? The same engine and the same starting subjects
// as the Compass page (a choice kept on this device, else the profile), so Today never disagrees with Compass.
function fitFor(rules, programmeId, subjects) {
  const group = Array.isArray(rules?.groups) ? rules.groups.find((g) => g.id === programmeId) : null;
  if (!group) return null;
  let saved = null;
  try { saved = readSaved(); } catch { saved = null; }
  const selection = decodeSelection(startingList({ saved, profile: subjects }), rules);
  if (selection.languages.length + selection.domains.length === 0 && !selection.gat) return { kind: 'none' };
  const r = evaluateGroup(group, selection);
  return r.eligible ? { kind: 'meets' } : { kind: 'short', by: r.nearest ? gapSize(r.nearest.gaps) : null };
}

const fitLine = (fit) => (!fit ? '' : fit.kind === 'meets' ? 'Your subjects meet its DU subject rules.'
  : fit.kind === 'none' ? 'Add your subjects to check its DU subject rules.'
    : fit.by ? `Your subjects are ${fit.by} ${fit.by === 1 ? 'subject' : 'subjects'} short of its DU subject rules.` : 'Your subjects do not meet its DU subject rules yet.');

// The colleges row's reads: My colleges, then the first college's cutoff and the subject check together, so the row lands
// once. `status` is 'loading' until all of it is known (or 'error' / 'empty' / 'ready').
function useCollegeRow(userId, subjects) {
  const mine = useMyColleges(userId);
  const first = mine.status === 'ready' && mine.colleges.length ? mine.colleges[0] : null;
  const firstKey = first ? `${first.programmeId}::${first.college}` : '';
  const [offer, setOffer] = useState({ key: '', cut: null, fit: null });
  const subjectKey = (subjects || []).join(',');
  useEffect(() => {
    if (!first) return undefined;
    let alive = true;
    Promise.all([loadOfferings(first.programmeId).catch(() => null), Promise.resolve(loadRules()).catch(() => null)])
      .then(([data, rules]) => alive && setOffer({ key: firstKey, cut: data ? roundOneCutoff(data, first, 'UR') : null, fit: rules ? fitFor(rules, first.programmeId, subjects) : null }));
    return () => { alive = false; };
    // The key stands for the entry; the object is a new one on every list change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstKey, subjectKey]);
  if (!userId) return { status: 'none' };
  if (mine.status === 'error') return { status: 'error', retry: mine.retry };
  if (mine.status !== 'ready') return { status: 'loading' };
  if (!first) return { status: 'empty' };
  if (offer.key !== firstKey) return { status: 'loading' };
  return { status: 'ready', first, more: mine.colleges.length - 1, cut: offer.cut, fit: offer.fit };
}

/** `hold`: the move is still on its way; the row waits with it so the page lands in one piece (W-042). */
export default function TodayColleges({ userId, subjects = [], hold = false }) {
  const row = useCollegeRow(userId, subjects);
  const head = <header className="tg__row"><h2 id="tc-h" className="tg__h">Your colleges</h2></header>;
  if (row.status === 'none') return null;
  if (hold || row.status === 'loading') {
    return <section className="tc tc--wait" aria-labelledby="tc-h" aria-busy="true">{head}<span className="tc__skl" /><span className="tc__skl tc__skl--s" /></section>;
  }
  if (row.status === 'error') {
    return <section className="tc" aria-labelledby="tc-h">{head}<p className="tc__empty" role="status">Your colleges did not load. <button type="button" className="tm__inline" onClick={row.retry}>Try again</button></p></section>;
  }
  if (row.status === 'empty') {
    // Colleges are picked in onboarding (owner, 16 Oct); a student who skipped it adds them on Account's one list.
    return (
      <section className="tc" aria-labelledby="tc-h">
        {head}
        <div className="tc__fit"><p>Pick up to 8 colleges to see their 2026 cutoffs here.</p><Link className="tm__pill" href="/profile#colleges"><Plus size={16} strokeWidth={1.75} aria-hidden="true" />Choose colleges</Link></div>
      </section>
    );
  }
  const { first, more, cut } = row;
  const cat = cut ? (cut.category === 'UR' ? 'unreserved' : cut.category) : '';
  const sub = `${first.programme ? `${first.programme}, ` : ''}2026 Round 1${cat ? `, ${cat}` : ''}.${more > 0 ? ` ${more} more saved.` : ''}`;
  const fit = fitLine(row.fit);
  const planHref = `/admission-compass?course=${encodeURIComponent(first.programmeId)}`;
  return (
    <section className="tc" aria-labelledby="tc-h">
      {head}
      <Link className="tc__row" href="/admission-compass" aria-label={`${first.college}, ${sub}${cut ? ` Cutoff ${formatScore(cut.cutoff)} of 1000.` : ''} Open Colleges.`}>
        <span className="tc__t" aria-hidden="true"><b>{first.college}</b><span>{sub}</span></span>
        {cut ? <span className="tc__fig" aria-hidden="true"><b>{formatScore(cut.cutoff)}</b><span>cutoff of 1000</span></span> : null}
        <ChevronRight className="tc__chev" size={20} strokeWidth={1.75} aria-hidden="true" />
      </Link>
      <div className="tc__fit">
        {fit ? <p data-fit={row.fit?.kind}>{fit}</p> : <span />}
        <Link className="tm__pill" href={planHref}><Compass size={16} strokeWidth={1.75} aria-hidden="true" />Open in Compass</Link>
      </div>
    </section>
  );
}
