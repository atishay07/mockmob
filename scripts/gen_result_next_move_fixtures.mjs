// Writes data/tests/fixtures/result_next_move/*.json from the illustrative papers (data/result_papers.mjs) and the
// rules (data/result_next_move.mjs). Run after a deliberate rule change: node scripts/gen_result_next_move_fixtures.mjs
// The app's port reads the same files (copy them to flutter_app/test/fixtures/result_next_move/).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paperRows, paperRepairOrder } from '../data/result_papers.mjs';
import { analysisFromRows, nextMove, costliestLine } from '../data/result_next_move.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'data/tests/fixtures/result_next_move');
mkdirSync(out, { recursive: true });

const base = { aiCredits: 68, practiceCredits: 40, isPremium: false, subject: 'accountancy', subjectName: 'Accountancy', labReady: true, hour: 21, answerReviews: {}, repaired: [], checks: {} };
const wrongIds = (name) => paperRows(name).filter((r) => r.verdict === 'wrong').map((r) => r.qid);
const CASES = {
  weak: { paper: 'weak', mode: 'full' },
  avg: { paper: 'avg', mode: 'full' },
  strong: { paper: 'strong', mode: 'full' },
  perfect: { paper: 'perfect', mode: 'full' },
  blank: { paper: 'blank', mode: 'full' },
  held: { paper: 'avg', mode: 'full', answerReviews: { 'paper-avg-q42': { state: 'under_review', originalIndex: 2 } } },
  zero_credits: { paper: 'avg', mode: 'full', aiCredits: 0 },
  all_repaired: { paper: 'avg', mode: 'full', repaired: wrongIds('avg') },
  late_night: { paper: 'avg', mode: 'full', hour: 0 },
  practice5: { paper: 'practice5', mode: 'quick', subject: 'business_studies', subjectName: 'Business Studies' },
};

for (const [name, c] of Object.entries(CASES)) {
  const input = { ...base, ...c, rows: paperRows(c.paper), repairOrder: paperRepairOrder(c.paper) };
  delete input.paper;
  const analysis = analysisFromRows(input.rows);
  const move = nextMove({ ...input, analysis, repaired: new Set(input.repaired) });
  const head = costliestLine(analysis, { answerReviews: input.answerReviews });
  const expected = { costliest: { line: head.line, detail: head.detail }, move: { kind: move.kind, rule: move.rule, label: move.label, why: move.why, value: move.value, cost: move.cost, late: move.late, alt: move.alt ? { kind: move.alt.kind, label: move.alt.label } : null, note: move.note, target: move.target } };
  writeFileSync(resolve(out, `${name}.json`), `${JSON.stringify({ name, input, expected }, null, 2)}\n`);
  console.log(name.padEnd(13), '|', head.line, head.detail || '', '|', move.label, '|', move.why, '|', move.cost, '|', move.late || '', '|', move.alt?.label || '', '|', move.note || '');
}
