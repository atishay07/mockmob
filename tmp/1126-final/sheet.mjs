// Contact sheets: node sheet.mjs <dir> <prefix> [perSheet=6] [tileWidth=300]
import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import path from 'node:path';
const [dir, prefix, per = '6', tw = '300'] = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.png') && !f.includes('sheet')).sort();
const n = Number(per), w = Number(tw);
for (let s = 0; s * n < files.length; s += 1) {
  const part = files.slice(s * n, s * n + n);
  const tiles = await Promise.all(part.map((f) => sharp(path.join(dir, f)).resize({ width: w }).toBuffer({ resolveWithObject: true })));
  const h = Math.max(...tiles.map((t) => t.info.height));
  await sharp({ create: { width: (w + 8) * part.length + 8, height: h + 16, channels: 3, background: '#ffffff' } })
    .composite(tiles.map((t, i) => ({ input: t.data, left: 8 + i * (w + 8), top: 8 }))).png().toFile(path.join(dir, `${prefix}sheet-${s}.png`));
}
console.log('sheets', Math.ceil(files.length / n));
