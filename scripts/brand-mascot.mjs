import fs from 'node:fs/promises';
import sharp from 'sharp';
import path from 'node:path';

// Only format/size optimisation of built-in generated cutouts. No paid API.
const items = JSON.parse(await fs.readFile('artifacts/round3/mascot-generation.json', 'utf8'));
await fs.mkdir('public/brand/mascot', { recursive: true });
const manifest = {};
for (const item of items) {
  const original = sharp(item.source);
  const meta = await original.metadata();
  const stats = await original.stats();
  if (!meta.hasAlpha || stats.channels.at(-1).min !== 0) throw new Error(`No genuine transparent alpha: ${item.pose}`);
  const name = item.pose === 'sheet' ? 'character-sheet' : item.pose;
  const output = path.join('public/brand/mascot', `${name}.webp`);
  await original.trim().resize({ width: item.pose === 'sheet' ? 1200 : 480, height: item.pose === 'sheet' ? 1200 : 560, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 100, effort: 6 }).toFile(output);
  const delivered = await sharp(output).metadata();
  const deliveredStats = await sharp(output).stats();
  manifest[item.pose] = { src: `/brand/mascot/${name}.webp`, width: delivered.width, height: delivered.height, bytes: (await fs.stat(output)).size, alphaMin: deliveredStats.channels.at(-1).min, alphaMax: deliveredStats.channels.at(-1).max };
}
await fs.writeFile('public/brand/mascot/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
