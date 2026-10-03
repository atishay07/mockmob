// Lists emoji and decorative unicode glyphs used as UI in the signed-in app and shared
// components. These should be SVG icons from one family. Read-only.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const GLYPHS = /[\u{1F300}-\u{1FAFF}☀-➿⭐←-⇿■-◿∞✓✕✦❖⬢⬡⬟]/gu;
const SKIP_DIR = new Set(['node_modules', '.next', 'landing', 'marketing', 'preview']);
const hits = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { if (!SKIP_DIR.has(entry.name)) walk(path); continue; }
    if (!/\.(jsx?|mjs)$/.test(entry.name)) continue;
    readFileSync(path, 'utf8').split(/\r?\n/).forEach((line, i) => {
      const found = line.match(GLYPHS);
      if (found) hits.push({ file: path.replace(/\\/g, '/'), line: i + 1, glyphs: [...new Set(found)].join(' '), text: line.trim().slice(0, 90) });
    });
  }
}
walk('src/app/(app)');
walk('src/components');
walk('data');
const byFile = Object.groupBy(hits, (h) => h.file);
for (const [file, list] of Object.entries(byFile)) {
  console.log(`${file} (${list.length})`);
  for (const h of list.slice(0, 5)) console.log(`  ${h.line}: [${h.glyphs}] ${h.text}`);
}
console.log(`\n${hits.length} lines in ${Object.keys(byFile).length} files`);
