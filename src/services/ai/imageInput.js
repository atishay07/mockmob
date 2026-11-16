// One image as model input (16 Nov 2026, "bring a mistake" photos). Pure: no I/O, no 'server-only', no alias imports, so the
// request check (src/services/mobi/bringMistake.mjs), the provider runtime (providerCore.js callOnce) and the tests share it.
//
// What it holds the line on:
//  * Only a JPEG, checked by its bytes (FF D8 FF and a readable frame header), never by a name or a type the client claims.
//  * The request shape is the one the code's OpenAI call already uses: Chat Completions (client.chat.completions.create), where
//    a user message's content may be an array of parts and an image is {"type":"image_url","image_url":{"url":"data:image/
//    jpeg;base64,...","detail":"high"}}. Checked on 16 Nov 2026 through Context7 against OpenAI's API reference
//    (developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create: "content: string or array of
//    ChatCompletionContentPart ... Can contain text, image, or audio inputs", the curl example with a "text" part then an
//    "image_url" part) and the Vision fine-tuning page's image_url object with "detail". The installed SDK's own type agrees
//    (node_modules/openai ChatCompletionContentPartImage: image_url.url "Either a URL of the image or the base64 encoded image
//    data", detail 'auto' | 'low' | 'high'). OpenAI's changelog (22 Sep 2026) says GPT-6 Luna accepts text and image inputs
//    through the Responses and Chat Completions APIs.
//  * The runtime guard reserves for the image's own input tokens, never its base64 bytes (imageTokenBound).

export const JPEG_MIME = 'image/jpeg';
// 'high': a photo of a printed question needs its small print read. OpenAI's sizing for 'high' fits the image in its patch
// budget; 'auto' means 'original' on the GPT-6 and GPT-5.6 models (no budget), so it is never sent.
export const IMAGE_DETAIL = 'high';
// The decoded photo the provider ever gets: 1 MB (the panel sends at most 900 KB).
export const IMAGE_MAX_BYTES = 1_048_576;
// The longest side the panel ever sends (it draws the photo onto a canvas with this long edge, then exports a JPEG).
export const IMAGE_MAX_EDGE = 1600;

// ---- Image tokens --------------------------------------------------------------------------------------------------------
// OpenAI's images-vision guide, "Calculating costs > Patch-based image tokenization" (read 16 Nov 2026 through Context7,
// developers.openai.com/api/docs/guides/images-vision): the image is covered by 32 px x 32 px patches after its detail level's
// resize (a resize only ever lowers the count), and the billable image input is ceil(patches x the model's multiplier). The
// guide's multiplier table gives 1.2 for gpt-6-astra and the gpt-5.x models, and at most 2.46 for any model it lists
// (gpt-4.1-nano); gpt-6-luna has no row of its own there. So the reservation multiplies by 2.5, above every documented
// multiplier, and counts the patches of the image exactly as sent, with no budget cut. A tile-based model (gpt-4o: 85 + 170 a
// 512 px tile after fitting the short side to 768 px) bills less than this for the same image.
export const IMAGE_PATCH_PX = 32;
export const IMAGE_TOKEN_MULTIPLIER_BOUND = 2.5;
// What the guide documents for the GPT-6 and GPT-5.x family, used only to say what a photo is expected to cost.
export const IMAGE_TOKEN_MULTIPLIER_FAMILY = 1.2;

/** 32 px patches covering a width x height image. */
export function imagePatches({ width, height }) {
  return Math.ceil(width / IMAGE_PATCH_PX) * Math.ceil(height / IMAGE_PATCH_PX);
}

/** The input tokens the guard reserves for one image of this size (an upper bound; see above). */
export function imageTokenBound({ width, height }, multiplier = IMAGE_TOKEN_MULTIPLIER_BOUND) {
  return Math.ceil(imagePatches({ width, height }) * multiplier);
}

// ---- Bytes ---------------------------------------------------------------------------------------------------------------

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** The decoded length of a checked base64 string, without decoding it. */
export function base64Length(data) {
  if (typeof data !== 'string' || !data || data.length % 4 !== 0 || !BASE64.test(data)) return -1;
  const pad = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return (data.length / 4) * 3 - pad;
}

/** Base64 (standard alphabet, padded) to bytes, or null when it is not base64. */
export function base64Bytes(data) {
  if (base64Length(data) < 0) return null;
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(data, 'base64'));
  try {
    const bin = atob(data);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** True when the bytes start like a JPEG (SOI then a marker). */
export function isJpeg(bytes) {
  return Boolean(bytes) && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/**
 * A JPEG's width and height from its frame header (SOF0..SOF15, not DHT, JPG or DAC), walking the marker segments from the
 * start. -> { width, height } | null (not a JPEG, a header cut off, or the scan before any frame header).
 */
export function jpegSize(bytes) {
  if (!isJpeg(bytes)) return null;
  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    let marker = bytes[i + 1];
    while (marker === 0xff && i + 2 < bytes.length) { i += 1; marker = bytes[i + 1]; } // fill bytes
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; } // no length
    if (marker === 0xd9 || marker === 0xda) return null; // end of image, or the scan, before a frame header
    if (i + 3 >= bytes.length) return null;
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2) return null;
    const frame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (frame) {
      if (i + 8 >= bytes.length || length < 7) return null;
      const height = (bytes[i + 5] << 8) | bytes[i + 6];
      const width = (bytes[i + 7] << 8) | bytes[i + 8];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    i += 2 + length;
  }
  return null;
}

/**
 * One checked image. `image` is { mime, data } (data: base64 without the data: prefix).
 * -> { ok: true, bytes, width, height, data } | { ok: false, reason: 'type' | 'encoding' | 'too_large' | 'not_jpeg' | 'size' }
 */
export function checkImage(image, { maxBytes = IMAGE_MAX_BYTES, maxEdge = IMAGE_MAX_EDGE } = {}) {
  if (!image || typeof image !== 'object' || Array.isArray(image) || image.mime !== JPEG_MIME) return { ok: false, reason: 'type' };
  const length = base64Length(image.data);
  if (length < 0) return { ok: false, reason: 'encoding' };
  if (length > maxBytes) return { ok: false, reason: 'too_large' };
  const bytes = base64Bytes(image.data);
  if (!isJpeg(bytes)) return { ok: false, reason: 'not_jpeg' };
  const size = jpegSize(bytes);
  if (!size || size.width > maxEdge || size.height > maxEdge) return { ok: false, reason: 'size' };
  return { ok: true, bytes: bytes.length, width: size.width, height: size.height, data: image.data };
}

/**
 * The Chat Completions parts for one checked image and what the guard reserves for it, or null when the image fails the check.
 * -> { part: { type: 'image_url', image_url: { url, detail } }, tokens, width, height, bytes }
 */
export function openaiImageInput(image) {
  const checked = checkImage(image);
  if (!checked.ok) return null;
  return {
    part: { type: 'image_url', image_url: { url: `data:${JPEG_MIME};base64,${checked.data}`, detail: IMAGE_DETAIL } },
    tokens: imageTokenBound(checked),
    width: checked.width, height: checked.height, bytes: checked.bytes,
  };
}
