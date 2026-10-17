#!/usr/bin/env node
// Authored wave 4: the NTA engine's own eligibility check on the assembled candidates BEFORE any scoring exists. OFFLINE: reads one file, writes one report.
// No database, no network, no model, nothing in data/ is written.
//
//   node scripts/authored-w4-engine-precheck.mjs [--candidates=docs/brain/reports/authored-w4/wave4-candidates-2026-10-17.json]
//                                                [--out=docs/brain/reports/authored-w4/wave4-engine-precheck-2026-10-17.json]
//
// Each candidate is mapped to the exact row the publisher would write (scripts/lib/authored-wave.mjs planPublication, so the wave-4 validation runs first), then
// data/nta_engine.js ntaEligibility runs on it with EMPTY agent and fit tables. A row that is not scored yet is always refused for the score and fit gates ("no_score",
// "fit_*"); those reasons are expected and are left out. What is listed are the content gates only, the ones ntaGateOf calls 'veto': answer guard (option text, near
// duplicate options), wording and corrupted text, structural checks per question type (sequence, statement, match), listed-order key, orphan passage wording.
// A row with a veto reason would be refused for good whatever the judges score, so it is reworded or dropped before scoring (wave 2 found such rows only after scoring).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ntaEligibility, ntaGateOf } from '../data/nta_engine.js';
import { stemLabels } from '../data/nta_item_checks.js';
import { planPublication } from './lib/authored-wave.mjs';
import { explainRefusal } from './authored-w2-accept.mjs';

const DEFAULTS = {
  candidates: 'docs/brain/reports/authored-w4/wave4-candidates-2026-10-17.json',
  out: 'docs/brain/reports/authored-w4/wave4-engine-precheck-2026-10-17.json',
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

/** { problems, refused, bySubject, reasons } for a candidate list. Pure. */
export function precheck(candidates) {
  const plan = planPublication(candidates);
  if (plan.problems.length) return { problems: plan.problems, refused: [], bySubject: {}, reasons: {}, planned: 0 };
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const refused = [];
  const bySubject = {};
  const reasons = {};
  for (const row of plan.rows) {
    const candidate = byId.get(row.id);
    const subject = candidate.subject;
    const verdict = ntaEligibility({ ...row, evidence: null }, { subject, agentScores: {}, fitScores: {} });
    const veto = verdict.reasons.filter((reason) => ntaGateOf(reason) === 'veto');
    const s = (bySubject[subject] ||= { planned: 0, clean: 0, refused: 0 });
    s.planned += 1;
    if (!veto.length) { s.clean += 1; continue; }
    s.refused += 1;
    for (const reason of veto) reasons[reason] = (reasons[reason] || 0) + 1;
    refused.push({ id: row.id, subject, chapter: candidate.chapter, authored_type: candidate.type, engine_type: verdict.type, reasons: veto, cause: explainRefusal(candidate, veto, stemLabels), stem: String(candidate.stem).slice(0, 160) });
  }
  return { problems: [], refused, bySubject, reasons, planned: plan.rows.length };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const candidates = readJson(args.candidates);
  const result = precheck(candidates);
  const report = { kind: 'authored_w4_engine_precheck', source: 'claude-authored-2026-10-17-w4', candidatesFile: args.candidates, method: 'ntaEligibility on the row planPublication writes, empty agent and fit tables; score and fit reasons are not listed, only the veto gate (content, wording, structure, answer guard).', ...result, engineRefused: result.refused.length };
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 1)}\n`);
  console.log(JSON.stringify({ out: args.out, planned: result.planned, problems: result.problems, engineRefused: result.refused.length, bySubject: result.bySubject, reasons: result.reasons }, null, 1));
  if (result.problems.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
