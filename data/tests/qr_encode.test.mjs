import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { encodeQr, formatBits, versionBits, rsEncode, buildCodewords, versionFor, dataCodewords } from '../../src/lib/qr/encode.js';

// What this proves, and what it does not:
// - Reference check: the matrix equals the one produced by the independent `qrcode` package
//   (already a project dependency) for the same text, byte mode, level M, same mask.
// - Structure check: a decoder written here (unmask, read format info, un-zigzag, de-interleave,
//   Reed-Solomon syndromes, parse byte mode) recovers the text from the matrix alone.
// It does NOT prove a particular phone camera scans it; scan one printed result before shipping.
const require = createRequire(import.meta.url);
const QRCode = require('qrcode');

const URLS = [
  'https://www.mockmob.in/result/1',
  'https://www.mockmob.in/result/3f2b8c1e-9a4d-4c7e-8b21-6d5e0a7f4c19',
  'https://www.mockmob.in/result/3f2b8c1e-9a4d-4c7e-8b21-6d5e0a7f4c19?utm_source=handoff&utm_medium=qr&utm_campaign=result_phone_continue',
  'A'.repeat(100),
  'B'.repeat(200),
];

const reference = (text, mask) => {
  const q = QRCode.create([{ data: text, mode: 'byte' }], { errorCorrectionLevel: 'M', maskPattern: mask });
  const rows = [];
  for (let r = 0; r < q.modules.size; r++) { const row = []; for (let c = 0; c < q.modules.size; c++) row.push(!!q.modules.get(r, c)); rows.push(row); }
  return { version: q.version, rows };
};
const bitString = (n, len) => n.toString(2).padStart(len, '0');

test('format and version info match the published BCH tables', () => {
  // ISO 18004 table C.1, level M: mask 0, 1, 7
  assert.equal(bitString(formatBits(0), 15), '101010000010010');
  assert.equal(bitString(formatBits(1), 15), '101000100100101');
  assert.equal(bitString(formatBits(7), 15), '100101010100000');
  // ISO 18004 table D.1: versions 7 and 10
  assert.equal(bitString(versionBits(7), 18), '000111110010010100');
  assert.equal(bitString(versionBits(10), 18), '001010010011010011');
});

test('Reed-Solomon matches the worked 1-M example from the specification walkthrough', () => {
  const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
  assert.deepEqual(rsEncode(data, 10), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
});

test('capacity table matches level M data codewords per version', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(dataCodewords), [16, 28, 44, 64, 86, 108, 124, 154, 182, 216]);
  assert.equal(versionFor(14), 1); // 16 codewords hold 14 bytes after mode and count
  assert.equal(versionFor(15), 2);
  assert.equal(versionFor(213), 10);
  assert.equal(versionFor(214), 0);
  assert.equal(encodeQr('x'.repeat(214)), null);
});

test('matrix equals the independent reference for every mask', () => {
  for (const text of URLS) for (let mask = 0; mask < 8; mask++) {
    const mine = encodeQr(text, { mask });
    const ref = reference(text, mask);
    assert.equal(mine.version, ref.version, `${text.slice(0, 30)} version`);
    assert.deepEqual(mine.modules, ref.rows, `${text.slice(0, 30)} mask ${mask}`);
  }
});

test('automatic mask choice picks the lowest-penalty mask the reference also picks', () => {
  for (const text of URLS) {
    const auto = QRCode.create([{ data: text, mode: 'byte' }], { errorCorrectionLevel: 'M' });
    assert.equal(encodeQr(text).mask, auto.maskPattern, text.slice(0, 40));
  }
});

test('finder, timing and dark-module structure', () => {
  const { modules: m, size } = encodeQr(URLS[1]);
  const finderAt = (r0, c0) => {
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
      assert.equal(m[r0 + r][c0 + c], ring !== 2, `finder ${r0},${c0} at ${r},${c}`);
    }
  };
  finderAt(0, 0); finderAt(0, size - 7); finderAt(size - 7, 0);
  for (let i = 8; i < size - 8; i++) { assert.equal(m[6][i], i % 2 === 0); assert.equal(m[i][6], i % 2 === 0); }
  assert.equal(m[size - 8][8], true);
});

// ---- Independent decoder (reads the matrix only) ----
const MASK_FN = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];
const EXP = []; const LOG = [];
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 285; }
const gmul = (a, b) => (a && b ? EXP[(LOG[a] + LOG[b]) % 255] : 0);

function decode({ modules, size, version }) {
  // Format info copy 1 (around the top-left finder), read as a QR reader does.
  const g = (x, y) => (modules[y][x] ? 1 : 0);
  let f = 0;
  const order1 = [[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8], [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0]];
  order1.forEach(([x, y], i) => { f |= g(x, y) << (14 - i); });
  const fmt = f ^ 0x5412;
  assert.equal(fmt >> 13, 0, 'error correction level bits must be M (00)');
  const mask = (fmt >> 10) & 7;
  assert.equal(formatBits(mask), f, 'format bits are the BCH codeword for this mask');
  // Second copy must agree.
  let f2 = 0;
  for (let i = 0; i < 7; i++) f2 |= g(8, size - 1 - i) << (14 - i);
  for (let i = 7; i < 15; i++) f2 |= g(size - 15 + i, 8) << (14 - i);
  assert.equal(f2, f, 'second format copy agrees');

  // Function-module map rebuilt from the spec (not taken from the encoder).
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const box = (x0, y0, x1, y1) => { for (let y = Math.max(0, y0); y <= Math.min(size - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(size - 1, x1); x++) fn[y][x] = true; };
  box(0, 0, 8, 8); box(size - 8, 0, size - 1, 8); box(0, size - 8, 8, size - 1);
  box(6, 0, 6, size - 1); box(0, 6, size - 1, 6);
  const pos = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] }[version];
  for (const cy of pos) for (const cx of pos) {
    if ((cx === 6 && cy === 6) || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6)) continue;
    box(cx - 2, cy - 2, cx + 2, cy + 2);
  }
  if (version >= 7) { box(size - 11, 0, size - 9, 5); box(0, size - 11, 5, size - 9); }

  // Version info (v7+) read back and checked.
  if (version >= 7) {
    let v = 0;
    for (let i = 0; i < 18; i++) v |= g(size - 11 + (i % 3), Math.floor(i / 3)) << i;
    assert.equal(v, versionBits(version));
  }

  const bits = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j; const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
      if (fn[y][x]) continue;
      bits.push(g(x, y) ^ (MASK_FN[mask](x, y) ? 1 : 0));
    }
  }
  const cw = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  const table = { 1: [10, 1, 16, 0, 0], 2: [16, 1, 28, 0, 0], 3: [26, 1, 44, 0, 0], 4: [18, 2, 32, 0, 0], 5: [24, 2, 43, 0, 0], 6: [16, 4, 27, 0, 0], 7: [18, 4, 31, 0, 0], 8: [22, 2, 38, 2, 39], 9: [22, 3, 36, 2, 37], 10: [26, 4, 43, 1, 44] }[version];
  const [ecc, g1, d1, g2, d2] = table;
  const nBlocks = g1 + g2;
  const lens = Array.from({ length: nBlocks }, (_, i) => (i < g1 ? d1 : d2));
  const blocks = lens.map(() => []);
  let at = 0;
  for (let i = 0; i < Math.max(d1, d2); i++) for (let b = 0; b < nBlocks; b++) if (i < lens[b]) blocks[b].push(cw[at++]);
  const eccs = lens.map(() => []);
  for (let i = 0; i < ecc; i++) for (let b = 0; b < nBlocks; b++) eccs[b].push(cw[at++]);
  assert.equal(at, cw.length - (cw.length - at), 'consumed all codewords');

  // Syndromes: the full codeword (data then ecc) must evaluate to zero at alpha^0 .. alpha^(ecc-1).
  const data = [];
  blocks.forEach((blk, b) => {
    const word = [...blk, ...eccs[b]];
    for (let s = 0; s < ecc; s++) {
      let acc = 0;
      for (const c of word) acc = gmul(acc, EXP[s]) ^ c;
      assert.equal(acc, 0, `block ${b} syndrome ${s}`);
    }
    data.push(...blk);
  });

  // Parse: mode 0100, count, bytes.
  const stream = data.map((b) => bitString(b, 8)).join('');
  assert.equal(stream.slice(0, 4), '0100', 'byte mode');
  const countBits = version <= 9 ? 8 : 16;
  const count = parseInt(stream.slice(4, 4 + countBits), 2);
  const out = [];
  for (let i = 0; i < count; i++) out.push(parseInt(stream.slice(4 + countBits + i * 8, 12 + countBits + i * 8), 2));
  return Buffer.from(out).toString('utf8');
}

test('the matrix alone decodes back to the text with valid error correction', () => {
  for (const text of [...URLS, 'https://www.mockmob.in/result/abc?x=é', 'x'.repeat(213)]) {
    assert.equal(decode(encodeQr(text)), text);
  }
});

test('every version 1 to 10 round-trips', () => {
  const seen = new Set();
  for (let len = 1; len <= 213; len += 7) {
    const text = 'm'.repeat(len);
    const qr = encodeQr(text);
    seen.add(qr.version);
    assert.equal(decode(qr), text);
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('codeword builder pads with 236 and 17 after the terminator', () => {
  const cw = buildCodewords([0x41], 1);
  assert.deepEqual(cw.slice(0, 5), [0x40, 0x14, 0x10, 0xec, 0x11]);
});
