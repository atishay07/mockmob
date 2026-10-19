"use client";
// A Fold on the web (MOB-BUILD-SPEC-V3 5.2, technique C): one still per pose, pivoted at the boots. Breathe (scaleY 1 to
// 1.028 on 3600 ms, offset per member) and blink (the closed-eye still for 120 ms every 4 to 7 s, seeded, never in sync)
// run in the den only, and stop under reduced motion. A missing pose falls back to idle, and a missing file to the
// member's initial disc, never a broken image. Locked: the same still as a true silhouette (a CSS mask in the ink colour).
import { useState } from 'react';
import { foldBlinkSrc, foldSrc } from '@/lib/mob/v3/denModel.mjs';
import { foldName } from '@/lib/mob/v3/denCopy.mjs';
import { initialOf } from '@/lib/mob/model.mjs';

/** A small seeded number in [0, 1) from a string, so each Fold blinks on its own beat. */
export function seeded(str, salt = 0) {
  let h = 2166136261 ^ salt;
  for (const c of String(str || '')) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

export function InitialDisc({ name, colour = 0, size = 40, className = '' }) {
  return (
    <span className={`mob-disc den-disc ${className}`} data-colour={colour} aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {initialOf(name || '?')}
    </span>
  );
}

/**
 * fold: key; pose: idle | cheer | think (others draw idle); size: px; name and colour for the fallback disc.
 * live: breathe and blink (the den). index: join order, for the breathe offset. locked: a silhouette.
 */
export function FoldFigure({ fold, pose = 'idle', size = 80, name, colour = 0, live = false, index = 0, locked = false, large = false, label = null, className = '' }) {
  const wanted = foldSrc(fold, pose, large ? 512 : 256);
  const idle = foldSrc(fold, 'idle', large ? 512 : 256);
  const [failed, setFailed] = useState({ wanted: false, idle: false });
  const src = !failed.wanted ? wanted : !failed.idle ? idle : null;
  const alt = label ?? '';
  if (!src) return <InitialDisc name={name || foldName(fold)} colour={colour} size={Math.round(size * 0.62)} className={`den-fold__disc ${className}`} />;
  if (locked) {
    return (
      <span className={`den-fold den-fold--locked ${className}`} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}
        style={{ width: size, height: size, WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }} />
    );
  }
  const blink = live && pose === 'idle' ? foldBlinkSrc(fold) : null;
  const style = { width: size, height: size };
  if (live) {
    style['--den-breathe-delay'] = `${-(index * 120 + 700)}ms`;
    style['--den-blink-dur'] = `${4000 + Math.round(seeded(fold + index, 7) * 3000)}ms`;
    style['--den-blink-delay'] = `${Math.round(seeded(name || fold, index) * 3000) + 900}ms`;
  }
  return (
    <span className={`den-fold${live ? ' den-fold--live' : ''} ${className}`} style={style} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local stills with an onError fallback; next/image adds nothing here */}
      <img className="den-fold__img" src={src} alt={alt} width={size} height={size} draggable={false} decoding="async"
        onError={() => setFailed((f) => (src === wanted && !f.wanted ? { ...f, wanted: true } : { ...f, idle: true }))} />
      {blink ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="den-fold__blink" src={blink} alt="" width={size} height={size} draggable={false} decoding="async" aria-hidden="true" onError={(e) => { e.currentTarget.hidden = true; }} />
      ) : null}
    </span>
  );
}

/** A head disc (24 to 40 px) for cards and rows: the Fold's head crop, else the initial disc. */
export function FoldHead({ fold, name, colour = 0, size = 32, className = '' }) {
  const [failed, setFailed] = useState(false);
  const src = fold && !failed ? `/mob/folds/fold-${fold}-head@${size > 48 ? 256 : 128}.webp` : null;
  if (!src) return <InitialDisc name={name} colour={colour} size={size} className={className} />;
  return (
    <span className={`den-head ${className}`} data-colour={colour} style={{ width: size, height: size }} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={size} height={size} draggable={false} decoding="async" onError={() => setFailed(true)} />
    </span>
  );
}
