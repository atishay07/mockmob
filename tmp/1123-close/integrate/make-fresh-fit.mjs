// Fresh judge pass for the four fit-held rows (owner, 24 Nov 2026: "Yes, run it"): packs with the row's own batch text and fit aids,
// plus the real CUET 2026 question each one mirrors (the PYQ anchor the wave's fit judges never had). OFFLINE.
import fs from 'node:fs';
import path from 'node:path';
const I = 'tmp/1123-close/integrate';
const OUT = path.join(I, 'fresh-fit');
const PICK = [
  { id: '70fc4da1', subject: 'accountancy', cov: 'accountancy', n: 23, dir: 'scoring' },
  { id: '46fc9550', subject: 'computer_science', cov: 'computer-science', n: 10, dir: 'scoring3' },
  { id: 'a96cb5ae', subject: 'computer_science', cov: 'computer-science', n: 78, dir: 'scoring3' },
  { id: 'deb62cd1', subject: 'mathematics', cov: 'mathematics', n: 33, dir: 'scoring3' },
];
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const by = new Map();
for (const p of PICK) {
  const sdir = path.join(I, p.dir, p.subject);
  const file = fs.readdirSync(sdir).filter((f) => /__w6b[0-9a-z]*\.json$/.test(f)).find((f) => read(path.join(sdir, f)).questions.some((q) => q.id.startsWith(p.id)));
  const batch = read(path.join(sdir, file));
  const aids = read(path.join(sdir, file.replace('.json', '-fitaids.json')));
  const q = batch.questions.find((x) => x.id.startsWith(p.id));
  const paper = read(`data/coverage/cuet2026/${p.cov}-paper.json`).questions.find((x) => x.n === p.n);
  const key = `${p.subject}__w6f`;
  if (!by.has(key)) by.set(key, { subject: p.subject, batch: { ...batch, batch: key, questions: [] }, aids: { ...aids, rows: {} }, anchors: [] });
  const b = by.get(key);
  b.batch.questions.push(q);
  const rows = aids.rows;
  b.aids.rows[q.id] = Array.isArray(rows) ? rows.find((r) => r.id === q.id) : rows[q.id];
  b.anchors.push({ id: q.id, anchor: `CUET 2026 ${p.cov} paper, question ${p.n}`, cuet_question: { stem: paper.stem ?? paper.question ?? paper.text, options: paper.options ?? null, nta_answer_position: paper.answerPosition ?? null } });
}
for (const [key, b] of by) {
  const d = path.join(OUT, b.subject);
  fs.mkdirSync(path.join(d, 'verify'), { recursive: true });
  if (Array.isArray(b.aids.rows)) b.aids.rows = Object.values(b.aids.rows);
  fs.writeFileSync(path.join(d, `${key}.json`), JSON.stringify(b.batch, null, 1));
  fs.writeFileSync(path.join(d, `${key}-fitaids.json`), JSON.stringify(b.aids, null, 1));
  fs.writeFileSync(path.join(d, `${key}-anchors.json`), JSON.stringify(b.anchors, null, 1));
  console.log(key, b.batch.questions.length, b.anchors.map((a) => a.anchor + ': ' + String(a.cuet_question.stem).slice(0, 60)));
}
