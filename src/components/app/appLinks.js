// One place that decides what the Android app call to action may say. It reads only the two
// public env vars, and never claims availability the env does not confirm.
import QRCode from 'qrcode';
import { cleanUrl } from './cleanUrl';

/** @returns {{ state: 'store' | 'beta' | 'none', href: string, label: string, note: string }} */
export function getAppCta() {
  const store = cleanUrl(process.env.NEXT_PUBLIC_PLAY_STORE_URL);
  if (store) return { state: 'store', href: store, label: 'Get it on Google Play', note: '' };
  const beta = cleanUrl(process.env.NEXT_PUBLIC_PLAY_TESTING_URL);
  if (beta) return { state: 'beta', href: beta, label: 'Join the Android beta', note: 'The beta is a test version, so expect rough edges.' };
  return { state: 'none', href: '', label: '', note: 'The Android app is in testing. It will appear here when it is ready.' };
}

/** Inline SVG markup for a QR code of the URL, or '' when there is none. */
export async function qrSvg(href) {
  if (!href) return '';
  try {
    return await QRCode.toString(href, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#101810', light: '#ffffff' } });
  } catch {
    return '';
  }
}
