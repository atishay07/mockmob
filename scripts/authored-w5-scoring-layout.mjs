#!/usr/bin/env node
// Authored wave 5 (claude-authored-2026-11-22-w5): lays the 44 audited commerce rows out for scoring the way wave 4 was scored (tmp/authored-w4s/<subject>/).
// OFFLINE: reads the candidates file, writes files under tmp/1122-coverage/scoring. No database, no network, no model.
// Written beside scripts/authored-w4-scoring-layout.mjs, which is left exactly as it was; the helpers that do not depend on the wave (chunk, blindOf,
// textOf, fitAids) are imported from scripts/authored-w3-scoring-layout.mjs, as wave 4 does.
//
//   node scripts/authored-w5-scoring-layout.mjs [--candidates=docs/brain/reports/authored-w5/wave5-candidates-final-2026-11-22.json]
//                                              [--out=tmp/1122-coverage/scoring] [--size=20] [--expect-sha256=<hex>|any] [--force]
//
// Source of the text: the assembled wave-5 list the publisher's dry run hashed (PUBLISH.md section 1). Wave 4 re-ran its assembly to prove the scored text is
// the audited text; wave 5's assembly script writes files when run, so instead the candidates file must have the publisher's LF-normalised sha256
// (--expect-sha256, default below). Every row must carry the wave-5 source.
// Per subject folder <out>/<subject>/ (subject = the bank id: accountancy, business_studies, economics):
//   <subject>__w5b<n>.json          { batch, subject, questions } every field the judges are given (the `_verdict`, `_expert` and `_reworded` marks are not copied)
//   <subject>__w5b<n>-blind.json    what a blind solver sees: id, subject, type, stem, options, passage_text. No key, explanation, difficulty, unit, chapter, reference
//   <subject>__w5b<n>-fitaids.json  for the fit judges: the blueprint's allowed card and, per question, engine_unit_options, chapter_status, reading_words, read_seconds
//   verify/                         the result files <batch>__s1..s5, j1, j2, h1..h3 go here
// <out>/manifest.json lists the batches (ids in order, sha256 of each file) and the rows the audit repaired.
// Unlike wave 4 the out folder is NOT wiped (the instruction files SOLVER.md, QUALITY.md and FIT.md live in it): only the subject folders' pack files are
// rewritten, and the run refuses while any verify/ folder already holds a result file (unless --force), so results are never laid out from under.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { blindOf, chunk, fitAids, textOf } from './authored-w3-scoring-layout.mjs';

export const W5_SOURCE = 'claude-authored-2026-11-22-w5';
export const W5_SUBJECTS = Object.freeze(['accountancy', 'business_studies', 'economics']);
// PUBLISH.md section 1: the publisher's (LF-normalised) sha256 of wave5-candidates-final-2026-11-22.json.
export const W5_CANDIDATES_SHA256 = '31fd9c655b676cbda937c3bbb75c8389ee2fb2fdbc9ff92925792a7fe9881c08';
const DEFAULTS = {
  candidates: 'docs/brain/reports/authored-w5/wave5-candidates-final-2026-11-22.json',
  out: 'tmp/1122-coverage/scoring',
  size: '20',
  'expect-sha256': W5_CANDIDATES_SHA256,
};
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');

export function parseArgs(argv) {
  const out = { ...DEFAULTS, force: argv.includes('--force') };
  for (const arg of argv) {
    const m = arg.match(/^--([\w-]+)=(.*)$/);
    if (m && m[1] in out) out[m[1]] = m[2];
  }
  return out;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const candidatesText = fs.readFileSync(args.candidates, 'utf8');
  const candidatesSha256 = sha(candidatesText.replace(/\r\n/g, '\n'));
  if (args['expect-sha256'] !== 'any' && candidatesSha256 !== args['expect-sha256']) throw new Error(`the candidates file sha256 is ${candidatesSha256}, expected ${args['expect-sha256']} (the list the publisher's dry run hashed); refusing to lay out scoring input`);
  const candidates = JSON.parse(candidatesText.replace(/^﻿/, ''));
  if (!Array.isArray(candidates) || !candidates.length) throw new Error('the candidates file is not a non-empty array');
  const bad = candidates.filter((q) => q.source !== W5_SOURCE || !W5_SUBJECTS.includes(q.subject));
  if (bad.length) throw new Error(`${bad.length} rows are not wave-5 rows of ${W5_SUBJECTS.join(', ')} (first: ${bad[0].id})`);
  if (new Set(candidates.map((q) => q.id)).size !== candidates.length) throw new Error('duplicate ids in the candidates file');
  const subjects = W5_SUBJECTS.filter((subject) => candidates.some((q) => q.subject === subject));

  // Never lay out from under results that already exist.
  for (const subject of subjects) {
    const verify = path.join(args.out, subject, 'verify');
    const present = fs.existsSync(verify) ? fs.readdirSync(verify).filter((name) => name !== '.gitkeep') : [];
    if (present.length && !args.force) throw new Error(`${verify} already holds ${present.length} result file(s); refusing to rewrite the packs (move the results away, or pass --force)`);
  }

  const manifest = {
    kind: 'authored_w5_scoring_layout', source: W5_SOURCE, candidatesFile: args.candidates, candidatesSha256,
    excludedSubjects: [], instructions: { solver: path.resolve(args.out, 'SOLVER.md'), quality: path.resolve(args.out, 'QUALITY.md'), fit: path.resolve(args.out, 'FIT.md') },
    batches: [], repairsInScoredRows: [],
  };
  fs.mkdirSync(args.out, { recursive: true });
  for (const subject of subjects) {
    const dir = path.join(args.out, subject);
    fs.mkdirSync(path.join(dir, 'verify'), { recursive: true });
    // Old pack files of this subject (a previous layout) go; the verify folder and anything else stay.
    for (const name of fs.readdirSync(dir)) if (name.endsWith('.json') && fs.statSync(path.join(dir, name)).isFile()) fs.rmSync(path.join(dir, name));
    const batches = chunk(candidates.filter((q) => q.subject === subject), Number(args.size));
    batches.forEach((rows, index) => {
      const batch = `${subject}__w5b${index + 1}`;
      const files = {
        text: { name: `${batch}.json`, body: { batch, subject, questions: rows.map(textOf) } },
        blind: { name: `${batch}-blind.json`, body: { batch: `${batch}-blind`, subject, questions: rows.map(blindOf) } },
        aids: { name: `${batch}-fitaids.json`, body: { batch, subject, ...fitAids(subject, rows) } },
      };
      const shas = {};
      for (const [kind, file] of Object.entries(files)) {
        const text = `${JSON.stringify(file.body, null, 1)}\n`;
        fs.writeFileSync(path.join(dir, file.name), text);
        shas[kind] = sha(text);
      }
      // The blind file must carry nothing a solver may not see.
      for (const q of files.blind.body.questions) for (const field of ['correct_key', 'explanation', 'answer', 'difficulty_label', 'chapter', 'unit', 'ncert_ref']) if (field in q) throw new Error(`blind row ${q.id} carries ${field}`);
      manifest.batches.push({ subject, batch, count: rows.length, textPath: path.resolve(dir, files.text.name), blindPath: path.resolve(dir, files.blind.name), fitAidsPath: path.resolve(dir, files.aids.name), verifyDir: path.resolve(dir, 'verify'), sha256: shas, ids: rows.map((q) => q.id) });
    });
  }
  // The rows the independent audit repaired (PUBLISH.md section 1): their scored text is the candidates' text, which is the repaired text.
  const scored = new Map(manifest.batches.flatMap((b) => readJson(b.textPath).questions.map((q) => [q.id, { batch: b.batch, q }])));
  for (const c of candidates.filter((q) => q._expert === 'repaired')) {
    const found = scored.get(c.id);
    if (!found || JSON.stringify(found.q) !== JSON.stringify(textOf(c))) throw new Error(`repaired row ${c.id} is not carried unchanged`);
    manifest.repairsInScoredRows.push({ id: c.id, batch: found.batch, audit: 'repaired', carried: true });
  }
  // Every scored row is a candidate and every candidate is scored once.
  const scoredIds = manifest.batches.flatMap((b) => b.ids);
  if (scoredIds.length !== candidates.length || new Set(scoredIds).size !== candidates.length) throw new Error('the batches do not hold every candidate exactly once');
  fs.writeFileSync(path.join(args.out, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
  const counts = {};
  for (const b of manifest.batches) counts[b.subject] = (counts[b.subject] || 0) + b.count;
  const summary = { out: args.out, candidatesSha256, subjects: counts, batches: manifest.batches.map((b) => `${b.batch}:${b.count}`), repairsInScoredRows: manifest.repairsInScoredRows.length };
  console.log(JSON.stringify(summary, null, 1));
  return { manifest, summary };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
