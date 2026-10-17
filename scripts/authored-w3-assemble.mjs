#!/usr/bin/env node
// Authored wave 3 (claude-authored-2026-10-17-w3; general_test, physics, chemistry, hindi): turns the per-batch verified drafts into the one flat
// candidates list that scripts/question-publish-authored.mjs takes (--candidates). OFFLINE: reads and writes files only. No database, no network, no model.
//
//   node scripts/authored-w3-assemble.mjs [--raw=docs/brain/reports/authored-w3/raw] [--audit=docs/brain/reports/authored-w3/wave3-audit-2026-10-17.json]
//                                         [--out=docs/brain/reports/authored-w3/wave3-candidates-2026-10-17.json]
//
// raw     <subject>/<batch>.verified.json as the drafting run left them ({ batch, subject, questions: [...] }), copied here unchanged. The
//         *.rejected.json files stay beside them as the record of what the blind Haiku pass refused; they are never read here.
// audit   the second checker's file (wave3-audit-2026-10-17.json): the ids it solved itself and the text repairs it made.
//
// What it adds to a draft: `_verdict` (haiku_blind_verified for every row, opus_audited for the ids the audit solved itself; scripts/lib/authored-wave.mjs
// WAVES[3].verdicts) and, for a repaired row, `_reworded: true`. A repair is { id, field, expect, set } (the field must hold `expect`; text or the options list) or
// { id, field, find, replace } (`find` must occur exactly once). A repair that does not match stops the run: nothing is guessed.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const W3_SOURCE = 'claude-authored-2026-10-17-w3';
const DEFAULTS = {
  raw: 'docs/brain/reports/authored-w3/raw',
  audit: 'docs/brain/reports/authored-w3/wave3-audit-2026-10-17.json',
  out: 'docs/brain/reports/authored-w3/wave3-candidates-2026-10-17.json',
};

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));

export function parseArgs(argv) {
  const out = { ...DEFAULTS };
  for (const arg of argv) {
    const m = arg.match(/^--([\w-]+)=(.*)$/);
    if (m && m[1] in out) out[m[1]] = m[2];
  }
  return out;
}

/** Every `<subject>/<batch>.verified.json` under dir, in a fixed order (subject folder, then batch name). */
export function loadVerified(dir) {
  const batches = [];
  for (const subject of fs.readdirSync(dir).sort()) {
    const folder = path.join(dir, subject);
    if (!fs.statSync(folder).isDirectory()) continue;
    for (const file of fs.readdirSync(folder).filter((name) => name.endsWith('.verified.json')).sort()) {
      const draft = readJson(path.join(folder, file));
      if (!Array.isArray(draft.questions)) throw new Error(`${file}: no questions array`);
      batches.push({ batch: draft.batch, subject: draft.subject, questions: draft.questions });
    }
  }
  return batches;
}

/** Applies the audit's repairs to a copy of the candidates. Returns { candidates, applied }. */
export function applyRepairs(candidates, repairs) {
  const byId = new Map(candidates.map((c) => [c.id, { ...c }]));
  const touched = new Set();
  const applied = [];
  for (const repair of repairs) {
    const row = byId.get(repair.id);
    if (!row) throw new Error(`repair names an id that is not a candidate: ${repair.id}`);
    const before = row[repair.field];
    if ('find' in repair) {
      if (typeof before !== 'string') throw new Error(`repair ${repair.id}: field ${repair.field} is not text`);
      const parts = before.split(repair.find);
      if (parts.length !== 2) throw new Error(`repair ${repair.id}: "${repair.find}" occurs ${parts.length - 1} times in ${repair.field}, not once`);
      row[repair.field] = parts.join(repair.replace);
    } else {
      if (JSON.stringify(before) !== JSON.stringify(repair.expect)) throw new Error(`repair ${repair.id}: ${repair.field} is not what the audit saw`);
      row[repair.field] = repair.set;
    }
    touched.add(repair.id);
    applied.push({ id: repair.id, field: repair.field, defect: repair.defect || null });
  }
  return { candidates: candidates.map((c) => (touched.has(c.id) ? { ...byId.get(c.id), _reworded: true } : c)), applied };
}

/** { candidates, summary } from the verified batches and the audit. Pure: nothing is written. */
export function assemble(batches, audit) {
  const flat = [];
  const seen = new Set();
  for (const batch of batches) {
    for (const question of batch.questions) {
      if (question.source !== W3_SOURCE) throw new Error(`${batch.batch}: ${question.id} has source ${question.source}`);
      if (question.subject !== batch.subject) throw new Error(`${batch.batch}: ${question.id} names subject ${question.subject}, the batch is ${batch.subject}`);
      if (seen.has(question.id)) throw new Error(`duplicate id ${question.id}`);
      seen.add(question.id);
      flat.push(question);
    }
  }
  const audited = new Set(audit.audited_ids || []);
  for (const id of audited) if (!seen.has(id)) throw new Error(`the audit names an id that is not in the drafts: ${id}`);
  const marked = flat.map((q) => ({ ...q, _verdict: audited.has(q.id) ? 'opus_audited' : 'haiku_blind_verified' }));
  const { candidates, applied } = applyRepairs(marked, audit.repairs || []);
  const count = (key) => candidates.reduce((by, c) => { by[key(c)] = (by[key(c)] || 0) + 1; return by; }, {});
  return {
    candidates,
    summary: {
      questions: candidates.length,
      bySubject: count((c) => c.subject),
      byVerdict: count((c) => c._verdict),
      repairedRows: new Set(applied.map((a) => a.id)).size,
      repairsApplied: applied.length,
      batches: batches.map((b) => `${b.batch}:${b.questions.length}`),
    },
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const { candidates, summary } = assemble(loadVerified(args.raw), readJson(args.audit));
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(candidates, null, 1)}\n`);
  console.log(JSON.stringify({ out: args.out, ...summary }, null, 1));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
