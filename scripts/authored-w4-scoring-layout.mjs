#!/usr/bin/env node
// Authored wave 4 (claude-authored-2026-10-17-w4): lays the audited candidates out for scoring the way wave 3 was scored (tmp/authored-w3s/<subject>/).
// OFFLINE: reads the candidates file and the drafts, writes files under tmp/authored-w4s. No database, no network, no model.
// Written beside scripts/authored-w3-scoring-layout.mjs, which is left exactly as it was; the helpers that do not depend on the wave (chunk, blindOf,
// textOf, fitAids) are imported from it.
//
//   node scripts/authored-w4-scoring-layout.mjs [--candidates=docs/brain/reports/authored-w4/wave4-candidates-2026-10-17.json]
//                                              [--drafts=tmp/authored-w4/drafts] [--out=tmp/authored-w4s] [--size=20]
//
// Source of the text: the candidates file, which scripts/authored-w4-assemble.mjs builds from the audited drafts (the audit's repairs are already in the draft
// text). The layout re-runs that assembly and refuses to continue when the file differs, so the scored text is the audited text.
// Per subject folder <out>/<subject>/ :
//   <subject>__w4b<n>.json          { batch, subject, questions } every field the judges are given (the `_verdict` and `_reworded` marks are not copied)
//   <subject>__w4b<n>-blind.json    what a blind solver sees: id, subject, type, stem, options, passage_text. No key, explanation, difficulty, unit, chapter, reference
//   <subject>__w4b<n>-fitaids.json  for the fit judges: the blueprint's allowed card and, per question, engine_unit_options, chapter_status, reading_words, read_seconds
//   verify/                         empty; the result files <batch>__s1..s5, j1, j2, h1..h3 go here
// Rows of one case set (same set_id) always stay in one batch. <out>/manifest.json lists the batches (ids in order, sha256 of each file), the audit repairs that
// reached a scored row, and the draft files left out because they are not audited yet.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { W4_SOURCE, assemble, loadDrafts } from './authored-w4-assemble.mjs';
import { blindOf, chunk, fitAids, textOf } from './authored-w3-scoring-layout.mjs';

const DEFAULTS = {
  candidates: 'docs/brain/reports/authored-w4/wave4-candidates-2026-10-17.json',
  drafts: 'tmp/authored-w4/drafts',
  out: 'tmp/authored-w4s',
  size: '20',
};
export const EXCLUDED_SUBJECTS = Object.freeze(['hindi']);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');

export function parseArgs(argv) {
  const out = { ...DEFAULTS };
  for (const arg of argv) {
    const m = arg.match(/^--([\w-]+)=(.*)$/);
    if (m && m[1] in out) out[m[1]] = m[2];
  }
  return out;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const candidates = readJson(args.candidates);
  // The candidates file must be exactly what the assembly of the audited drafts gives (so the audited text is what is scored).
  const assembled = assemble(loadDrafts(args.drafts));
  if (JSON.stringify(assembled.candidates) !== JSON.stringify(candidates)) throw new Error('the candidates file is not the assembly of the audited drafts; refusing to lay out scoring input (rerun scripts/authored-w4-assemble.mjs)');
  const kept = candidates.filter((q) => !EXCLUDED_SUBJECTS.includes(q.subject));
  const subjects = [...new Set(kept.map((q) => q.subject))];
  const manifest = {
    kind: 'authored_w4_scoring_layout', source: W4_SOURCE, candidatesFile: args.candidates,
    candidatesSha256: sha(fs.readFileSync(args.candidates, 'utf8').replace(/\r\n/g, '\n')),
    excludedSubjects: EXCLUDED_SUBJECTS, unauditedDraftsLeftOut: assembled.summary.unaudited, batches: [], repairsInScoredRows: [],
  };
  fs.rmSync(args.out, { recursive: true, force: true });
  for (const subject of subjects) {
    const dir = path.join(args.out, subject);
    fs.mkdirSync(path.join(dir, 'verify'), { recursive: true });
    const batches = chunk(kept.filter((q) => q.subject === subject), Number(args.size));
    batches.forEach((rows, index) => {
      const batch = `${subject}__w4b${index + 1}`;
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
      manifest.batches.push({ subject, batch, count: rows.length, textPath: path.resolve(dir, files.text.name), blindPath: path.resolve(dir, files.blind.name), fitAidsPath: path.resolve(dir, files.aids.name), verifyDir: path.resolve(dir, 'verify'), sha256: shas, ids: rows.map((q) => q.id) });
    });
  }
  // Every audited repair that reached a scored row: the text on disk is the candidates' text (which is the audited draft text).
  const scored = new Map(manifest.batches.flatMap((b) => JSON.parse(fs.readFileSync(b.textPath, 'utf8')).questions.map((q) => [q.id, { batch: b.batch, q }])));
  const byId = new Map(candidates.map((q) => [q.id, q]));
  for (const repair of assembled.repairs) {
    const found = scored.get(repair.id);
    if (!found) continue;
    if (JSON.stringify(found.q) !== JSON.stringify(textOf(byId.get(repair.id)))) throw new Error(`repaired row ${repair.id} is not carried unchanged in ${found.batch}`);
    manifest.repairsInScoredRows.push({ id: repair.id, batch: found.batch, repairs: repair.repairs, carried: true });
  }
  // Every scored row is a candidate and every candidate is scored once.
  const scoredIds = manifest.batches.flatMap((b) => b.ids);
  if (scoredIds.length !== kept.length || new Set(scoredIds).size !== kept.length) throw new Error('the batches do not hold every candidate exactly once');
  fs.writeFileSync(path.join(args.out, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
  const counts = {};
  for (const b of manifest.batches) counts[b.subject] = (counts[b.subject] || 0) + b.count;
  console.log(JSON.stringify({ out: args.out, subjects: counts, batches: manifest.batches.map((b) => `${b.batch}:${b.count}`), repairsInScoredRows: manifest.repairsInScoredRows.length, unauditedDraftsLeftOut: manifest.unauditedDraftsLeftOut }, null, 1));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
