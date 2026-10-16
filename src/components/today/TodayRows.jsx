"use client";
// Two rows under the glance (TODAY-1017 4.5): Last paper and Your colleges. Each row opens its home: the paper's
// result, and Colleges (Compass, where the ladder, the cutoff bar and the Compass count live). No estimate and no
// chance against a cutoff here: the practice score and the DU score are different scales, and Compass owns that.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Plus } from 'lucide-react';
import { useMyColleges } from '@/components/colleges/useMyColleges';
import { loadOfferings, formatScore } from '@/lib/du/client';
import { roundOneCutoff } from '@/lib/du/compassLine.mjs';
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

function LastPaper({ papers, subjectName }) {
  if (papers.status !== 'ready' || !papers.data?.length) return null;
  const [last, ...rest] = papers.data;
  const before = rest.find((p) => p.formatId === last.formatId);
  const delta = before ? last.marks - before.marks : null;
  const mode = TEST_MODES[last.mode]?.label || 'Practice';
  const title = `${subjectName(last.subject)} ${mode.charAt(0).toLowerCase()}${mode.slice(1)}`;
  const change = delta == null ? '' : delta === 0 ? ', level with the one before' : `, ${delta > 0 ? '+' : '−'}${Math.abs(delta)} on the one before`;
  const sub = `${paperDay(last.completedAt)}${change}`;
  return <Row href={`/result/${encodeURIComponent(last.id)}`} label="Last paper" title={title} sub={sub} figure={last.marks} of={`of ${last.maxMarks}`} aria={`Last paper: ${title}, ${sub}, ${last.marks} of ${last.maxMarks} marks. Open it.`} />;
}

function Colleges({ userId }) {
  const mine = useMyColleges(userId);
  const first = mine.status === 'ready' && mine.colleges.length ? mine.colleges[0] : null;
  const firstKey = first ? `${first.programmeId}::${first.college}` : '';
  const [offer, setOffer] = useState({ key: '', cut: null });
  useEffect(() => {
    if (!first) return undefined;
    let alive = true;
    loadOfferings(first.programmeId)
      .then((data) => alive && setOffer({ key: firstKey, cut: roundOneCutoff(data, first, 'UR') }))
      .catch(() => alive && setOffer({ key: firstKey, cut: null }));
    return () => { alive = false; };
    // The key stands for the entry; the object is a new one on every list change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstKey]);
  if (mine.status === 'error') {
    return <li className="tr__note"><span className="tr__label">Your colleges</span><span>Your colleges did not load. <button type="button" className="tm__inline" onClick={mine.retry}>Try again</button></span></li>;
  }
  if (mine.status !== 'ready') return <li className="tr__note tr__note--wait" aria-hidden="true"><span className="tr__label">Your colleges</span><span className="tr__bar" /></li>;
  if (!first) {
    return (
      <li className="tr__note">
        <span className="tr__text"><span className="tr__label">Your colleges</span><span className="tr__sub">Pick up to 8 to see their 2026 cutoffs here.</span></span>
        <Link className="tm__pill tr__choose" href="/admission-compass"><Plus size={17} strokeWidth={1.75} aria-hidden="true" />Choose</Link>
      </li>
    );
  }
  const more = mine.colleges.length - 1;
  const cut = offer.key === firstKey ? offer.cut : null;
  const cat = cut ? (cut.category === 'UR' ? 'unreserved' : cut.category) : '';
  const sub = `${first.programme ? `${first.programme}, ` : ''}2026 Round 1${cat ? `, ${cat}` : ''}.${more > 0 ? ` ${more} more saved.` : ''}`;
  return <Row href="/admission-compass" label="Your colleges" title={first.college} sub={sub} figure={cut ? formatScore(cut.cutoff) : null} of={cut ? 'of 1000' : null} aria={`Your colleges: ${first.college}, ${sub}${cut ? ` Cutoff ${formatScore(cut.cutoff)} of 1000.` : ''} Open Colleges.`} />;
}

export default function TodayRows({ papers, userId, subjectName }) {
  return (
    <ul className="tr" aria-label="Your record">
      <LastPaper papers={papers} subjectName={subjectName} />
      {userId ? <Colleges userId={userId} /> : null}
    </ul>
  );
}
