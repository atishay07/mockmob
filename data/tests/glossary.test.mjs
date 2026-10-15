import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';
import {
  APPROVED, GLOSSARY_BASELINE, RETIRED_TERMS, SCAN_EXCLUDE, SCAN_EXTENSIONS, SCAN_ROOTS, UPLOAD_STATUS,
  moveLabel, retiredHits, retiredTermIn, studentStrings,
} from '../glossary.mjs';
import { contributionState } from '../contribution_ui.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Retired-term hits across the student-facing source: { total, byTerm, byFile }. */
export function scanRetired(root = ROOT) {
  const files = [];
  const walk = (p) => {
    const st = statSync(p, { throwIfNoEntry: false });
    if (!st) return;
    if (st.isDirectory()) { for (const f of readdirSync(p)) walk(join(p, f)); } else files.push(p);
  };
  for (const r of SCAN_ROOTS) walk(join(root, r));
  const byTerm = {};
  const byFile = {};
  let total = 0;
  for (const f of files) {
    const rel = relative(root, f).split(sep).join('/');
    if (!SCAN_EXTENSIONS.some((e) => rel.endsWith(e)) || SCAN_EXCLUDE.some((re) => re.test(rel))) continue;
    for (const hit of retiredHits(readFileSync(f, 'utf8'), rel)) {
      byTerm[hit.id] = (byTerm[hit.id] || 0) + 1;
      byFile[rel] = (byFile[rel] || 0) + 1;
      total += 1;
    }
  }
  return { total, byTerm, byFile };
}

test('the scanner reads strings and JSX text, not comments, class names or paths', () => {
  const src = `// Radar is old\n/* PrepOS too */\nconst a = 'Open Radar'; const c = "arena-nav-link"; const p = '/admission-compass';\n<p className="prepos">Ask PrepOS</p>`;
  const strings = studentStrings(src);
  assert.ok(strings.includes('Open Radar'));
  assert.ok(strings.some((s) => s.includes('Ask PrepOS')));
  const ids = retiredHits(src).map((h) => h.id).sort();
  assert.deepEqual(ids, ['prepos', 'radar']);
});

test('About may keep Score Recovery as positioning; other pages may not', () => {
  const src = `const t = 'Score Recovery for CUET';`;
  assert.equal(retiredHits(src, 'src/app/about/page.js').length, 0);
  assert.equal(retiredHits(src, 'src/app/pricing/page.js').length, 1);
});

test('approved names never contain a retired term', () => {
  const walk = (v) => (Array.isArray(v) ? v.flatMap(walk) : v && typeof v === 'object' ? Object.values(v).flatMap(walk) : typeof v === 'string' ? [v] : []);
  for (const name of walk(APPROVED)) assert.equal(retiredTermIn(name), null, name);
  for (const term of RETIRED_TERMS) if (term.use) assert.equal(retiredTermIn(term.use), null, `${term.id} -> ${term.use}`);
});

test('upload status words: one set, covering every contributionState', () => {
  for (const status of ['live', 'approved', 'rejected', 'quarantined', 'blocked', 'failed', 'pending_moderation', 'pending']) {
    assert.ok(UPLOAD_STATUS[contributionState(status)], status);
  }
});

test("move label follows the app's evening rule (4 PM to 4:59 AM India time)", () => {
  assert.equal(moveLabel(new Date('2026-10-15T10:29:00Z')), "Today's move"); // 3:59 PM IST
  assert.equal(moveLabel(new Date('2026-10-15T10:30:00Z')), "Tonight's move"); // 4:00 PM IST
  assert.equal(moveLabel(new Date('2026-10-15T23:29:00Z')), "Tonight's move"); // 4:59 AM IST
  assert.equal(moveLabel(new Date('2026-10-15T23:30:00Z')), "Today's move"); // 5:00 AM IST
});

test('retired terms in student-facing source do not grow above the recorded baseline', () => {
  const now = scanRetired();
  if (process.env.GLOSSARY_REPORT) console.log(JSON.stringify(now, null, 2));
  assert.ok(now.total <= GLOSSARY_BASELINE.total, `retired terms grew: ${now.total} > baseline ${GLOSSARY_BASELINE.total} (${JSON.stringify(now.byTerm)})`);
  for (const [id, count] of Object.entries(now.byTerm)) {
    assert.ok(count <= (GLOSSARY_BASELINE.byTerm[id] || 0), `${id} grew to ${count} (baseline ${GLOSSARY_BASELINE.byTerm[id] || 0})`);
  }
});
