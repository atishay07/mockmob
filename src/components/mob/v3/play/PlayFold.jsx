"use client";
// One Fold still (spec 5.2, technique C on the web): a pose image pivoted at the boots, with the member's
// initial disc as the fallback when a Fold file is missing, never a broken image.
import { useState } from 'react';
import { foldHeadSrc, foldSrc, FOLD_PAPER } from './playModel.mjs';

export function PlayFold({ fold, pose = 'idle', size = 64, name = '', colour = 0, ghost = false, silhouette = false, className = '', style }) {
  const [broken, setBroken] = useState(false);
  const src = foldSrc(fold, pose);
  const cls = `mp-fold${ghost ? ' mp-fold--ghost' : ''}${silhouette ? ' mp-fold--silhouette' : ''} ${className}`.trim();
  if (!src || broken) {
    return (
      <span className={`${cls} mp-fold--disc`} style={{ width: size, height: size, ...style }} aria-hidden="true">
        <span className="mp-disc" style={{ '--mp-c': `var(--mob-c${Number(colour) % 8 || 0})`, width: Math.round(size * 0.62), height: Math.round(size * 0.62), fontSize: Math.round(size * 0.28) }}>{String(name || '?').trim()[0]?.toUpperCase() || '?'}</span>
      </span>
    );
  }
  return (
    <span className={cls} style={{ width: size, height: size, ...style }} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={src} src={src} alt="" width={size} height={size} decoding="async" draggable="false" onError={() => setBroken(true)} />
    </span>
  );
}

/** A round head disc (24 to 40 px) from the Fold's head crop, else the initial on the member colour. */
export function FoldHead({ fold, size = 40, name = '', colour = 0 }) {
  const [broken, setBroken] = useState(false);
  const src = foldHeadSrc(fold);
  const ring = FOLD_PAPER[fold] || `var(--mob-c${Number(colour) % 8 || 0})`;
  if (!src || broken) {
    return <span className="mp-head mp-head--disc" style={{ width: size, height: size, '--mp-c': `var(--mob-c${Number(colour) % 8 || 0})`, fontSize: Math.round(size * 0.42) }} aria-hidden="true">{String(name || '?').trim()[0]?.toUpperCase() || '?'}</span>;
  }
  return (
    <span className="mp-head" style={{ width: size, height: size, '--mp-ring': ring }} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={size} height={size} decoding="async" draggable="false" onError={() => setBroken(true)} />
    </span>
  );
}
