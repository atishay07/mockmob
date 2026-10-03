"use client";

// A curated strip of Instagram links. Covers are authored local typography and pattern,
// never a stand-in for a creator photo or a fabricated post thumbnail. The embed is mounted
// only after activation, and the original link remains available if Instagram blocks it.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Heart, MessageCircle, Play, Users } from 'lucide-react';
import { combinedReach, compactCount, creatorReach, embedSrc, permalink } from '@/lib/social';

function IgGlyph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function initials(name) {
  const words = String(name || '').trim().split(/\s+/u).filter(Boolean);
  const segment = (word) => {
    if (typeof Intl.Segmenter === 'function') return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word)][0]?.segment || '';
    return Array.from(word)[0] || '';
  };
  return (words.length > 1 ? segment(words[0]) + segment(words.at(-1)) : segment(words[0] || '?')).toLocaleUpperCase();
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
              {embedState === 'loading' ? 'Loading from Instagram…' : embedState === 'delayed' ? 'Instagram may be blocking this embed.' : 'This embed could not load.'}
            </p>
          ) : null}
          <a ref={openRef} href={url} target="_blank" rel="noopener noreferrer" className="rl__open">
            <ExternalLink size={14} aria-hidden="true" /> Open original on Instagram
          </a>
        </div>
      ) : (
        <button type="button" className="rl__card" data-kind={item.kind} onClick={onPlay} aria-label={`Load ${label} from Instagram`}>
          <span className="rl__cover-mark" aria-hidden="true"><span className="rl__cover-orbit" /><span>{initials(item.creator)}</span></span>
          <span className="rl__top">
            <span className="rl__kind"><IgGlyph size={14} />{item.kind === 'reel' ? 'Creator reel' : 'MockMob post'}</span>
            {item.partnership ? <span className="rl__partner">Partner</span> : null}
          </span>
          {item.followers ? (
            <span className="rl__reach">
              <b className="mm-measure">{compactCount(item.followers)}</b>
              <span>followers{item.also ? <> · also runs <i>@{item.also.handle}</i> ({compactCount(item.also.followers)})</> : null}</span>
            </span>
          ) : null}
          {item.about ? <span className="rl__about">{item.about}</span> : null}
          {item.attribution ? <span className="rl__attribution">{item.attribution}</span> : null}
          {item.likes || item.comments ? (
            <span className="rl__engage">
              {item.likes ? <span><Heart size={13} aria-hidden="true" />{item.likes.toLocaleString('en-IN')} likes</span> : null}
              {item.comments ? <span><MessageCircle size={13} aria-hidden="true" />{item.comments.toLocaleString('en-IN')} comments</span> : null}
            </span>
          ) : null}
          <span className="rl__identity">
            <span className="rl__who"><b>{item.creator}</b><i>@{item.handle}{item.note ? ` · ${item.note}` : ''}</i></span>
            <span className="rl__play" aria-hidden="true"><Play size={18} fill="currentColor" /></span>
          </span>
          <span className="rl__load-label">Load preview <span aria-hidden="true">↗</span></span>
        </button>
      )}
    </li>
  );
}

export default function CreatorReels({ items = [], profileUrl, handle, asOf }) {
  const creators = items.filter((item) => item.kind === 'reel' && item.followers);
  const reach = combinedReach(creators);
  const biggest = creators.reduce((top, item) => (creatorReach(item) > creatorReach(top || {}) ? item : top), null);
  const loudest = creators.reduce((top, item) => ((item.comments || 0) > (top?.comments || 0) ? item : top), null);
  const trackRef = useRef(null);
  const [activeCode, setActiveCode] = useState(null);
  const [ends, setEnds] = useState({ start: true, end: true });

  const updateEnds = useCallback(() => {
    const node = trackRef.current;
    if (!node) return;
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
        <dl className="rl__summary">
          <div><dt>Combined followers</dt><dd className="mm-measure">{compactCount(Math.floor(reach / 1000) * 1000)}+</dd></div>
          <div><dt>CUET creators</dt><dd className="mm-measure">{creators.length}</dd></div>
          {biggest ? <div><dt>Largest profile</dt><dd><span>{compactCount(biggest.followers)}</span> <small>@{biggest.handle}</small></dd></div> : null}
          {loudest?.comments ? <div><dt>Comments on one reel</dt><dd><span>{loudest.comments.toLocaleString('en-IN')}</span></dd></div> : null}
        </dl>
      ) : null}
      <div className="rl__bar">
        <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="rl__follow"><IgGlyph size={17} />Follow @{handle}</a>
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
      <p className="rl__note">Public Instagram profile counts{asOf ? ` checked on ${asOf}` : ''}. Combined followers add accounts; audiences may overlap. Posts marked Partner are paid collaborations. Instagram loads only when you choose a card.</p>
    </div>
  );
}
