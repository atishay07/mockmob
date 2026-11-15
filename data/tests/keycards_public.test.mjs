// The public Key card decks (/key-cards, /key-cards/<subject>/<chapter>) on the server: what they read and when, that they show
// exactly what the app's Free deck shows, that a failure never rebuilds a page empty, and that nothing on them writes. The pure
// model has its own tests (src/lib/keycardsPublic.test.mjs). Fake database: src/lib/server/keycardsMemoryDb.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createKeycards, loadDecks } from '../../src/lib/server/keycards.js';
import { fakeDb } from '../../src/lib/server/keycardsMemoryDb.js';
import { syllabusFrom } from '../../src/lib/server/keycardsSyllabus.js';
import { createPublicDecks } from '../../src/lib/server/keycardsPublicLoad.js';
import { NO_DECKS } from '../../src/lib/keycardsPublic.mjs';
import { SUBJECT_PAGES } from '../../src/lib/subjectPages.mjs';
import * as cuetSyllabus from '../cuet_syllabus.js';

const ROOT = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8').replace(/\r\n/g, '\n'); // a Windows checkout has CRLF
const DAY = 86_400_000;
const T0 = Date.parse('2026-11-16T12:00:00+05:30');
const DECKS = loadDecks({ log: () => {} });
const SYLLABUS = syllabusFrom(cuetSyllabus);

function world({ tables = {}, enabled = true, decks = DECKS, retries = 1 } = {}) {
  const db = fakeDb(tables);
  const kc = createKeycards({
    db, decks, syllabus: SYLLABUS, now: () => T0,
    getUser: async (id) => ({ id, isPremium: false, subjects: ['accountancy'], createdAt: T0 - 30 * DAY }),
  });
  const publicDecks = createPublicDecks({
    enabled: () => enabled, decks: () => decks, service: async () => kc, syllabus: async () => SYLLABUS, pages: SUBJECT_PAGES, retries, wait: 0,
  });
  const reads = (table) => db.log.filter((l) => l.table === table).length;
  return { db, kc, publicDecks, reads };
}

test('one read of the suspended-card view builds every public page; the next pages in the window read nothing', async () => {
  const w = world();
  const first = await w.publicDecks();
  assert.ok(first.totals.chapters > 100, `${first.totals.chapters} chapters`);
  await w.publicDecks();
  await w.publicDecks();
  assert.equal(w.reads('key_card_suspended'), 1);
  assert.deepEqual([...new Set(w.db.log.map((l) => l.table || l.rpc))], ['key_card_suspended'], 'no other table, no rpc, no write');
  assert.equal(await w.publicDecks(), first, 'the same published set gives the same model, not a rebuild');
});

test('every public chapter is exactly the app\'s Free deck of that chapter: its open cards whole, its count of locked cards', async () => {
  const w = world();
  const model = await w.publicDecks();
  for (const subject of model.subjects) {
    for (const chapter of subject.chapters.filter((_, i) => i % 3 === 0)) {
      const app = (await w.kc.deck('visitor', chapter.key)).body;
      const open = app.cards.filter((c) => !c.locked);
      assert.deepEqual(chapter.open.map((c) => c.id), open.map((c) => c.id), chapter.key);
      assert.equal(chapter.total, app.counts.total, chapter.key);
      assert.equal(chapter.lockedCount, app.counts.locked, chapter.key);
      for (const c of chapter.open) {
        const full = open.find((x) => x.id === c.id);
        assert.equal(c.front, full.front);
        assert.equal(c.back, full.back);
        assert.deepEqual(c.texHtml ?? null, full.texHtml ?? null);
      }
    }
  }
});

test('a card five established students reported leaves the public deck as it leaves every Free deck', async () => {
  const model = await world().publicDecks();
  const chapter = model.find('accountancy', 'partnership-fundamentals');
  const gone = chapter.open[0].id;
  const users = ['u1', 'u2', 'u3', 'u4', 'u5'];
  const tables = {
    key_card_reports: users.map((u) => ({ user_id: u, card_id: gone, reason: 'Wrong page', created_at: new Date(T0 - DAY).toISOString() })),
    attempts: users.map((u, i) => ({ id: `a${i}`, user_id: u, completed_at: new Date(T0 - 5 * DAY).toISOString() })),
  };
  const w = world({ tables });
  const after = (await w.publicDecks()).find('accountancy', 'partnership-fundamentals');
  assert.equal(after.open.some((c) => c.id === gone), false);
  assert.equal(after.open.length, chapter.open.length, 'the next Must-know card takes its place');
  assert.equal(after.total, chapter.total - 1);
  const app = (await w.kc.deck('visitor', chapter.key)).body;
  assert.deepEqual(after.open.map((c) => c.id), app.cards.filter((c) => !c.locked).map((c) => c.id));
});

test('Key cards switched off: no public deck and no read', async () => {
  const w = world({ enabled: false });
  assert.equal(await w.publicDecks(), NO_DECKS);
  assert.equal(w.db.log.length, 0);
});

test('no deck readable (a bundle without the deck files): it throws, so a rebuild never replaces a good page with an empty one', async () => {
  const w = world({ decks: { bySubject: new Map(), byId: new Map(), links: new Map(), disabled: [] } });
  await assert.rejects(w.publicDecks(), /KEY_CARDS_DECKS_UNREADABLE/);
  assert.equal(w.db.log.length, 0);
});

test('the read fails once: tried again; fails twice: throws (Next keeps the last page it built)', async () => {
  const flaky = world();
  let left = 1;
  flaky.db.failures.key_card_suspended = () => left-- > 0;
  assert.ok((await flaky.publicDecks()).totals.chapters > 0);
  assert.equal(flaky.reads('key_card_suspended'), 2);
  const down = world();
  down.db.failures.key_card_suspended = () => true;
  await assert.rejects(down.publicDecks());
  assert.equal(down.reads('key_card_suspended'), 2, 'one try and one retry, no more');
});

// ---------------------------------------------------------------- the routes, the links, the deck

test('the chapter pages are static: built at deploy, rebuilt at most hourly, an unknown address a real 404', () => {
  const page = read('src/app/key-cards/[subject]/[chapter]/page.js');
  assert.match(page, /export const revalidate = 3600;/);
  assert.match(page, /export const dynamicParams = false;/);
  assert.match(page, /export async function generateStaticParams\(\) \{\n {2}return \(await publicKeyCards\(\)\)\.params\(\);\n\}/);
  assert.match(page, /if \(!deck\) notFound\(\);/);
  assert.match(page, /signupHref=\{signupPathFor\(deck\.appPath\)\}/, 'sign-up comes back to this chapter\'s deck in the app');
  assert.match(page, /<NavBar \/>/);
  assert.match(page, /<MarketingFooter \/>/);
  assert.match(page, /breadcrumbJsonLd\(/);
  const index = read('src/app/key-cards/page.js');
  assert.match(index, /export const revalidate = 3600;/);
  for (const file of ['src/app/key-cards/[subject]/[chapter]/page.js', 'src/app/key-cards/page.js', 'src/components/keycards/public/PublicDeck.jsx', 'src/lib/keycardsPublic.mjs', 'src/lib/server/keycardsPublicLoad.js', 'src/lib/server/keycardsPublic.js']) {
    const text = read(file);
    assert.doesNotMatch(text, /\.(from|rpc|insert|upsert|update)\(\s*['"`]/, `${file} reads or writes no table itself`);
    assert.doesNotMatch(text, /supabase/i, `${file} has no database client of its own`);
  }
});

test('the deck sends nothing and saves nothing: no API, no fetch, no storage; the card is the app\'s CardFace', () => {
  const deck = read('src/components/keycards/public/PublicDeck.jsx');
  assert.match(deck, /import \{ CardFace \} from '@\/components\/learn2\/stage\/CardFace';/);
  assert.doesNotMatch(deck, /keycards\/api|learn2\/api|fetch\(|localStorage|sessionStorage|sendReview|sendReport/);
  assert.match(deck, /data-now=/);
  assert.match(deck, /aria-live="polite"/);
});

test('the links in: the sitemap, each subject page, the home page\'s Key cards section', () => {
  const sitemap = read('src/app/sitemap.js');
  assert.match(sitemap, /publicKeyCards\(\)/);
  assert.match(sitemap, /absoluteUrl\(KEY_CARDS_PATH\)/);
  assert.match(sitemap, /s\.chapters\.map\(\(c\) => \(\{ url: absoluteUrl\(c\.path\)/);
  const subject = read('src/app/cuet/[subject]/page.js');
  assert.match(subject, /keyCards=\{keyCards\}/);
  assert.match(read('src/components/subject/SubjectLandingPage.jsx'), /<Link href=\{keyCards\.href\} className="mm-link">See the \{name\} Key cards<\/Link>/);
  const demo = read('src/components/landing/KeyCardsDemo.jsx');
  assert.match(demo, /const PUBLIC_DECKS_HREF = '\/key-cards';/);
  assert.match(demo, /<Link href=\{PUBLIC_DECKS_HREF\} className="mm-link">\{W\.seeChapter\}<\/Link>/);
});

// ---------------------------------------------------------------- the card's look: the app's values, copied once and pinned

/** The custom properties set in the first rule whose selector is exactly `selector` in `css`. */
function propsOf(css, selector) {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} not found`);
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  return Object.fromEntries([...body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().replace(/\s+/g, ' ')]));
}

test('the public card wears the app\'s values: the Arena roles, the index card\'s paper and the stage\'s, Night and Day', () => {
  const mine = read('src/components/keycards/public/public-deck.css');
  const night = propsOf(mine, '.kcp.kc');
  const day = propsOf(mine, "html[data-theme='light'] .kcp.kc");
  const arena = read('src/app/(app)/arena.css');
  const arenaNight = propsOf(arena, 'html:has(.app-shell)');
  const arenaDay = propsOf(arena, "html[data-theme='light']:has(.app-shell)");
  for (const [key, value] of Object.entries(night).filter(([k]) => k.startsWith('--a-'))) assert.equal(value, arenaNight[key], `Night ${key}`);
  for (const [key, value] of Object.entries(day).filter(([k]) => k.startsWith('--a-'))) assert.equal(value, arenaDay[key], `Day ${key}`);
  const cards = read('src/components/keycards/keycards.css');
  const paperNight = propsOf(cards, '.st.kc, .lr.kc');
  const paperDay = propsOf(cards, "html[data-theme='light'] :is(.st.kc, .lr.kc)");
  for (const key of ['--kc-paper', '--kc-paper-line', '--kc-paper-shadow', '--kc-band-mix', '--kc-rule']) {
    assert.equal(night[key], paperNight[key], `Night ${key}`);
    assert.equal(day[key], paperDay[key], `Day ${key}`);
  }
  assert.equal(night['--kc-surface'], paperNight['--kc-surface']);
  const stage = read('src/components/learn2/stage/stage.css');
  const st = propsOf(stage, '.st.kc');
  for (const key of ['--st-ease', '--st-out', '--st-tick-ahead']) assert.equal(night[key], st[key], key);
  assert.equal(day['--st-tick-ahead'], propsOf(stage, "html[data-theme='light'] .st.kc")['--st-tick-ahead']);
  assert.equal(st['--st-card-min'], 'clamp(300px, 46dvh, 380px)', 'the stage\'s least card height; the public deck takes it in svh');
  assert.equal(night['--st-card-min'], 'clamp(300px, 46svh, 380px)');
});
