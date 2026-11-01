'use client';
// "Today's free session is used" (R2 screens 9, ruling 5): the start refused on Free, for the feed and the run alike. One
// message, not two; top-aligned; at most three ways on:
//   headline  Today's free session is used
//   line      Explore questions stay free. Pro has no daily limit.
//   volt      Pick up where you stopped / "Admission of a Partner, 1 of 12" (when today's session can be picked up), else the
//             first way that still works today (due cards), else "Answer single questions" (Explore stays free)
//   line key  Revise 3 due cards, 1 min (when it is not already the volt)
//   text key  See Pro
// Close (the X above it) returns to where the student came from.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { seePro } from './Stage';

const minutesWord = (m) => (m ? `${m} min` : null);

export default function FreeUsed({ data = {}, links, chapterKey = null, minutes = 10 }) {
  const router = useRouter();
  const r = data.resume || null;
  const options = Array.isArray(data.options) ? data.options : [];
  const revise = options.find((o) => o.run?.kind === 'cards') || null;
  const explore = options.find((o) => o.href && o.go === 'explore') || options.find((o) => o.href) || null;
  const resumeHref = r ? (r.kind === 'feed' ? links.feed(r.chapterKey, minutes, { runId: r.id }) : links.run({ chapterKey: r.chapterKey, runId: r.id })) : null;
  const reviseHref = revise ? links.run({ chapterKey: revise.run.chapterKey || chapterKey, minutes: revise.run.minutes, kind: 'cards', cardIds: revise.run.cardIds || [] }) : null;
  const reviseLabel = revise ? [revise.label, minutesWord(revise.run?.minutes)].filter(Boolean).join(', ') : null;
  const exploreHref = explore ? (links.resolve ? links.resolve(explore.href) : explore.href) : links.explore();
  let volt;
  let line = null;
  if (resumeHref) {
    volt = (
      <Link className="kc-btn kc-btn--volt st-endx__main" data-page-primary="" href={resumeHref}>
        <span className="st-endx__mainl">Pick up where you stopped</span>
        <small className="st-endx__sub">{[r.title, r.done && r.of ? `${r.done} of ${r.of}` : null].filter(Boolean).join(', ')}</small>
      </Link>
    );
    if (revise) line = <Link className="kc-btn kc-btn--line st-free__line" href={reviseHref}>{reviseLabel}</Link>;
  } else if (revise) {
    volt = <Link className="kc-btn kc-btn--volt st-endx__main" data-page-primary="" href={reviseHref}><span className="st-endx__mainl">{reviseLabel}</span></Link>;
  } else {
    volt = <Link className="kc-btn kc-btn--volt st-endx__main" data-page-primary="" href={exploreHref}><span className="st-endx__mainl">Answer single questions</span></Link>;
  }
  return (
    <div className="st-free">
      <h1 className="st-free__h">Today&apos;s free session is used</h1>
      <p className="st-free__p">Explore questions stay free. Pro has no daily limit.</p>
      <div className="st-free__keys">
        {volt}
        {line}
        <button type="button" className="st-textkey" onClick={(e) => seePro('learn', e.currentTarget, router.push)}>See Pro</button>
      </div>
    </div>
  );
}
