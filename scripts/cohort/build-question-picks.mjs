// Builds data/cohort/question_picks.v1.json, the static cohort snapshot behind "How others answered" (spec
// tmp/mistake-lab-v4/SPEC.md 4.3; replaced by a nightly table in slice 5).
//
// 1. Run scripts/cohort/question_picks.sql through the Supabase MCP (execute_sql, read-only, SELECT only) with a
//    {cutoff} and {part} 0 for the summary, then parts 1 to 4 for the lines. Every line is aggregates only:
//      <question id> <n students> <today's key hash> <option hash>:<count>,<option hash>:<count>,...
//    No user id, attempt id or answer row leaves the database.
// 2. Save the lines (in qid order) to one text file and run
//      node scripts/cohort/build-question-picks.mjs --rows <file> --cutoff 2026-10-15T09:00:00Z \
//        --since 2026-04-21 --md5 <summary md5> [--summary <summary json file>]
//    The md5 of the saved lines must equal the database's own md5 of the same lines, so a copying slip cannot
//    reach the file. Nothing here writes to production.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SNAPSHOT_PATH = join(ROOT, 'data', 'cohort', 'question_picks.v1.json');
const HASH = /^[0-9a-f]{16}$/;
const QID = /^[A-Za-z0-9_-]{1,64}$/;
const MIN_STUDENTS = 10;

/** Parse and check the exported lines. Throws on the first bad line. */
export function parseRows(text) {
  const lines = String(text).replace(/\r/g, '').replace(/\n+$/, '').split('\n').filter(Boolean);
  const questions = {};
  for (const [i, line] of lines.entries()) {
    const parts = line.split(' ');
    if (parts.length !== 4) throw new Error(`line ${i + 1}: expected 4 fields`);
    const [qid, nText, keyHash, picksText] = parts;
    const n = Number(nText);
    if (!QID.test(qid) || questions[qid]) throw new Error(`line ${i + 1}: bad or repeated question id`);
    if (!Number.isInteger(n) || n < MIN_STUDENTS) throw new Error(`line ${i + 1}: n under ${MIN_STUDENTS}`);
    if (!HASH.test(keyHash)) throw new Error(`line ${i + 1}: bad key hash`);
    const picks = {};
    for (const pair of picksText.split(',')) {
      const [hash, countText] = pair.split(':');
      const count = Number(countText);
      if (!HASH.test(hash) || !Number.isInteger(count) || count < 1 || picks[hash]) throw new Error(`line ${i + 1}: bad pick ${pair}`);
      picks[hash] = count;
    }
    const sum = Object.values(picks).reduce((s, c) => s + c, 0);
    if (sum !== n) throw new Error(`line ${i + 1}: picks add to ${sum}, not ${n}`);
    questions[qid] = { n, keyHash, picks };
  }
  return { lines, questions };
}

export function buildSnapshot({ text, cutoff, since, md5 = null, summary = null }) {
  const clean = String(text).replace(/\r/g, '').replace(/\n+$/, '');
  if (md5 && createHash('md5').update(clean).digest('hex') !== md5) throw new Error('md5 of the saved lines differs from the database');
  const { questions } = parseRows(clean);
  const builtAt = new Date(cutoff).toISOString();
  return {
    version: 1,
    since,
    until: builtAt.slice(0, 10),
    builtAt,
    source: {
      what: "Each student's first answer to each question on MockMob, any mode, counted by option text against today's key. Aggregates only.",
      questions: Object.keys(questions).length,
      answers: Object.values(questions).reduce((s, q) => s + q.n, 0),
      ...(summary ? { checked: summary.deep, dropped: summary.dropped } : {}),
    },
    questions,
  };
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rows = arg('rows');
  const cutoff = arg('cutoff');
  const since = arg('since');
  if (!rows || !cutoff || !since) {
    console.error('usage: node scripts/cohort/build-question-picks.mjs --rows <file> --cutoff <iso> --since <YYYY-MM-DD> [--md5 <hex>] [--summary <json file>]');
    process.exit(2);
  }
  const summary = arg('summary') ? JSON.parse(readFileSync(arg('summary'), 'utf8')) : null;
  const snapshot = buildSnapshot({ text: readFileSync(rows, 'utf8'), cutoff, since, md5: arg('md5'), summary });
  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
  writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot)}\n`);
  const lowRight = Object.values(snapshot.questions).filter((q) => q.n >= 20 && (q.picks[q.keyHash] || 0) / q.n < 0.2).length;
  console.log(`wrote ${snapshot.source.questions} questions (${snapshot.source.answers} first answers) to ${SNAPSHOT_PATH}`);
  console.log(`questions with 20 or more answers where under 20% chose today's key (worth a key check): ${lowRight}`);
}
