// Third check of the OLD bank (owner, 24 Nov 2026: "Previously" should say what the old bank really held). OFFLINE.
// For every counted question that the first check (A and B both) did not count: the question, what A and B said, and the
// material as it stood at the first check: the served bank rows of the first-check snapshot and the Key card deck at FIRST_COMMIT.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const COV = 'data/coverage/cuet2026';
const OUT = 'tmp/1124-old';
const FIRST_COMMIT = '211cdc9f9';
const SNAP = { accountancy: 'tmp/1122-coverage/snap/accountancy', biology: 'tmp/1122-coverage/snap/biology', 'business-studies': 'tmp/1122-coverage/snap/business-studies', geography: 'tmp/1122-coverage/snap/geography', history: 'tmp/1122-coverage/snap/history', 'political-science': 'tmp/1122-coverage/snap/political-science', psychology: 'tmp/1122-coverage/snap/psychology', sociology: 'tmp/1122-coverage/snap/sociology', chemistry: 'tmp/1123-papers/chemistry/snap', 'computer-science': 'tmp/1123-papers/computer-science/snap', mathematics: 'tmp/1123-papers/mathematics/snap', physics: 'tmp/1123-papers/physics/snap' };
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
let total = 0;
for (const [id, snap] of Object.entries(SNAP)) {
  const deckName = id.replace(/-/g, '_');
  const paper = read(`${COV}/${id}-paper.json`);
  const A = new Map(read(`${COV}/${id}-A.json`).questions.map((q) => [q.n, q]));
  const B = new Map(read(`${COV}/${id}-B.json`).questions.map((q) => [q.n, q]));
  const F = new Map(read(`${COV}/${id}-final.json`).questions.map((q) => [q.n, q]));
  const todo = [];
  for (const q of paper.questions) {
    const f = F.get(q.n);
    if (!f || f.verdict === 'skill') continue;
    const a = A.get(q.n), b = B.get(q.n);
    if (a?.verdict === 'covered' && b?.verdict === 'covered') continue;
    const say = (c) => (c ? { verdict: c.verdict, best: c.best ?? null, matches: c.matches ?? null, reason: c.reason ?? null } : null);
    todo.push({ n: q.n, chapter: f.chapter, type: f.type, stem: q.stem, passage: q.passage && paper.passages ? paper.passages[q.passage]?.text ?? null : null, options: q.options, answerPosition: q.answerPosition, answerPositions: q.answerPositions ?? null, firstCheck: { A: say(a), B: say(b) } });
  }
  const files = fs.readdirSync(snap);
  let served;
  if (files.includes('served_rows.json')) served = read(path.join(snap, 'served_rows.json'));
  else {
    const bank = read(path.join(snap, files.find((f) => f.startsWith('bank_'))));
    const list = read(path.join(snap, files.find((f) => f.startsWith('served_'))));
    if (list.length && typeof list[0] === 'object') served = list;
    else { const ids = new Set(list); served = bank.filter((r) => ids.has(r.id)); }
  }
  const rows = (Array.isArray(served) ? served : served.rows).map((r) => ({ id: r.id, chapter: r.chapter, body: r.body ?? r.question ?? r.stem, passage: r.passage_text ?? r.passage ?? undefined, options: r.options, correct_answer: r.correct_answer, explanation: r.explanation }));
  const deckRaw = JSON.parse(execFileSync('git', ['show', `${FIRST_COMMIT}:data/keycards/decks/${deckName}.json`], { maxBuffer: 1 << 28 }).toString('utf8'));
  const cards = (deckRaw.cards || deckRaw).map((c) => ({ id: c.id, chapter: c.chapter, kind: c.kind, front: c.front, back: c.back }));
  const d = path.join(OUT, id);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'todo.json'), JSON.stringify(todo, null, 1));
  fs.writeFileSync(path.join(d, 'old-bank.json'), JSON.stringify(rows, null, 1));
  fs.writeFileSync(path.join(d, 'old-cards.json'), JSON.stringify(cards, null, 1));
  total += todo.length;
  console.log(id.padEnd(18), 'todo', String(todo.length).padStart(3), 'old bank rows', String(rows.length).padStart(5), 'old cards', cards.length, rows[0]?.correct_answer ? '' : 'NO KEY FIELD');
}
console.log('total', total);
