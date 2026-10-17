// Derives every number the mocks show from fixture.json, with RESULT-1017's rules, and checks the mocks say the same.
// Usage: node check.mjs   (prints the derived numbers, then one line per mock string that is missing)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const f = JSON.parse(readFileSync(join(here, 'fixture.json'), 'utf8'));
const web = readFileSync(join(here, 'web.html'), 'utf8');
const app = readFileSync(join(here, 'app.html'), 'utf8');

const paper = Object.fromEntries(f.papers.map((p) => [p.id, p]));
const chName = Object.fromEntries(f.chapters.map((c) => [c.id, c.name]));
const wrong = f.items.filter((i) => i.state !== 'blank');
const blank = f.items.filter((i) => i.state === 'blank');
const isOpen = (i) => i.state === 'open' || i.state === 'slipped';

// Papers add up (score = 5 right - 1 wrong; lost = 6 wrong + 5 blank).
for (const p of f.papers) {
  const w = wrong.filter((i) => i.paper === p.id).length;
  const b = blank.filter((i) => i.paper === p.id).length;
  const ok = w === p.wrong && b === p.blank && p.right * 5 - p.wrong === p.score && p.of - p.score === 6 * w + 5 * b;
  console.log(`${p.name} ${p.subject}: ${w} wrong, ${b} blank, ${p.score} of ${p.of}, lost ${6 * w + 5 * b} ${ok ? 'ok' : 'MISMATCH'}`);
}

// Receipt strip.
const found = wrong.length;
const repaired = wrong.filter((i) => ['slipped', 'repaired', 'held'].includes(i.state)).length;
const retested = wrong.filter((i) => ['slipped', 'held'].includes(i.state)).length;
const held = wrong.filter((i) => i.state === 'held').length;
const open = wrong.filter(isOpen).length;
console.log(`strip: Found ${found}, Repaired ${repaired}, Retested ${retested}, Still right ${held}; open ${open}; blanks ${blank.length}`);

// Chapters priced as RESULT-1017 4.2 rule 1: 6 a wrong answer, 5 a blank; here over open items across papers.
const rows = f.chapters.map((c) => {
  const its = f.items.filter((i) => i.ch === c.id);
  const w = its.filter((i) => i.state !== 'blank');
  const ow = w.filter(isOpen).length; const b = its.filter((i) => i.state === 'blank').length;
  const papers = [...new Set(its.map((i) => paper[i.paper].name))];
  return { name: c.name, marks: 6 * ow + 5 * b, openWrong: ow, blank: b, wrong: w.length, fixed: w.length - w.filter(isOpen).length, papers };
}).sort((a, b) => b.marks - a.marks || b.openWrong - a.openWrong);
for (const r of rows) console.log(`  -${r.marks}  ${r.name}: ${r.openWrong} wrong and ${r.blank} left blank open; ${r.fixed} of ${r.wrong} repaired; ${r.papers.join(' and ')}`);
const total = rows.reduce((s, r) => s + r.marks, 0);
console.log(`open marks ${total} = ${open} x 6 + ${blank.length} x 5`);
const lostAll = f.papers.reduce((s, p) => s + (p.of - p.score), 0);
console.log(`all marks lost across papers: ${lostAll}`);

// Next move: RESULT-1017 4.3 in its order, on the open set across papers (rule 2 on the newest paper).
const newest = [...f.papers].sort((a, b) => b.at.localeCompare(a.at))[0];
const answered = newest.right + newest.wrong;
const costliest = rows[0];
let move;
if (found === 0) move = 'rule 1: Set up a harder full mock';
else if (newest.right / answered < 0.4) move = `rule 2: Practise 10 on ${costliest.name}`;
else if (open > 0 && f.wallet.aiCredits >= 1) {
  const target = f.items.find((i) => i.ch === f.chapters.find((c) => c.name === costliest.name).id && isOpen(i));
  move = `rule 3: Repair Q${target.q} (${paper[target.paper].name})`;
} else if (wrong.some((i) => i.state === 'repaired')) move = 'rule 4: Check Q held';
else move = `rule 5: Practise 10 on ${costliest.name}`;
console.log(`newest paper ${newest.name}: ${newest.right} of ${answered} answered right (${Math.round((100 * newest.right) / answered)}%)`);
console.log(`next move: ${move}; with 0 AI credits: rule 5: Practise 10 on ${costliest.name}`);
const due = f.revise.dueToday; const dueN = due.questions + due.again + due.checks + due.cards;
console.log(`Revise due today ${dueN} (${due.questions} questions back, ${due.checks} Check it held, ${due.cards} cards); rotation ${f.revise.rotation} = boxes ${f.revise.boxes.reduce((a, b) => a + b)}`);
const ls = Object.values(f.lessons).filter(Array.isArray).flat();
const read = ls.filter((l) => l.read).length;
console.log(`lessons ${ls.length}, read ${read}, cards in Revise ${read * f.lessons.cardsPerLesson}`);

// Strings every mock must carry (and must not carry).
const must = [
  `${found}`, `${open} open`, `${total} marks`, `−${costliest.marks}`, 'Repair Q42', 'Check it held', '6 of the 7 checks held',
  'Sun 18 Oct', `${dueN} due`, 'Mock 3, 16 Oct, 9:40 PM', 'Mock 2, 12 Oct, 10:42 PM',
];
const banned = ['Tue, 21 Oct', 'Back Tue', '126 marks', 'Repair 6 mistakes', 'Repair 3 in this chapter', 'check on a new question', '21 to repair', 'Q42 repair'];
for (const [name, src] of [['web.html', web], ['app.html', app]]) {
  for (const s of must) if (!src.includes(s)) console.log(`${name}: missing "${s}"`);
  for (const s of banned) if (src.includes(s)) console.log(`${name}: still says "${s}"`);
}
