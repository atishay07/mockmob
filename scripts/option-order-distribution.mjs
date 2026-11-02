// Served-key distribution per subject, before and after the stable option order (R5 Packet A, LK44).
// OFFLINE and READ-ONLY: reads a question export on disk (the shape scripts/nta-fixture-export.mjs writes: one
// <subject>.json array of full rows per subject), never the database, never a model.
//
//   node scripts/option-order-distribution.mjs <exportDir> [--all]
//
// For every live, undeleted, verified question (--all: every live one) it prints the key letter as stored ("before")
// and the key letter each surface serves now ("after"). The non-NTA surfaces (Learn, Explore, Saved, practice and
// recovery papers, Mob papers and games, Revise, Rival) all serve data/option_order.js servedRow, so one "after"
// column stands for all of them; the script checks that each surface's own serving function agrees with it.
// NTA papers keep their own per-session shuffle and are not counted here.
import fs from 'node:fs';
import path from 'node:path';
import { servedRow, servedOut, keyIndexOf, outOrder } from '../data/option_order.js';
import { feedServed } from '../data/explore_served.js';
import { learnServed } from '../src/lib/server/learn.js';
import { reviseItem } from '../src/lib/server/revise.js';
import { publicQuestion } from '../src/lib/mob/games.mjs';
import { offeredHashes, orderFromHashes } from '../data/repair_check.js';

const dir = process.argv[2];
const all = process.argv.includes('--all');
if (!dir || !fs.existsSync(dir)) {
  console.error('usage: node scripts/option-order-distribution.mjs <exportDir> [--all]');
  process.exit(2);
}
const LETTERS = 'ABCDE';
const pct = (n, total) => (total ? `${Math.round((100 * n) / total)}%` : '-');
const verified = (row) => row.verification_state === 'verified' || row.evidence?.record?.state === 'published';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !['manifest.json', 'shared.json'].includes(f)).sort();

const totals = { before: [0, 0, 0, 0, 0], after: [0, 0, 0, 0, 0], kept: 0, rows: 0, unresolved: 0, disagree: 0 };
const reasons = {};
console.log(`subject              rows   before A/B/C/D            after A/B/C/D             kept   kept%`);
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const rows = (Array.isArray(data) ? data : data.rows || []).filter((r) => r && r.status === 'live' && !r.is_deleted && (all || verified(r)));
  const before = [0, 0, 0, 0, 0];
  const after = [0, 0, 0, 0, 0];
  let kept = 0;
  for (const row of rows) {
    const key = keyIndexOf(row);
    if (key < 0) { totals.unresolved += 1; continue; }
    before[key] += 1;
    const served = servedRow(row);
    after[served.row.correct_index] += 1;
    if (!served.shuffled) { kept += 1; for (const r of served.reasons) reasons[r] = (reasons[r] || 0) + 1; }
    // Each surface's own serving function must serve the same order and key. Practice papers, Mob papers and the Mob race serve
    // questionOut-shaped questions (data/db.js servedQuestionOut = servedOut(questionOut(row))); a questionOut stand-in is used
    // here because data/db.js needs the app's Supabase client.
    const out = { id: row.id, question: row.question ?? row.body, body: row.body, options: row.options, correctIndex: key, correctAnswer: row.correct_answer, explanation: row.explanation };
    const letter = LETTERS[served.row.correct_index];
    const texts = (list) => JSON.stringify((list || []).map((o) => (typeof o === 'string' ? o : o?.text)));
    const same = (order) => JSON.stringify(order) === JSON.stringify(served.order);
    const checks = [
      servedOut(out).correctIndex === served.row.correct_index && same(outOrder(out)),
      feedServed(row).correct_answer === letter && texts(feedServed(row).options) === texts(served.row.options),
      learnServed(row).key === letter && same(learnServed(row).order),
      texts(reviseItem(row, { box: 1 }).options) === texts(served.row.options),
      texts(publicQuestion(servedOut(out), 0).options) === texts(served.row.options),
      // A repair check or a Mobi thread check is offered in the order its hashes name (absent: options not distinct, never offered).
      (() => { const order = orderFromHashes(row, offeredHashes(row)); return !order || same(order); })(),
    ];
    if (checks.some((ok) => !ok)) { totals.disagree += 1; if (totals.disagree <= 5) console.error('disagree', row.id, checks); }
  }
  const n = before.reduce((a, b) => a + b, 0);
  const line = (counts) => counts.slice(0, 4).map((c) => `${pct(c, n)}`.padStart(4)).join(' ') + `  (${counts.slice(0, 4).join('/')})`.padEnd(22);
  console.log(`${file.replace(/\.json$/, '').padEnd(20)} ${String(n).padStart(5)}   ${line(before)}  ${line(after)}  ${String(kept).padStart(5)}  ${pct(kept, n).padStart(5)}`);
  before.forEach((c, i) => { totals.before[i] += c; });
  after.forEach((c, i) => { totals.after[i] += c; });
  totals.kept += kept;
  totals.rows += n;
}
const n = totals.rows;
console.log(`${'ALL'.padEnd(20)} ${String(n).padStart(5)}   ${totals.before.slice(0, 4).map((c) => pct(c, n).padStart(4)).join(' ')}  (${totals.before.slice(0, 4).join('/')})   ${totals.after.slice(0, 4).map((c) => pct(c, n).padStart(4)).join(' ')}  (${totals.after.slice(0, 4).join('/')})   kept ${totals.kept} (${pct(totals.kept, n)})`);
console.log(`key unresolved (served as stored, not counted): ${totals.unresolved}`);
console.log(`kept in stored order, by reason: ${JSON.stringify(reasons)}`);
console.log(`surfaces disagreeing with the shared order: ${totals.disagree}`);
if (totals.disagree) process.exitCode = 1;
