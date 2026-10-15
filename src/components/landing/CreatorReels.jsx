"use client";

// A curated strip of Instagram links. Covers are plain typography on a flat surface (the creator's real
// audience, name, handle and bio line), never a stand-in for a creator photo, a fake avatar or a fabricated
// post thumbnail. The embed is mounted only after activation, and the original link remains available if
// Instagram blocks it. The proof above the strip is one sentence, not a panel of stat tiles.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { undrawn } from './undrawn';
import { REEL_VIEWS_AS_OF, REEL_VIEWS_FLOOR, combinedReach, compactCount, embedSrc, floorForPlus, permalink, recordedEngagement } from '@/lib/social';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// '2026-04-28' -> { day: '28 April', year: '2026' }, written out by hand so the server and the phone agree.
function postedOn(date) {
  const [year, month, day] = String(date || '').split('-').map(Number);
  if (!year || !month || !day || !MONTHS[month - 1]) return null;
  return { day: `${day} ${MONTHS[month - 1]}`, year: String(year) };
}

function Card({ item, active, onPlay }) {
  const [embedState, setEmbedState] = useState('loading');
  const openRef = useRef(null);
  const label = `${item.kind === 'reel' ? 'Reel' : 'Post'} by ${item.creator}`;
  const url = permalink(item);

  // Activation replaces the focused cover button, so hand focus to the always-usable
  // original-post link instead of letting it fall back to the page body.
  useEffect(() => {
    if (active) openRef.current?.focus({ preventScroll: true });
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setTimeout(() => setEmbedState((state) => state === 'loading' ? 'delayed' : state), 10000);
    return () => window.clearTimeout(timer);
  }, [active, item.code]);

  return (
    <li className="rl__item" data-active={active}>
      {active ? (
        <div className="rl__frame" data-embed-state={embedState}>
          <iframe
            src={embedSrc(item)}
            title={label}
            loading="lazy"
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setEmbedState('loaded')}
            onError={() => setEmbedState('error')}
          />
          {embedState !== 'loaded' ? (
            <p className="rl__status" role="status" aria-live="polite">
              {embedState === 'loading' ? 'Loading from Instagram…' : embedState === 'delayed' ? 'Still loading. You can open it on Instagram instead.' : 'This one didn’t load. Open it on Instagram instead.'}
            </p>
          ) : null}
          <a ref={openRef} href={url} target="_blank" rel="noopener noreferrer" className="rl__open">
            Open the original on Instagram
          </a>
        </div>
      ) : (
        <button type="button" className="rl__card" data-kind={item.kind} onClick={onPlay} aria-label={`Load ${label} from Instagram`}>
          <span className="rl__top">
            <span className="rl__kind">{item.kind === 'reel' ? 'Creator reel' : 'MockMob post'}</span>
            {item.partnership ? <span className="rl__partner">Paid partnership</span> : null}
          </span>
          {item.followers ? (
            <span className="rl__reach">
              <b>{compactCount(item.followers)}</b>
              <span>followers{item.also ? <>, also runs <i>@{item.also.handle}</i> ({compactCount(item.also.followers)})</> : null}</span>
            </span>
          ) : null}
          {!item.followers && postedOn(item.date) ? (
            <span className="rl__reach rl__reach--date">
              <b>{postedOn(item.date).day}</b>
              <span>{postedOn(item.date).year}</span>
            </span>
          ) : null}
          {item.about ? <span className="rl__about">{item.about}</span> : null}
          {item.attribution ? <span className="rl__attribution">{item.attribution}</span> : null}
          {item.likes || item.comments ? (
            <span className="rl__engage">
              {[item.likes ? `${item.likes.toLocaleString('en-IN')} likes` : null, item.comments ? `${item.comments.toLocaleString('en-IN')} comments` : null].filter(Boolean).join(', ')}
            </span>
          ) : null}
          <span className="rl__identity">
            <span className="rl__who"><b>{item.creator}</b><i>@{item.handle}{item.note ? `, ${item.note}` : ''}</i></span>
          </span>
          <span className="rl__load-label">Watch it here</span>
        </button>
      )}
    </li>
  );
}

// "3 October 2026" and "5 October 2026" read as "3–5 October 2026": one short date line under the reels.
function countsDate(a, b) {
  if (!a || a === b) return b;
  const [dayA, ...restA] = a.split(' ');
  const [dayB, ...restB] = b.split(' ');
  if (restA.join(' ') !== restB.join(' ')) return `${a} to ${b}`;
  const [lo, hi] = [Number(dayA), Number(dayB)].sort((x, y) => x - y);
  return `${lo}–${hi} ${restB.join(' ')}`;
}

export default function CreatorReels({ items = [], profileUrl, handle, asOf }) {
  const creators = items.filter((item) => item.kind === 'reel' && item.followers);
  const reach = combinedReach(creators);
  const engagement = floorForPlus(recordedEngagement(items));
  const trackRef = useRef(null);
  const [activeCode, setActiveCode] = useState(null);
  const [ends, setEnds] = useState({ start: true, end: true });

  const updateEnds = useCallback(() => {
    const node = trackRef.current;
    // Undrawn (content-visibility): the ResizeObserver below reads it once the section is drawn.
    if (!node || undrawn(node)) return;
    const max = Math.max(0, node.scrollWidth - node.clientWidth);
    setEnds({ start: node.scrollLeft <= 2, end: node.scrollLeft >= max - 2 });
  }, []);

  useEffect(() => {
    const node = trackRef.current;
    if (!node) return undefined;
    updateEnds();
    if (!('ResizeObserver' in window)) return undefined;
    const observer = new ResizeObserver(updateEnds);
    observer.observe(node);
    const first = node.querySelector('.rl__item');
    if (first) observer.observe(first);
    return () => observer.disconnect();
  }, [items.length, updateEnds]);

  const scrollBy = (dir) => {
    const node = trackRef.current;
    if (!node || (dir < 0 ? ends.start : ends.end)) return;
    const card = node.querySelector('.rl__item');
    const step = (card?.getBoundingClientRect().width || 240) + 16;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollBy({ left: dir * step * 2, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div className="rl">
      {creators.length ? (
        <p className="rl__summary">
          <b>{compactCount(Math.floor(reach / 1000) * 1000)}+</b> combined followers, <b>{compactCount(REEL_VIEWS_FLOOR)}+</b> reel views{engagement ? <> and <b>{engagement.toLocaleString('en-IN')}+</b> likes and comments</> : null}.
        </p>
      ) : null}
      <div className="rl__bar">
        <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="rl__follow">Follow @{handle} on Instagram</a>
        {items.length > 1 ? (
          <div className="rl__arrows" role="group" aria-label="Browse posts">
            {/* aria-disabled, not disabled: a focused arrow that reaches the end keeps focus. */}
            <button type="button" onClick={() => scrollBy(-1)} aria-label="Scroll back" aria-disabled={ends.start}><ArrowLeft size={18} aria-hidden="true" /></button>
            <button type="button" onClick={() => scrollBy(1)} aria-label="Scroll forward" aria-disabled={ends.end}><ArrowRight size={18} aria-hidden="true" /></button>
          </div>
        ) : null}
      </div>
      <ul className="rl__track" ref={trackRef} onScroll={updateEnds} aria-label="Curated Instagram reels and posts">
        {items.map((item) => (
          <Card key={`${item.code}-${activeCode === item.code ? 'active' : 'idle'}`} item={item} active={activeCode === item.code} onPlay={() => setActiveCode(item.code)} />
        ))}
      </ul>
      <p className="rl__note">Counts as of {countsDate(asOf, REEL_VIEWS_AS_OF)}.</p>
    </div>
  );
}
