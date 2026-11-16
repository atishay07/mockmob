'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import assets from '@/../public/brand/mascot/manifest.json';
import { EYES } from './mobiEyes';

/**
 * One Mobi finish on every page: the 3D clay art in public/brand/mascot (17 Nov 2026, the owner: "many new generations of
 * Mobi and 3D assets ... but I don't see any changes"). From 4 Nov until then the home page drew every seat, the phone
 * companion and the flying guide as a flat vector pose from a sprite; that sprite has left the page, and the only vector
 * Mobi still on it is the live rig on the sample's desk (HeroMobi), which never shares a screen with another Mobi.
 * Besides the seven first poses there are the job poses, one per section's job (scripts/brand/ship-mobi-stills.py writes
 * their sizes into the manifest): reading the paper, the magnifier, the camera, the calendar page, the desk hello and the wave.
 */
export const JOB_POSES = ['reading', 'magnifier', 'camera', 'calendar', 'deskHello', 'wave'];
/** What a screen reader hears after "Mobi, MockMob's study companion, ". */
const DOING = {
  greeting: 'waving hello', attentive: 'listening attentively', thinking: 'thinking', pointing: 'pointing towards your next step',
  celebrating: 'celebrating a finished drill', encouraging: 'cheering you on', idle: 'sitting beside the preview',
  reading: 'reading the answer sheet', magnifier: 'looking at a mistake through a magnifying glass', camera: 'taking a photo with a phone',
  calendar: 'holding up today’s page of the calendar', deskHello: 'looking over the edge of a desk', wave: 'waving',
};
const asset = (pose) => assets[pose] || assets.greeting;

/**
 * The Celebrations setting (Profile > Look and feel) applies to the art itself: Quiet swaps the
 * arms-up celebrating pose for the calm, warm one; Off for the plain standing one. Every other
 * pose is already calm and is never changed.
 */
export function calmPose(pose, celebrations = 'full') {
  if (pose !== 'celebrating' || celebrations === 'full') return pose;
  return celebrations === 'quiet' ? 'encouraging' : 'attentive';
}

/**
 * Mobi is a brand character. Static inside the Arena, never present in exam questions. Every image is lazy unless a caller
 * asks otherwise and carries its own width and height, so it never moves the page and is never fetched before it is near.
 * `sizes` is the width he is drawn at (the phone companion passes its 48 px, so a 56 px figure never fetches a seat's image).
 */
export function Mascot({ pose: wanted = 'greeting', facing = 'right', className = '', alt = '', eager = false, sizes = '(max-width: 600px) 110px, 160px' }) {
  const { celebrations } = useMobiPrefs();
  const pose = calmPose(wanted, celebrations);
  const art = asset(pose);
  return <Image className={`pip-image ${className}`.trim()} data-pose={pose} data-facing={facing} src={art.src} width={art.width} height={art.height} sizes={sizes} loading={eager ? 'eager' : 'lazy'} alt={alt} draggable={false} />;
}

/**
 * The wave as six real frames (mobi-wave-6.webp: one row of six cells the size of the wave still, the first cell the
 * still itself). The sheet is only fetched once the figure is within 600 px of the screen; once it has decoded this layer
 * takes over from the still (the same picture, so nothing changes) and brand-pip.css plays the cells once when his seat
 * comes into view, and once more on a tap. Without the sheet, or under Reduce motion, the still stays.
 */
const WAVE = assets.waveSheet;
export function WaveCells() {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    let live = true;
    const near = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      near.disconnect();
      const sheet = new window.Image();
      sheet.src = WAVE.src;
      const loaded = sheet.decode ? sheet.decode() : new Promise((done, fail) => { sheet.onload = done; sheet.onerror = fail; });
      loaded.then(() => { if (live) setReady(true); }).catch(() => { /* the still stays */ });
    }, { rootMargin: '600px 0px' });
    near.observe(node);
    return () => { live = false; near.disconnect(); };
  }, []);
  return <span ref={ref} className="pip-wave" data-ready={ready ? 'true' : undefined} style={ready ? { backgroundImage: `url(${WAVE.src})`, backgroundSize: `${WAVE.cells * 100}% 100%` } : undefined} aria-hidden="true" />;
}

const pct = (n) => `${Math.round(n * 100) / 100}%`;

/**
 * Mobi's eyes as a layer over the art (only the open-eyed first poses have them): each baked eye is covered by a soft
 * patch of the visor's colour and redrawn as a ball that can look (--pip-look-x/-y, -1 to 1). At rest the ball sits
 * exactly on the baked eye, so the art reads unchanged. brand-pip.css shows it only on the landing while the guide runs
 * (never in the Arena, never under Reduce motion).
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

const aspect = (pose) => (asset(pose).width / asset(pose).height).toFixed(4);

/** A tap on a seated Mobi: one small bounce in his own pose, or the wave again (PipGuide plays it; nothing under Reduce motion). */
function tapped(station) {
  if (station) window.dispatchEvent(new CustomEvent('pip:react', { detail: { station, mood: 'tap' } }));
}

/**
 * A reserved perch. With `station`, PipGuide can land here (the static pose stays the fallback). The art sits in
 * a rig the exact shape of the pose (so the eyes layer lines up), with a breath layer inside it: on the landing
 * he arrives when his seat comes into view, breathes and looks, and answers a tap (brand-pip.css).
 */
export function MascotSeat({ pose: wanted, facing = 'left', label, note, className = '', eager = false, station }) {
  const { celebrations } = useMobiPrefs();
  // Where he waves, a tap plays the six frames again (a fresh layer; the sheet is already decoded by then).
  const [waves, setWaves] = useState(0);
  const pose = calmPose(wanted, celebrations);
  const faced = pose === 'pointing' ? facing : 'right';
  return (
    <figure className={`pip-seat ${className}`.trim()} data-pip-station={station} data-pip-pose={station ? pose : undefined}>
      <div className="pip-seat__art" onClick={station ? () => { tapped(station); if (pose === 'wave') setWaves((n) => n + 1); } : undefined}>
        <span className="pip-rig" data-facing={faced} style={{ '--pip-ar': aspect(pose) }}>
          <span className="pip-rig__breath">
            {pose === 'wave' ? <WaveCells key={waves} /> : null}
            <Mascot pose={pose} facing={faced} eager={eager} alt={`Mobi, MockMob’s study companion, ${DOING[pose] || DOING.greeting}.`} />
            <PipEyes pose={pose} />
          </span>
        </span>
      </div>
      {label || note ? <figcaption><b>{label}</b>{note && <span>{note}</span>}</figcaption> : null}
    </figure>
  );
}
