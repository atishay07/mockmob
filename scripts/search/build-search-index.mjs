// Search's small static index (the signed-in Search panel, lane palette 18 Nov 2026). The panel never asks the server while a
// student types: the chapters come from the syllabus module itself (data/cuet_syllabus.js), and the two things only the
// server's files know are folded into one small JSON here, read by the panel the first time it opens:
//   * courses:  DU's 2026 programmes (public/du/2026/index.json groups), with the number of colleges that published a cutoff
//               for each (the same count the cutoff pages print), for Colleges' own ?course= link;
//   * colleges: the colleges that appear in DU's 2026 lists, with their address (collegeSlug) and how many courses they have;
//   * decks:    the chapter keys that have Key cards in the decks the site serves (data/keycards/decks), so a chapter row offers
//               "Key cards" and "Learn" only where those pages have a deck to show.
// Run: node scripts/search/build-search-index.mjs            (writes src/lib/search/searchIndex.json)
//      node scripts/search/build-search-index.mjs --check    (exits 1 when the committed file is stale)
// src/lib/search/searchModel.test.mjs runs buildSearchIndex() and fails when the committed file differs, so it cannot drift.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildCatalog } from '../../src/lib/du/cutoffPages.mjs';
import { CHAPTERS } from '../../data/cuet_syllabus.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SEARCH_INDEX_FILE = join(ROOT, 'src', 'lib', 'search', 'searchIndex.json');

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

export function buildSearchIndex(root = ROOT) {
  const du = join(root, 'public', 'du', '2026');
  const index = readJson(join(du, 'index.json'));
  const offerings = {};
  for (const group of index.groups) {
    if (group.offerings) offerings[group.id] = readJson(join(du, 'offerings', `${group.id}.json`));
  }
  const catalog = buildCatalog(index, offerings);
  const collegesOf = new Map(catalog.courses.map((course) => [course.id, course.collegeCount]));
  // Every programme Colleges can open (its ?course= link takes any group), in the index's own order.
  const courses = index.groups.map((group) => ({ id: group.id, name: group.name, colleges: collegesOf.get(group.id) || 0 }));
  const colleges = catalog.colleges.map((college) => ({ slug: college.slug, name: college.title, courses: college.courseCount }));

  const decks = deckChapters(join(root, 'data', 'keycards'), new Set(CHAPTERS.map((chapter) => chapter.key)));
  return { courses, colleges, decks };
}

/**
 * The live chapter keys with Key cards, by the server's own rule (src/lib/server/keycards.js loadDecks): a subject in the
 * manifest whose deck file is there and matches the manifest's sha256 (otherwise the server switches that subject off), and
 * only cards that name that subject. `live`: the syllabus's chapter keys. -> sorted keys.
 */
export function deckChapters(dir, live) {
  let manifest = {};
  try { manifest = readJson(join(dir, 'manifest.json')); } catch { return []; }
  const decks = new Set();
  for (const subject of Object.keys(manifest).sort()) {
    const file = join(dir, 'decks', `${subject}.json`);
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    if (createHash('sha256').update(text).digest('hex') !== manifest[subject]?.sha256) continue;
    let deck;
    try { deck = JSON.parse(text); } catch { continue; }
    for (const card of deck.cards || []) if (card?.id && card.subject === subject && live.has(card.chapterKey)) decks.add(card.chapterKey);
  }
  return [...decks].sort();
}

export const serialise = (value) => `${JSON.stringify(value)}\n`;

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const next = serialise(buildSearchIndex());
  const current = existsSync(SEARCH_INDEX_FILE) ? readFileSync(SEARCH_INDEX_FILE, 'utf8') : '';
  if (process.argv.includes('--check')) {
    if (current !== next) { console.error('src/lib/search/searchIndex.json is stale: run node scripts/search/build-search-index.mjs'); process.exit(1); }
    console.log('searchIndex.json is current');
  } else {
    writeFileSync(SEARCH_INDEX_FILE, next);
    const parsed = JSON.parse(next);
    console.log(`wrote ${SEARCH_INDEX_FILE}: ${parsed.courses.length} courses, ${parsed.colleges.length} colleges, ${parsed.decks.length} chapters with Key cards (${next.length} bytes)`);
  }
}
