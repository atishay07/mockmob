#!/usr/bin/env node
// Checks one solver, quality-judge or fit-judge result file against the batch text it answers, with the same validators the acceptance code
// uses (scripts/lib/authored-scores.mjs: qualityProblems, fitCheck, allowedCard). OFFLINE: reads two files, writes nothing.
//
//   node scripts/authored-w3-validate-records.mjs --role=s1|s2|s3|s4|s5|j1|j2|h1|h2|h3 --text=<batch text json> --out=<result json>
//
// Prints "OK <n> records" and exits 0, or lists every problem and exits 1. An agent that wrote a result file runs this and fixes the file until it says OK.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { NTA_AGENT_BLOCKING_FLAGS } from '../data/nta_agent_scores.js';
import { FIT_FLAGS, allowedCard, fitCheck, qualityProblems } from './lib/authored-scores.mjs';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const TAG = /^[a-z0-9_]+\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+){1,5}$/;
const slug = (value) => String(value).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const UNIT_ROLES = ['j1', 'j2'];

export function validate({ role, batch, results, warnings = [] }) {
  const problems = [];
  const questions = batch.questions || [];
  if (!Array.isArray(results)) return ['the file is not a JSON array'];
  if (results.length !== questions.length) problems.push(`${results.length} records for ${questions.length} questions`);
  const card = /^h\d$/.test(role) ? allowedCard(batch.subject) : null;
  questions.forEach((q, i) => {
    const r = results[i];
    const at = `#${i + 1} ${q.id.slice(0, 8)}`;
    if (!r || typeof r !== 'object') { problems.push(`${at}: missing record`); return; }
    if (r.id !== q.id) { problems.push(`${at}: id ${r.id} is not the batch's id at this position (records must follow the batch order)`); return; }
    if (/^s[1-5]$/.test(role)) {
      if (!['A', 'B', 'C', 'D'].includes(String(r.answer).toUpperCase())) problems.push(`${at}: answer must be one letter A to D`);
    } else if (UNIT_ROLES.includes(role)) {
      for (const p of qualityProblems(r, q.id)) problems.push(`${at}: ${p}`);
      for (const flag of r.flags || []) if (!NTA_AGENT_BLOCKING_FLAGS.includes(flag)) problems.push(`${at}: flag ${flag} is not in the rubric's list`);
      if (typeof r.objective_tag === 'string') {
        if (!TAG.test(r.objective_tag)) warnings.push(`${at}: objective_tag format (subject.chapter-slug.objective-slug, 2 to 6 words)`);
        else {
          const [subject, chapter] = r.objective_tag.split('.');
          const want = q.subject;
          if (subject !== want) warnings.push(`${at}: objective_tag subject must be ${want}`);
          if (chapter !== slug(q.chapter)) warnings.push(`${at}: objective_tag chapter slug must be ${slug(q.chapter)}`);
        }
      }
      if (typeof r.note === 'string' && r.note.length > 240) problems.push(`${at}: note over 240 characters`);
      if (r.blind_answer && r.key_matches !== (String(r.blind_answer).toUpperCase() === q.correct_key)) problems.push(`${at}: key_matches does not agree with blind_answer and the key`);
      if (r.blind_answer === '?' && r.key_matches !== false) problems.push(`${at}: blind_answer ? needs key_matches false`);
    } else {
      const { value, problems: bad } = fitCheck(r, q.id, card);
      for (const p of bad || []) problems.push(`${at}: ${p}`);
      for (const flag of r.fit_flags || []) if (!FIT_FLAGS.includes(flag)) problems.push(`${at}: fit flag ${flag} is not in the rubric's list`);
      if (value) {
        if (typeof r.note === 'string' && r.note.length > 200) problems.push(`${at}: note over 200 characters`);
        const dims = r.dims && typeof r.dims === 'object' ? Object.values(r.dims) : null;
        if (!dims || dims.length !== 5 || dims.some((d) => !Number.isInteger(d) || d < 0 || d > 3)) problems.push(`${at}: dims needs the five 0 to 3 integers`);
        if (!Number.isInteger(r.est_seconds)) problems.push(`${at}: est_seconds must be an integer`);
        if (!Number.isInteger(r.reasoning_steps) || r.reasoning_steps < 1 || r.reasoning_steps > 8) problems.push(`${at}: reasoning_steps 1 to 8`);
        if (r.fit_flags.length === 0 && r.dims && (r.dims.syllabus_objective === 0 || r.dims.format_authenticity === 0 || r.dims.level_calibration === 0 || r.dims.time_suitability <= 1)) problems.push(`${at}: a 0 dimension (or time 1 or 0) comes with its blocking flag`);
        if (r.fit_score >= 10 && !r.ten_route) problems.push(`${at}: a 10 needs a ten_route`);
      }
    }
  });
  return problems;
}

export function main(argv = process.argv.slice(2)) {
  const arg = (name) => argv.map((a) => a.match(new RegExp(`^--${name}=(.*)$`))).find(Boolean)?.[1];
  const role = arg('role');
  if (!/^(s[1-5]|j[12]|h[123])$/.test(role || '') || !arg('text') || !arg('out')) { console.error('usage: --role=s1..s5|j1|j2|h1..h3 --text=<batch text> --out=<result file>'); process.exit(2); }
  let results;
  try { results = readJson(arg('out')); } catch (error) { console.log(`PROBLEM: cannot read ${arg('out')} as JSON (${error.message})`); process.exit(1); }
  const warnings = [];
  const problems = validate({ role, batch: readJson(arg('text')), results, warnings });
  if (warnings.length) console.log(`${warnings.length} warning(s) (not blocking, fix if you can):\n${warnings.slice(0, 40).join('\n')}`);
  if (problems.length) { console.log(`${problems.length} problem(s):\n${problems.slice(0, 60).join('\n')}`); process.exit(1); }
  console.log(`OK ${results.length} records`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
