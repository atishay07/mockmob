// The landing's Mistake Lab story: ONE illustrative 10-question Accountancy session, told in four
// scenes (time per question, every answer change, the repair, the SWOT). It is the same session as
// the interactive replay further down the page (MistakeLab.jsx): same verdicts, same 22 marks, same
// three changes netting -6. Every figure below is derived here from the rows, never typed twice, so
// the scenes cannot disagree with each other. The page labels all of it as an illustrative example.

export const MARK = Object.freeze({ right: 5, wrong: -1, blank: 0 });
// CUET UG: 50 questions in 60 minutes, so the paper's pace is 72 seconds a question.
export const PAPER_PACE_SEC = 72;

const row = (n, verdict, sec, chapter, change = null) => Object.freeze({ n, verdict, sec, chapter, change });
// change: first pick and its clock time, the final pick and its clock time (seconds from the start).
export const SESSION = Object.freeze([
  row(1, 'right', 48, 'Ratios'),
  row(2, 'right', 55, 'Ratios'),
  row(3, 'wrong', 80, 'Partnership'),
  row(4, 'wrong', 198, 'Partnership', { from: 'B', fromVerdict: 'right', at: 225, to: 'D', toAt: 860 }),
  row(5, 'right', 62, 'Ratios'),
  row(6, 'blank', 20, 'Cash flow'),
  row(7, 'right', 192, 'Partnership'),
  row(8, 'wrong', 161, 'Partnership', { from: 'A', fromVerdict: 'right', at: 550, to: 'C', toAt: 898 }),
  row(9, 'right', 110, 'Cash flow', { from: 'D', fromVerdict: 'wrong', at: 662, to: 'B', toAt: 750 }),
  row(10, 'blank', 10, 'Cash flow'),
]);

export const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
export const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

const sum = (list, pick) => list.reduce((total, item) => total + pick(item), 0);

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

// Every answer change, in clock order, with the marks it won or cost.
export function answerChanges(session = SESSION) {
  return session
    .filter((r) => r.change)
    .map((r) => {
      const before = MARK[r.change.fromVerdict];
      const after = MARK[r.verdict];
      return Object.freeze({ n: r.n, from: r.change.from, to: r.change.to, at: clock(r.change.at), toAt: clock(r.change.toAt), atSec: r.change.at, toAtSec: r.change.toAt, net: after - before });
    })
    .sort((a, b) => a.toAtSec - b.toAtSec);
}

export function chapterRecord(chapter, session = SESSION) {
  const rows = session.filter((r) => r.chapter === chapter);
  return Object.freeze({ chapter, right: rows.filter((r) => r.verdict === 'right').length, of: rows.length, blank: rows.filter((r) => r.verdict === 'blank').length });
}

// The four scenes' numbers, ready to print.
export function labStory(session = SESSION) {
  const facts = sessionFacts(session);
  const changes = answerChanges(session);
  const net = sum(changes, (c) => c.net);
  const lost = changes.filter((c) => c.net < 0);
  const partnership = chapterRecord('Partnership', session);
  const ratios = chapterRecord('Ratios', session);
  return Object.freeze({
    facts,
    pace: clock(PAPER_PACE_SEC),
    paceShare: Math.min(1, PAPER_PACE_SEC / Math.max(...session.map((r) => r.sec))),
    median: clock(facts.medianSec),
    total: clock(facts.totalSec),
    rightTime: clock(facts.rightSec),
    wrongTime: clock(facts.wrongSec),
    longest: longestQuestions(session),
    changes,
    net,
    lostToChanges: sum(lost, (c) => c.net),
    lostQuestions: lost.map((c) => c.n),
    partnership,
    ratios,
    blankMarks: facts.blank * MARK.right,
    blanks: session.filter((r) => r.verdict === 'blank').map((r) => Object.freeze({ n: r.n, chapter: r.chapter })),
  });
}

// The repair scene: Q4 of the session (picked B, the key, then changed to D). Indian Partnership
// Act 1932, s.13(d): without a deed, a partner's loan or advance earns 6% a year; capital earns none.
export const REPAIR = Object.freeze({
  n: 4,
  stem: 'With no partnership deed, a partner lends the firm ₹50,000. What interest does the loan earn?',
  options: Object.freeze([['A', '12% a year'], ['B', '6% a year'], ['C', 'The bank rate'], ['D', 'None, like capital']]),
  picked: 'D',
  key: 'B',
  blocks: Object.freeze([
    Object.freeze({ kind: 'trap', label: 'Why D looked right', text: 'With no deed, capital earns no interest. A loan from the same partner feels like the same money.' }),
    Object.freeze({ kind: 'wrong', label: 'Where it breaks', text: 'A partner’s loan is not capital. Under the Partnership Act it earns 6% a year on its own.' }),
    Object.freeze({ kind: 'right', label: 'Why B is right', text: 'With no deed, a partner’s loan earns 6% a year, whatever the firm’s profit.' }),
  ]),
});
