#!/usr/bin/env node
// Authored wave 4 (claude-authored-2026-10-17-w4; physics, chemistry, mathematics, biology, general_test): turns the audited drafts into the one flat
// candidates list that scripts/question-publish-authored.mjs takes (--candidates). OFFLINE: reads and writes files only. No database, no network, no model.
// Written beside scripts/authored-w3-assemble.mjs, which is left exactly as it was (wave 3 behaves as before).
//
//   node scripts/authored-w4-assemble.mjs [--drafts=tmp/authored-w4/drafts]
//                                         [--out=docs/brain/reports/authored-w4/wave4-candidates-2026-10-17.json]
//                                         [--report=docs/brain/reports/authored-w4/wave4-assembly-2026-10-17.json]
//
// drafts  <subject>/<batch>.json as the author jobs wrote them ({ batch, subject, questions: [...], dropped?: [...] }) and the audit jobs then
//         completed IN PLACE: every row of an audited file carries `_audit` ({ verdict: kept|repaired, repairs: [...], ... }). The audit applied its
//         repairs to the row text itself, so, unlike wave 3, there is no separate repairs list to replay here. `dropped` rows are kept in the file as
//         the record of what the audit refused; they are never read as candidates.
//
// What it does to a draft row: removes `_audit` (the draft validator and the publisher both enforce the exact row shape), adds `_verdict`
// ('claude_audited', scripts/lib/authored-wave.mjs WAVES[4].verdicts: the row was solved blind and checked by a second pass) and, when the audit
// repaired the row, `_reworded: true`. Nothing is guessed: a row whose audit is missing in an otherwise audited file, a verdict that disagrees with its
// repairs, a wrong source or subject, or a duplicate id stops the run. A draft file with NO audited row at all has not been audited yet; it is left
// out and named in the report (`unaudited`), so a rerun after its audit picks it up.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const W4_SOURCE = 'claude-authored-2026-10-17-w4';
export const W4_VERDICT = 'claude_audited';
const DEFAULTS = {
  drafts: 'tmp/authored-w4/drafts',
  out: 'docs/brain/reports/authored-w4/wave4-candidates-2026-10-17.json',
  report: 'docs/brain/reports/authored-w4/wave4-assembly-2026-10-17.json',
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

/** Every `<subject>/<file>.json` under dir, in a fixed order (subject folder, then file name). */
export function loadDrafts(dir) {
  const drafts = [];
  for (const subject of fs.readdirSync(dir).sort()) {
    const folder = path.join(dir, subject);
    if (!fs.statSync(folder).isDirectory()) continue;
    for (const file of fs.readdirSync(folder).filter((name) => name.endsWith('.json')).sort()) {
      const draft = readJson(path.join(folder, file));
      if (!Array.isArray(draft.questions)) throw new Error(`${file}: no questions array`);
      drafts.push({ file: `${subject}/${file}`, batch: draft.batch, subject: draft.subject, questions: draft.questions, dropped: Array.isArray(draft.dropped) ? draft.dropped : [] });
    }
  }
  return drafts;
}

const repairsOf = (row) => (Array.isArray(row._audit?.repairs) ? row._audit.repairs : []);

/** { candidates, summary } from the drafts. Pure: nothing is written. */
export function assemble(drafts) {
  const candidates = [];
  const seen = new Set();
  const unaudited = [];
  const repairs = [];
  const dropped = [];
  const batches = [];
  for (const draft of drafts) {
    const audited = draft.questions.filter((row) => row._audit && typeof row._audit === 'object').length;
    if (audited === 0) { unaudited.push({ file: draft.file, batch: draft.batch, rows: draft.questions.length }); continue; }
    if (audited !== draft.questions.length) throw new Error(`${draft.file}: ${audited} of ${draft.questions.length} rows carry an _audit; a partly audited file is not assembled`);
    const droppedIds = new Set(draft.dropped.map((row) => row.id));
    for (const row of draft.questions) {
      if (row.source !== W4_SOURCE) throw new Error(`${draft.file}: ${row.id} has source ${row.source}`);
      if (row.subject !== draft.subject) throw new Error(`${draft.file}: ${row.id} names subject ${row.subject}, the file is ${draft.subject}`);
      if (seen.has(row.id)) throw new Error(`duplicate id ${row.id}`);
      if (droppedIds.has(row.id)) throw new Error(`${draft.file}: ${row.id} is both a question and in dropped`);
      seen.add(row.id);
      const verdict = row._audit.verdict;
      const fixes = repairsOf(row);
      if (verdict !== 'kept' && verdict !== 'repaired') throw new Error(`${draft.file}: ${row.id} audit verdict is ${verdict}, not kept or repaired`);
      if ((verdict === 'repaired') !== (fixes.length > 0)) throw new Error(`${draft.file}: ${row.id} audit verdict ${verdict} disagrees with its ${fixes.length} repairs`);
      const { _audit, ...text } = row;
      candidates.push({ ...text, _verdict: W4_VERDICT, ...(fixes.length ? { _reworded: true } : {}) });
      if (fixes.length) repairs.push({ id: row.id, batch: draft.batch, repairs: fixes });
    }
    for (const row of draft.dropped) dropped.push({ id: row.id, batch: draft.batch, subject: draft.subject, chapter: row.chapter ?? null, reason: row._audit?.reason ?? row._audit?.why ?? row.reason ?? null });
    batches.push(`${draft.batch}:${draft.questions.length}`);
  }
  const count = (key) => candidates.reduce((by, c) => { by[key(c)] = (by[key(c)] || 0) + 1; return by; }, {});
  return {
    candidates,
    summary: {
      questions: candidates.length,
      bySubject: count((c) => c.subject),
      byVerdict: count((c) => c._verdict),
      repairedRows: repairs.length,
      droppedByAudit: dropped.length,
      batches,
      unaudited,
    },
    repairs,
    dropped,
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const { candidates, summary, repairs, dropped } = assemble(loadDrafts(args.drafts));
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(candidates, null, 1)}\n`);
  fs.mkdirSync(path.dirname(args.report), { recursive: true });
  fs.writeFileSync(args.report, `${JSON.stringify({ kind: 'authored_w4_assembly', source: W4_SOURCE, candidatesFile: args.out, ...summary, repairs, dropped }, null, 1)}\n`);
  console.log(JSON.stringify({ out: args.out, report: args.report, ...summary }, null, 1));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
