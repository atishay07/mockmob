// The key-quality loop (spec tmp/mistake-lab-v4/SPEC.md "Slice 4"): finds every question of the cohort snapshot where a
// wrong option was picked by 20 or more other students and by more of them than the key, and (only with --apply) sends
// those questions to the existing re-check queue (src/lib/server/keyQuality.js: the question is held until re-checked).
//   node scripts/cohort/key-quality-loop.mjs                 dry run: prints the list and writes nothing
//   node scripts/cohort/key-quality-loop.mjs --json          the same, as JSON
//   node scripts/cohort/key-quality-loop.mjs --apply         holds each flagged live question (needs SUPABASE_URL and
//                                                            SUPABASE_SERVICE_ROLE_KEY for the project to change)
// The snapshot holds counts and hashes only. Run the dry run first and read the list: a popular wrong option is
// sometimes just a hard question, and a re-check removes the question from practice until it is cleared. The nightly
// cohort table (slice 5) replaces the snapshot; the loop then reads that table instead.
import { readFileSync } from 'node:fs';
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
  const tally = { held: 0, skipped: 0 };
  for (const f of flags) {
    const r = await recheckFlaggedKey(db, { qid: f.qid });
    tally[r.held ? 'held' : 'skipped'] += 1;
    console.log(`${f.qid}: ${r.held ? 'held for re-check' : `left as it is (${r.reason})`}`);
  }
  console.log(`Held ${tally.held}, left ${tally.skipped}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { console.error(e?.message || e); process.exitCode = 1; });
