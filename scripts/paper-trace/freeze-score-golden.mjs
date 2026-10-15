// Freezes what scoreSession returned for old payloads (visit, answer and mark events only) BEFORE slice 2's capture
// changes, so data/tests/capture.test.mjs can prove old payloads still score byte for byte the same.
//   node scripts/paper-trace/freeze-score-golden.mjs     writes data/tests/fixtures/capture/score_session_golden_v1.json
// Run once, on the scorer as it was at web/alive-1015 eeeaca20. Re-running it after the change would only copy the
// new scorer's output, so the script refuses to overwrite an existing golden file.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreSession, scorePracticeSubmission } from '../../data/recovery.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'data', 'tests', 'fixtures', 'capture', 'score_session_golden_v1.json');
if (existsSync(OUT)) { console.error(`refusing to overwrite ${OUT}`); process.exit(1); }
const lab = (name) => JSON.parse(readFileSync(join(ROOT, 'data', 'tests', 'fixtures', 'mistake_lab', `${name}.json`), 'utf8'));

const payloads = [];
// 1. The slice 1 papers, replayed from their stored timelines and final answers.
for (const name of ['full_mock_input', 'quick_set_input', 'no_missed_input', 'nta_shuffled_input']) {
  const { attempt } = lab(name);
  const answers = Object.fromEntries(attempt.details.filter((d) => d.givenIndex !== null).map((d) => [d.qid, d.givenIndex]));
  payloads.push({ name, scorer: 'session', questions: attempt.questionsSnapshot, answers, events: attempt.selectionMeta.recovery.timeline, durationMs: 3600000 });
}
// 2. The Time and decisions fixture (12 questions: changes, a clear and repick, return visits).
const tdQuestions = Array.from({ length: 12 }, (_, i) => ({ id: `q${i + 1}`, chapter: i < 4 ? 'Goodwill' : 'Ratios', question: `Question ${i + 1}`, options: ['a', 'b', 'c', 'd'], correctIndex: 0 }));
const tdEvents = (() => {
  const ev = []; let seq = 1;
  const push = (qid, at, type, answer) => ev.push({ seq: seq++, qid, at, type, ...(type === 'answer' ? { answer } : {}) });
  push('q1', 0, 'visit'); push('q1', 42000, 'answer', 1); push('q1', 115000, 'answer', 2);
  push('q2', 130000, 'visit'); push('q2', 150000, 'answer', 0); push('q2', 200000, 'answer', 3);
  push('q3', 210000, 'visit'); push('q3', 215000, 'answer', 1);
  push('q4', 216000, 'visit'); push('q4', 260000, 'answer', 0);
  for (let i = 5; i <= 11; i++) { const start = 270000 + (i - 5) * 50000; push(`q${i}`, start, 'visit'); push(`q${i}`, start + 30000, 'answer', 0); }
  push('q12', 620000, 'visit'); push('q12', 640000, 'answer', 2); push('q12', 650000, 'answer', null); push('q12', 700000, 'answer', 0);
  push('q1', 710000, 'visit'); push('q3', 720000, 'visit');
  return ev;
})();
const tdAnswers = { q1: 2, q2: 3, q3: 1, q4: 0, q5: 0, q6: 0, q7: 0, q8: 0, q9: 0, q10: 0, q11: 0, q12: 0 };
payloads.push({ name: 'time_decisions_fixture', scorer: 'session', questions: tdQuestions, answers: tdAnswers, events: tdEvents, durationMs: Infinity });
// 3. An old web runner paper with marks for review (validated, then dropped by the old scorer).
const four = (id, key) => ({ id, correctIndex: key, options: [`${id} a`, `${id} b`, `${id} c`, `${id} d`] });
const small = [four('m1', 0), four('m2', 1), four('m3', 2)];
const marked = [
  { seq: 1, qid: 'm1', at: 0, type: 'visit' }, { seq: 2, qid: 'm1', at: 4000, type: 'mark', marked: true },
  { seq: 3, qid: 'm1', at: 9000, type: 'answer', answer: 0 }, { seq: 4, qid: 'm2', at: 15000, type: 'visit' },
  { seq: 5, qid: 'm2', at: 21000, type: 'answer', answer: 3 }, { seq: 6, qid: 'm1', at: 30000, type: 'visit' },
  { seq: 7, qid: 'm1', at: 31000, type: 'mark', marked: false }, { seq: 8, qid: 'm3', at: 40000, type: 'visit' },
];
payloads.push({ name: 'old_web_with_marks', scorer: 'session', questions: small, answers: { m1: 0, m2: 3 }, events: marked, durationMs: 60000 });
// 4. A record that contradicts the submitted answers, a paper with no events, and a practice paper with a bad clock.
payloads.push({ name: 'inconsistent', scorer: 'session', questions: small, answers: { m1: 1 }, events: [{ seq: 1, qid: 'm1', at: 0, type: 'answer', answer: 0 }], durationMs: 60000 });
payloads.push({ name: 'no_events', scorer: 'session', questions: small, answers: { m2: 1, m3: 0 }, events: [], durationMs: 60000 });
payloads.push({ name: 'practice_clock_skew', scorer: 'practice', questions: small, answers: { m1: 0 }, events: [{ seq: 1, qid: 'm1', at: 90000, type: 'answer', answer: 0 }], durationMs: 60000 });

const out = payloads.map((p) => {
  const score = p.scorer === 'practice' ? scorePracticeSubmission : scoreSession;
  const result = score(p.questions, p.answers, p.events, p.durationMs);
  return { ...p, durationMs: Number.isFinite(p.durationMs) ? p.durationMs : null, output: result };
});
writeFileSync(OUT, `${JSON.stringify({ version: 1, frozenFrom: 'web/alive-1015 eeeaca20 data/recovery.js', payloads: out }, null, 2)}\n`);
console.log(`froze ${out.length} payloads to ${OUT}`);
