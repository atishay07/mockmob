"use client";

// The creators who featured MockMob, set as a list on hairlines rather than a row of cards: each creator's name,
// their handle and one true fact about their audience, the paraphrase of their own bio, and a plain "Watch" that
// opens the reel right there in the row. MockMob's own posts are one row at the end, their date a caption, never a
// headline. No thumbnails we do not have, no fake avatar, no display-size follower figures: the proof is the one
// sentence above the list. The embed mounts only after a press (nothing is sent to Instagram before that), and the
// original link stays one tap away if Instagram blocks the embed.
import { useEffect, useRef, useState } from 'react';
import { REEL_VIEWS_AS_OF, REEL_VIEWS_FLOOR, combinedReach, compactCount, embedSrc, permalink } from '@/lib/social';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// '2026-04-28' -> { day: 28, month: 'April', year: 2026 }, written out by hand so the server and the phone agree.
function parts(date) {
  const [year, month, day] = String(date || '').split('-').map(Number);
  if (!year || !month || !day || !MONTHS[month - 1]) return null;
  return { day, month: MONTHS[month - 1], year };
}
const WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const dayLabel = (date) => { const p = parts(date); return p ? `${p.day} ${p.month} ${p.year}` : ''; };
// An Instagram shortcode is the post's id in base 64, and ids grow with time: the order two posts went up.
const CODE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const codeId = (code) => [...String(code)].reduce((n, c) => n * 64n + BigInt(Math.max(0, CODE.indexOf(c))), 0n);
const postOrder = (a, b) => { const x = codeId(a); const y = codeId(b); return x < y ? -1 : x > y ? 1 : 0; };
const shortDay = (date) => { const p = parts(date); return p ? `${p.day} ${p.month}` : ''; };

// "26 and 28 April 2026" for a run of posts in one month; otherwise each date in full.
function datesLine(dates) {
  const all = [...new Set(dates)].map(parts).filter(Boolean).sort((a, b) => a.year - b.year || MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month) || a.day - b.day);
  if (!all.length) return '';
  const sameMonth = all.every((p) => p.month === all[0].month && p.year === all[0].year);
  if (!sameMonth) return all.map((p) => `${p.day} ${p.month} ${p.year}`).join(', ');
  const days = all.map((p) => p.day);
  const list = days.length > 1 ? `${days.slice(0, -1).join(', ')} and ${days.at(-1)}` : String(days[0]);
  return `${list} ${all[0].month} ${all[0].year}`;
}

// "3 October 2026" and "5 October 2026" read as "3–5 October 2026": one short date line under the list.
function countsDate(a, b) {
  if (!a || a === b) return b;
  const [dayA, ...restA] = a.split(' ');
  const [dayB, ...restB] = b.split(' ');
  if (restA.join(' ') !== restB.join(' ')) return `${a} to ${b}`;
  const [lo, hi] = [Number(dayA), Number(dayB)].sort((x, y) => x - y);
  return `${lo}–${hi} ${restB.join(' ')}`;
}

// One creator's audience in a line: "161K followers, also runs @garima.again (25.3K)".
function audience(item) {
  if (!item.followers) return '';
  const base = `${compactCount(item.followers)} followers`;
  return item.also ? `${base}, also runs @${item.also.handle} (${compactCount(item.also.followers)})` : base;
}

// The embed in place, under the row's words. Instagram may be slow or blocked, so the original link is always there.
function Embed({ item }) {
  const [state, setState] = useState('loading');
  const openRef = useRef(null);
  const label = `${item.kind === 'reel' ? 'Reel' : 'Post'} by ${item.creator}`;
  // The press that opened it replaced nothing, but the original link is the one control that always works:
  // focus goes there so a keyboard user lands inside the opened row.
  useEffect(() => { openRef.current?.focus({ preventScroll: true }); }, [item.code]);
  useEffect(() => {
    const timer = window.setTimeout(() => setState((s) => (s === 'loading' ? 'delayed' : s)), 10000);
    return () => window.clearTimeout(timer);
  }, [item.code]);
  return (
    <div className="rl__frame" data-embed-state={state}>
      <iframe
        src={embedSrc(item)}
        title={label}
        loading="lazy"
        allow="encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => setState('loaded')}
        onError={() => setState('error')}
      />
      {state !== 'loaded' ? (
        <p className="rl__status" role="status" aria-live="polite">
          {state === 'loading' ? 'Loading from Instagram…' : state === 'delayed' ? 'Still loading. You can open it on Instagram instead.' : 'This one didn’t load. Open it on Instagram instead.'}
        </p>
      ) : null}
      <a ref={openRef} href={permalink(item)} target="_blank" rel="noopener noreferrer" className="rl__open">
        Open the original on Instagram
      </a>
    </div>
  );
}

function CreatorRow({ item, active, onToggle }) {
  const meta = [
    item.attribution || null,
    item.partnership ? 'Paid partnership' : null,
    item.likes ? `${item.likes.toLocaleString('en-IN')} likes` : null,
  ].filter(Boolean);
  return (
    <li className="rl__row" data-active={active ? 'true' : 'false'}>
      <div className="rl__id">
        <h3 className="rl__name">{item.creator}</h3>
        <p className="rl__fact">@{item.handle}{item.followers ? <>, {audience(item)}</> : null}</p>
      </div>
      <div className="rl__words">
        {item.about ? <p className="rl__about">{item.about}</p> : null}
        {meta.length ? <p className="rl__meta">{meta.join('. ')}.</p> : null}
      </div>
      <div className="rl__act">
        <button type="button" className="rl__watch" aria-expanded={active} aria-label={active ? `Close the reel by ${item.creator}` : `Watch the reel by ${item.creator} here`} onClick={onToggle}>
          {active ? 'Close' : 'Watch'}
        </button>
      </div>
      {active ? <Embed item={item} /> : null}
    </li>
  );
}

function PostsRow({ posts, activeCode, onToggle }) {
  const open = posts.find((p) => p.code === activeCode) || null;
  const handle = posts[0]?.handle;
  return (
    <li className="rl__row rl__row--own" data-active={open ? 'true' : 'false'}>
      <div className="rl__id">
        <h3 className="rl__name">MockMob</h3>
        <p className="rl__fact">@{handle}, our own posts</p>
      </div>
      <div className="rl__words">
        <p className="rl__about">{posts.length === 1 ? 'One post' : `${WORDS[posts.length] || posts.length} posts`} from {datesLine(posts.map((p) => p.date))}, on the account that runs this site.</p>
      </div>
      <div className="rl__act rl__act--many">
        {[...posts].sort((a, b) => a.date.localeCompare(b.date) || postOrder(a.code, b.code)).map((post) => {
          const on = post.code === activeCode;
          // Each key names its post by day ('28 April'); a second post that day is '28 April, later' (shortcodes
          // order the posts by when they went up).
          const sameDay = posts.filter((p) => p.date === post.date).sort((a, b) => postOrder(a.code, b.code));
          const later = sameDay.indexOf(post) > 0;
          const name = `${shortDay(post.date)}${later ? ', later' : ''}`;
          return (
            <button key={post.code} type="button" className="rl__watch" aria-expanded={on} aria-label={`${on ? 'Close' : 'Watch'} MockMob’s ${later ? 'later ' : sameDay.length > 1 ? 'first ' : ''}post of ${dayLabel(post.date)}${on ? '' : ' here'}`} onClick={() => onToggle(post.code)}>
              {on ? 'Close' : name}
            </button>
          );
        })}
      </div>
      {open ? <Embed key={open.code} item={open} /> : null}
    </li>
  );
}

export default function CreatorReels({ items = [], profileUrl, handle, asOf }) {
  const creators = items.filter((item) => item.kind === 'reel');
  const posts = items.filter((item) => item.kind !== 'reel');
  const reach = combinedReach(creators.filter((c) => c.followers));
  const [activeCode, setActiveCode] = useState(null);
  const toggle = (code) => setActiveCode((now) => (now === code ? null : code));

  return (
    <div className="rl">
      {reach ? (
        <p className="rl__summary">
          <b>{compactCount(Math.floor(reach / 1000) * 1000)}+</b> combined followers and <b>{compactCount(REEL_VIEWS_FLOOR)}+</b> reel views.
        </p>
      ) : null}
      <ul className="rl__list" aria-label="Creators who featured MockMob on Instagram">
        {creators.map((item) => (
          <CreatorRow key={item.code} item={item} active={activeCode === item.code} onToggle={() => toggle(item.code)} />
        ))}
        {posts.length ? <PostsRow posts={posts} activeCode={activeCode} onToggle={toggle} /> : null}
      </ul>
      <div className="rl__foot">
        <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="rl__follow">Follow @{handle} on Instagram</a>
        <p className="rl__note">Counts as of {countsDate(asOf, REEL_VIEWS_AS_OF)}.</p>
      </div>
    </div>
  );
}
