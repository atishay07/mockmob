'use client';

// The Mistake Lab's five screens in the "next" look (owner, 20 Nov 2026 night: "the mistake lab approach was better ...
// You just had to redo the screens", and LK363: "they have a cursor which is updating the screen live ... using actual
// screens and actual UI, because we are showing people how to use it"). LabCinema renders these only for look="next";
// the live home keeps its own panels. Each screen is the result page's own UI, fed with labStory.mjs's one sample
// Accountancy mock (never a typed figure), and a cursor (CursorDemo) works it when its scene comes on stage:
//   Chapters  the real MarksLedger (src/components/result/MarksLedger.jsx): the cursor opens the costliest chapter's row
//             and its lost questions show under it. Under the rows, the folded head of "Across your mocks" says the
//             chapter cost marks in the two mocks before this one too.
//   Time      "Where your time went" (TimeDecisions' rows, time-decisions.css copied into lab-next.css): the cursor taps the slowest question,
//             its verdict and how many times the paper's pace it took show.
//   Changes   "Every answer you changed" (the same sheet, TIME_COPY's own sentences): the cursor taps the first change, its
//             first pick and final pick show with the marks it cost. The wide device adds the ledger's re-mark line
//             ("First picks: 28 of 50. Final answers: 22 of 50.").
//   Repair    a mistake row and the repair's own start key (MistakeRepair.jsx, mistake-repair.css): the cursor taps
//             "Repair Q4" and the finished repair shows (why D looked right, why B is right, the rule to keep).
//   SWOT      "After this mock" (SwotPanel's words and swot.css): the cursor taps the "Watch" group and its line shows.
// Each screen holds one headline line and at most four rows. Its state is a real control's state, so a reader's own tap
// works the same and takes over from the cursor. Reduced motion, or a story that is not held: no cursor, the finished
// state shows, the controls still work by hand. Only transform and opacity move; no layout read but CursorDemo's one per step.
import { useState } from 'react';
import { ArrowRight, Check, KeyRound, Wrench, X } from 'lucide-react';
import CursorDemo from './demo/CursorDemo';
import MarksLedger, { withNumbers } from '@/components/result/MarksLedger';
import { SWOT_UI_COPY } from '@/components/result/SwotPanel';
import { TIME_COPY, signedMarks } from '@/../data/time_decisions';
import { REPAIR_COPY, checkChip } from '@/../data/repair_presentation.mjs';
import { FIX_COPY } from '@/components/recovery/fixForGood.mjs';
import { labStory, longestQuestions, GAP, REPAIR } from './labStory.mjs';
import '@/components/recovery/mistake-repair.css';
import './lab-next.css';

const S = labStory();
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
// labStory says right / wrong / blank; the result page's time rows say correct / wrong / skipped.
const TIME_VERDICT = { right: 'correct', wrong: 'wrong', blank: 'skipped' };

// ---------- 0. Chapters: the real ledger, one group a chapter ----------
// The groups are the chapters that lost marks, worst first (labStory chapterLedger). The headline and each row's line are the
// result page's own sentences: "Partnership cost 18 of the 28 marks you missed." (data/result_next_move.mjs costliestLine)
// and "18 marks on 3 questions" (the ledger's group line); the opened row says the chapter's count the way the result's
// finding does ("In Partnership: 3 wrong of its 4 questions.") and lists its lost questions as the ledger's Q chips.
const slug = (chapter) => `ch-${chapter.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
function chapterDetail(c) {
  const wrong = c.misses.filter((m) => m.verdict === 'wrong').length;
  const blank = c.misses.filter((m) => m.verdict === 'blank').length;
  const parts = [wrong ? `${wrong} wrong` : null, blank ? `${blank} left blank` : null].filter(Boolean).join(' and ');
  return `In ${c.chapter}: ${parts} of its ${plural(c.of, 'question')}.`;
}
const LOST_CHAPTERS = S.chapters.filter((c) => c.lost > 0);
const TOP = LOST_CHAPTERS[0];
function chapterLab(openFirst) {
  return {
    state: 'ready',
    barLabel: 'Where the marks went, by chapter',
    headline: { group: slug(TOP.chapter), text: TOP.lost === S.lostMarks ? `${TOP.chapter} cost all ${S.lostMarks} marks you missed.` : `${TOP.chapter} cost ${TOP.lost} of the ${S.lostMarks} marks you missed.` },
    groups: LOST_CHAPTERS.map((c, i) => ({
      id: slug(c.chapter), label: c.chapter, marks: c.lost, count: c.misses.length, numbers: c.misses.map((m) => m.n),
      line: `${c.lost} marks on ${plural(c.misses.length, 'question')}`, doLine: chapterDetail(c), open: openFirst && i === 0,
    })),
  };
}
const NO_JUMP = () => {};
// The proof that the chapter is a habit, not one bad paper: labStory's earlierLine, in the folded head of the result page's
// "Across your mocks" (AcrossMocks.jsx: its title, and its first line as the teaser), so it shows without opening anything.
function ChaptersScreen({ still }) {
  return (
    <div className="lnx lnx--chapters">
      <p className="lnx-h">Where your marks went</p>
      <MarksLedger lab={chapterLab(still)} attemptId={null} onJump={NO_JUMP} />
      {S.earlierLine ? (
        <div className="am lnx-across" data-surface="inset">
          <p className="am-head__title">Across your mocks</p>
          <p className="am-head__teaser">{withNumbers(S.earlierLine)}</p>
        </div>
      ) : null}
    </div>
  );
}

// ---------- 1. Time: the slowest questions against the paper's pace ----------
// TimeDecisions' "Where your time went" rows: the bar in the verdict's colour, the paper's pace as the mark on it, the time.
// A tapped row shows what the result page prints under it: the verdict and how many times the paper's pace it took. Every
// answered question, slowest first (labStory longestQuestions); the device shows as many as fit at full size (lab-next.css:
// 4 on a small phone, 6 on a phone, all 8 on the wide device). The pace mark is labelled, and one line says what the bar
// colours mean in the result page's words.
const SLOWEST = longestQuestions(undefined, 8);
const SLOW_MAX = S.rows.reduce((m, r) => Math.max(m, r.sec), 1);
function TimeScreen({ still }) {
  const [open, setOpen] = useState(still ? SLOWEST[0].n : null);
  return (
    <div className="lnx lnx--time">
      <p className="lnx-h">{TIME_COPY.longestTitle}</p>
      <p className="td-lead">The paper gives {S.pace} a question. Your median was {S.median}.</p>
      <div className="lnx-pace" aria-hidden="true"><span className="lnx-pace__track"><b style={{ left: `${S.paceShare * 100}%` }}>Pace {S.pace}</b></span></div>
      <ol className="td-long">
        {SLOWEST.map((l, i) => {
          const sec = S.rows.find((r) => r.n === l.n).sec;
          const verdict = TIME_VERDICT[l.verdict];
          const on = open === l.n;
          return (
            <li key={l.n} style={{ '--i': i }}>
              <button type="button" className="td-long__row" aria-expanded={on} data-open={on || undefined} onClick={() => setOpen(on ? null : l.n)}>
                <span className="td-long__q">Q{l.n}</span>
                <span className="td-long__track" aria-hidden="true">
                  <span className="td-long__fill" data-verdict={verdict} style={{ width: `${Math.max(2, (sec / SLOW_MAX) * 100)}%` }} />
                  <span className="td-long__pace" style={{ left: `${S.paceShare * 100}%` }} />
                </span>
                <span className="td-long__time">{l.time}</span>
                <span className="td-long__meta">
                  <span data-verdict={verdict}>{TIME_COPY.verdict[verdict]}</span>
                  <span>{TIME_COPY.longestRatio(l.pace)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="lnx-key"><span><i data-verdict="correct" />{TIME_COPY.verdict.correct}</span><span><i data-verdict="wrong" />{TIME_COPY.verdict.wrong}</span></p>
    </div>
  );
}

// ---------- 2. Changes: every answer changed, on the clock ----------
// TIME_COPY's own sentences ("Picked B at 5:08. Changed to D at 6:00, 0:52 later.") and the marks each change won or cost. A
// tapped row opens its two picks, first then final, with their verdicts and TIME_COPY's line on what the change did.
const VERDICT_WORD = { right: 'Right', wrong: 'Wrong', blank: 'Blank' };
// data/mistake_lab.copy.json remark.scores ("First picks: {first} of {max}. Final answers: {final} of {max}{held}."), filled
// from labStory: the first answers' total and the final one. lab_next_1121.test.mjs holds it to the JSON's template.
const FIRST_SCORES = `First picks: ${S.firstAnswers} of ${S.facts.outOf}. Final answers: ${S.facts.marks} of ${S.facts.outOf}.`;
function PickChip({ letter, verdict, label }) {
  return (
    <span className="lnx-pick" data-verdict={verdict}>
      <i>{letter}{verdict === 'right' ? <Check size={10} strokeWidth={3.2} aria-hidden="true" /> : <X size={10} strokeWidth={3.2} aria-hidden="true" />}</i>
      <span><small>{label}</small>{VERDICT_WORD[verdict]}</span>
    </span>
  );
}
function ChangesScreen({ still }) {
  const [open, setOpen] = useState(still ? S.changes[0].n : null);
  return (
    <div className="lnx lnx--changes">
      <p className="lnx-h">{TIME_COPY.changesTitle}</p>
      <p className="td-lead">{TIME_COPY.changesLead(S.changes.length, S.changes.length, S.net)}</p>
      {/* The totals, as the result page sums the changes (TimeDecisions' parts: TIME_COPY.changesGained / changesCost), with
          the net beside them. */}
      <div className="lnx-sum">
        <p data-tone="good"><b>{signedMarks(S.gainedMarks)}</b>{TIME_COPY.changesGained(S.gainedCount, S.gainedMarks)}</p>
        <p data-tone="bad"><b>{signedMarks(S.lostToChanges)}</b>{TIME_COPY.changesCost(S.lostQuestions.length, -S.lostToChanges)}</p>
        <p data-tone={S.net < 0 ? 'bad' : 'good'} data-net=""><b>= {signedMarks(S.net)}</b>Net effect on your marks</p>
      </div>
      <ol className="td-changes">
        {S.changes.map((c, i) => {
          const on = open === c.n;
          return (
            <li key={c.n} style={{ '--i': i }} data-open={on || undefined}>
              <button type="button" className="td-changes__row" aria-expanded={on} onClick={() => setOpen(on ? null : c.n)}>
                <span className="td-changes__q">Q{c.n}</span>
                <span className="td-changes__text">{TIME_COPY.first(c.from, c.at)} {TIME_COPY.changed(c.to, c.toAt, c.gap)}</span>
                <b className="td-changes__net" data-tone={c.net > 0 ? 'good' : c.net < 0 ? 'bad' : 'neutral'}>{signedMarks(c.net)}</b>
              </button>
              {/* The first change's picks keep their room even while closed (the cursor opens that one), so opening it moves
                  nothing; another change opens only on a reader's own tap. */}
              {on || i === 0 ? (
                <div className="lnx-picks" data-shown={on || undefined} aria-hidden={on ? undefined : true}>
                  <span className="lnx-picks__row">
                    <PickChip letter={c.from} verdict={c.fromVerdict} label={`First pick, ${c.at}`} />
                    <ArrowRight className="lnx-picks__arrow" size={16} strokeWidth={2.4} aria-hidden="true" />
                    <PickChip letter={c.to} verdict={c.toVerdict} label={`Final pick, ${c.toAt}`} />
                  </span>
                  <p className="lnx-picks__effect" data-tone={c.net < 0 ? 'bad' : 'good'}>{TIME_COPY.effectOne(c.net)}</p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {/* Wide device only (lab-next.css): the ledger's re-mark line, in its own words (data/mistake_lab.copy.json remark.scores). */}
      <p className="lnx-first">{withNumbers(FIRST_SCORES)}</p>
    </div>
  );
}

// ---------- 3. Repair: the mistake's row, the repair's start key, then the repair ----------
// The row is the result's mistake row (picks as "yours" and "answer", the marks it cost). The key is MistakeRepair's own
// start ("Repair Q4", FIX_COPY's line and price). The finished repair is Repair v3's layout in its own words (REPAIR_COPY):
// the trap as its heading, "Explained from the answer key (B).", why D looked right, why B is right, and the rule to keep.
const REPAIR_BLOCK = Object.fromEntries(REPAIR.blocks.map((b) => [b.kind, b]));
function RepairScreen({ still }) {
  const [done, setDone] = useState(still);
  return (
    <div className="lnx lnx--repair">
      <p className="lnx-h">Your mistakes</p>
      <div className="lnx-mistake" data-verdict="wrong">
        <span className="rx-row__n" aria-hidden="true">{REPAIR.n}</span>
        <span className="rx-row__main">
          <span className="rx-row__ch"><span className="sr-only">Question {REPAIR.n}, </span>{REPAIR.chapter}</span>
          <span className="rx-row__stem">{REPAIR.stem}</span>
          <span className="rx-row__facts">
            <span className="rx-pick" data-kind="mine"><i>{REPAIR.picked}</i>yours</span>
            <span className="rx-pick" data-kind="key"><i>{REPAIR.key}</i>answer</span>
          </span>
        </span>
        <span className="rx-row__cost">{signedMarks(-GAP.wrong)}</span>
      </div>
      {done ? (
        <section className="mr mr--panel mr--done" data-fresh={still ? undefined : ''} aria-label="Mistake Repair">
          <header className="mr-head" data-stagger style={{ '--mr-i': 0 }}>
            <div className="mr-head__text">
              <p className="mr-title">{REPAIR.trap}</p>
              <span className="mr-check"><KeyRound size={14} strokeWidth={2.4} aria-hidden="true" />{checkChip(REPAIR.key)}</span>
            </div>
          </header>
          <div className="mr-block" data-stagger style={{ '--mr-i': 1 }}><p className="mr-label">{REPAIR_COPY.whyLooked(REPAIR.picked)}</p><p>{REPAIR_BLOCK.trap.text}</p></div>
          <div className="mr-block" data-stagger style={{ '--mr-i': 2 }}><p className="mr-label">{REPAIR_COPY.whyRight(REPAIR.key)}</p><p>{REPAIR_BLOCK.right.text}</p></div>
          <div className="mr-rule" data-stagger style={{ '--mr-i': 3 }}>
            <div className="mr-rule__head"><span>{REPAIR_COPY.keepThis}</span></div>
            <p>{REPAIR_BLOCK.rule.text}</p>
          </div>
        </section>
      ) : (
        <button type="button" className="mr-start" onClick={() => setDone(true)}>
          <span className="mr-start__icon" aria-hidden="true"><Wrench size={18} strokeWidth={2.4} /></span>
          <span className="mr-start__text"><b>{FIX_COPY.startTitle(REPAIR.n)}</b><small>{FIX_COPY.startLine(REPAIR.picked)}</small></span>
          <span className="mr-start__cost">{FIX_COPY.price}</span>
        </button>
      )}
    </div>
  );
}

// ---------- 4. SWOT: "After this mock" ----------
// SwotPanel's words: "Do these next" with the plan's first set, then the four groups under the plain headings the result
// page uses inside "After this mock" (SwotPanel PLAIN, in its order). A tapped group shows its line and its questions.
const PLAIN = { weakness: 'Costing you', strength: 'Working', opportunity: 'Room to grow', threat: 'Watch' };
const PLAIN_ORDER = ['weakness', 'strength', 'opportunity', 'threat'];
const QUADS = [...S.swot.quadrants].sort((a, b) => PLAIN_ORDER.indexOf(a.id) - PLAIN_ORDER.indexOf(b.id));
const FIRST = S.swot.plan[0];
function SwotScreen({ still }) {
  const [open, setOpen] = useState(still ? 'threat' : null);
  return (
    <div className="lnx lnx--swot sw" data-in-fold="">
      <p className="lnx-h">{SWOT_UI_COPY.title}</p>
      <div className="sw-block">
        <p className="sw-h3">{SWOT_UI_COPY.next}</p>
        <ol className="sw-plan">
          <li className="sw-plan__row" data-first="">
            <span className="sw-plan__n" aria-hidden="true">1</span>
            <div className="sw-plan__text">
              <p className="sw-plan__label">{FIRST.label}</p>
              <p className="sw-plan__reason">{FIRST.reason}</p>
            </div>
          </li>
        </ol>
      </div>
      <p className="sw-h3 lnx-swot-h">{SWOT_UI_COPY.swot}</p>
      <div className="lnx-quads">
        {QUADS.map((q) => {
          const on = open === q.id;
          return (
            <section key={q.id} className="sw-q" data-q={q.id} data-open={on || undefined}>
              <button type="button" className="lnx-quad" aria-expanded={on} onClick={() => setOpen(on ? null : q.id)}>
                <span className="sw-q__h">{PLAIN[q.id]}</span>
                <span className="sw-item__title">{q.title}</span>
              </button>
              {on ? <p className="sw-item__detail">{q.detail}</p> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ---------- The cursor's scripts (CursorDemo steps: each clicks the screen's real control) ----------
// 4 to 7 s each. A selector that finds nothing is skipped, so a screen that changes never strands the cursor.
const SCRIPTS = Object.freeze({
  chapters: Object.freeze([
    { wait: 450 },
    { target: '.ml-row:first-child .ml-row__btn', at: [0.3, 0.5], move: 700, click: true, dwell: 700 },
    { target: '.ml-row[data-open] .ml-chip', at: [0.55, 0.55], move: 520, dwell: 1500 },
  ]),
  time: Object.freeze([
    { wait: 450 },
    { target: '.td-long li:nth-child(3) .td-long__track', at: [0.85, 0.5], move: 640, dwell: 260 },
    { target: '.td-long li:first-child .td-long__row', at: [0.62, 0.32], move: 520, click: true, dwell: 1700 },
  ]),
  changes: Object.freeze([
    { wait: 450 },
    { target: '.td-changes li:first-child .td-changes__row', at: [0.55, 0.45], move: 700, click: true, dwell: 900 },
    { target: '.lnx-picks .lnx-pick:last-of-type', at: [0.5, 0.5], move: 520, dwell: 1500 },
  ]),
  repair: Object.freeze([
    { wait: 500 },
    { target: '.mr-start', at: [0.2, 0.45], move: 720, click: true, dwell: 900 },
    { target: '.mr-rule', at: [0.6, 0.6], move: 640, dwell: 1600 },
  ]),
  swot: Object.freeze([
    { wait: 450 },
    { target: '.sw-q[data-q="threat"] .lnx-quad', at: [0.45, 0.4], move: 760, click: true, dwell: 2000 },
  ]),
});

const SCREENS = { chapters: ChaptersScreen, time: TimeScreen, changes: ChangesScreen, repair: RepairScreen, swot: SwotScreen };

/**
 * One scene's screen in the next look.
 * scene  the scene's key (LAB_SCENES)
 * live   this scene is the one on stage of a held story: the cursor plays
 * still  reduced motion, or a story that is not held: no cursor, the finished state
 * Each time the scene comes on stage the screen starts fresh (a new key), so the cursor's work plays again from the top and a
 * reader who took over once gets the cursor back next time.
 */
export default function LabNextScreen({ scene, live = false, still = false }) {
  const [entries, setEntries] = useState(0);
  const [wasLive, setWasLive] = useState(live);
  if (live !== wasLive) {
    setWasLive(live);
    if (live) setEntries((n) => n + 1);
  }
  const Screen = SCREENS[scene];
  if (!Screen) return null;
  return (
    <CursorDemo key={`${entries}${still ? '-still' : ''}`} steps={SCRIPTS[scene]} playing={live && !still} className="lnx-stage">
      <Screen still={still} />
    </CursorDemo>
  );
}
