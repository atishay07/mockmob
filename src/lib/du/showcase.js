// Builds the landing-page Compass ladder from the same published DU files the full tool uses.
// Runs at build/request time on the server, so only a few kilobytes of numbers reach the phone.
// Nothing is estimated: every figure is a "minimum allocation score" printed in DU's round lists.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROGRAMMES = [
  { id: 'b-com-hons', label: 'B.Com. (Hons.)' },
  { id: 'b-a-hons-economics', label: 'Economics (Hons.)' },
  { id: 'b-a-hons-history', label: 'History (Hons.)' },
  { id: 'b-a-hons-political-science', label: 'Political Science (Hons.)' },
];
// Colleges students ask about most, matched by name. Absent colleges are skipped, never invented.
const COLLEGES = [
  ['Hindu', /^Hindu\b/], ['Shri Ram College of Commerce', /^Shri Ram .*Commerce/], ['Hansraj', /^Hansraj/], ['Lady Shri Ram', /^Lady Shri Ram/],
  ["St. Stephen's", /^St\. Stephen/], ['Miranda House', /^Miranda House/], ['Ramjas', /^Ramjas/], ['Kirori Mal', /^Kirori Mal/],
  ['Sri Venkateswara', /^Sri Venk/], ['Gargi', /^Gargi/], ['Atma Ram Sanatan Dharma', /^Atma Ram/], ['Dyal Singh', /^Dyal Singh$/],
  ['Aryabhatta', /^Aryabhatta/], ['Deshbandhu', /^Deshbandhu/], ['Shivaji', /^Shivaji/], ['Rajdhani', /^Rajdhani/],
];
const CATEGORIES = ['UR', 'OBC-NCL', 'EWS', 'SC'];
const ROUNDS = ['round-1', 'round-2', 'round-3'];

export function buildCompassShowcase() {
  const programmes = [];
  for (const { id, label } of PROGRAMMES) {
    let group;
    try { group = JSON.parse(readFileSync(join(process.cwd(), 'public', 'du', '2026', 'offerings', `${id}.json`), 'utf8')); } catch { continue; }
    const catIndex = Object.fromEntries(CATEGORIES.map((c) => [c, group.categories.indexOf(c)]));
    if (Object.values(catIndex).some((i) => i < 0)) continue;
    const rows = [];
    for (const [display, pattern] of COLLEGES) {
      const row = group.rows.find((r) => pattern.test(r[0]) && !/Evening/i.test(r[0]));
      if (!row) continue;
      const cutoffs = {};
      ROUNDS.forEach((round, r) => {
        cutoffs[round] = Object.fromEntries(CATEGORIES.map((c) => {
          const v = row[2 + r]?.[catIndex[c]];
          return [c, typeof v === 'number' ? Math.round(v * 10) / 10 : null];
        }));
      });
      rows.push({ college: display, women: /\(W\)/.test(row[0]), cutoffs });
    }
    if (rows.length >= 6) programmes.push({ id, label, rows: rows.slice(0, 10) });
  }
  return { cycle: 'CSAS UG 2026-27', programmes, categories: CATEGORIES, rounds: ROUNDS };
}

/** Headline counts from the published DU index (programmes, colleges, college-programme offerings). */
export function duIndexFacts() {
  try {
    const index = JSON.parse(readFileSync(join(process.cwd(), 'public', 'du', '2026', 'index.json'), 'utf8'));
    return { cycle: index.meta.cycle, programmes: index.groups.length, colleges: index.meta.colleges, offerings: index.meta.offerings };
  } catch {
    return null;
  }
}
