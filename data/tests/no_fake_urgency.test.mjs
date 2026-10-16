// No fake urgency (AGENT_RULES 21 and 22; evidence T005, T009): a price is never shown beside a ticking clock unless
// a real, dated announcement stands behind it.
// - src/components/pricing/PriceIncreaseCountdown.jsx is a live "price increase at midnight" countdown. It is kept
//   (deleting it is the owner's call), but nothing may render it.
// - Any other file under src/app or src/components that ticks a countdown next to a price, with urgency words, must
//   name its dated source on a line `urgency-source: YYYY-MM-DD <who announced it>`, or this test fails.
// Run: node --test data/tests/no_fake_urgency.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PARKED = 'src/components/pricing/PriceIncreaseCountdown.jsx';
const CODE = /\.(m?js|jsx|tsx?)$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (CODE.test(name) && !/\.test\.m?js$/.test(name)) out.push(full);
  }
  return out;
}

const TICK = /setInterval\s*\([^)]*?\b1000\b|padStart\(2,\s*['"]0['"]\)[\s\S]{0,400}\b(sec|seconds|hrs|hours)\b/;
const PRICE = /₹\s?\d|\bRs\.?\s?\d|\/\s?month\b|\bper month\b/i;
const URGENCY = /price (increase|goes up|rises)|offer ends|ends in\b|expires in\b|last chance|hurry|before the (midnight|deadline)|pricing update/i;
const SOURCE = /urgency-source:\s*(\d{4}-\d{2}-\d{2})\s+\S+/;

/** Every breach of the two rules in a list of { path, text } (path relative to the repo, forward slashes). */
export function fakeUrgency(files) {
  const found = [];
  for (const { path, text } of files) {
    if (path === PARKED) continue;
    if (/PriceIncreaseCountdown/.test(text) && /(import[^;]*PriceIncreaseCountdown|<PriceIncreaseCountdown\b|require\([^)]*PriceIncreaseCountdown)/.test(text)) {
      found.push(`${path}: renders the parked PriceIncreaseCountdown`);
      continue;
    }
    if (TICK.test(text) && PRICE.test(text) && URGENCY.test(text)) {
      const source = text.match(SOURCE);
      if (!source || Number.isNaN(Date.parse(source[1]))) found.push(`${path}: a countdown beside a price with no dated urgency-source line`);
    }
  }
  return found;
}

const repoFiles = () => ['src/app', 'src/components'].flatMap((d) => walk(resolve(root, d)))
  .map((full) => ({ path: relative(root, full).split('\\').join('/'), text: readFileSync(full, 'utf8') }));

test('nothing under src/app or src/components renders a countdown beside a price without a dated source', () => {
  const files = repoFiles();
  assert.ok(files.length > 100, 'the walk found the source tree');
  assert.deepEqual(fakeUrgency(files), []);
});

test('the parked countdown still exists and is still recognised as one (so the guard is not vacuous)', () => {
  const text = readFileSync(resolve(root, PARKED), 'utf8');
  assert.ok(TICK.test(text) && PRICE.test(text) && URGENCY.test(text));
  // Moved anywhere else, it is caught by the second rule as well as the first.
  assert.equal(fakeUrgency([{ path: 'src/components/pricing/Copy.jsx', text }]).length, 1);
});

test('a planted import of the countdown fails', () => {
  const planted = [
    { path: 'src/app/pricing/page.jsx', text: "import { PriceIncreaseCountdown } from '@/components/pricing/PriceIncreaseCountdown';\nexport default function P() { return <PriceIncreaseCountdown deadline=\"2026-10-17\" />; }" },
    { path: 'src/components/Plans.jsx', text: "const C = require('./pricing/PriceIncreaseCountdown');" },
  ];
  assert.deepEqual(fakeUrgency(planted).map((line) => line.split(':')[0]), ['src/app/pricing/page.jsx', 'src/components/Plans.jsx']);
});

test('a countdown beside a price passes only with a real dated source', () => {
  const body = "useEffect(() => { const t = setInterval(tick, 1000); return () => clearInterval(t); }, []);\nreturn <p>Offer ends in {left}. Pro is ₹69 per month.</p>;";
  assert.equal(fakeUrgency([{ path: 'src/components/Offer.jsx', text: body }]).length, 1);
  assert.equal(fakeUrgency([{ path: 'src/components/Offer.jsx', text: `// urgency-source: 2026-11-01 owner announcement in the release notes\n${body}` }]).length, 0);
  assert.equal(fakeUrgency([{ path: 'src/components/Offer.jsx', text: `// urgency-source: 2026-13-45 nobody\n${body}` }]).length, 1);
  // A plain timer with no price (the test runner's clock) is not urgency.
  assert.equal(fakeUrgency([{ path: 'src/components/Timer.jsx', text: 'setInterval(tick, 1000); return <span>Ends in {mm}:{ss}</span>;' }]).length, 0);
});
