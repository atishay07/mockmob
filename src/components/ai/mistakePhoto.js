// A photo of a question, made ready in the browser before it is sent (lane web/1116-photo, 16 Nov 2026). The original file is
// never uploaded: it is decoded (an iPhone photo turned the way it was taken: createImageBitmap with imageOrientation
// 'from-image', or an <img>, which browsers draw upright from its EXIF orientation), drawn onto a canvas with its long edge at
// most 1,600 px, and exported as a JPEG at about 0.82, the quality and then the size stepped down until it is at most 900 KB.
// Drawing it again also drops the file's EXIF data (the place and the phone it was taken with).
//
// The server checks the result again by its bytes (src/services/ai/imageInput.js). Browser only.
import { MISTAKE_PHOTO_LIMITS } from '@/services/mobi/bringMistake.mjs';

export class PhotoError extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason; // 'decode' (not a photo the browser can open) | 'too_big' (still over the cap at the smallest step)
  }
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close?.() };
    } catch { /* an older browser, or a type it cannot open this way: the <img> below */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
    if (img.decode) await img.decode().catch(() => {});
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new PhotoError('decode');
  }
}

const toBlob = (canvas, quality) => new Promise((resolve) => {
  try { canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality); } catch { resolve(null); }
});

function base64Of(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const comma = text.indexOf(',');
      if (comma < 0) reject(new PhotoError('decode')); else resolve(text.slice(comma + 1));
    };
    reader.onerror = () => reject(new PhotoError('decode'));
    reader.readAsDataURL(blob);
  });
}

// The steps, in order: the quality first (0.82 down to 0.62), then the size (90 % of the edge each time, from 0.72).
const QUALITIES = [MISTAKE_PHOTO_LIMITS.quality, 0.76, 0.7, 0.62];
const MAX_SHRINKS = 5;

/**
 * -> { data (base64, no prefix), bytes, width, height, url (an object URL of the JPEG, for the thumbnail; revoke it) }
 * Throws PhotoError('decode') for a file the browser cannot open as a picture, PhotoError('too_big') if no step fits.
 */
export async function preparePhoto(file, { maxEdge = MISTAKE_PHOTO_LIMITS.maxEdge, maxBytes = MISTAKE_PHOTO_LIMITS.sendBytes } = {}) {
  if (!file) throw new PhotoError('decode');
  const picture = await decode(file);
  try {
    if (!picture.width || !picture.height) throw new PhotoError('decode');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new PhotoError('decode');
    let edge = Math.min(maxEdge, Math.max(picture.width, picture.height));
    for (let shrink = 0; shrink <= MAX_SHRINKS; shrink += 1) {
      const scale = edge / Math.max(picture.width, picture.height);
      canvas.width = Math.max(1, Math.round(picture.width * scale));
      canvas.height = Math.max(1, Math.round(picture.height * scale));
      // White under the picture: a transparent PNG would otherwise turn black in a JPEG.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(picture.source, 0, 0, canvas.width, canvas.height);
      for (const quality of shrink === 0 ? QUALITIES : [0.72]) {
        const blob = await toBlob(canvas, quality);
        if (!blob) throw new PhotoError('decode');
        if (blob.size <= maxBytes) {
          const data = await base64Of(blob);
          return { data, bytes: blob.size, width: canvas.width, height: canvas.height, url: URL.createObjectURL(blob) };
        }
      }
      edge = Math.floor(edge * 0.9);
    }
    throw new PhotoError('too_big');
  } finally {
    picture.done();
  }
}

/** "412": a size in KB as the panel says it (1 decimal under 10 KB). */
export function kilobytes(bytes) {
  const kb = Math.max(0, Number(bytes) || 0) / 1024;
  return kb < 10 ? kb.toFixed(1) : Math.round(kb).toLocaleString('en-IN');
}
