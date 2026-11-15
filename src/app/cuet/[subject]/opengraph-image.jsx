import { ImageResponse } from 'next/og';
import { subjectArt } from '@/../data/subject_art.mjs';
import { SUBJECT_HUBS, getSubjectHub } from '@/lib/subjectHubs';
import { FIRST_FULL_FREE, paperCode } from '@/lib/subjectPages.mjs';
import { CARD_SIZE, CARD_TYPE, SUBJECT_ALT, cardFonts, cardResponse, subjectCard, subjectPicture } from '@/lib/og/shareCards.mjs';

// The share picture for a CUET subject hub: the subject's own lamp-lit object standing on its contact shadow under the desk
// lamp (drawn in src/lib/og/shareCards.mjs). Sent as a JPEG under 300 KB (P8, 15 Nov 2026: 12 of the 15 PNGs were over).
// No model call.

export const runtime = 'nodejs';
export const alt = SUBJECT_ALT;
export const size = CARD_SIZE;
export const contentType = CARD_TYPE;

export function generateStaticParams() {
  return SUBJECT_HUBS.map((hub) => ({ subject: hub.slug }));
}

export default async function OpengraphImage({ params }) {
  const { subject } = await params;
  const hub = getSubjectHub(subject);
  const art = hub ? subjectArt(hub.slug) : null;
  const root = process.cwd();
  const [fonts, picture] = await Promise.all([cardFonts(root), subjectPicture(root, art)]);
  const element = subjectCard({ name: hub?.name || 'CUET subject', code: hub ? paperCode(hub) : null, art, picture, firstFree: FIRST_FULL_FREE });
  return cardResponse(ImageResponse, element, fonts);
}
