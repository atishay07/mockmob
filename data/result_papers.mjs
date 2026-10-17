// Illustrative papers for the result screen (RESULT-1017 section 5): development fixtures only, never real students,
// never bank questions. The preview (/preview/arena?view=result&mock=full&paper=weak|avg|strong|perfect|blank, and
// &mock=practice5) serves them, and data/tests/fixtures/result_next_move/*.json are generated from them so the website
// and the app test the next-move rules on the same papers. Accountancy, +5 / -1: every number adds up
// (score = 5 x right - wrong; missed = 6 x wrong + 5 x blank).

// [chapter, outcomes]: R right, W wrong, B blank. Question numbers run in order through the blocks.
export const RESULT_PAPERS = Object.freeze({
  // 8 / 22 / 20: 18 of 250. Share Capital 51 (1 right of 10: 6 wrong and 3 left blank). Under 40% right: practise.
  weak: [
    ['Partnership Fundamentals', 'RWBWBRWB'],
    ['Profit & Loss Appropriation Account', 'WBWRBWBW'],
    ['Goodwill', 'WBBWRB'],
    ['Share Capital', 'RWWBWWBWBW'],
    ['Accounting Ratios', 'WBWRBWBW'],
    ['Depreciation', 'RWBBWRBWBB'],
  ],
  // 28 / 12 / 10: 128 of 250. Share Capital 29 (4 wrong and 1 left blank, of 6). Repair Q42.
  avg: [
    ['Partnership Fundamentals', 'RRRRRRWB'],
    ['Profit & Loss Appropriation Account', 'RRRRRWBB'],
    ['Goodwill', 'RRRWRB'],
    ['Accounting Ratios', 'RRRWWRBR'],
    ['Cash Flow Statement', 'RRWRRWBB'],
    ['Share Capital', 'RWBWWW'],
    ['Depreciation', 'RRWRBB'],
  ],
  // 44 / 4 / 2: 216 of 250. Accounting Ratios 12. Repair Q31; all 4 repairs take about 15 minutes.
  strong: [
    ['Partnership Fundamentals', 'RRRRRWRR'],
    ['Profit & Loss Appropriation Account', 'RRRRBRRR'],
    ['Goodwill', 'RRRWRR'],
    ['Accounting Ratios', 'RRRWRRRRWR'],
    ['Share Capital', 'RRRRRBRR'],
    ['Depreciation', 'RRRRRRRRRR'],
  ],
  perfect: [
    ['Partnership Fundamentals', 'RRRRRRRR'],
    ['Profit & Loss Appropriation Account', 'RRRRRRRR'],
    ['Goodwill', 'RRRRRR'],
    ['Accounting Ratios', 'RRRRRRRRRR'],
    ['Share Capital', 'RRRRRRRR'],
    ['Depreciation', 'RRRRRRRRRR'],
  ],
  blank: [
    ['Partnership Fundamentals', 'BBBBBBBB'],
    ['Profit & Loss Appropriation Account', 'BBBBBBBB'],
    ['Goodwill', 'BBBBBB'],
    ['Accounting Ratios', 'BBBBBBBBBB'],
    ['Share Capital', 'BBBBBBBB'],
    ['Depreciation', 'BBBBBBBBBB'],
  ],
  // A 5-question practice set: 3 / 1 / 1, 14 of 25.
  practice5: [
    ['Nature & Significance of Management', 'RRWRB'],
  ],
});

// Illustrative cohort lines for the repair order (the shape data/repair_order.js sends, state 'cohort').
// Shares: 18/22 = 0.82, 21/26 = 0.81, 16/21 = 0.76.
const COHORT = Object.freeze({
  avg: [[42, 18, 22], [14, 21, 26], [43, 16, 21]],
  strong: [[31, 16, 21], [6, 21, 26]],
  weak: [[24, 18, 22], [2, 16, 21]],
});

const TOTALS = (blocks) => blocks.reduce((n, [, o]) => n + o.length, 0);

/** The paper's rows: { qid, number, chapter, verdict, key, givenIndex }. A wrong pick is the option after the key. */
export function paperRows(name) {
  const blocks = RESULT_PAPERS[name];
  if (!blocks) return null;
  const rows = [];
  for (const [chapter, outcomes] of blocks) {
    for (const o of outcomes) {
      const number = rows.length + 1;
      const key = number % 4;
      rows.push({
        qid: `paper-${name}-q${number}`, number, chapter, key,
        verdict: o === 'R' ? 'correct' : o === 'W' ? 'wrong' : 'skipped',
        givenIndex: o === 'R' ? key : o === 'W' ? (key + 1) % 4 : null,
      });
    }
  }
  if (rows.length !== TOTALS(blocks)) throw new Error('paper rows');
  return rows;
}

/** The repair order for a paper: the cohort-led items first (by share), then the other wrong answers in paper order. */
export function paperRepairOrder(name) {
  const rows = paperRows(name);
  if (!rows) return null;
  const wrong = rows.filter((r) => r.verdict === 'wrong');
  const led = (COHORT[name] || []).filter(([n]) => wrong.some((r) => r.number === n))
    .map(([n, r, of]) => ({ qid: `paper-${name}-q${n}`, number: n, reason: 'most_right', key: `Repair Q${n} first`, line: `${r} of ${of} other students got it right.`, share: r / of }))
    .sort((a, b) => b.share - a.share || a.number - b.number);
  const rest = wrong.filter((r) => !led.some((x) => x.number === r.number)).map((r) => ({ qid: r.qid, number: r.number, reason: 'paper', key: null, line: null }));
  const items = [...led.map(({ share, ...x }) => x), ...rest];
  return { version: 1, state: led.length ? 'cohort' : 'paper', items, qids: items.map((x) => x.qid) };
}
