'use client';

import Image from 'next/image';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import assets from '@/../public/brand/mascot/manifest.json';

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

/** A reserved perch. With `station`, PipGuide can land here (the static pose stays the fallback). */
export function MascotSeat({ pose: wanted, facing = 'left', label, note, className = '', eager = false, station }) {
  const { celebrations } = useMobiPrefs();
  const pose = calmPose(wanted, celebrations);
  return <figure className={`pip-seat ${className}`} data-pip-station={station} data-pip-pose={station ? pose : undefined}><div className="pip-seat__art"><Mascot pose={pose} facing={pose === 'pointing' ? facing : 'right'} eager={eager} alt={`Mobi, MockMob’s study companion, ${pose === 'attentive' ? 'listening attentively' : pose === 'thinking' ? 'thinking' : pose === 'pointing' ? 'pointing towards your next step' : pose === 'celebrating' ? 'celebrating a finished drill' : pose === 'encouraging' ? 'cheering you on' : pose === 'idle' ? 'sitting beside the preview' : 'waving hello'}.`} /></div><figcaption><b>{label}</b>{note && <span>{note}</span>}</figcaption></figure>;
}
