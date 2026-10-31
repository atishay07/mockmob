'use client';
// The lead card above Explore's question list when a chapter is chosen (DESIGN-SPEC A6, B 3.8):
//   "Run this chapter as a feed" / "10 minutes: 12 Key cards and 6 questions, one at a time."
//   A three-way length (5, 10, 20 minutes) and the one volt key, "Start the feed, 10 minutes".
// The counts come from POST /api/learn/runs/preview, so they are the real mix; a chapter with nothing to run shows no card.
// The card's height is reserved from the first paint (a placeholder of the same shape), so the list below never moves.
// The key is the page's one volt key: it carries data-page-primary, so the sidebar and the phone dock step back while it shows.
// In the development preview it always asks; on the real site it stays hidden until Learn v2 is switched on
// (NEXT_PUBLIC_LEARN2 = 'on'), so Explore never calls a route that is not there yet.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { slugChapter } from '@/components/keycards/kinds';
import { previewRun } from '../api';
import { useLearnLinks } from '../links';
import { countWord } from '../cards/cardsShared';
import '@/components/keycards/keycards.css';
import './feed.css';

const LENGTHS = [5, 10, 20];

export default function ExploreLeadCard({ subject, chapterName }) {
  const links = useLearnLinks();
  const on = links.preview || process.env.NEXT_PUBLIC_LEARN2 === 'on';
  const chapterKey = subject && chapterName ? slugChapter(subject, chapterName) : null;
  const [minutes, setMinutes] = useState(10);
  const [read, setRead] = useState({ key: null, minutes: 10, data: null, loading: false, done: false });
  useEffect(() => {
    if (!on || !chapterKey) return undefined;
    let alive = true;
    queueMicrotask(() => { if (alive) setRead((r) => ({ ...r, loading: true })); });
    previewRun({ chapterKey, minutes, leaveOut: ['mistakes', 'lesson'] })
      .then((data) => { if (alive) setRead({ key: chapterKey, minutes, data, loading: false, done: true }); })
      .catch(() => { if (alive) setRead({ key: chapterKey, minutes, data: null, loading: false, done: true }); });
    return () => { alive = false; };
  }, [on, chapterKey, minutes]);
  if (!on || !chapterKey) return null;

  // Until the first answer for this chapter, a placeholder of the card's own shape holds its place.
  if (read.key !== chapterKey) {
    return (
      <section className="l2x-lead" data-skel="" aria-hidden="true">
        <span className="l2x-lead__obj"><span className="skeleton" style={{ width: 72, height: 72 }} /></span>
        <span className="skeleton" style={{ height: 22, width: '78%' }} />
        <span className="skeleton" style={{ height: 16, width: '56%' }} />
        <span className="skeleton l2x-lead__line" style={{ height: 22 }} />
        <span className="l2x-lead__keys"><span className="skeleton" style={{ height: 48 }} /><span className="skeleton" style={{ height: 52 }} /></span>
      </section>
    );
  }
  if (!read.data) return null;
  const piles = Object.fromEntries((read.data.piles || []).map((p) => [p.id, p.count]));
  const cards = piles.cards || 0;
  const questions = piles.questions || 0;
  if (!cards && !questions) return null;
  const mix = [cards ? `${cards} Key ${cards === 1 ? 'card' : 'cards'}` : null, questions ? countWord(questions, 'question') : null].filter(Boolean).join(' and ');
  const title = read.data.chapter?.title || chapterName;
  return (
    <section className="l2x-lead" data-loading={read.loading || read.minutes !== minutes || undefined} aria-label="Run this chapter as a feed">
      <span className="l2x-lead__obj" aria-hidden="true"><SubjectObject id={subject} size={72} framed={false} life={false} /></span>
      <h2 className="l2x-lead__t">Run this chapter as a feed</h2>
      <p className="l2x-lead__chap">{title}</p>
      <p className="l2x-lead__line" aria-live="polite">{read.minutes} minutes: {mix}, one at a time.</p>
      <div className="l2x-lead__keys">
        <div className="l2x-len" role="group" aria-label="How long">
          {LENGTHS.map((m) => <button key={m} type="button" aria-pressed={m === minutes} onClick={() => setMinutes(m)}>{m} min</button>)}
        </div>
        <Link className="kc-btn kc-btn--volt" href={links.feed(chapterKey, minutes)} data-page-primary="">Start the feed, {minutes} minutes</Link>
      </div>
    </section>
  );
}
