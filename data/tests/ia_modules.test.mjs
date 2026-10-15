import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  SAMPLE_HANDOFF_KEY, SAMPLE_VERSION, buildSampleHandoff, clearSampleHandoff, importOutcome, markImported, parseSampleHandoff, readSampleHandoff,
  sampleImportBody, sampleScore, shouldImport, writeSampleHandoff,
} from '../sample_handoff.mjs';
import { validateSampleImport, SAMPLE_VERSION as SERVER_SAMPLE_VERSION, SAMPLE_QUESTIONS } from '../../src/lib/server/sampleImport.js';
import { PUBLIC_SUBJECTS, SUBJECT_ART_BY_ID, SUBJECT_RENDERS, artBox, subjectArt, subjectName } from '../subject_art.mjs';
import { BRAND_FLAGS, HERO_COPY, brandFlags } from '../brand_flags.mjs';
import { CAPABILITIES, mistakeRepairReleased, recoveryReleased, RELEASE_GATES } from '../capabilities.js';
import { ROOT } from './ia_helpers.mjs';

const memory = () => {
  const store = new Map();
  return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), store };
};
const ANSWERS = ['q1', 'q2', 'q3', 'q4', 'q5'].map((id, i) => ({ sampleQuestionId: id, optionKey: 'ABCD'[i % 4] }));

test('sample handoff: key, version and body match the server contract', () => {
  assert.equal(SAMPLE_HANDOFF_KEY, 'mm:sample:v1');
  assert.equal(SAMPLE_VERSION, SERVER_SAMPLE_VERSION);
  const h = buildSampleHandoff({ answers: ANSWERS, subject: 'Accountancy', now: 1_000_000, random: () => 0.5 });
  const v = validateSampleImport(sampleImportBody(h));
  assert.equal(v.ok, true, v.message);
  assert.equal(v.value.total, SAMPLE_QUESTIONS.length);
  assert.equal(buildSampleHandoff({ answers: ANSWERS.slice(0, 4) }), null, 'incomplete answers are not stored');
});

test('sample handoff: runs once, survives a reload, ignores 409, and never throws on blocked storage', () => {
  const storage = memory();
  const now = Date.parse('2026-10-15T10:00:00Z');
  const h = buildSampleHandoff({ answers: ANSWERS, subject: 'Accountancy', now });
  assert.ok(writeSampleHandoff(storage, h));
  const read = readSampleHandoff(storage, { now: now + 60_000 });
  assert.ok(shouldImport(read));
  markImported(storage, read);
  assert.equal(shouldImport(readSampleHandoff(storage, { now: now + 120_000 })), false, 'after a reload it is not posted again');
  assert.equal(importOutcome(200), 'done');
  assert.equal(importOutcome(409), 'done');
  assert.equal(importOutcome(401), 'later');
  assert.equal(importOutcome(503), 'later');
  assert.equal(importOutcome(400), 'drop');
  assert.equal(readSampleHandoff(storage, { now: now + 8 * 86_400_000 }), null, 'expires after a week');
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(readSampleHandoff(blocked), null);
  assert.equal(writeSampleHandoff(blocked, h), false);
  assert.doesNotThrow(() => clearSampleHandoff(blocked));
  assert.equal(parseSampleHandoff('{not json'), null);
  assert.deepEqual(sampleScore(ANSWERS, { q1: 'A', q2: 'B', q3: 'A' }), { right: 2, total: 5, line: '2 of 5' });
});

test('subject art: 16 renders, every public subject has one, files are the app’s own', () => {
  assert.equal(Object.keys(SUBJECT_RENDERS).length, 16);
  for (const s of PUBLIC_SUBJECTS) assert.ok(subjectArt(s.id), s.id);
  assert.equal(subjectArt('hindi').name, 'language');
  assert.equal(subjectArt('gat').name, 'generaltest');
  assert.equal(subjectArt('Business Studies').name, 'business');
  assert.equal(subjectArt('agriculture'), null, 'an unknown subject keeps its initials card');
  assert.equal(new Set(Object.values(SUBJECT_ART_BY_ID)).size, 16);
  const dir = join(ROOT, 'public', 'art', 'subjects');
  const files = readdirSync(dir).filter((f) => f.endsWith('.webp')).sort();
  assert.deepEqual(files, Object.values(SUBJECT_RENDERS).map((r) => r.file).sort());
  const app = join(ROOT, '..', 'wt-phase2', 'flutter_app', 'assets', 'art');
  if (existsSync(app)) for (const f of files) assert.ok(readFileSync(join(dir, f)).equals(readFileSync(join(app, f))), `${f} differs from the app`);
  assert.equal(subjectName('gat'), 'General Test');
  assert.equal(subjectName('business_studies'), 'Business Studies');
});

test('subject art is never cropped: the box sits wholly inside the tile', () => {
  for (const art of Object.values(SUBJECT_RENDERS)) {
    const box = artBox(art, 160);
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 160 + 1e-9 && box.y + box.height <= 160 + 1e-9, art.name);
    assert.ok(Math.abs(box.width / box.height - art.width / art.height) < 1e-6, `${art.name} keeps its aspect`);
  }
});

test('brand flags stay off until Gate A, and a bad override never breaks a page', () => {
  assert.deepEqual({ ...BRAND_FLAGS }, { displayFont: 'gabarito', logo: 'bolt', subjectArt: false, heroCopy: 'a' });
  assert.deepEqual({ ...brandFlags('font,logo,art') }, { displayFont: 'bricolage', logo: 'b', subjectArt: true, heroCopy: 'a' });
  assert.deepEqual({ ...brandFlags({ logo: 'x', subjectArt: 'yes' }) }, { ...BRAND_FLAGS });
  assert.equal(HERO_COPY.a.title, 'CUET mocks that show where your marks went.');
  assert.doesNotMatch(HERO_COPY.a.lead, /fresh/i, 'copy A promises no fresh check');
});

test('mistakeRepair capability follows runtimeAi and the kill switch, not the old episodes gate', () => {
  assert.equal(CAPABILITIES.mistakeRepair.state, 'available');
  assert.equal(recoveryReleased(), false);
  assert.equal(mistakeRepairReleased({ ...RELEASE_GATES, runtimeAi: false }, {}), false);
  assert.equal(mistakeRepairReleased(RELEASE_GATES, { PREPOS_MODEL_REPLIES_DISABLED: 'true' }), false);
  assert.equal(mistakeRepairReleased(RELEASE_GATES, {}), true);
});

test('preview registry: every legacy view is kept, each packet has its own file with views and handlers', () => {
  const dir = join(ROOT, 'src', 'app', 'preview', 'arena', 'views');
  const legacy = readFileSync(join(dir, 'legacy.jsx'), 'utf8');
  const order = JSON.parse(legacy.match(/LEGACY_ORDER = (\[[^\]]+\])/)[1].replaceAll("'", '"'));
  assert.deepEqual(order, ['dashboard', 'test', 'prepos', 'compass', 'radar', 'saved', 'today', 'review', 'progress', 'recovery', 'explore', 'ranks', 'profile', 'upload', 'my-uploads', 'result', 'rival', 'onboarding', 'moderation']);
  for (const name of order) assert.match(legacy, new RegExp(`^\\s+'?${name}'?: \\{\\s+route: '/`, 'm'), name);
  for (const packet of ['shell', 'today', 'onboarding', 'practice', 'review', 'you']) {
    const src = readFileSync(join(dir, `${packet}.jsx`), 'utf8');
    assert.match(src, /export const views = /, packet);
    assert.match(src, /export const handlers = /, packet);
  }
  const client = readFileSync(join(ROOT, 'src', 'app', 'preview', 'arena', 'ArenaPreviewClient.jsx'), 'utf8');
  assert.match(client, /from '\.\/views'/);
  assert.match(client, /packetFixtureReply\(/);
  assert.doesNotMatch(client, /view === 'onboarding' \?/, 'views render through the registry');
  const page = readFileSync(join(ROOT, 'src', 'app', 'preview', 'arena', 'page.jsx'), 'utf8');
  assert.match(page, /NODE_ENV === 'production'\) notFound\(\)/, 'previews stay out of production');
});
