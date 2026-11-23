// node scripts/coverage/build-home.mjs
//
// The home page's CUET 2026 check (owner LK427, 23 Nov 2026) draws from trimmed copies of the public coverage files, so a
// phone fetches a paper's questions only when that paper is chosen, and never the checker's notes. This writes, from
// data/coverage/cuet2026/public/ (scripts/coverage/build-public.mjs, which calls this at its end):
//   data/coverage/cuet2026/home/<id>.json   a paper's questions and their matches (coverage2026.mjs homeSubject);
//   data/coverage/cuet2026/home/strips.json one short string a paper, one letter a question (coverageWords.mjs STATUS_CODE).
// It reads no database and no network. coverage2026.test.mjs fails when these files are not what this script would write.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUB = path.join(ROOT, 'data/coverage/cuet2026/public');
const HOME = path.join(ROOT, 'data/coverage/cuet2026/home');
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const write = (file, data) => writeFileSync(file, `${JSON.stringify(data)}\n`);

export async function buildHome({ log = console.log } = {}) {
  // strips.json is imported by coverage2026.mjs: on a first run it has to exist before that module can load.
  mkdirSync(HOME, { recursive: true });
  if (!existsSync(path.join(HOME, 'strips.json'))) write(path.join(HOME, 'strips.json'), {});
  if (!existsSync(path.join(HOME, 'marks.json'))) write(path.join(HOME, 'marks.json'), {});
  const { homeSubject, marksOf, stripOf } = await import(pathToFileURL(path.join(ROOT, 'src/components/landing/coverage2026.mjs')).href);
  const summary = read(path.join(PUB, 'summary.json'));
  const strips = {};
  const marks = {};
  const kept = new Set(['strips.json', 'marks.json']);
  for (const s of summary.subjects) {
    const file = read(path.join(PUB, `${s.id}.json`));
    strips[s.id] = stripOf(file);
    marks[s.id] = marksOf(file);
    write(path.join(HOME, `${s.id}.json`), homeSubject(file));
    kept.add(`${s.id}.json`);
  }
  write(path.join(HOME, 'strips.json'), strips);
  // The first check, one letter a question: 1 counted then, 0 not (coverageWords.mjs viewStrip).
  write(path.join(HOME, 'marks.json'), marks);
  // A subject that left the summary leaves the home folder too.
  for (const name of readdirSync(HOME)) if (!kept.has(name)) rmSync(path.join(HOME, name));
  log(`home files: ${summary.subjects.map((s) => `${s.id} ${strips[s.id].length}`).join(', ')}`);
  return strips;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildHome().catch((err) => { console.error(err); process.exit(1); });
}
