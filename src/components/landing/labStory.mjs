// The landing's Mistake Lab story: ONE illustrative 10-question Accountancy session, told in four
// scenes (time per question, every answer change, the repair, the SWOT) and replayed step by step in
// the interactive replay further down the page (MistakeLab.jsx imports SESSION from here). Same
// verdicts, same 22 marks, same three changes netting -6, same clock times everywhere. Every figure
// below is derived here from the rows, never typed twice, so no scene can disagree with another.
// Clock times count from the start of the paper, as they do in the product. The times are a real
// student's: most questions take 0:35 to 2:10, one runs past three minutes, and no change comes
// more than about three minutes after the pick it replaces.

export const MARK = Object.freeze({ right: 5, wrong: -1, blank: 0 });
// What a lost question cost: 6 for a wrong answer (5 not earned and 1 penalty), 5 for a blank.
export const GAP = Object.freeze({ wrong: 6, blank: 5 });
// CUET UG: 50 questions in 60 minutes, so the paper's pace is 72 seconds a question.
export const PAPER_PACE_SEC = 72;

const row = (n, verdict, sec, chapter, change = null) => Object.freeze({ n, verdict, sec, chapter, change });
// change: first pick and its clock time, the final pick and its clock time (seconds from the start).
export const SESSION = Object.freeze([
  row(1, 'right', 48, 'Ratios'),
  row(2, 'right', 55, 'Ratios'),
  row(3, 'wrong', 108, 'Partnership'),
  row(4, 'wrong', 200, 'Partnership', { from: 'B', fromVerdict: 'right', at: 225, to: 'D', toAt: 410 }),
  row(5, 'right', 62, 'Ratios'),
  row(6, 'blank', 41, 'Cash flow'),
  row(7, 'right', 130, 'Partnership'),
  row(8, 'wrong', 125, 'Partnership', { from: 'A', fromVerdict: 'right', at: 700, to: 'C', toAt: 880 }),
  row(9, 'right', 95, 'Cash flow', { from: 'D', fromVerdict: 'wrong', at: 784, to: 'B', toAt: 850 }),
  row(10, 'blank', 35, 'Cash flow'),
]);

// The SWOT also reads the record before this mock: the two earlier Accountancy mocks, oldest first.
// Partnership: 1 right of 3 in each earlier paper, so 2 wrong answers and 12 marks lost in each.
export const EARLIER = Object.freeze({
  papers: 2,
  partnershipLost: Object.freeze([12, 12]),
  answered: Object.freeze({ Partnership: Object.freeze({ right: 2, of: 6 }), Ratios: Object.freeze({ right: 11, of: 12 }), 'Cash flow': Object.freeze({ right: 8, of: 13 }) }),
});

// The same student's other papers, for the tour's Weak chapters screen (one chapter each; the Accountancy rows
// come from SESSION and EARLIER above, so the tour and the Mistake Lab print the same counts).
export const OTHER_CHAPTERS = Object.freeze([
  Object.freeze({ chapter: 'Money and banking', subject: 'Economics', right: 11, of: 21 }),
  Object.freeze({ chapter: 'Reading passages', subject: 'English', right: 14, of: 23 }),
  Object.freeze({ chapter: 'Business environment', subject: 'Business Studies', right: 13, of: 19 }),
]);

export const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
export const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0] ?? '');

const sum = (items, pick) => items.reduce((total, item) => total + pick(item), 0);

export function sessionFacts(session = SESSION) {
  const count = (v) => session.filter((r) => r.verdict === v).length;
  const right = count('right');
  const wrong = count('wrong');
  const blank = count('blank');
  const marks = sum(session, (r) => MARK[r.verdict]);
  const totalSec = sum(session, (r) => r.sec);
  const sorted = session.map((r) => r.sec).sort((a, b) => a - b);
  const mid = sorted.length / 2;
  const medianSec = sorted.length % 2 ? sorted[Math.floor(mid)] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  const secFor = (v) => sum(session.filter((r) => r.verdict === v), (r) => r.sec);
  return Object.freeze({ right, wrong, blank, marks, outOf: session.length * MARK.right, totalSec, medianSec, rightSec: secFor('right'), wrongSec: secFor('wrong') });
}

// Where the time went: the five longest questions against the paper's pace.
export function longestQuestions(session = SESSION, limit = 5) {
  const max = Math.max(...session.map((r) => r.sec));
  return session
    .filter((r) => r.verdict !== 'blank')
    .sort((a, b) => b.sec - a.sec)
    .slice(0, limit)
    .map((r) => Object.freeze({ n: r.n, verdict: r.verdict, time: clock(r.sec), share: r.sec / max, pace: Math.round((r.sec / PAPER_PACE_SEC) * 10) / 10 }));
}

// The Time scene: every question in paper order against the pace line. `base` is the bar up to the
// pace (or the whole bar when it finished inside it), `over` the time past the pace, both as shares
// of the longest question. band: under (inside the pace), over (past it) or blank.
export function paceRows(session = SESSION) {
  const max = Math.max(...session.map((r) => r.sec));
  return session.map((r) => {
    const overSec = r.sec - PAPER_PACE_SEC;
    const band = r.verdict === 'blank' ? 'blank' : overSec > 0 ? 'over' : 'under';
    return Object.freeze({
      n: r.n, verdict: r.verdict, sec: r.sec, time: clock(r.sec), band,
      delta: clock(Math.abs(overSec)), deltaSec: overSec,
      base: Math.min(r.sec, PAPER_PACE_SEC) / max, over: Math.max(0, overSec) / max,
    });
  });
}

// Every answer change, in clock order, with the marks it won or cost.
export function answerChanges(session = SESSION) {
  return session
    .filter((r) => r.change)
    .map((r) => {
      const before = MARK[r.change.fromVerdict];
      const after = MARK[r.verdict];
      return Object.freeze({
        n: r.n, from: r.change.from, to: r.change.to, fromVerdict: r.change.fromVerdict, toVerdict: r.verdict,
        at: clock(r.change.at), toAt: clock(r.change.toAt), atSec: r.change.at, toAtSec: r.change.toAt,
        gap: clock(r.change.toAt - r.change.at), net: after - before,
      });
    })
    .sort((a, b) => a.toAtSec - b.toAtSec);
}

export function chapterRecord(chapter, session = SESSION) {
  const rows = session.filter((r) => r.chapter === chapter);
  const lost = sum(rows, (r) => (r.verdict === 'wrong' ? GAP.wrong : r.verdict === 'blank' ? GAP.blank : 0));
  return Object.freeze({ chapter, right: rows.filter((r) => r.verdict === 'right').length, of: rows.length, answered: rows.filter((r) => r.verdict !== 'blank').length, blank: rows.filter((r) => r.verdict === 'blank').length, lost, qs: rows.filter((r) => r.verdict !== 'right').map((r) => r.n) });
}

// The Mistake Lab ledger of this session, in the product's groups and words (data/mistake_lab.copy.json):
// every lost question sits in one group, so the groups add up to the marks missed.
export function marksLedger(session = SESSION) {
  const lostRows = session.filter((r) => r.verdict !== 'right');
  const changedFromRight = lostRows.filter((r) => r.verdict === 'wrong' && r.change?.fromVerdict === 'right');
  const otherWrong = lostRows.filter((r) => r.verdict === 'wrong' && !changedFromRight.includes(r));
  const blanks = lostRows.filter((r) => r.verdict === 'blank');
  const group = (id, label, rows, gap) => Object.freeze({ id, label, marks: rows.length * gap, count: rows.length, qs: rows.map((r) => r.n), line: `${rows.length * gap} marks on ${plural(rows.length, 'question')}` });
  const groups = [
    group('changed_from_right', 'Right, then changed', changedFromRight, GAP.wrong),
    group('other_wrong', 'Other wrong answers', otherWrong, GAP.wrong),
    group('other_blank', 'Opened, left blank', blanks, GAP.blank),
  ].filter((g) => g.count > 0);
  const gap = sum(groups, (g) => g.marks);
  const top = groups[0];
  return Object.freeze({
    gap,
    groups: Object.freeze(groups),
    heading: `You missed ${gap} marks. Here’s where they went.`,
    headline: `${plural(top.count, 'answer was', 'answers were')} right until you changed ${top.count === 1 ? 'it' : 'them'}. That cost ${top.marks} of the ${gap} marks you missed.`,
    doLine: 'Change an answer only when you can point to the line that proves it wrong.',
  });
}

// The SWOT and "Do these next", in the product's words (data/mock_swot.js), from this mock and EARLIER.
function swotRead(session, changes) {
  const partnership = chapterRecord('Partnership', session);
  const record = (chapter) => {
    const paper = chapterRecord(chapter, session);
    const before = EARLIER.answered[chapter];
    return { paper, right: before.right + paper.right, of: before.of + paper.answered, papers: EARLIER.papers + 1 };
  };
  const ratios = record('Ratios');
  const cash = record('Cash flow');
  const lost = [...EARLIER.partnershipLost, partnership.lost];
  const turned = changes.filter((c) => c.fromVerdict === 'right' && c.toVerdict === 'wrong');
  const move = nextMove(session);
  const plan = [
    { label: move.label, reason: move.reason },
    { label: 'Practise 10 on Cash flow', reason: `${cash.right} right of ${cash.of} so far. ${cash.paper.lost} marks lost here in this paper.` },
  ];
  // line, figure and unit are the phone's short form of title and detail: one strong line and its count.
  const quadrants = [
    { id: 'strength', label: 'Strengths', title: 'Ratios', detail: `${ratios.right} right of ${ratios.of} across ${ratios.papers} papers, ${ratios.paper.right} of ${ratios.paper.of} in this one.`, qs: [], line: 'Ratios', figure: `${ratios.right} of ${ratios.of}`, unit: `right in ${ratios.papers} papers` },
    { id: 'weakness', label: 'Weaknesses', title: 'Right answers changed to wrong', detail: `${turned.length} answers were right before you changed them. Those changes cost ${turned.length * GAP.wrong} marks.`, qs: turned.map((c) => c.n).sort((a, b) => a - b), line: 'Right, then changed', figure: plural(turned.length, 'answer'), unit: `cost ${turned.length * GAP.wrong} marks` },
    { id: 'opportunity', label: 'Opportunities', title: 'Cash flow', detail: `${cash.right} right of ${cash.of} across ${cash.papers} papers. ${cash.paper.lost} marks lost here in this paper.`, qs: [], line: 'Cash flow', figure: `${cash.right} of ${cash.of}`, unit: `right in ${cash.papers} papers` },
    { id: 'threat', label: 'Threats', title: `Partnership in each of your last ${lost.length} mocks`, detail: `Marks lost here: ${list(lost.map(String))}, oldest first.`, qs: partnership.qs, line: 'Partnership', figure: `${lost.length} of ${lost.length}`, unit: 'mocks lost marks' },
  ];
  return { plan, quadrants, partnershipLost: lost };
}

// A chapter's record across the three Accountancy papers: this one and EARLIER.
export function chapterAcross(chapter, session = SESSION) {
  const paper = chapterRecord(chapter, session);
  const before = EARLIER.answered[chapter] ?? { right: 0, of: 0 };
  return Object.freeze({ chapter, subject: 'Accountancy', right: before.right + paper.right, of: before.of + paper.answered, papers: EARLIER.papers + 1, paper });
}

// The tour's Weak chapters screen: the Accountancy chapters of this record and the same student's other papers,
// weakest first.
export function weakChapters(session = SESSION) {
  const accountancy = ['Partnership', 'Cash flow', 'Ratios'].map((c) => chapterAcross(c, session));
  return Object.freeze([...accountancy, ...OTHER_CHAPTERS].map((r) => Object.freeze({ chapter: r.chapter, subject: r.subject, right: r.right, of: r.of })).sort((a, b) => a.right / a.of - b.right / b.of));
}

// The ONE next move this sample student is given, worded the same wherever the page shows it (the Lab's SWOT,
// the tour's Ask Mobi reply and the Score Recovery Lab's plan): the first set of "Do these next", the evidence
// behind it, and the rule to practise it with.
export function nextMove(session = SESSION) {
  const lost = [...EARLIER.partnershipLost, chapterRecord('Partnership', session).lost];
  const record = chapterAcross('Partnership', session);
  return Object.freeze({
    label: 'Practise 10 on Partnership',
    chapter: 'Partnership',
    count: 10,
    lost: Object.freeze(lost),
    record,
    reason: `Marks lost here in each of your last ${lost.length} mocks.`,
    why: `You lost marks on Partnership in each of your last ${lost.length} mocks: ${list(lost.map(String))}, oldest first.`,
    rule: marksLedger(session).doLine,
  });
}

// When each question was opened, on the paper's clock: the questions run in order, each after the one before.
export function openedAt(n, session = SESSION) {
  return sum(session.filter((r) => r.n < n), (r) => r.sec);
}

// The four scenes' numbers, ready to print.
export function labStory(session = SESSION) {
  const facts = sessionFacts(session);
  const changes = answerChanges(session);
  const net = sum(changes, (c) => c.net);
  const lost = changes.filter((c) => c.net < 0);
  const gained = changes.filter((c) => c.net > 0);
  const partnership = chapterRecord('Partnership', session);
  const ratios = chapterRecord('Ratios', session);
  const rows = paceRows(session);
  const answered = rows.filter((r) => r.band !== 'blank');
  const overWrong = answered.filter((r) => r.band === 'over' && r.verdict === 'wrong');
  const under = answered.filter((r) => r.band === 'under');
  const swot = swotRead(session, changes);
  return Object.freeze({
    facts,
    pace: clock(PAPER_PACE_SEC),
    paceShare: Math.min(1, PAPER_PACE_SEC / Math.max(...session.map((r) => r.sec))),
    median: clock(facts.medianSec),
    total: clock(facts.totalSec),
    rightTime: clock(facts.rightSec),
    wrongTime: clock(facts.wrongSec),
    longest: longestQuestions(session),
    rows,
    time: Object.freeze({
      overCount: answered.filter((r) => r.band === 'over').length,
      wrongAllOver: overWrong.length === facts.wrong,
      overWrongTime: clock(sum(overWrong, (r) => r.deltaSec)),
      underCount: under.length,
      underAllRight: under.length > 0 && under.every((r) => r.verdict === 'right'),
    }),
    changes,
    net,
    gainedMarks: sum(gained, (c) => c.net),
    gainedCount: gained.length,
    lostToChanges: sum(lost, (c) => c.net),
    lostQuestions: lost.map((c) => c.n),
    firstAnswers: facts.marks - net,
    ledger: marksLedger(session),
    partnership,
    ratios,
    blankMarks: facts.blank * GAP.blank,
    blanks: session.filter((r) => r.verdict === 'blank').map((r) => Object.freeze({ n: r.n, chapter: r.chapter })),
    swot,
  });
}

// The repair scene: Q4 of the session (picked B, the key, then changed to D), laid out as Repair v3
// shows it (data/repair_presentation.mjs): the trap's name, "Explained from the answer key", why the
// pick looked right, where it breaks, why the key is right, the rule to keep and the record line.
// Indian Partnership Act 1932, s.13(c) and (d): with no deed, capital earns no interest and a
// partner's loan or advance earns 6% a year.
export const REPAIR = Object.freeze({
  n: 4,
  chapter: 'Partnership',
  trap: 'The wrong rule applied',
  stem: 'With no partnership deed, a partner lends the firm ₹50,000. What interest does the loan earn?',
  // The phone's short form of the stem, and one line for each block the phone shows first (the full text
  // sits behind a tap there).
  stemShort: 'No deed. A partner lends the firm ₹50,000. What interest does the loan earn?',
  options: Object.freeze([['A', '12% a year'], ['B', '6% a year'], ['C', 'The bank rate'], ['D', 'None, like capital']]),
  picked: 'D',
  key: 'B',
  blocks: Object.freeze([
    Object.freeze({ kind: 'trap', label: 'Why D looked right', short: 'A partner’s loan feels like capital.', text: 'With no deed, capital earns no interest, and a loan from a partner feels like more capital.' }),
    Object.freeze({ kind: 'wrong', label: 'Where it breaks', short: null, text: 'The no-interest rule covers capital only. A loan is money the firm owes the partner.' }),
    Object.freeze({ kind: 'right', label: 'Why B is right', short: 'With no deed, a loan earns 6% a year.', text: 'Section 13(d): with no deed, a partner’s loan earns 6% a year, whatever the profit.' }),
    Object.freeze({ kind: 'rule', label: 'Keep this', short: 'Capital earns nothing. A loan earns 6%.', text: 'No deed: capital earns nothing, a partner’s loan earns 6%.' }),
  ]),
});

// "From your record" under the repair: the product's own sentence about this question's picks.
export const repairRecordLine = (session = SESSION) => {
  const q = session.find((r) => r.n === REPAIR.n);
  return q?.change ? `You first chose ${q.change.from} here, then changed to ${q.change.to}.` : null;
};
