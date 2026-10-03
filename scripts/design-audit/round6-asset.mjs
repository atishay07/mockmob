import sharp from 'sharp';
import fs from 'node:fs/promises';
const source = 'C:/Users/atish/.codex/generated_images/01a10116-8c9f-7c40-9c90-90ad937b1dea/exec-c10c669f-6ab1-4339-bb10-b7d602dd62ed.png';
await fs.copyFile(source, 'artifacts/round6/pip-attentive-master.png');
// Delivery resize only; the generated alpha and artwork are preserved.
const result = await sharp(source).trim().resize({height:560}).webp({quality:86}).toFile('public/brand/mascot/attentive.webp');
const manifest = JSON.parse(await fs.readFile('public/brand/mascot/manifest.json','utf8'));
manifest.attentive = {src:'/brand/mascot/attentive.webp',width:result.width,height:result.height,bytes:result.size};
await fs.writeFile('public/brand/mascot/manifest.json', JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest.attentive));
