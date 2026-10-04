// Local, zero-model authoring build. Writes candidate content only; release is decided separately by
// validate-study-content.mjs. Run from the repository root: node scripts/learning/build-study-content.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CANONICAL_SYLLABUS } from '../../data/canonical_syllabus.js';
import { CONCEPT_BLUEPRINTS } from '../../data/learning_engine.js';
import { synset } from './lib/wordnet.mjs';
import { accountancy } from '../../data/study/authored/accountancy.mjs';
import { economics } from '../../data/study/authored/economics.mjs';
import { businessStudies } from '../../data/study/authored/business-studies.mjs';
import { english } from '../../data/study/authored/english.mjs';
import { compilePacket } from '../../data/study/authored/packetCompiler.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const packets=JSON.parse(readFileSync('data/study/authored/expansion.json','utf8'));
const subjects = [english, accountancy, businessStudies, economics,...packets.map(compilePacket)];
const units = subjects.flatMap(s => s.units);
const cards = subjects.flatMap(s => s.cards);

// Licensed WordNet excerpts: the exact synset lines used, plus lines that prove each antonym.
const license = readFileSync('data/study/sources/WORDNET-LICENSE.txt', 'utf8');
const lines = new Map();
for (const fact of english.wordnetFacts) {
  const entry = synset(fact.offset);
  lines.set(fact.offset, entry.line);
  for (const p of entry.pointers.filter(p => p.symbol === '!' || p.symbol === '&')) {
    const related = synset(p.offset);
    lines.set(p.offset, related.line);
    for (const q of related.pointers.filter(q => q.symbol === '!')) lines.set(q.offset, synset(q.offset).line);
  }
}
const excerpts = { version: '3.0', source: 'WordNet 3.0 data.adj', archiveSha256: sha(readFileSync('data/study/sources/wordnet-3.0.tar.gz')),
  facts: english.wordnetFacts.map(f => ({ word: f.word, offset: f.offset, line: f.line, sha256: sha(f.line) })),
  lines: Object.fromEntries([...lines].map(([offset, line]) => [offset, { line, sha256: sha(line) }])), license };
writeFileSync('data/study/sources/wordnet-excerpts.json', JSON.stringify(excerpts, null, 2) + '\n');

const syllabus = CANONICAL_SYLLABUS.filter(s => ['english', 'accountancy', 'economics', 'business_studies'].includes(s.subject_id)).map(s => ({
  subject: s.subject_id, title: s.subject_name, basis: 'CUET UG 2026 syllabus map; 2027 provisional until NTA publishes it',
  chapters: s.units.flatMap(u => u.chapters.map(c => ({ id: `${s.subject_id}:${c}`, title: c, unitTitle: u.unit_name }))),
}));
for (const unit of units) if (!syllabus.some(s => s.subject === unit.subject && s.chapters.some(c => c.title === unit.chapter))) throw new Error(`Unit chapter not in syllabus: ${unit.id}`);

writeFileSync('data/study/pilot.json', JSON.stringify({ version: 2, units, cards, syllabus, blueprints: CONCEPT_BLUEPRINTS }, null, 2) + '\n');
console.log(JSON.stringify({ units: units.length, cards: cards.length, variants: cards.reduce((s, c) => s + (c.variants?.length || 1), 0), wordnetWords: english.wordnetFacts.length, paidCalls: 0, productionWrites: 0 }));
