'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import assets from '@/../public/brand/mascot/manifest.json';
import { EYES } from './mobiEyes';

/**
 * The Celebrations setting (Profile > Look and feel) applies to the art itself: Quiet swaps the
 * arms-up celebrating pose for the calm, warm one; Off for the plain standing one. Every other
 * pose is already calm and is never changed.
 */
export function calmPose(pose, celebrations = 'full') {
  if (pose !== 'celebrating' || celebrations === 'full') return pose;
  return celebrations === 'quiet' ? 'encouraging' : 'attentive';
}

/** Mobi is a brand character. Static inside the Arena, never present in exam questions. */
export function Mascot({ pose: wanted = 'greeting', facing = 'right', className = '', alt = '', eager = false }) {
  const { celebrations } = useMobiPrefs();
  const pose = calmPose(wanted, celebrations);
  const asset = assets[pose] || assets.greeting;
  return <Image className={`pip-image ${className}`} data-pose={pose} data-facing={facing} src={asset.src} width={asset.width} height={asset.height} sizes="(max-width: 600px) 110px, 160px" loading={eager ? 'eager' : 'lazy'} alt={alt} />;
}

const pct = (n) => `${Math.round(n * 100) / 100}%`;

/**
 * Mobi's eyes as a layer over the art (only the open-eyed poses have them): each baked eye is covered by a soft
 * patch of the visor's colour and redrawn as a ball that can look (--pip-look-x/-y, -1 to 1) and blink. At rest
 * the ball sits exactly on the baked eye, so the art reads unchanged. brand-pip.css animates it only on the
 * landing while the guide runs (never in the Arena, never under Reduce motion).
 */
export function PipEyes({ pose }) {
  const eyes = EYES[pose];
  if (!eyes) return null;
  return (
    <span className="pip-eyes" aria-hidden="true">
      {eyes.map(([left, top, width, height]) => (
        <i key={left} className="pip-eye" style={{ left: pct(left - width * 0.3), top: pct(top - height * 0.2), width: pct(width * 1.6), height: pct(height * 1.4) }}><b className="pip-eye__ball" /></i>
      ))}
    </span>
  );
}

const aspect = (pose) => ((assets[pose] || assets.greeting).width / (assets[pose] || assets.greeting).height).toFixed(4);

/**
 * A reserved perch. With `station`, PipGuide can land here (the static pose stays the fallback). The art sits in
 * a rig the exact shape of the pose (so the eyes layer lines up), with a breath layer inside it: on the landing
 * he arrives with a squash and a hop when his seat comes into view, breathes, blinks and looks (brand-pip.css).
 */
export function MascotSeat({ pose: wanted, facing = 'left', label, note, className = '', eager = false, station }) {
  const { celebrations } = useMobiPrefs();
  const pose = calmPose(wanted, celebrations);
  const faced = pose === 'pointing' ? facing : 'right';
  const seatRef = useRef(null);
  // The eyes layer and the contact shadow are drawn by CSS, the body is a lazy image: until the image has
  // decoded, a phone saw two eyes floating over a shadow. So the seat waits (data-art="wait", brand-pip.css: the
  // art box at opacity 0) and shows body, eyes and shadow together once the image is in. The server HTML carries
  // no wait, so without JavaScript the seat is as before. Within one screen of the window the image is asked for
  // at once (eager), so by the time the seat is on screen it is usually already drawn.
  useEffect(() => {
    const seat = seatRef.current;
    const img = seat?.querySelector('.pip-image');
    if (!seat || !img || (img.complete && img.naturalWidth)) return undefined;
    seat.dataset.art = 'wait';
    const show = () => { if (img.naturalWidth) seat.dataset.art = 'ready'; };
    img.addEventListener('load', show);
    let near = null;
    if (img.loading === 'lazy' && typeof IntersectionObserver !== 'undefined') {
      near = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        img.loading = 'eager';
        near.disconnect();
      }, { rootMargin: '100% 0px' });
      near.observe(seat);
    }
    return () => { img.removeEventListener('load', show); near?.disconnect(); delete seat.dataset.art; };
  }, [pose]);
  return <figure ref={seatRef} className={`pip-seat ${className}`} data-pip-station={station} data-pip-pose={station ? pose : undefined}><div className="pip-seat__art"><span className="pip-rig" data-facing={faced} style={{ '--pip-ar': aspect(pose) }}><span className="pip-rig__breath"><Mascot pose={pose} facing={faced} eager={eager} alt={`Mobi, MockMob’s study companion, ${pose === 'attentive' ? 'listening attentively' : pose === 'thinking' ? 'thinking' : pose === 'pointing' ? 'pointing towards your next step' : pose === 'celebrating' ? 'celebrating a finished drill' : pose === 'encouraging' ? 'cheering you on' : pose === 'idle' ? 'sitting beside the preview' : 'waving hello'}.`} /><PipEyes pose={pose} /></span></span></div><figcaption><b>{label}</b>{note && <span>{note}</span>}</figcaption></figure>;
}
