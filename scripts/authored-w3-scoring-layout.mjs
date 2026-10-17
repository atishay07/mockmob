#!/usr/bin/env node
// Authored wave 3 (claude-authored-2026-10-17-w3): lays the drafts out for scoring the way wave 2 was scored (tmp/authored-w2/<subject>/).
// OFFLINE: reads the candidates file and the audit, writes files under tmp/authored-w3s. No database, no network, no model.
//
//   node scripts/authored-w3-scoring-layout.mjs [--candidates=docs/brain/reports/authored-w3/wave3-candidates-2026-10-17.json]
//                                              [--audit=docs/brain/reports/authored-w3/wave3-audit-2026-10-17.json]
//                                              [--raw=docs/brain/reports/authored-w3/raw] [--out=tmp/authored-w3s] [--size=20]
//
// Source of the text: the candidates file, which scripts/authored-w3-assemble.mjs builds from the verified drafts WITH the audit's repairs
// applied (a test below re-runs the assembly and refuses to continue if the file differs). Hindi is left out (owner decision: no fluent reviewer).
// Per subject folder <out>/<subject>/ :
//   <subject>__w3b<n>.json          { batch, subject, questions } the wave-2 batch text (every field the judges are given; the `_verdict` and `_reworded` marks are not copied)
//   <subject>__w3b<n>-blind.json    what a blind solver sees: id, subject, type, stem, options, passage_text. No key, explanation, difficulty, unit, chapter, reference
//   <subject>__w3b<n>-fitaids.json  for the fit judges: the blueprint's allowed card and, per question, engine_unit_options, chapter_status, reading_words, read_seconds
//   verify/                         empty; the result files <batch>__s1..s5, j1, j2, h1..h3 go here
// <out>/manifest.json lists the batches (ids in order, sha256 of each file) and every audit repair that reached a scored row.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { allowedCard } from './lib/authored-scores.mjs';
import { assemble, loadVerified } from './authored-w3-assemble.mjs';

const DEFAULTS = {
  candidates: 'docs/brain/reports/authored-w3/wave3-candidates-2026-10-17.json',
  audit: 'docs/brain/reports/authored-w3/wave3-audit-2026-10-17.json',
  raw: 'docs/brain/reports/authored-w3/raw',
  out: 'tmp/authored-w3s',
  size: '20',
};
export const EXCLUDED_SUBJECTS = Object.freeze(['hindi']);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const words = (value) => String(value ?? '').split(/\s+/).filter(Boolean).length;

export function parseArgs(argv) {
  const out = { ...DEFAULTS };
  for (const arg of argv) {
    const m = arg.match(/^--([\w-]+)=(.*)$/);
    if (m && m[1] in out) out[m[1]] = m[2];
  }
  return out;
}

/** What a blind solver sees. */
export const blindOf = (q) => ({ id: q.id, subject: q.subject, type: q.type, stem: q.stem, options: q.options, passage_text: q.passage_text ?? null });
/** What the judges see: the candidate without the pipeline marks. */
export const textOf = (q) => Object.fromEntries(Object.entries(q).filter(([key]) => !key.startsWith('_')));

/** Splits rows into `count` balanced batches in order; rows that share a set_id stay together. */
export function chunk(rows, size) {
  const count = Math.max(1, Math.ceil(rows.length / size));
  const units = [];
  const bySet = new Map();
  for (const row of rows) {
    if (row.set_id) {
      if (!bySet.has(row.set_id)) { bySet.set(row.set_id, []); units.push(bySet.get(row.set_id)); }
      bySet.get(row.set_id).push(row);
    } else units.push([row]);
  }
  const batches = Array.from({ length: count }, () => []);
  let before = 0;
  for (const unit of units) {
    batches[Math.min(count - 1, Math.floor(((before + unit.length / 2) / rows.length) * count))].push(...unit);
    before += unit.length;
  }
  return batches.filter((batch) => batch.length);
}

export function fitAids(subject, rows) {
  const card = allowedCard(subject);
  const chapters = new Set(card.units.flatMap((unit) => unit.chapters));
  const excluded = new Set(card.excluded_chapters);
  const perRow = {};
  for (const q of rows) {
    const readingWords = words(q.stem) + (q.options || []).reduce((n, option) => n + words(option.text), 0) + Math.round(words(q.passage_text) / 5);
    perRow[q.id] = {
      engine_unit_options: card.units.filter((unit) => unit.chapters.includes(q.chapter)).map((unit) => unit.unit),
      chapter_status: excluded.has(q.chapter) ? 'excluded_by_blueprint' : chapters.has(q.chapter) ? 'in_blueprint' : 'not_in_blueprint',
      reading_words: readingWords,
      read_seconds: Math.round(8 + readingWords / 3.3),
    };
  }
  return { allowed: card, rows: perRow };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const candidates = readJson(args.candidates);
  const audit = readJson(args.audit);
  // The candidates file must be exactly what the assembly of the drafts plus the audit's repairs gives (so the repaired text is what is scored).
  const assembled = assemble(loadVerified(args.raw), audit).candidates;
  if (JSON.stringify(assembled) !== JSON.stringify(candidates)) throw new Error('the candidates file is not the assembly of the raw drafts and the audit; refusing to lay out scoring input');
  const kept = candidates.filter((q) => !EXCLUDED_SUBJECTS.includes(q.subject));
  const subjects = [...new Set(kept.map((q) => q.subject))];
  const manifest = { kind: 'authored_w3_scoring_layout', source: 'claude-authored-2026-10-17-w3', candidatesFile: args.candidates, candidatesSha256: sha(fs.readFileSync(args.candidates, 'utf8').replace(/\r\n/g, '\n')), excludedSubjects: EXCLUDED_SUBJECTS, batches: [], repairsInScoredRows: [] };
  fs.rmSync(args.out, { recursive: true, force: true });
  for (const subject of subjects) {
    const dir = path.join(args.out, subject);
    fs.mkdirSync(path.join(dir, 'verify'), { recursive: true });
    const batches = chunk(kept.filter((q) => q.subject === subject), Number(args.size));
    batches.forEach((rows, index) => {
      const batch = `${subject}__w3b${index + 1}`;
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
  // Every repair of the audit that reached a scored row, checked against the written text.
  const scored = new Map(manifest.batches.flatMap((b) => JSON.parse(fs.readFileSync(b.textPath, 'utf8')).questions.map((q) => [q.id, { batch: b.batch, q }])));
  const pre = new Map(loadVerified(args.raw).flatMap((b) => b.questions.map((q) => [q.id, q])));
  for (const repair of audit.repairs || []) {
    const found = scored.get(repair.id);
    if (!found) continue;
    const value = found.q[repair.field];
    const ok = 'find' in repair ? typeof value === 'string' && value.includes(repair.replace) && !value.includes(repair.find) : JSON.stringify(value) === JSON.stringify(repair.set);
    const before = pre.get(repair.id)?.[repair.field];
    const changed = JSON.stringify(before) !== JSON.stringify(value);
    if (!ok || !changed) throw new Error(`repair ${repair.id} ${repair.field} is not carried in ${found.batch}`);
    manifest.repairsInScoredRows.push({ id: repair.id, batch: found.batch, field: repair.field, defect: repair.defect || null, carried: true });
  }
  fs.writeFileSync(path.join(args.out, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
  const counts = {};
  for (const b of manifest.batches) counts[b.subject] = (counts[b.subject] || 0) + b.count;
  console.log(JSON.stringify({ out: args.out, subjects: counts, batches: manifest.batches.map((b) => `${b.batch}:${b.count}`), repairsInScoredRows: manifest.repairsInScoredRows.length }, null, 1));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
