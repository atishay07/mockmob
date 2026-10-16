#!/usr/bin/env node
// Puts repaired questions back into practice: writes the repaired stem, options, key and
// explanation, and restores the visibility state saved by question-hold.mjs. Only rows still in
// the hold are touched. The previous content of every row is saved first to a backup file.
//
//   node --use-system-ca scripts/question-republish.mjs --mode=dry-run --repaired=<publish.json> --restore=<restore.json>
//   node --use-system-ca scripts/question-republish.mjs --mode=apply   --repaired=<publish.json> --restore=<restore.json>
//
// After an apply it rebuilds the nta_question_index rows of the subjects it touched (data/nta_index.js): a held question
// leaves the index at the next rebuild, and its repaired text has a new content hash, so without this it would stay out of
// NTA papers. It needs CUET_EVIDENCE_SIGNING_KEY in .env.local or the environment and skips quietly without it or without
// the table; --no-index-rebuild switches it off. It never fails the republish.

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { rebuildNtaIndexForSubjects } from '../data/nta_index.js';

const HOLD = Object.freeze({ status: 'pending', verification_state: 'disputed', exploration_state: 'pending_review' });
const REPORT_DIR = path.resolve('docs/brain/reports/question-holds');

function loadEnv(file = '.env.local') {
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }),
  );
}

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.match(/^--([\w-]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const env = loadEnv();
const sb = createClient(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const repaired = JSON.parse(fs.readFileSync(args.repaired, 'utf8'));
const saved = new Map(JSON.parse(fs.readFileSync(args.restore, 'utf8')).rows.map((r) => [r.id, r]));

const { data: current, error } = await sb.from('questions').select('id, subject, body, options, correct_answer, explanation, status, verification_state, exploration_state').in('id', repaired.map((r) => r.id));
if (error) throw error;
const byId = new Map(current.map((r) => [r.id, r]));
const plan = repaired.filter((r) => {
  const row = byId.get(r.id);
  return row && saved.has(r.id) && Object.entries(HOLD).every(([k, v]) => row[k] === v);
});
console.log(JSON.stringify({ mode: args.mode, repaired: repaired.length, eligible: plan.length }, null, 1));
if (args.mode !== 'apply') process.exit(0);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(path.join(REPORT_DIR, `republish-backup-${stamp}.json`), JSON.stringify(plan.map((r) => byId.get(r.id)), null, 1));
let done = 0;
const touched = new Set();
for (const r of plan) {
  const before = saved.get(r.id);
  const options = r.options.map((o) => ({ key: o.key, text: o.text }));
  const { data, error: e } = await sb.from('questions').update({
    body: r.stem, options, correct_answer: r.correct_key, explanation: r.explanation,
    status: before.status, verification_state: before.verification_state, exploration_state: before.exploration_state,
    updated_at: new Date().toISOString(),
  }).eq('id', r.id).match(HOLD).select('id');
  if (e) throw e;
  done += (data || []).length;
  if ((data || []).length && byId.get(r.id)?.subject) touched.add(byId.get(r.id).subject);
}
const ntaIndex = process.argv.includes('--no-index-rebuild') || !touched.size
  ? { status: 'skipped', reason: touched.size ? 'disabled' : 'nothing_republished', subjects: [] }
  : await rebuildNtaIndexForSubjects(sb, [...touched], { secret: env.CUET_EVIDENCE_SIGNING_KEY || process.env.CUET_EVIDENCE_SIGNING_KEY || '' });
console.log(JSON.stringify({ republished: done, ntaIndex }, null, 1));
