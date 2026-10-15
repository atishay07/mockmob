// The key-quality loop (spec tmp/mistake-lab-v4/SPEC.md "Slice 4"): finds every question of the cohort snapshot where a
// wrong option was picked by 20 or more other students and by more of them than the key, and (only with --apply) sends
// those questions to the existing re-check queue (src/lib/server/keyQuality.js: the question is held until re-checked).
//   node scripts/cohort/key-quality-loop.mjs                 dry run: prints the list and writes nothing
//   node scripts/cohort/key-quality-loop.mjs --json          the same, as JSON
//   node scripts/cohort/key-quality-loop.mjs --apply         holds each flagged live question (needs SUPABASE_URL and
//                                                            SUPABASE_SERVICE_ROLE_KEY for the project to change); it first
//                                                            saves a restore file that scripts/question-hold.mjs can restore
// The snapshot holds counts and hashes only. Run the dry run first and read the list: a popular wrong option is
// sometimes just a hard question, and a re-check removes the question from practice until it is cleared. The nightly
// cohort table (slice 5) replaces the snapshot; the loop then reads that table instead.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keyQualityFlags, TRAP_RULES } from '../../data/trap_atlas.js';
import { recheckFlaggedKey } from '../../src/lib/server/keyQuality.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SNAPSHOT = join(ROOT, 'data', 'cohort', 'question_picks.v1.json');

export function flagsFromFile(path = SNAPSHOT) {
  const snapshot = JSON.parse(readFileSync(path, 'utf8'));
  return { snapshot, flags: keyQualityFlags(snapshot) };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const { snapshot, flags } = flagsFromFile();
  if (args.has('--json')) {
    console.log(JSON.stringify({ since: snapshot.since, until: snapshot.until, rule: TRAP_RULES.keyLoopMin, flags }, null, 2));
  } else {
    console.log(`Snapshot ${snapshot.since} to ${snapshot.until}: ${Object.keys(snapshot.questions).length} questions, ${flags.length} flagged (a wrong option picked by ${TRAP_RULES.keyLoopMin} or more students and by more than the key).`);
    for (const f of flags) console.log(`${f.qid}  n=${f.n}  top wrong option ${f.topPicks} picks (${f.topHash}), key ${f.keyPicks} picks`);
  }
  if (!args.has('--apply')) { console.log('Dry run: nothing was written. Add --apply to hold these questions.'); return; }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('--apply needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the project to change');
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(url, key, { auth: { persistSession: false } });
  // Save every live flagged question's current state first, in the file format scripts/question-hold.mjs --mode=restore reads,
  // so one command puts them back if the owner decides a hold was wrong. Nothing is held before the file is written.
  const ids = flags.map((f) => f.qid);
  const live = [];
  for (let i = 0; i < ids.length; i += 100) {
    const read = await db.from('questions').select('id,subject,chapter,status,verification_state,exploration_state').in('id', ids.slice(i, i + 100));
    if (read.error) throw read.error;
    live.push(...(read.data || []).filter((r) => r.status === 'live'));
  }
  const dir = join(ROOT, 'docs', 'brain', 'reports', 'question-holds');
  mkdirSync(dir, { recursive: true });
  const restoreFile = join(dir, `restore-${new Date().toISOString().replace(/[:.]/g, '-')}-key-quality.json`);
  writeFileSync(restoreFile, `${JSON.stringify({ kind: 'question_hold', mode: 'apply', reason: 'key-quality loop', at: new Date().toISOString(), requested: ids.length, toHold: live.length, rows: live }, null, 1)}
`);
  console.log(`Restore file: ${restoreFile} (node --use-system-ca scripts/question-hold.mjs --mode=restore --restore=<that file> puts them back).`);
  const tally = { held: 0, skipped: 0 };
  for (const f of flags) {
    const r = await recheckFlaggedKey(db, { qid: f.qid });
    tally[r.held ? 'held' : 'skipped'] += 1;
    console.log(`${f.qid}: ${r.held ? 'held for re-check' : `left as it is (${r.reason})`}`);
  }
  console.log(`Held ${tally.held}, left ${tally.skipped}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { console.error(e?.message || e); process.exitCode = 1; });
