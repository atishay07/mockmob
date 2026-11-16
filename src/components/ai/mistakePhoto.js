// A photo of a question, made ready in the browser before it is sent (lane web/1116-photo, 16 Nov 2026). The original file is
// never uploaded. Drawing it again also drops the file's EXIF data (the place and the phone it was taken with).
//
// Very large photos (review, 16 Nov): a 48 to 200 megapixel photo is never decoded at full size. Its size is read first from
// the file's own header (pictureSize: a JPEG's frame header and EXIF orientation, PNG, GIF, WebP), cheaply, without decoding;
// then it is decoded straight to its sending size with createImageBitmap's resizeWidth / resizeHeight (long edge at most
// 1,600 px), turned the way it was taken (imageOrientation 'from-image'). A browser that resizes before it turns the picture
// gives the two sides swapped: that bitmap is dropped and the picture decoded again with the sides the other way round. A file
// whose header this cannot read (HEIC, AVIF) is sized by an <img>'s own natural size (read on load, not drawn), and a browser
// without createImageBitmap draws that <img> straight onto a canvas no larger than the sending size. Every bitmap is closed,
// every object URL revoked and the canvas emptied on every path, failures included.
//
// Then the JPEG: quality about 0.82, stepped down (0.76, 0.70, 0.62), then the size (90 % of the edge each time, at 0.72),
// until it is at most 900 KB. The server checks the result again by its bytes (src/services/ai/imageInput.js). Browser only,
// apart from pictureSize, which is pure and tested in Node.
// A relative import (not the @ alias) so Node's tests can load pictureSize and sendingSize.
import { MISTAKE_PHOTO_LIMITS } from '../../services/mobi/bringMistake.mjs';

export class PhotoError extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason; // 'decode' (not a photo the browser can open) | 'too_big' (still over the cap at the smallest step)
  }
}

// ---- The size, from the file's own header ----------------------------------------------------------------------------------

const u16be = (b, o) => (b[o] << 8) | b[o + 1];
const u16le = (b, o) => b[o] | (b[o + 1] << 8);

/** The EXIF orientation (1..8) in an APP1 segment whose 'Exif\0\0' starts at `at`; 1 when there is none. */
function exifOrientation(b, at, end) {
  const t = at + 6;
  if (t + 8 > end) return 1;
  const le = b[t] === 0x49 && b[t + 1] === 0x49;
  if (!le && !(b[t] === 0x4d && b[t + 1] === 0x4d)) return 1;
  const r16 = (o) => (le ? u16le(b, o) : u16be(b, o));
  const r32 = (o) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
  const ifd = t + r32(t + 4);
  if (ifd + 2 > end) return 1;
  const count = r16(ifd);
  for (let i = 0; i < count; i += 1) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > end) break;
    if (r16(e) === 0x0112) { const v = r16(e + 8); return v >= 1 && v <= 8 ? v : 1; }
  }
  return 1;
}

function jpegHeader(b) {
  let orientation = 1;
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) return null;
    let marker = b[i + 1];
    while (marker === 0xff && i + 2 < b.length) { i += 1; marker = b[i + 1]; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if (marker === 0xd9 || marker === 0xda || i + 3 >= b.length) return null;
    const length = u16be(b, i + 2);
    if (length < 2) return null;
    if (marker === 0xe1 && i + 10 < b.length && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) {
      orientation = exifOrientation(b, i + 4, Math.min(b.length, i + 2 + length));
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (i + 8 >= b.length) return null;
      const height = u16be(b, i + 5);
      const width = u16be(b, i + 7);
      return width && height ? { width, height, orientation } : null;
    }
    i += 2 + length;
  }
  return null;
}

/**
 * A picture's size as it is shown (an EXIF rotation of a quarter turn swaps the sides), from the first bytes of its file:
 * JPEG, PNG, GIF and WebP. -> { width, height } | null (another format, or a header cut off). Pure.
 */
export function pictureSize(b) {
  if (!b || b.length < 30) return null;
  let raw = null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) raw = jpegHeader(b);
  else if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) raw = { width: ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0, height: ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0, orientation: 1 };
  else if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) raw = { width: u16le(b, 6), height: u16le(b, 8), orientation: 1 };
  else if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const kind = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (kind === 'VP8 ') raw = { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff, orientation: 1 };
    else if (kind === 'VP8L') raw = { width: 1 + (((b[22] & 0x3f) << 8) | b[21]), height: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)), orientation: 1 };
    else if (kind === 'VP8X') raw = { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)), orientation: 1 };
  }
  if (!raw || !raw.width || !raw.height) return null;
  return raw.orientation >= 5 ? { width: raw.height, height: raw.width } : { width: raw.width, height: raw.height };
}

/** The sending size for a picture shown at width x height: the long edge at most `maxEdge`, never enlarged. */
export function sendingSize({ width, height }, maxEdge = MISTAKE_PHOTO_LIMITS.maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// The first megabyte holds a JPEG's frame header behind any EXIF, XMP and colour profile a phone writes.
const HEADER_BYTES = 1024 * 1024;

async function headerSize(file) {
  try { return pictureSize(new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer())); } catch { return null; }
}

// ---- Decoding, straight to the sending size --------------------------------------------------------------------------------

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new PhotoError('decode'));
    img.src = url;
  });
}

/** createImageBitmap at the sending size, or null where the browser has no such option. Throws PhotoError('decode'). */
async function bitmapAt(file, target) {
  if (typeof createImageBitmap !== 'function') return null;
  const at = (w, h) => createImageBitmap(file, { imageOrientation: 'from-image', resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
  let bitmap;
  try { bitmap = await at(target.width, target.height); } catch { return null; }
  if (bitmap.width === target.width && bitmap.height === target.height) return bitmap;
  // The sides came back swapped: this browser resized before it turned the picture, so the content is squeezed. Decode it
  // again with the sides the other way round.
  if (bitmap.width === target.height && bitmap.height === target.width) {
    bitmap.close?.();
    try { bitmap = await at(target.height, target.width); } catch { return null; }
    if (bitmap.width === target.width && bitmap.height === target.height) return bitmap;
  }
  return bitmap; // some other size: still drawn at the sending size below
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

// The steps, in order: the quality first (0.82 down to 0.62), then the size (90 % of the edge each time, at 0.72).
const QUALITIES = [MISTAKE_PHOTO_LIMITS.quality, 0.76, 0.7, 0.62];
const MAX_SHRINKS = 5;

/**
 * -> { data (base64, no prefix), bytes, width, height, url (an object URL of the JPEG, for the thumbnail; the caller revokes it) }
 * Throws PhotoError('decode') for a file the browser cannot open as a picture, PhotoError('too_big') if no step fits.
 */
export async function preparePhoto(file, { maxEdge = MISTAKE_PHOTO_LIMITS.maxEdge, maxBytes = MISTAKE_PHOTO_LIMITS.sendBytes } = {}) {
  if (!file) throw new PhotoError('decode');
  let bitmap = null;
  let imgUrl = null;
  let canvas = null;
  try {
    // 1. The size as shown: from the header, else from an <img>'s natural size (read on load; it is not drawn here).
    let img = null;
    let shown = await headerSize(file);
    if (!shown) {
      imgUrl = URL.createObjectURL(file);
      img = await loadImage(imgUrl);
      if (!img.naturalWidth || !img.naturalHeight) throw new PhotoError('decode');
      shown = { width: img.naturalWidth, height: img.naturalHeight };
    }
    const target = sendingSize(shown, maxEdge);
    // 2. Decoded straight to that size; without createImageBitmap, the <img> is drawn onto the bounded canvas below.
    bitmap = await bitmapAt(file, target);
    let source = bitmap;
    if (!source) {
      if (!img) { imgUrl = URL.createObjectURL(file); img = await loadImage(imgUrl); }
      source = img;
    }
    canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new PhotoError('decode');
    // 3. The JPEG, stepped down until it fits.
    let edge = Math.max(target.width, target.height);
    for (let shrink = 0; shrink <= MAX_SHRINKS; shrink += 1) {
      const scale = edge / Math.max(target.width, target.height);
      canvas.width = Math.max(1, Math.round(target.width * scale));
      canvas.height = Math.max(1, Math.round(target.height * scale));
      // White under the picture: a transparent PNG would otherwise turn black in a JPEG.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
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
  } catch (err) {
    throw err instanceof PhotoError ? err : new PhotoError('decode');
  } finally {
    bitmap?.close?.();
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}

/** "412": a size in KB as the panel says it (1 decimal under 10 KB). */
export function kilobytes(bytes) {
  const kb = Math.max(0, Number(bytes) || 0) / 1024;
  return kb < 10 ? kb.toFixed(1) : Math.round(kb).toLocaleString('en-IN');
}
