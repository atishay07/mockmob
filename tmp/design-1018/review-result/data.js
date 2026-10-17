// One student for every mock in this folder (REVIEW-RESULT-1018). Illustrative stems; every count is derived here,
// never typed twice. Now: Sat 17 Oct 2026, 9:41 PM (17 Oct 2026 is a Saturday; 18 Oct a Sunday).
// CUET marking: +5 right, -1 wrong, 0 blank. Marks lost on a question = 5 not earned + 1 penalty for a wrong answer (6),
// 5 for a blank. A chapter's marks on offer = 5 x its questions, so lost = on offer - scored.
(function () {
  const papers = {
    m3: { id: 'm3', name: 'Mock 3', subject: 'Accountancy', at: 'Fri 16 Oct, 9:40 PM', right: 34, wrong: 12, blank: 4, total: 50, took: '46m 36s', tookSec: 2796, limitMin: 60 },
    bq: { id: 'bq', name: 'Quick practice', subject: 'Business Studies', at: 'Thu 15 Oct, 7:05 PM', right: 7, wrong: 3, blank: 0, total: 10 },
    m2: { id: 'm2', name: 'Mock 2', subject: 'Accountancy', at: 'Mon 12 Oct, 10:42 PM', right: 31, wrong: 15, blank: 4, total: 50 },
  };
  for (const p of Object.values(papers)) { p.max = p.total * 5; p.score = p.right * 5 - p.wrong; p.lost = p.max - p.score; }

  // Chapters across the three papers: questions and right answers (wrong and blank come from the mistakes below).
  const chapterBase = [
    { id: 'adm', name: 'Admission of a partner', subject: 'Accountancy', obj: 'accountancy', q: 16, r: 10 },
    { id: 'dis', name: 'Dissolution of a firm', subject: 'Accountancy', obj: 'accountancy', q: 6, r: 1 },
    { id: 'ret', name: 'Retirement and death of a partner', subject: 'Accountancy', obj: 'accountancy', q: 14, r: 9 },
    { id: 'sha', name: 'Issue of shares', subject: 'Accountancy', obj: 'accountancy', q: 16, r: 11 },
    { id: 'cfs', name: 'Cash flow statement', subject: 'Accountancy', obj: 'accountancy', q: 12, r: 8 },
    { id: 'rat', name: 'Accounting ratios', subject: 'Accountancy', obj: 'accountancy', q: 14, r: 10 },
    { id: 'gw', name: 'Goodwill', subject: 'Accountancy', obj: 'accountancy', q: 10, r: 7 },
    { id: 'pf', name: 'Partnership fundamentals', subject: 'Accountancy', obj: 'accountancy', q: 12, r: 9 },
    { id: 'pom', name: 'Principles of management', subject: 'Business Studies', obj: 'business', q: 4, r: 2 },
    { id: 'pln', name: 'Planning', subject: 'Business Studies', obj: 'business', q: 6, r: 5 },
  ];

  // Every wrong answer and blank on record. state: open | pending (repaired, Check it held not taken) | held | slipped | blank
  const M = (paper, n, ch, stem, pick, key, state = 'open', extra = {}) => ({ paper, n, ch, stem, pick, key, state, ...extra });
  const mistakes = [
    M('m3', 42, 'adm', 'New partner brings premium in cash; the sacrificing ratio is not given.', 'D', 'B'),
    M('m3', 38, 'adm', 'Revaluation profit on admission: which partners share it?', 'A', 'C'),
    M('m3', 45, 'adm', 'Hidden goodwill when the capital brought in is more than the share.', 'C', 'A'),
    M('m2', 11, 'adm', 'Adjusting old partners’ capitals to the new partner’s capital.', 'B', 'D'),
    M('m2', 17, 'adm', 'Premium for goodwill credited in the sacrificing ratio.', 'A', 'C', 'slipped', { repaired: 'Tue 13 Oct, 11:08 PM', checked: 'tonight, 8:55 PM' }),
    M('m3', 47, 'adm', 'Accumulated profits on admission, with a workmen compensation claim.', null, 'B', 'blank'),
    M('m3', 49, 'dis', 'Realisation account: an unrecorded asset taken over by a partner.', 'B', 'D'),
    M('m3', 26, 'dis', 'Order of payment of liabilities on dissolution.', 'C', 'A'),
    M('m2', 40, 'dis', 'Loss on realisation shared in the profit-sharing ratio.', 'D', 'B', 'held', { repaired: 'Tue 13 Oct, 10:40 PM' }),
    M('m2', 44, 'dis', 'Partner’s loan paid before capitals.', 'A', 'C'),
    M('m2', 48, 'dis', 'Creditors accept an asset in full settlement.', 'B', 'A'),
    M('m3', 31, 'ret', 'Gaining ratio when B retires and A and C take his share.', 'A', 'D'),
    M('m2', 6, 'ret', 'Goodwill adjusted through the continuing partners’ capitals.', 'C', 'B', 'held', { repaired: 'Tue 13 Oct, 9:55 PM' }),
    M('m2', 24, 'ret', 'Deceased partner’s share of profit till the date of death.', 'D', 'A'),
    M('m2', 41, 'ret', 'Joint life policy surrender value on death.', 'B', 'C'),
    M('m2', 37, 'ret', 'Amount due to a retiring partner paid in instalments.', null, 'A', 'blank'),
    M('m3', 29, 'sha', 'Shares forfeited and reissued at a discount.', 'C', 'A', 'pending', { repaired: 'tonight, 8:30 PM' }),
    M('m3', 14, 'sha', 'Calls in arrears on the allotment money.', 'B', 'D'),
    M('m2', 14, 'sha', 'Pro-rata allotment with excess application money.', 'A', 'B', 'held', { repaired: 'Wed 14 Oct, 9:20 PM' }),
    M('m3', 28, 'sha', 'Securities premium used for writing off a discount.', null, 'C', 'blank'),
    M('m2', 12, 'sha', 'Minimum subscription not received.', null, 'D', 'blank'),
    M('m3', 22, 'cfs', 'Interest paid by a non-financial company: which activity?', 'D', 'A'),
    M('m2', 27, 'cfs', 'Proceeds from the sale of machinery at a loss.', 'B', 'C', 'pending', { repaired: 'Wed 14 Oct, 10:15 PM' }),
    M('m2', 35, 'cfs', 'Increase in trade payables in operating activities.', 'C', 'A'),
    M('m3', 36, 'cfs', 'Dividend received by an investment company.', null, 'B', 'blank'),
    M('m3', 3, 'rat', 'Quick ratio after paying a creditor in cash.', 'A', 'C'),
    M('m2', 33, 'rat', 'Inventory turnover from cost of revenue.', 'D', 'B', 'held', { repaired: 'Wed 14 Oct, 8:50 PM' }),
    M('m3', 50, 'rat', 'Interest coverage ratio with tax given.', null, 'A', 'blank'),
    M('m2', 46, 'rat', 'Debt to equity after issuing debentures.', null, 'C', 'blank'),
    M('m3', 19, 'gw', 'Goodwill by capitalisation of super profit.', 'B', 'D'),
    M('m2', 21, 'gw', 'Average profit after an abnormal loss.', 'C', 'A', 'held', { repaired: 'Tue 13 Oct, 10:05 PM' }),
    M('m2', 30, 'gw', 'Weighted average profit method.', 'A', 'B'),
    M('m3', 9, 'pf', 'Interest on drawings made evenly through the year.', 'D', 'C'),
    M('m2', 9, 'pf', 'Guarantee of minimum profit to a partner.', 'B', 'A', 'held', { repaired: 'Tue 13 Oct, 9:30 PM' }),
    M('m2', 19, 'pf', 'Past adjustments through capital accounts.', null, 'D', 'blank'),
    M('bq', 2, 'pom', 'Fayol’s principle shown by a single boss for each worker.', 'C', 'A'),
    M('bq', 5, 'pom', 'Taylor’s technique for finding the best way to do a job.', 'B', 'D'),
    M('bq', 8, 'pln', 'Which step of planning comes after setting objectives?', 'A', 'B'),
  ];
  const isWrong = (m) => m.state !== 'blank';
  const lostOf = (m) => (isWrong(m) ? 6 : 5);

  const chapters = chapterBase.map((c) => {
    const items = mistakes.filter((m) => m.ch === c.id);
    const w = items.filter(isWrong).length, b = items.length - w;
    const offer = c.q * 5, scored = c.r * 5 - w, lost = items.reduce((s, m) => s + lostOf(m), 0);
    if (c.r + w + b !== c.q) throw new Error(`${c.id}: questions do not add up`);
    if (offer - scored !== lost) throw new Error(`${c.id}: lost does not equal offer - scored`);
    const paperIds = [...new Set(items.map((m) => m.paper))].sort((x, y) => ['m3', 'bq', 'm2'].indexOf(x) - ['m3', 'bq', 'm2'].indexOf(y));
    return {
      ...c, items, w, b, offer, scored, lost,
      open: items.filter((m) => m.state === 'open'),
      blanks: items.filter((m) => m.state === 'blank'),
      repaired: items.filter((m) => ['pending', 'held', 'slipped'].includes(m.state)),
      paperNames: paperIds.map((id) => papers[id].name),
    };
  }).sort((x, y) => y.lost - x.lost || y.w - x.w);

  // Paper checks: per-paper wrong and blank counts must equal the papers above.
  for (const p of Object.values(papers)) {
    const mine = mistakes.filter((m) => m.paper === p.id);
    if (mine.filter(isWrong).length !== p.wrong || mine.filter((m) => !isWrong(m)).length !== p.blank) throw new Error(`${p.id}: mistakes do not match the paper`);
  }
  const totalLost = chapters.reduce((s, c) => s + c.lost, 0);
  if (totalLost !== Object.values(papers).reduce((s, p) => s + p.lost, 0)) throw new Error('chapter marks do not add up to the papers');

  const repaired = mistakes.filter((m) => ['pending', 'held', 'slipped'].includes(m.state));
  const order = { slipped: 0, pending: 1, held: 2 };
  repaired.sort((x, y) => order[x.state] - order[y.state]);
  const review = {
    totalLost,
    wrong: mistakes.filter(isWrong).length,
    blank: mistakes.filter((m) => !isWrong(m)).length,
    open: mistakes.filter((m) => m.state === 'open').length,
    repaired,
    held: repaired.filter((m) => m.state === 'held').length,
    slipped: repaired.filter((m) => m.state === 'slipped').length,
    pending: repaired.filter((m) => m.state === 'pending').length,
    revise: { due: 8, back: 5, checks: 1, cards: 2, minutes: 7 },
    credits: 40, aiCredits: 68,
  };

  // ---------- The result: Mock 3, question by question ----------
  const m3 = papers.m3;
  const wrongM3 = new Set(mistakes.filter((m) => m.paper === 'm3' && isWrong(m)).map((m) => m.n));
  const blankM3 = new Set(mistakes.filter((m) => m.paper === 'm3' && !isWrong(m)).map((m) => m.n));
  const chOf = Object.fromEntries(mistakes.filter((m) => m.paper === 'm3').map((m) => [m.n, chapterBase.find((c) => c.id === m.ch).name]));
  const rightCh = ['Partnership fundamentals', 'Goodwill', 'Issue of shares', 'Accounting ratios', 'Cash flow statement', 'Retirement and death of a partner', 'Admission of a partner'];
  // Changes on this paper: from, to, when picked, when changed, effect in marks.
  const changes = {
    8: { from: 'C', to: 'A', at: '7:17', to_at: '41:56', effect: +6, later: true },
    22: { from: 'D', to: 'A', at: '20:04', to_at: '20:34', effect: -6 },
    31: { from: 'B', to: 'D', at: '27:59', to_at: '28:54', effect: -6 },
    44: { from: 'B', to: 'C', at: '38:12', to_at: '43:20', effect: +6, later: true },
    49: { from: 'A', to: 'B', at: '40:41', to_at: '40:47', effect: 0 },
  };
  // Seconds on each question: fixed where the analysis names them, the rest from a seeded list, scaled to 46m 36s.
  const fixed = { 3: 12, 19: 15, 49: 9, 42: 160, 14: 130, 17: 155, 28: 90, 36: 40, 47: 25, 50: 10 };
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const raw = Array.from({ length: 50 }, (_, i) => fixed[i + 1] ?? Math.round(32 + rnd() * 62));
  const fixedSum = Object.values(fixed).reduce((s, v) => s + v, 0);
  const freeSum = raw.reduce((s, v, i) => s + (fixed[i + 1] != null ? 0 : v), 0);
  const k = (m3.tookSec - fixedSum) / freeSum;
  const secs = raw.map((v, i) => (fixed[i + 1] != null ? v : Math.round(v * k)));
  secs[49] += m3.tookSec - secs.reduce((s, v) => s + v, 0); // the last question absorbs rounding (it stays above 0)
  let ci = 0;
  const questions = secs.map((s, i) => {
    const n = i + 1;
    const verdict = wrongM3.has(n) ? 'wrong' : blankM3.has(n) ? 'blank' : 'right';
    return { n, verdict, sec: s, changed: Boolean(changes[n]), change: changes[n] || null, chapter: chOf[n] || rightCh[(ci++) % rightCh.length] };
  });
  const result = {
    paper: m3, questions, changes,
    pace: Math.round((m3.limitMin * 60) / m3.total), // 72 s
    missed: m3.lost,
    finding: { chapter: 'Admission of a partner', lost: mistakes.filter((m) => m.paper === 'm3' && m.ch === 'adm').reduce((s, m) => s + lostOf(m), 0), w: 3, b: 1, of: 8 },
    ledger: [
      { id: 'changed', label: 'Right, then changed', qs: [22, 31] },
      { id: 'quick', label: 'Wrong in under 20 seconds', qs: [3, 19, 49] },
      { id: 'long', label: '2 minutes or more, still lost', qs: [42, 14] },
      { id: 'other', label: 'Other wrong answers', qs: [9, 26, 29, 38, 45] },
      { id: 'blank', label: 'Opened, left blank', qs: [28, 36, 47, 50] },
    ],
  };
  result.ledger.forEach((g) => { g.marks = g.qs.reduce((s, n) => s + (blankM3.has(n) ? 5 : 6), 0); });
  const ledgerSum = result.ledger.reduce((s, g) => s + g.marks, 0);
  if (ledgerSum !== m3.lost) throw new Error(`ledger ${ledgerSum} != ${m3.lost}`);
  if (secs.reduce((s, v) => s + v, 0) !== m3.tookSec) throw new Error('times do not add up');

  // A 10-question paper (Business Studies quick practice, 8m 20s) for the replay sized to its length.
  const bqSecs = [44, 61, 38, 52, 19, 70, 47, 33, 58, 78];
  const bqVerdict = { 2: 'wrong', 5: 'wrong', 8: 'wrong' };
  const short = { paper: papers.bq, took: '8m 20s', pace: 60, questions: bqSecs.map((s, i) => ({ n: i + 1, sec: s, verdict: bqVerdict[i + 1] || 'right', changed: i + 1 === 6, change: i + 1 === 6 ? { from: 'B', to: 'A', at: '4:31', to_at: '5:02', effect: 0 } : null })) };
  if (bqSecs.reduce((s, v) => s + v, 0) !== 500) throw new Error('short paper time');

  const fmt = (s) => (s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`);
  const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  window.MM = { papers, chapters, mistakes, review, result, short, fmt, clock, lostOf };
})();
