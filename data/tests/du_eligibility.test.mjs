import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateGroup,
  evaluateAll,
  suggestUnlocks,
  effectiveCutoff,
  seatStatus,
  gapsFor,
  explainCombinations,
} from '../../src/lib/du/eligibility.js';
import { searchSubjects } from '../../src/lib/du/search.js';
import { DU_SOURCES } from '../../src/lib/du/sources.js';

const root = path.resolve(import.meta.dirname, '../../public/du/2026');
const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
const rules = JSON.parse(fs.readFileSync(path.join(root, 'rules.json'), 'utf8'));
const byName = (name) => index.groups.find((g) => g.name === name);
const sel = (languages, domains = [], gat = false) => ({ languages, domains, gat });

test('dataset: counts and integrity', () => {
  assert.equal(index.groups.length, 73);
  assert.equal(rules.groups.length, 73);
  assert.equal(index.meta.offerings, 1393);
  assert.equal(index.groups.reduce((n, g) => n + g.offerings, 0), 1393);
  for (const g of index.groups) {
    assert.ok(g.eligibility.combinations.length > 0, `${g.name} has combinations`);
    for (const c of g.eligibility.combinations) assert.ok(Array.isArray(c.slots) && c.slots.length > 0, `${g.name}: ${c.text}`);
  }
  assert.equal(index.meta.sources.length, 4);
  for (const s of index.meta.sources) assert.match(s.sha256, /^[0-9a-f]{64}$/);
});

test('dataset: a cutoff row matches the PDF exactly', () => {
  const g = byName('B.Com. (Hons.)');
  const file = JSON.parse(fs.readFileSync(path.join(root, 'offerings', `${g.id}.json`), 'utf8'));
  const row = file.rows.find((r) => r[0] === 'Acharya Narendra Dev College');
  assert.ok(row);
  // Round I: UR 718.5747, OBC-NCL 569.0049, SC 484.8911, ST 139.9449, EWS 628.5515 (printed in the PDF)
  assert.deepEqual(row[2].slice(0, 5), [718.5747, 569.0049, 484.8911, 139.9449, 628.5515]);
  assert.deepEqual(row[3].slice(0, 5), [690.5296, 508.1489, 428.4849, 356.3864, 600.4957]);
});

test('commerce subjects: eligible for B.Com. (Hons.) and B.Com., not for Economics (needs Mathematics)', () => {
  const s = sel(['english'], ['accountancy', 'business_studies', 'economics']);
  assert.equal(evaluateGroup(byName('B.Com. (Hons.)'), s).eligible, true);
  assert.equal(evaluateGroup(byName('B.Com.'), s).eligible, true);
  const econ = evaluateGroup(byName('B.A. (Hons.) Economics'), s);
  assert.equal(econ.eligible, false);
  assert.deepEqual(econ.nearest.gaps, [{ kind: 'domain', id: 'mathematics' }]);
});

test('adding Mathematics unlocks Economics; Business Economics also needs the General Aptitude Test', () => {
  const base = sel(['english'], ['accountancy', 'economics', 'business_studies']);
  const withMaths = sel(['english'], ['accountancy', 'economics', 'business_studies', 'mathematics']);
  assert.equal(evaluateGroup(byName('B.A. (Hons.) Economics'), withMaths).eligible, true);
  assert.equal(evaluateGroup(byName('B.A. (Hons.) Business Economics'), withMaths).eligible, false);
  assert.equal(evaluateGroup(byName('B.A. (Hons.) Business Economics'), { ...withMaths, gat: true }).eligible, true);
  const unlocks = suggestUnlocks(index.groups, base, rules);
  assert.ok(unlocks.some((u) => u.id === 'mathematics' && u.programmes.includes('B.A. (Hons.) Economics')));
});

test('science: PCM + a language is eligible for Physics; domains alone are not (language is also required)', () => {
  const physics = byName('B.Sc. (Hons.) Physics');
  assert.equal(evaluateGroup(physics, sel(['english'], ['physics', 'chemistry', 'mathematics'])).eligible, true);
  const noLang = evaluateGroup(physics, sel([], ['physics', 'chemistry', 'mathematics']));
  assert.equal(noLang.eligible, false);
  assert.deepEqual(noLang.nearest.gaps, [{ kind: 'any-language', count: 1 }]);
  // PCB is not enough for Physics (needs Mathematics)
  assert.equal(evaluateGroup(physics, sel(['english'], ['physics', 'chemistry', 'biology'])).eligible, false);
});

test('language-specific rules: Hindi and Sanskrit Honours', () => {
  const hindi = byName('B.A. (Hons.) Hindi');
  assert.equal(evaluateGroup(hindi, sel(['english'], ['history', 'economics', 'psychology'])).eligible, false);
  assert.equal(evaluateGroup(hindi, sel(['hindi'], ['history', 'economics', 'psychology'])).eligible, true);
  assert.equal(evaluateGroup(hindi, sel(['hindi', 'english'], ['history', 'economics'])).eligible, true);
  const sanskrit = byName('B.A. (Hons.) Sanskrit');
  assert.equal(evaluateGroup(sanskrit, sel(['sanskrit'], ['history', 'economics', 'psychology'])).eligible, true);
  assert.equal(evaluateGroup(sanskrit, sel(['english', 'sanskrit'], ['history', 'economics'])).eligible, true);
  // Eligible only through Combination III, which the Bulletin ranks after Combinations I and II.
  const viaGeneral = evaluateGroup(sanskrit, sel(['english'], ['history', 'economics', 'psychology']));
  assert.equal(viaGeneral.eligible, true);
  assert.equal(viaGeneral.secondary, true);
  assert.equal(evaluateGroup(sanskrit, sel(['sanskrit'], ['history', 'economics', 'psychology'])).secondary, false);
  // Hindi Honours has no general combination: a non-Hindi student is simply not eligible.
  assert.equal(evaluateGroup(hindi, sel(['english', 'urdu'], ['history', 'economics'])).eligible, false);
});

test('GAT combinations', () => {
  const bcom = byName('B.Com.');
  // Any one Language + any one subject + GAT
  assert.equal(evaluateGroup(bcom, sel(['english'], ['accountancy'], true)).eligible, true);
  assert.equal(evaluateGroup(bcom, sel(['english'], ['accountancy'], false)).eligible, false);
  assert.equal(evaluateGroup(byName('Bachelor of Fine Arts (B.F.A.)'), sel(['english'], [], true)).eligible, true);
});

test('nothing selected evaluates to nobody eligible', () => {
  const all = evaluateAll(index.groups, sel([], []));
  assert.equal(all.filter((r) => r.eligible).length, 0);
});

test('every combination is satisfiable by some selection (no dead rules)', () => {
  const allLangs = rules.languages.map((l) => l.id);
  const allDomains = rules.domains.map((d) => d.id);
  const everything = sel(allLangs, allDomains, true);
  for (const g of index.groups) {
    assert.equal(evaluateGroup(g, everything).eligible, true, `${g.name} unreachable`);
    for (const c of g.eligibility.combinations) assert.equal(gapsFor(c, g.eligibility.requiresLanguage, everything).length, 0);
  }
});

test('cutoffs: a reserved-category candidate may clear on the UR cutoff', () => {
  // [UR, OBC-NCL, ...]
  assert.equal(effectiveCutoff([600, 500, null], 1), 500);
  assert.equal(effectiveCutoff([450, 500, null], 1), 450); // UR lower than OBC: UR merit applies
  assert.equal(effectiveCutoff([null, 500, null], 1), 500);
  assert.equal(effectiveCutoff(null, 1), null);
});

test('seatStatus reports the first round a score clears', () => {
  const row = ['College', 'Prog', [600, 500], [550, 450], [400, 300]];
  assert.equal(seatStatus(610, row, 0).id, 'r1');
  assert.equal(seatStatus(560, row, 0).id, 'r2');
  assert.equal(seatStatus(420, row, 0).id, 'r3');
  assert.equal(seatStatus(100, row, 0).id, 'below');
  assert.equal(seatStatus(900, ['C', 'P', null, null, null], 0).id, 'none');
});

test('the source links shown on the page are exactly the ones the dataset was built from', () => {
  assert.deepEqual(
    DU_SOURCES.map((s) => [s.id, s.url]),
    index.meta.sources.map((s) => [s.id, s.url])
  );
});

test('commerce student with Informatics Practices: B.Sc. (Hons.) Computer Science needs Mathematics (per the Bulletin)', () => {
  const cs = byName('B.Sc. (Hons.) Computer Science');
  const commerceWithIp = sel(['english'], ['accountancy', 'business_studies', 'economics', 'computer_science']);
  const r = evaluateGroup(cs, commerceWithIp);
  assert.equal(r.eligible, false);
  assert.deepEqual(r.nearest.gaps, [{ kind: 'domain', id: 'mathematics' }]);
  // Both Bulletin combinations require Mathematics/Applied Mathematics.
  assert.ok(cs.eligibility.combinations.every((c) => c.slots.some((s) => s.type === 'domain' && s.subject === 'mathematics')));
  // With Mathematics added the same student is eligible.
  assert.equal(evaluateGroup(cs, sel(['english'], [...commerceWithIp.domains, 'mathematics'])).eligible, true);
});

test('Computer Science and Informatics Practices are one subject for every rule that names it', () => {
  const electronics = byName('B.Sc. (Hons.) Electronics');
  // Physics + Mathematics + Computer Science/Informatics Practices, plus the language that rule also needs
  assert.equal(evaluateGroup(electronics, sel(['english'], ['physics', 'mathematics', 'computer_science'])).eligible, true);
  assert.equal(evaluateGroup(electronics, sel([], ['physics', 'mathematics', 'computer_science'])).eligible, false);
});

test('explainCombinations reports each Bulletin combination with what is missing', () => {
  const cs = byName('B.Sc. (Hons.) Computer Science');
  const rows = explainCombinations(cs, sel(['english'], ['accountancy', 'economics']), rules);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.ok === false));
  assert.ok(rows[0].missing.some((m) => /Mathematics/.test(m)));
  const ok = explainCombinations(byName('B.Com.'), sel(['english'], ['accountancy', 'economics', 'history']), rules);
  assert.equal(ok[0].ok, true);
});

test('subject search understands the names students actually use', () => {
  const idsFor = (q) => searchSubjects(q, rules).domains;
  assert.deepEqual(idsFor('informatics'), ['computer_science']);
  assert.deepEqual(idsFor('IP'), ['computer_science']);
  assert.ok(idsFor('biotech').includes('biology'));
  assert.ok(idsFor('book keeping').includes('accountancy'));
  assert.ok(idsFor('applied maths').includes('mathematics') || idsFor('maths').includes('mathematics'));
  assert.ok(idsFor('business econ').includes('economics'));
  assert.equal(searchSubjects('x', rules).domains.length, 0);
  assert.ok(searchSubjects('hin', rules).languages.includes('hindi'));
});
