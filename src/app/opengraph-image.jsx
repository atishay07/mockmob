import { ImageResponse } from 'next/og';
import { CARD_SIZE, CARD_TYPE, HOME_ALT, cardFonts, cardResponse, homeCard, homeCardAssets } from '@/lib/og/shareCards.mjs';

// The site's share card (every page that names no image of its own; DEFAULT_SHARE_IMAGE in src/lib/seo.js). The picture is
// drawn in src/lib/og/shareCards.mjs and sent as a JPEG under 300 KB, so WhatsApp shows it (P8, 15 Nov 2026).

export const runtime = 'nodejs';
export const alt = HOME_ALT;
export const size = CARD_SIZE;
export const contentType = CARD_TYPE;

export default async function OpengraphImage() {
  const root = process.cwd();
  const [fonts, objects] = await Promise.all([cardFonts(root), homeCardAssets(root)]);
  return cardResponse(ImageResponse, homeCard(objects), fonts);
}
