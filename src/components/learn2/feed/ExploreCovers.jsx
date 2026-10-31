'use client';
// The way into the Explore feed (docs/brain/learn-1031/FEED-2.md section 6): above Explore's question list, a row of chapter
// covers that snap one per swipe. Each cover: the subject object (lamp-lit, 140 px), the chapter title, the real mix
// ("10 minutes, 16 Key cards and 5 questions") and a volt Play key. The first cover is the student's suggested chapter (due cards
// or open mistakes first), marked "For you". One length control (5, 10 or 20 minutes) above the row applies to every cover.
// Every count is the feed the cover plays (GET /api/learn/covers, the composer's own dry run at each length), so switching the
// length never waits and never moves anything. The row's height is held from the first paint by covers of the same shape.
// In the development preview it always shows; on the real site it stays hidden until Learn v2 is on (NEXT_PUBLIC_LEARN2 = 'on').
import { useState } from 'react';
import Link from 'next/link';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { FEED_RULES, coverLine } from '@/../data/learn/feed.js';
import { feedCovers, useLearnRead } from '../api';
import { useLearnLinks } from '../links';
import '@/components/keycards/keycards.css';
import './covers.css';

function Skeleton() {
  return (
    <div className="fxc-row" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="fxc-cover" data-skel="">
          <span className="skeleton fxc-sk fxc-sk--obj" />
          <span className="skeleton fxc-sk" style={{ width: '86%', height: 26 }} />
          <span className="skeleton fxc-sk" style={{ width: '74%', height: 18 }} />
          <span className="skeleton fxc-sk fxc-sk--key" />
        </div>
      ))}
    </div>
  );
}

export default function ExploreCovers({ subject }) {
  const links = useLearnLinks();
  const on = links.preview || process.env.NEXT_PUBLIC_LEARN2 === 'on';
  const [minutes, setMinutes] = useState(10);
  const read = useLearnRead(() => (on && subject ? feedCovers(subject) : Promise.resolve(null)), [on, subject]);
  if (!on) return null;
  const data = read.data;
  if (read.status === 'error' || (data && !data.covers?.length)) return null;
  return (
    <section className="fxc" aria-labelledby="fxc-h">
      <div className="fxc-head">
        <h2 className="fxc-title" id="fxc-h">Chapter feeds</h2>
        <div className="fxc-len" role="group" aria-label="How long">
          {FEED_RULES.lengths.map((m) => <button key={m} type="button" aria-pressed={m === minutes} onClick={() => setMinutes(m)}>{m} min</button>)}
        </div>
      </div>
      {data?.free ? <p className="fxc-free">{data.free.text}</p> : null}
      {!subject || !data || read.status === 'loading' ? <Skeleton /> : (
        <ul className="fxc-row" aria-label={`${data.subject?.name || 'Your subject'} chapters`}>
          {data.covers.map((c) => {
            const n = c.counts[minutes] || c.counts[10];
            return (
              <li key={c.key} className="fxc-cover">
                <span className="fxc-obj" aria-hidden="true"><SubjectObject id={subject} size={140} framed={false} lit life={false} /></span>
                {c.forYou ? <p className="fxc-for">For you</p> : null}
                <h3 className="fxc-name">{c.title}</h3>
                <p className="fxc-line">{coverLine(n.minutes, n)}</p>
                <Link className="kc-btn kc-btn--volt fxc-play" href={links.feed(c.key, minutes)} aria-label={`Play ${c.title}, ${n.minutes} minutes`}>Play</Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
