"use client";
// Paper stickers on the web (MOB-BUILD-SPEC-V3 M12; BRAND-MOTION-KIT 4: a fixed preset set of paper stickers, drawn
// locally, never emoji). One glyph per kind in one weight, the app's StickerGlyph redrawn as SVG: exam stationery.
// Only the enum's words are ever drawn (stickerWords): there is no free text between members.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FLIGHT_MS, FADE_MS, HOLD_MS, REDUCED_FADE_MS, RISE_MS, flightFrames, stickerTilt, stickerWords } from '@/lib/mob/v3/stickerFlights.mjs';

const LAMP = '#c98a2e';

/** The painted glyph for a kind (20 x 20, ink strokes with a lamp fill). */
export function StickerGlyph({ kind, size = 18 }) {
  const ink = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.1, strokeLinecap: 'round', strokeLinejoin: 'round' };
  let body = null;
  switch (kind) {
    case 'nice_one': // a tick in an answer bubble
      body = <><circle cx="10" cy="10" r="8.8" fill={LAMP} fillOpacity="0.35" /><path d="M5.2 10.4 8.6 13.6 14.8 6.8" {...ink} /></>;
      break;
    case 'so_close': // a ruler with two marks a hair apart, and the near miss
      body = <><rect x="1.2" y="6.8" width="17.6" height="7.2" rx="1.2" {...ink} strokeWidth="1.8" /><path d="M6 6.8v2.8M10 6.8v4.4M14 6.8v2.8" {...ink} strokeWidth="1.8" /><circle cx="11.6" cy="4" r="1.4" fill={LAMP} /></>;
      break;
    case 'teach_me': // a pencil
      body = <g transform="rotate(-45 10 10)"><rect x="5.2" y="7.4" width="13.4" height="5.2" fill={LAMP} /><rect x="5.2" y="7.4" width="13.4" height="5.2" {...ink} strokeWidth="1.6" /><path d="M5.2 7.4 1.6 10l3.6 2.6" {...ink} strokeWidth="1.8" /></g>;
      break;
    case 'again': // a loop that comes round again
      body = <><path d="M14.1 4.7A6.8 6.8 0 1 1 6.5 4.2" {...ink} /><path d="M10.2 4.4 14.1 4.7l.4 3.9" {...ink} /></>;
      break;
    case 'good_luck': // a four-point glint
      body = <path d="M10 .8Q11.2 8.8 19.2 10 11.2 11.2 10 19.2 8.8 11.2.8 10 8.8 8.8 10 .8Z" fill={LAMP} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />;
      break;
    case 'lets_go': // a pennant on its pole
      body = <><path d="M4.8 1.6v17.2" {...ink} /><path d="M4.8 2.4 17.6 6 4.8 10Z" fill={LAMP} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></>;
      break;
    case 'one_sec': // a stopwatch
      body = <><circle cx="10" cy="11.2" r="7.2" {...ink} /><path d="M10 .4v2.8M10 11.2l3.2-2.8" {...ink} /></>;
      break;
    case 'ready': // a filled OMR bubble
      body = <><circle cx="10" cy="10" r="8.4" {...ink} strokeWidth="1.8" /><circle cx="10" cy="10" r="5.2" fill="currentColor" /></>;
      break;
    default:
      return null;
  }
  return <svg className="den-psticker__glyph" viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" focusable="false">{body}</svg>;
}

/** A die-cut paper sticker: paper with a white sticker edge, the glyph and the enum's words, tilted a hair. */
export function PaperSticker({ kind, small = false, className = '', style }) {
  const words = stickerWords(kind);
  if (!words) return null;
  return (
    <span className={`den-psticker${small ? ' den-psticker--small' : ''} ${className}`.trim()} style={{ '--tilt': `${stickerTilt(kind)}deg`, ...style }}>
      <StickerGlyph kind={kind} size={small ? 16 : 18} />
      <span className="den-psticker__words">{words}</span>
    </span>
  );
}

/**
 * One of your stickers on its way to the den: drawn over the page (a portal, so no transformed or contained parent can
 * clip it), lifted off the key at `from` and flown along an arc to `to` (both viewport points, bottom centre). When it
 * lands, `onLanded` hands it to the stage, which holds it over your Fold. `to` null: there is nowhere visible to fly
 * (the room is scrolled away), so it rises 24 px off the key, holds and fades there instead (M12 on other screens).
 */
export function StickerFlyer({ kind, from, to, reduced = false, onLanded, onDone }) {
  const ref = useRef(null);
  const landed = useRef(onLanded);
  const done = useRef(onDone);
  useEffect(() => { landed.current = onLanded; done.current = onDone; }, [onLanded, onDone]);
  useEffect(() => {
    const el = ref.current;
    // Reduced motion with a place to land: no flight; the stage fades it in over your Fold (120 ms) and out again.
    if (!el || typeof el.animate !== 'function' || (to && reduced)) { (to ? landed.current : done.current)?.(); return undefined; }
    const base = 'translate(-50%, -100%)';
    let anim;
    if (to && !reduced) {
      // Land where the stage will hold it: centred on the anchor, or leaning in at the end slots (sx is a percent).
      const lean = ((to.sx ?? -50) + 50) / 100 * el.getBoundingClientRect().width;
      const frames = flightFrames(from, { x: to.x + lean, y: to.y }, { tilt: stickerTilt(kind) }).map((f) => ({
        offset: f.offset, opacity: 1,
        transform: `${base} translate(${f.x}px, ${f.y}px) rotate(${f.rotate}deg) scale(${f.scale})`,
      }));
      anim = el.animate(frames, { duration: FLIGHT_MS, easing: 'linear', fill: 'forwards' });
      anim.onfinish = () => landed.current?.();
    } else {
      const total = (reduced ? REDUCED_FADE_MS * 2 : RISE_MS + FADE_MS) + HOLD_MS;
      const rise = reduced ? 0 : -24;
      const fadeIn = reduced ? REDUCED_FADE_MS / total : 120 / total;
      const up = reduced ? fadeIn : RISE_MS / total;
      const out = 1 - (reduced ? REDUCED_FADE_MS : FADE_MS) / total;
      anim = el.animate([
        { offset: 0, opacity: 0, transform: `${base} translateY(0) scale(${reduced ? 1 : 0.9})` },
        { offset: fadeIn, opacity: 1 },
        { offset: up, opacity: 1, transform: `${base} translateY(${rise}px) scale(1)` },
        { offset: out, opacity: 1, transform: `${base} translateY(${rise}px) scale(1)` },
        { offset: 1, opacity: 0, transform: `${base} translateY(${rise}px) scale(1)` },
      ], { duration: total, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
      anim.onfinish = () => done.current?.();
    }
    return () => anim?.cancel();
  }, [from, to, reduced, kind]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <span ref={ref} className="den-fly" style={{ left: from.x, top: from.y }} aria-hidden="true">
      <PaperSticker kind={kind} small />
    </span>,
    document.body,
  );
}
