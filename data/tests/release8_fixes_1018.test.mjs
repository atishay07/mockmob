// Release 8 fixes (the 18 Oct website re-audit, docs/brain/W-REAUDIT-2026-10-18.md): source-level checks that run without a
// browser. The browser walk of the same fixes (390 and 1440, Night and Day, real pointer clicks) is in tmp/r8fixes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
function walk(dir, ext, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, ext, out);
    else if (ext.some((e) => entry.name.endsWith(e))) out.push(path);
  }
  return out;
}
const srcDir = fileURLToPath(new URL('src/', root));

// ---------------------------------------------------------------------------------------------------------------------
// W-078: /mentor ("Your record") was near-white on near-white in Day (contrast 1.01).
// ---------------------------------------------------------------------------------------------------------------------

test('W-078: the /mentor record sits under pp-arena, so Day gets the Arena ink and not the dark fallbacks', () => {
  const page = read('src/components/ai/MentorRecordPage.jsx');
  assert.match(page, /<div className="mrp pp-arena">/, 'the page root carries pp-arena');
  // The root wraps the record view, not a sibling of it.
  const rootAt = page.indexOf('<div className="mrp pp-arena">');
  assert.ok(rootAt > 0 && page.indexOf('<RecordView', rootAt) > rootAt, 'RecordView renders inside the pp-arena root');
});

test('W-078: every page that draws the record view wraps it in pp-arena', () => {
  const users = walk(srcDir, ['.jsx', '.js']).filter((file) => !/[\\/]RecordView\.jsx$/.test(file) && /<RecordView\b/.test(readFileSync(file, 'utf8')));
  assert.ok(users.length >= 2, 'the Radar and Ask Mobi pages both draw it');
  for (const file of users) assert.match(readFileSync(file, 'utf8'), /\bpp-arena\b/, `${file} draws <RecordView> outside pp-arena`);
});

test('W-078: arena.css maps every --pp token the record view reads onto an Arena token (Night and Day follow together)', () => {
  const arena = stripComments(read('src/app/(app)/arena.css'));
  const rule = arena.match(/\.app-shell \.pp-arena\s*\{([^}]*)\}/);
  assert.ok(rule, 'the .pp-arena rule exists');
  const mapped = new Set([...rule[1].matchAll(/--(pp-[a-z0-9-]+)\s*:\s*var\(--a-/g)].map((m) => m[1]));
  const used = new Set();
  for (const file of walk(srcDir, ['.css'])) for (const m of readFileSync(file, 'utf8').matchAll(/var\(--(pp-[a-z0-9-]+)/g)) used.add(m[1]);
  assert.ok(used.size >= 8, 'the record view reads its ink, line, accent, bad and wash tokens');
  for (const token of used) assert.ok(mapped.has(token), `--${token} is read in CSS but not mapped onto an --a- token by .pp-arena`);
});

test('the preview fixture and the signed-in page render the same /mentor component', () => {
  assert.ok(existsSync(new URL('src/components/ai/MentorRecordPage.jsx', root)));
  assert.match(read('src/app/(app)/mentor/page.js'), /<MentorRecordPage \/>/);
  assert.match(read('src/app/preview/arena/ArenaPreviewClient.jsx'), /view === 'prepos' \? <MentorRecordPage \/>/);
});
