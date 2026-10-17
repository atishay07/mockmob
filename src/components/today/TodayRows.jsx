"use client";
// Two rows under the glance (TODAY-1017 4.5): Last paper and Your colleges. Each row opens its home: the paper's
// result, and Colleges (Compass, where the ladder, the cutoff bar and the Compass count live). No estimate and no
// chance against a cutoff here: the practice score and the DU score are different scales, and Compass owns that.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Compass, Plus } from 'lucide-react';
import { useMyColleges } from '@/components/colleges/useMyColleges';
import { decodeSelection, loadOfferings, loadRules, formatScore, readSaved } from '@/lib/du/client';
import { roundOneCutoff, startingList } from '@/lib/du/compassLine.mjs';
import { evaluateGroup, gapSize } from '@/lib/du/eligibility';
import { paperDay } from '@/lib/today/move.mjs';
import { TEST_MODES } from '@/../data/test_modes';

function Row({ href, label, title, sub, figure, of, aria }) {
  return (
    <li>
      <Link className="tr__row" href={href} aria-label={aria}>
        <span className="tr__text">
          <span className="tr__label">{label}</span>
          <span className="tr__title">{title}</span>
          {sub ? <span className="tr__sub">{sub}</span> : null}
        </span>
        {figure != null ? <span className="tr__fig"><b>{figure}</b>{of ? <small>{of}</small> : null}</span> : null}
        <ChevronRight className="tr__chev" size={20} strokeWidth={1.75} aria-hidden="true" />
      </Link>
    </li>
  );
}

// A row's resting shape while its read is on its way: the same 76 px as the row it becomes, so nothing below moves
// when it lands (W-042: no section arrives late and shifts the page).
function Waiting({ label }) {
  return <li className="tr__note tr__note--wait" aria-hidden="true"><span className="tr__text"><span className="tr__label">{label}</span><span className="tr__bar" /></span><span className="tr__figbar" /></li>;
}

function LastPaper({ papers, subjectName }) {
  if (papers.status === 'loading') return <Waiting label="Last paper" />;
  if (papers.status !== 'ready' || !papers.data?.length) return null;
  const [last, ...rest] = papers.data;
  const before = rest.find((p) => p.formatId === last.formatId);
  const delta = before ? last.marks - before.marks : null;
  const mode = TEST_MODES[last.mode]?.label || 'Practice';
  const title = `${subjectName(last.subject)} ${mode.charAt(0).toLowerCase()}${mode.slice(1)}`;
  const change = delta == null ? '' : delta === 0 ? ', level with the one before' : `, ${delta > 0 ? '+' : '−'}${Math.abs(delta)} on the one before`;
  // The first paper's receipt (W-064, FEATURE-ADOPTION 5): what it gave the student, in the record's own numbers.
  const firstReceipt = !rest.length && Number(last.wrong) > 0 ? `. Your first paper: its ${last.wrong} ${Number(last.wrong) === 1 ? 'mistake is' : 'mistakes are'} in Review, each with its explanation` : '';
  const sub = `${paperDay(last.completedAt)}${change}${firstReceipt}`;
  return <Row href={`/result/${encodeURIComponent(last.id)}`} label="Last paper" title={title} sub={sub} figure={last.marks} of={`of ${last.maxMarks}`} aria={`Last paper: ${title}, ${sub}, ${last.marks} of ${last.maxMarks} marks. Open it.`} />;
}

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

function Colleges({ row }) {
  if (row.status === 'none') return null;
  if (row.status === 'error') {
    return <li className="tr__note"><span className="tr__label">Your colleges</span><span>Your colleges did not load. <button type="button" className="tm__inline" onClick={row.retry}>Try again</button></span></li>;
  }
  if (row.status === 'loading') return <Waiting label="Your colleges" />;
  if (row.status === 'empty') {
    // Colleges are picked in onboarding (owner, 16 Oct); a student who skipped it adds them on Account's one list.
    return (
      <li className="tr__note">
        <span className="tr__text"><span className="tr__label">Your colleges</span><span className="tr__sub">Pick up to 8 to see their 2026 cutoffs here.</span></span>
        <Link className="tm__pill tr__choose" href="/profile#colleges"><Plus size={17} strokeWidth={1.75} aria-hidden="true" />Choose</Link>
      </li>
    );
  }
  const { first, more, cut } = row;
  const cat = cut ? (cut.category === 'UR' ? 'unreserved' : cut.category) : '';
  const sub = `${first.programme ? `${first.programme}, ` : ''}2026 Round 1${cat ? `, ${cat}` : ''}.${more > 0 ? ` ${more} more saved.` : ''}`;
  const fit = fitLine(row.fit);
  // The college's next step (W-047): the course opened in Compass, with its rules checked against your subjects and its
  // cutoffs college by college. A plain link, so it always does something.
  const planHref = `/admission-compass?course=${encodeURIComponent(first.programmeId)}`;
  return (
    <>
      <Row href="/admission-compass" label="Your colleges" title={first.college} sub={sub} figure={cut ? formatScore(cut.cutoff) : null} of={cut ? 'of 1000' : null} aria={`Your colleges: ${first.college}, ${sub}${cut ? ` Cutoff ${formatScore(cut.cutoff)} of 1000.` : ''} Open Colleges.`} />
      {fit ? (
        <li className="tr__plan">
          <p className="tr__fit" data-fit={row.fit?.kind}>{fit}</p>
          <Link className="tm__pill tr__plan-key" href={planHref}><Compass size={17} strokeWidth={1.75} aria-hidden="true" />Plan for it</Link>
        </li>
      ) : null}
    </>
  );
}

/** `hold`: the move is still on its way; the rows wait with it, and with each other, so the page lands in one piece (W-042). */
export default function TodayRows({ papers, userId, subjectName, subjects = [], hold = false }) {
  const row = useCollegeRow(userId, subjects);
  if (hold || papers.status === 'loading' || row.status === 'loading') {
    return (
      <ul className="tr" aria-label="Your record" aria-busy="true">
        <Waiting label="Last paper" />
        {userId ? <Waiting label="Your colleges" /> : null}
      </ul>
    );
  }
  return (
    <ul className="tr" aria-label="Your record">
      <LastPaper papers={papers} subjectName={subjectName} />
      <Colleges row={row} />
    </ul>
  );
}
