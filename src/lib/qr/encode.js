// Minimal QR Code encoder: byte mode, error correction level M, versions 1 to 10.
// Used only to draw the "Continue on your phone" code for a result URL, so there is
// no extra dependency and no network call. Layout follows ISO/IEC 18004.

// Per version at level M: [ecc codewords per block, group 1 blocks, group 1 data codewords, group 2 blocks, group 2 data codewords].
const BLOCKS_M = [
  null,
  [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44],
];
const ALIGNMENT = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
export const MAX_VERSION = 10;

// ---- Galois field 256 (x^8 + x^4 + x^3 + x^2 + 1) ----
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x; LOG[x] = i;
  x <<= 1; if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

export function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) { next[j] ^= poly[j]; next[j + 1] ^= mul(poly[j], EXP[i]); }
    poly = next;
  }
  return poly;
}

export function rsEncode(data, eccLen) {
  const gen = rsGenerator(eccLen);
  const rem = new Array(eccLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem[0];
    rem.shift(); rem.push(0);
    for (let i = 0; i < eccLen; i++) rem[i] ^= mul(gen[i + 1], factor);
  }
  return rem;
}

export const dataCodewords = (version) => { const [, a, b, c, d] = BLOCKS_M[version]; return a * b + c * d; };

// ---- Bit stream and codewords ----
export function buildCodewords(bytes, version) {
  const capacityBits = dataCodewords(version) * 8;
  const bits = [];
  const push = (value, count) => { for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; data.length < dataCodewords(version); pad = pad === 0xec ? 0x11 : 0xec) data.push(pad);

  const [eccLen, g1, d1, g2, d2] = BLOCKS_M[version];
  const blocks = [];
  let at = 0;
  for (let i = 0; i < g1 + g2; i++) {
    const len = i < g1 ? d1 : d2;
    const chunk = data.slice(at, at + len); at += len;
    blocks.push({ data: chunk, ecc: rsEncode(chunk, eccLen) });
  }
  const out = [];
  for (let i = 0; i < Math.max(d1, d2); i++) for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  for (let i = 0; i < eccLen; i++) for (const b of blocks) out.push(b.ecc[i]);
  return out;
}

// ---- BCH-protected info fields ----
export function formatBits(mask) {
  const data = mask; // level M indicator is 00
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}
export function versionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function penalty(m, size) {
  let score = 0;
  const line = (get) => {
    let run = 1;
    for (let i = 1; i < size; i++) {
      if (get(i) === get(i - 1)) run++; else { if (run >= 5) score += 3 + run - 5; run = 1; }
    }
    if (run >= 5) score += 3 + run - 5;
  };
  const finderRun = (get) => {
    const a = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    for (let i = 0; i + 11 <= size; i++) {
      let fwd = true; let back = true;
      for (let k = 0; k < 11; k++) { const v = get(i + k) ? 1 : 0; if (v !== a[k]) fwd = false; if (v !== a[10 - k]) back = false; }
      if (fwd) score += 40;
      if (back) score += 40;
    }
  };
  for (let y = 0; y < size; y++) { line((i) => m[y][i]); finderRun((i) => m[y][i]); }
  for (let x = 0; x < size; x++) { line((i) => m[i][x]); finderRun((i) => m[i][x]); }
  let dark = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (m[y][x]) dark++;
    if (x + 1 < size && y + 1 < size && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
  }
  const total = size * size;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return score;
}

/** Smallest version (1..10) whose level-M byte capacity holds `length` bytes, or 0 when too long. */
export function versionFor(length) {
  for (let v = 1; v <= MAX_VERSION; v++) if (4 + (v <= 9 ? 8 : 16) + length * 8 <= dataCodewords(v) * 8) return v;
  return 0;
}

/**
 * Encode text (UTF-8, byte mode, level M). Returns { version, size, mask, modules } where modules[row][col]
 * is true for a dark module, or null when the text does not fit in version 10. Pass `mask` (0 to 7) to force
 * a mask instead of choosing the lowest-penalty one.
 */
export function encodeQr(text, { mask: forcedMask } = {}) {
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  const version = versionFor(bytes.length);
  if (!version) return null;
  const size = 17 + version * 4;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFn = (x, y, dark) => { modules[y][x] = dark; fn[y][x] = true; };

  // Timing, finders with separators, alignment.
  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx; const y = cy + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      setFn(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const pos = ALIGNMENT[version];
  for (const cy of pos) for (const cx of pos) {
    if ((cx === 6 && cy === 6) || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const writeFormat = (m) => {
    const bits = formatBits(m);
    const bit = (i) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(i));
    setFn(8, 7, bit(6)); setFn(8, 8, bit(7)); setFn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i));
    setFn(8, size - 8, true); // the always-dark module
  };
  writeFormat(0); // reserves the areas; rewritten with the chosen mask below
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1; const a = size - 11 + (i % 3); const b = Math.floor(i / 3);
      setFn(a, b, dark); setFn(b, a, dark);
    }
  }

  // Data, zigzag from the bottom right.
  const codewords = buildCodewords(bytes, version);
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j;
      const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
      if (!fn[y][x] && bitIndex < codewords.length * 8) {
        modules[y][x] = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) === 1;
        bitIndex++;
      }
    }
  }

  const applyMask = (m) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y)) modules[y][x] = !modules[y][x];
  };
  let mask = forcedMask;
  if (!Number.isInteger(mask) || mask < 0 || mask > 7) {
    let best = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(m); writeFormat(m);
      const p = penalty(modules, size);
      if (p < best) { best = p; mask = m; }
      applyMask(m); // undo
    }
  }
  applyMask(mask); writeFormat(mask);
  return { version, size, mask, modules };
}
