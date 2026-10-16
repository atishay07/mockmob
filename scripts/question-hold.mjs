#!/usr/bin/env node
// Withholds questions from practice and NTA mode until they are rechecked, the same hold that
// Mistake Repair uses for a disputed key (status pending, verification disputed, exploration
// pending_review). Nothing is deleted. Every applied change is saved first to a restore file, and
// --mode=restore puts the saved states back.
//
//   node --use-system-ca scripts/question-hold.mjs --mode=dry-run --list=<ids.json> [--list=...] --reason=<text>
//   node --use-system-ca scripts/question-hold.mjs --mode=apply   --list=<ids.json> ... --reason=<text>
//   node --use-system-ca scripts/question-hold.mjs --mode=restore --restore=<restore.json>
//
// A list file is a JSON array of ids, or of objects with an id field.
//
// --mode=restore puts questions back in front of students, so it then rebuilds the nta_question_index rows of the subjects
// it touched (data/nta_index.js): an earlier rebuild drops a held question's row, and the freshness check cannot see a
// question that was only hidden and shown again. It needs CUET_EVIDENCE_SIGNING_KEY in .env.local or the environment, skips
// quietly without it or without the table, never fails the restore, and --no-index-rebuild switches it off. Holding needs
// no rebuild: the pool reads only live questions.

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { rebuildNtaIndexForSubjects } from '../data/nta_index.js';

const HOLD = Object.freeze({ status: 'pending', verification_state: 'disputed', exploration_state: 'pending_review' });
const FIELDS = 'id, subject, chapter, status, verification_state, exploration_state, is_deleted';
const REPORT_DIR = path.resolve('docs/brain/reports/question-holds');

function loadEnv(file = '.env.local') {
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }),
  );
}

function parseArgs(argv) {
  const out = { mode: 'dry-run', lists: [], reason: '', restore: null };
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([\w-]+)=(.*)$/);
    if (!m) continue;
    if (m[1] === 'mode') out.mode = m[2];
    if (m[1] === 'list') out.lists.push(m[2]);
    if (m[1] === 'reason') out.reason = m[2];
    if (m[1] === 'restore') out.restore = m[2];
  }
  return out;
}

const isVisible = (row) => !row.is_deleted && (row.status === 'live' || (row.verification_state === 'verified' && row.exploration_state === 'active'));
const chunks = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

async function fetchRows(sb, ids) {
  const rows = [];
  for (const part of chunks(ids, 100)) {
    const { data, error } = await sb.from('questions').select(FIELDS).in('id', part);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

function readIds(files) {
  const ids = new Set();
  for (const file of files) {
    const list = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const item of list) ids.add(typeof item === 'string' ? item : item.id);
  }
  return [...ids].filter(Boolean);
}

function summarise(rows) {
  const bySubject = {};
  for (const row of rows) bySubject[row.subject] = (bySubject[row.subject] || 0) + 1;
  return bySubject;
}

async function main() {
  const args = parseArgs(process.argv);
  const env = loadEnv();
  const sb = createClient(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  if (args.mode === 'restore') {
    const saved = JSON.parse(fs.readFileSync(args.restore, 'utf8'));
    let restored = 0;
    const touched = new Set();
    for (const entry of saved.rows) {
      const { error } = await sb.from('questions')
        .update({ status: entry.status, verification_state: entry.verification_state, exploration_state: entry.exploration_state, updated_at: new Date().toISOString() })
        .eq('id', entry.id).match(HOLD);
      if (error) throw error;
      restored += 1;
      if (entry.subject) touched.add(entry.subject);
    }
    console.log(`restored ${restored} of ${saved.rows.length}`);
    if (touched.size && !process.argv.includes('--no-index-rebuild')) {
      const ntaIndex = await rebuildNtaIndexForSubjects(sb, [...touched], { secret: env.CUET_EVIDENCE_SIGNING_KEY || process.env.CUET_EVIDENCE_SIGNING_KEY || '' });
      console.log(JSON.stringify({ ntaIndex }, null, 1));
    }
    return;
  }

  if (!args.lists.length || !args.reason) throw new Error('need --list and --reason');
  const ids = readIds(args.lists);
  const rows = await fetchRows(sb, ids);
  const found = new Set(rows.map((r) => r.id));
  const missing = ids.filter((id) => !found.has(id));
  const toHold = rows.filter(isVisible);
  const alreadyHidden = rows.filter((r) => !isVisible(r));
  const report = {
    kind: 'question_hold', mode: args.mode, reason: args.reason, at: new Date().toISOString(),
    requested: ids.length, found: rows.length, missing, alreadyHidden: alreadyHidden.length,
    toHold: toHold.length, toHoldBySubject: summarise(toHold),
  };
  console.log(JSON.stringify(report, null, 1));

  if (args.mode !== 'apply') {
    fs.writeFileSync(path.join(REPORT_DIR, `dry-run-${stamp()}.json`), JSON.stringify({ ...report, ids: toHold.map((r) => r.id) }, null, 1));
    return;
  }

  // Save the restore file before touching anything.
  const restoreFile = path.join(REPORT_DIR, `restore-${stamp()}.json`);
  fs.writeFileSync(restoreFile, JSON.stringify({ ...report, rows: toHold.map(({ id, subject, chapter, status, verification_state, exploration_state }) => ({ id, subject, chapter, status, verification_state, exploration_state })) }, null, 1));
  let held = 0;
  for (const part of chunks(toHold.map((r) => r.id), 100)) {
    const { data, error } = await sb.from('questions').update({ ...HOLD, updated_at: new Date().toISOString() })
      .in('id', part).eq('is_deleted', false).neq('status', 'rejected').select('id');
    if (error) throw error;
    held += (data || []).length;
  }
  const after = await fetchRows(sb, toHold.map((r) => r.id));
  const stillVisible = after.filter(isVisible).map((r) => r.id);
  console.log(JSON.stringify({ held, stillVisible, restoreFile }, null, 1));
}

main().catch((error) => { console.error(error?.message || error); process.exit(1); });
