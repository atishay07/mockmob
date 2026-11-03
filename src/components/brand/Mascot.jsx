'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import assets from '@/../public/brand/mascot/manifest.json';
import { EYES } from './mobiEyes';

/**
 * One Mobi finish on the home page (LK73, 4 Nov 2026, decision 10). On "/" every seat, the sample's reaction and the
 * flying guide draw the rigged vector Mobi (the app's own figure) from the sprite MobiPoseSprite.jsx puts in the page
 * once; every other page keeps the baked photo-real art. The keys are the seat poses, the values the rig's acts
 * (scripts/brand/build-mobi-poses.mjs). `reading` (the answer sheet in his hands) only exists as a vector pose.
 */
const VECTOR_ACT = { greeting: 'wave', attentive: 'listen', thinking: 'think', pointing: 'point', celebrating: 'cheer', encouraging: 'encourage', idle: 'idle', reading: 'read' };
const VECTOR_VIEWBOX = '0 0 140 168'; // the figure's box (the generated sprite stays out of this client module on purpose)
const VECTOR_AR = '0.8333';
export const useVectorFinish = () => usePathname() === '/';

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
  const vector = useVectorFinish();
  const pose = calmPose(wanted, celebrations);
  if (vector && VECTOR_ACT[pose]) {
    // The svg is its own .mobi-react scope, so the palette variables (Night and Day, mobi-figure.css) reach the shared symbol.
    return (
      <svg className={`mobi-react pip-image pip-image--vector ${className}`.trim()} data-pose={pose} data-facing={facing} viewBox={VECTOR_VIEWBOX} preserveAspectRatio="xMidYMax meet" overflow="visible"
        style={{ position: 'static', display: 'block', width: '100%', height: '100%' }} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} focusable="false">
        <use href={`#mbp-${VECTOR_ACT[pose]}`} />
      </svg>
    );
  }
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
  const vector = useVectorFinish();
  const eyes = EYES[pose];
  if (!eyes || vector) return null; // the vector figure draws its own eyes
  return (
    <span className="pip-eyes" aria-hidden="true">
      {eyes.map(([left, top, width, height]) => (
        <i key={left} className="pip-eye" style={{ left: pct(left - width * 0.3), top: pct(top - height * 0.2), width: pct(width * 1.6), height: pct(height * 1.4) }}><b className="pip-eye__ball" /></i>
      ))}
    </span>
  );
}

const aspect = (pose, vector) => (vector ? VECTOR_AR : ((assets[pose] || assets.greeting).width / (assets[pose] || assets.greeting).height).toFixed(4));

/**
 * A reserved perch. With `station`, PipGuide can land here (the static pose stays the fallback). The art sits in
 * a rig the exact shape of the pose (so the eyes layer lines up), with a breath layer inside it: on the landing
 * he arrives with a squash and a hop when his seat comes into view, breathes, blinks and looks (brand-pip.css).
 */
export function MascotSeat({ pose: wanted, facing = 'left', label, note, className = '', eager = false, station }) {
  const { celebrations } = useMobiPrefs();
  const vector = useVectorFinish();
  const pose = calmPose(wanted, celebrations);
  const faced = pose === 'pointing' ? facing : 'right';
  return <figure className={`pip-seat ${className}`} data-pip-station={station} data-pip-pose={station ? pose : undefined}><div className="pip-seat__art"><span className="pip-rig" data-facing={faced} style={{ '--pip-ar': aspect(pose, vector) }}><span className="pip-rig__breath"><Mascot pose={pose} facing={faced} eager={eager} alt={`Mobi, MockMob’s study companion, ${pose === 'attentive' ? 'listening attentively' : pose === 'reading' ? 'reading the answer sheet' : pose === 'thinking' ? 'thinking' : pose === 'pointing' ? 'pointing towards your next step' : pose === 'celebrating' ? 'celebrating a finished drill' : pose === 'encouraging' ? 'cheering you on' : pose === 'idle' ? 'sitting beside the preview' : 'waving hello'}.`} /><PipEyes pose={pose} /></span></span></div><figcaption><b>{label}</b>{note && <span>{note}</span>}</figcaption></figure>;
}
