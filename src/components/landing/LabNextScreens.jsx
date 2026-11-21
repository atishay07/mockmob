'use client';

// The Mistake Lab's five screens in the "next" look (owner, 20 Nov 2026 night: "the mistake lab approach was better ...
// You just had to redo the screens", and LK363: "they have a cursor which is updating the screen live ... using actual
// screens and actual UI, because we are showing people how to use it"). LabCinema renders these only for look="next";
// the live home keeps its own panels. Each screen is the result page's own UI, fed with labStory.mjs's one sample
// Accountancy mock (never a typed figure), and a cursor (CursorDemo) works it, two taps a scene, when its scene comes on:
//   Chapters  the real MarksLedger (src/components/result/MarksLedger.jsx): the cursor opens the costliest chapter, then taps
//             one of its lost questions to show what it was. Under it, the folded head of "Across your mocks" says the chapter
//             cost marks in the two mocks before this one too.
//   Time      "Where your time went" (TimeDecisions' rows, time-decisions.css copied into lab-next.css): the cursor taps the
//             slowest question, then the quickest one shown; each shows its verdict and its share of the paper's pace.
//   Changes   "Every answer you changed" (TIME_COPY's own sentences), its totals counting up: the cursor taps the change that
//             cost marks, then the last one shown; each shows its first pick and final pick and what the change did. The wide
//             device adds the ledger's re-mark line ("First picks: 28 of 50. Final answers: 22 of 50.").
//   Repair    a mistake row and the repair's own start key (MistakeRepair.jsx, mistake-repair.css): the cursor taps
//             "Repair Q4" and the finished repair shows (why D looked right, why B is right, the rule to keep).
//   SWOT      "After this mock" (SwotPanel's words and swot.css): the cursor taps "Costing you", then "Watch".
// LK364 (21 Nov 2026, "animations and all could be improved a bit, and interactivity could be improved"): every control looks
// like one (a chevron, a pressed state, the chosen one marked), and what a tap shows appears in a slot under the rows that
// holds the room of its tallest answer from the first frame, so a tap moves nothing (no layout shift) and the answer rises in
// (transform and opacity, 240 ms). Bars fill as a scene comes on; the Changes totals count up once. Reduced motion, or a story
// that is not held: no cursor, the finished state, the controls still work by hand. No layout read but CursorDemo's, once a step.
import { memo, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, KeyRound, Wrench, X } from 'lucide-react';
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
const reducedNow = () => {
  if (typeof window === 'undefined') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
};
/**
 * How long an arriving card takes to stand (lab-next.css: the card's 420 ms slide). A scene's reveal (its bars, its counts)
 * starts once the card stands, never while it travels (critic round, 21 Nov 2026 evening).
 */
export const LNX_IN_MS = 420;

/**
 * What a tap shows, in one place under the rows. Every answer is drawn in the same grid cell, only the chosen one visible, so
 * the slot holds the room of the tallest from the first frame and choosing another moves nothing.
 */
function Slot({ options, chosen, className = '' }) {
  return (
    <div className={`lnx-slot ${className}`.trim()} aria-live="polite">
      {options.map((o) => (
        <div key={o.id} className="lnx-slot__item" data-shown={o.id === chosen || undefined} aria-hidden={o.id === chosen ? undefined : true}>{o.node}</div>
      ))}
    </div>
  );
}

// ---------- 0. Chapters: the real ledger, one group a chapter ----------
// The groups are the chapters that lost marks, worst first (labStory chapterLedger). The headline and each row's line are the
// result page's own sentences: "Partnership cost 18 of the 28 marks you missed." (data/result_next_move.mjs costliestLine)
// and "18 marks on 3 questions" (the ledger's group line); the opened row says the chapter's count the way the result's
// finding does ("In Partnership: 3 wrong of its 4 questions.") and lists its lost questions as the ledger's Q chips. A chip
// says what that question was: wrong after its time, and the change if there was one (labStory's rows and changes).
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
const MISSED = LOST_CHAPTERS.flatMap((c) => c.misses.map((m) => m.n));
function missLine(n) {
  const row = S.rows.find((r) => r.n === n);
  const change = S.changes.find((c) => c.n === n);
  if (row.band === 'blank') return `Q${n}: left blank after ${row.time}.`;
  return `Q${n}: wrong after ${row.time}.${change ? ` You changed ${change.from} to ${change.to}.` : ''}`;
}
const CHAPTER_Q = TOP.misses[Math.min(1, TOP.misses.length - 1)].n;
// The proof that the chapter is a habit, not one bad paper: labStory's earlierLine, in the folded head of the result page's
// "Across your mocks" (AcrossMocks.jsx: its title, and its first line as the teaser), so it shows without opening anything.
function ChaptersScreen({ still }) {
  const [q, setQ] = useState(still ? CHAPTER_Q : null);
  return (
    <div className="lnx lnx--chapters">
      <p className="lnx-h">Where your marks went</p>
      <MarksLedger lab={chapterLab(still)} attemptId={null} onJump={setQ} />
      <Slot className="lnx-slot--line" chosen={q} options={MISSED.map((n) => ({ id: n, node: <p className="lnx-detail">{missLine(n)}</p> }))} />
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
// TimeDecisions' "Where your time went" rows: the bar in the verdict's colour (filling as the scene comes on), the paper's
// pace as the mark on it, the time. Every answered question, slowest first (labStory longestQuestions); the device shows as
// many as fit at full size (lab-next.css). A tapped row shows what the result page prints for it: the verdict and how many
// times the paper's pace it took.
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
              <button type="button" className="td-long__row" aria-pressed={on} data-open={on || undefined} onClick={() => setOpen(l.n)}>
                <span className="td-long__q">Q{l.n}</span>
                <span className="td-long__track" aria-hidden="true">
                  <span className="td-long__fill" data-verdict={verdict} style={{ width: `${Math.max(2, (sec / SLOW_MAX) * 100)}%` }} />
                  <span className="td-long__pace" style={{ left: `${S.paceShare * 100}%` }} />
                </span>
                <span className="td-long__time">{l.time}</span>
                <ChevronRight className="lnx-chev" size={16} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
      <Slot className="lnx-slot--line" chosen={open} options={SLOWEST.map((l) => {
        const verdict = TIME_VERDICT[l.verdict];
        return { id: l.n, node: <p className="lnx-detail"><b>Q{l.n}</b> <span data-verdict={verdict}>{TIME_COPY.verdict[verdict]}</span>, {l.time}: {TIME_COPY.longestRatio(l.pace)}.</p> };
      })} />
      <p className="lnx-key"><span><i data-verdict="correct" />{TIME_COPY.verdict.correct}</span><span><i data-verdict="wrong" />{TIME_COPY.verdict.wrong}</span></p>
    </div>
  );
}

// ---------- 2. Changes: every answer changed, on the clock ----------
// TIME_COPY's own sentences ("Picked B at 5:08. Changed to D at 6:00, 0:52 later.") and the marks each change won or cost,
// under the totals as the result page sums them (TimeDecisions' parts: TIME_COPY.changesGained / changesCost) with the net,
// counting up once as the scene comes on. A tapped change shows its two picks, first then final (the final one settling in),
// with TIME_COPY's line on what the change did.
const VERDICT_WORD = { right: 'Right', wrong: 'Wrong', blank: 'Blank' };
// data/mistake_lab.copy.json remark.scores ("First picks: {first} of {max}. Final answers: {final} of {max}{held}."), filled
// from labStory: the first answers' total and the final one. lab_next_1121.test.mjs holds it to the JSON's template.
const FIRST_SCORES = `First picks: ${S.firstAnswers} of ${S.facts.outOf}. Final answers: ${S.facts.marks} of ${S.facts.outOf}.`;
function PickChip({ letter, verdict, label, end }) {
  return (
    <span className="lnx-pick" data-verdict={verdict} data-end={end}>
      <i>{letter}{verdict === 'right' ? <Check size={10} strokeWidth={3.2} aria-hidden="true" /> : <X size={10} strokeWidth={3.2} aria-hidden="true" />}</i>
      <span><small>{label}</small>{VERDICT_WORD[verdict]}</span>
    </span>
  );
}
// The totals count up once, 420 ms, written straight into their text (no re-render a frame). The real figure is in the markup
// from the first paint (the server's drawing, reduced motion, a story that is not held). In the held story a fresh screen
// waits in its start state (every count at 0) until its scene is on stage, and counts once the card stands (LNX_IN_MS): the
// card never lands showing its finished figures and then wipes them (critic round, 21 Nov 2026 evening).
function useCountUp(ref, still, on) {
  useEffect(() => {
    const root = ref.current;
    if (still || !root || reducedNow()) return undefined;
    const nodes = [...root.querySelectorAll('[data-count]')];
    const write = (k) => { for (const node of nodes) node.textContent = `${node.dataset.prefix || ''}${signedMarks(Math.round(Number(node.dataset.count) * k))}`; };
    if (!on) { write(0); return undefined; }
    let frame = 0;
    let start = 0;
    const tick = (now) => {
      start ||= now;
      const t = Math.min(1, (now - start) / 420);
      write(1 - (1 - t) ** 3);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    const wait = window.setTimeout(() => { frame = requestAnimationFrame(tick); }, LNX_IN_MS);
    return () => { window.clearTimeout(wait); cancelAnimationFrame(frame); write(1); };
  }, [ref, still, on]);
}
function ChangesScreen({ still, on }) {
  const [open, setOpen] = useState(still ? S.changes[0].n : null);
  const sumRef = useRef(null);
  useCountUp(sumRef, still, on);
  return (
    <div className="lnx lnx--changes">
      <p className="lnx-h">{TIME_COPY.changesTitle}</p>
      <p className="td-lead">{TIME_COPY.changesLead(S.changes.length, S.changes.length, S.net)}</p>
      <div className="lnx-sum" ref={sumRef}>
        <p data-tone="good"><b data-count={S.gainedMarks}>{signedMarks(S.gainedMarks)}</b>{TIME_COPY.changesGained(S.gainedCount, S.gainedMarks)}</p>
        <p data-tone="bad"><b data-count={S.lostToChanges}>{signedMarks(S.lostToChanges)}</b>{TIME_COPY.changesCost(S.lostQuestions.length, -S.lostToChanges)}</p>
        <p data-tone={S.net < 0 ? 'bad' : 'good'} data-net=""><b data-count={S.net} data-prefix="= ">= {signedMarks(S.net)}</b>Net effect on your marks</p>
      </div>
      <ol className="td-changes">
        {S.changes.map((c, i) => {
          const on = open === c.n;
          return (
            <li key={c.n} style={{ '--i': i }} data-open={on || undefined}>
              <button type="button" className="td-changes__row" aria-pressed={on} onClick={() => setOpen(c.n)}>
                <span className="td-changes__q">Q{c.n}</span>
                <span className="td-changes__text">{TIME_COPY.first(c.from, c.at)} {TIME_COPY.changed(c.to, c.toAt, c.gap)}</span>
                <b className="td-changes__net" data-tone={c.net > 0 ? 'good' : c.net < 0 ? 'bad' : 'neutral'}>{signedMarks(c.net)}</b>
                <ChevronRight className="lnx-chev" size={16} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
      <Slot className="lnx-slot--picks" chosen={open} options={S.changes.map((c) => ({ id: c.n, node: (
        <div className="lnx-picks">
          <span className="lnx-picks__row">
            <b className="lnx-picks__q">Q{c.n}</b>
            <PickChip letter={c.from} verdict={c.fromVerdict} label={`First pick, ${c.at}`} end="from" />
            <ArrowRight className="lnx-picks__arrow" size={16} strokeWidth={2.4} aria-hidden="true" />
            <PickChip letter={c.to} verdict={c.toVerdict} label={`Final pick, ${c.toAt}`} end="to" />
          </span>
          <p className="lnx-picks__effect" data-tone={c.net < 0 ? 'bad' : 'good'}>{TIME_COPY.effectOne(c.net)}</p>
        </div>
      ) }))} />
      {/* Wide device only (lab-next.css): the ledger's re-mark line, in its own words (data/mistake_lab.copy.json remark.scores). */}
      <p className="lnx-first">{withNumbers(FIRST_SCORES)}</p>
    </div>
  );
}

// ---------- 3. Repair: the mistake's row, opened, then the repair ----------
// Two taps, the way a student does it on the result page (owner LK366, 22 Nov 2026: one tap made this scene a third as long
// as the others). The row is the result's mistake row (MistakeList.jsx Row: the chapter, the question, the picks as "yours"
// and "answer", the marks it cost). Tapped, it opens and writes the two answers out in the row's own words ("Your answer",
// "Correct answer", REPAIR.options), in the room its picks held, so the opening moves nothing. The key under it is
// MistakeRepair's own start ("Repair Q4", FIX_COPY's line and price). The finished repair is Repair v3's layout in its own
// words (REPAIR_COPY): the trap as its heading, "Explained from the answer key (B).", why D looked right, why B is right, and
// the rule to keep.
const REPAIR_BLOCK = Object.fromEntries(REPAIR.blocks.map((b) => [b.kind, b]));
const OPTION_TEXT = Object.fromEntries(REPAIR.options);
function RepairScreen({ still }) {
  const [open, setOpen] = useState(still);
  const [done, setDone] = useState(still);
  return (
    <div className="lnx lnx--repair">
      <p className="lnx-h">Your mistakes</p>
      <button type="button" className="lnx-mistake" data-verdict="wrong" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="rx-row__n" aria-hidden="true">{REPAIR.n}</span>
        <span className="rx-row__main">
          <span className="rx-row__ch"><span className="sr-only">Question {REPAIR.n}, </span>{REPAIR.chapter}</span>
          <span className="rx-row__stem">{REPAIR.stem}</span>
          <span className="lnx-answers">
            <span className="rx-row__facts" data-shown={open ? undefined : ''}>
              <span className="rx-pick" data-kind="mine"><i>{REPAIR.picked}</i>yours</span>
              <span className="rx-pick" data-kind="key"><i>{REPAIR.key}</i>answer</span>
            </span>
            <span className="rx-row__opts" data-shown={open ? '' : undefined} aria-hidden={open ? undefined : true}>
              <span className="rx-opt" data-kind="mine"><i>{REPAIR.picked}</i><span><small>Your answer</small>{OPTION_TEXT[REPAIR.picked]}</span></span>
              <span className="rx-opt" data-kind="key"><i>{REPAIR.key}</i><span><small>Correct answer</small>{OPTION_TEXT[REPAIR.key]}</span></span>
            </span>
          </span>
        </span>
        <span className="rx-row__cost">{signedMarks(-GAP.wrong)}</span>
        <ChevronRight className="lnx-chev" size={16} strokeWidth={2.4} aria-hidden="true" />
      </button>
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
// page uses inside "After this mock" (SwotPanel PLAIN, in its order). A tapped group shows its line under the four.
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
              <button type="button" className="lnx-quad" aria-pressed={on} onClick={() => setOpen(q.id)}>
                <span className="sw-q__h">{PLAIN[q.id]}<ChevronRight className="lnx-chev" size={14} strokeWidth={2.4} aria-hidden="true" /></span>
                <span className="sw-item__title">{q.title}</span>
              </button>
            </section>
          );
        })}
      </div>
      <Slot className="lnx-slot--swot" chosen={open} options={QUADS.map((q) => ({ id: q.id, node: <p className="lnx-detail" data-q={q.id}><b>{PLAIN[q.id]}</b> {q.detail}</p> }))} />
    </div>
  );
}

// ---------- The cursor's scripts (CursorDemo steps: each clicks the screen's real control) ----------
// Two taps a scene, every scene. A selector that finds nothing is skipped, so a screen that changes never strands the cursor.
// `lastShown` marks the last row the device shows (it shows fewer on a small phone), one layout read, once.
// Hand-offs (owner LK365, 21 Nov 2026: the next scene comes "as soon as one animation ends"): the script's last rest ends,
// then LabNextScreen's end step hands over at once. The next scene's cursor does not travel in from the stage's corner: it
// waits, hidden, until the card stands (`arrive` shows it where the last scene's cursor stopped, the cards lie in the same
// place), rests, then goes straight to its first control.
//
// THE PACE (owner, 22 Nov 2026, LK366: "the auto play is a bit too fast. Previously, it was a bit too slow, but I prefer the
// previous one only over this one. This is just way too fast ... No one can even read it properly"). The round before ran
// about 5.4 s a scene with some 3 s of nothing after a scene's last answer; the hand-off round ran 1.6 to 4 s a scene, unevenly
// (Repair had one tap, every scene its own dwells, and CursorDemo cut a late dwell by up to a quarter to catch up). Now every
// scene keeps one rhythm, timed from the moment its card stands (LNX_IN_MS after its step; the first scene's card stands as it
// starts):
//   LAB_PACE.firstTapMs   the cursor's first tap lands 1.5 s after the card stands (target 1.4 to 1.7 s): the reader reads
//                         the scene's heading and sees the screen; the cursor shows at once and moves for the last 550 ms;
//   LAB_PACE.readMs       once a tap's answer is in (REVEAL_MS), 1.85 s of stillness, then the cursor moves (420 ms) and
//                         presses (130 ms): 2.4 s from the answer to the next tap (target: 1.8 s or more of rest before it);
//   LAB_PACE.lastReadMs   once the scene's last answer is in, 2.1 s, then the next card comes (target 2.0 to 2.4 s);
//   a scene runs 6.5 to 7.5 s from its step to the next (sceneMs: 6.94 to 7.35 s), 6.5 s or more from its card standing, the
//   Lab about 35 s; the last scene rests when done.
// The rests keep to the scene's own clock: each ends at its planned time after the card stood, so a timer that came late on a
// slow phone is made up in the rest that follows, but never below minReadMs / minLastReadMs (and CursorDemo never shortens
// them itself: `exact`). So the scene keeps its length and a rest is never too short to read. lab_next_1121.test.mjs pins it.
export const LAB_PACE = Object.freeze({ firstTapMs: 1500, readMs: 1850, lastReadMs: 2100, minReadMs: 1800, minLastReadMs: 2000, moveMs: 420, pressMs: 130 });
/** CursorDemo's own entry before its first step (its 30 ms and 190 ms holds): the first scene's card already stands then. */
const CURSOR_ENTRY_MS = 220;
/**
 * How long each kind of answer takes to come in after its tap (the CSS that draws it; the test reads the sheets):
 *   row      a ledger chapter opens: its line and its chips rise (lab-next.css, 240 ms, the chips 60 ms behind);
 *   line     a slot's answer rises (lnx-rise, 260 ms);
 *   picks    a change's two picks: the final pick settles 140 ms in, over 320 ms (lnx-settle);
 *   answers  the mistake row opens: its two answers rise (lnx-rise, 260 ms);
 *   repair   the repair's blocks rise 50 ms apart, the rule last (mistake-repair.css mr-rule-in, 520 ms from 150 ms).
 */
export const REVEAL_MS = Object.freeze({ row: 300, line: 260, picks: 460, answers: 260, repair: 670 });
// The cursor's last point, in the stage's own px (the cards share one size and place). No layout read: CursorDemo's own
// inline transform says where it is, and where it put the cursor on entry (82 % and 90 % of the stage's size) gives the
// stage's size.
let handoff = null;
const cursorOf = (stage) => stage.querySelector(':scope > .cd-cursor');
const pointOf = (cursor) => {
  const m = cursor?.style.transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px/);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
};
const keepPoint = (stage) => { handoff = pointOf(cursorOf(stage)) ?? handoff; };
/** Shows the cursor (hidden by lab-next.css until now) at the last scene's end point, or where CursorDemo entered it. */
const arrive = (stage) => {
  const cursor = cursorOf(stage);
  const entry = pointOf(cursor);
  if (!cursor || !entry) return;
  const w = entry.x / 0.82;
  const h = entry.y / 0.9;
  const x = handoff ? Math.min(w - 8, Math.max(8, handoff.x)) : entry.x;
  const y = handoff ? Math.min(h - 8, Math.max(8, handoff.y)) : entry.y;
  cursor.style.transitionDuration = '0ms, 160ms';
  cursor.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  stage.dataset.lnxCursor = 'in';
};
// When the story's step last changed (useStoryStep), so the arriving cursor shows as its card stands (LNX_IN_MS) however
// long the screen took to start: CursorDemo spends 220 ms on its own entry, and on a slow phone the screen starts a few
// hundred ms after the step. The wait is read as the step runs (a getter), never fixed in advance.
let steppedAt = -Infinity;
// When this scene's card stands: LNX_IN_MS after its step (the card's slide is keyed to the step itself, so it stands then
// however late a slow phone starts the script; the first rest makes up the delay). The first scene's card does not slide
// (no fresh step): it stands as its script starts. Fixed by the script's first step; the rests below count from it.
let standAt = 0;
const FRESH_STEP_MS = 2500;
const STAND = Object.freeze({
  run: () => {
    const now = performance.now();
    standAt = now - steppedAt < FRESH_STEP_MS ? steppedAt + LNX_IN_MS : now - CURSOR_ENTRY_MS;
  },
});
const ARRIVE = Object.freeze({ run: () => {}, get dwell() { return Math.max(0, Math.round(standAt - performance.now())); } });
/** The rest before the first tap: its move and press start so that the tap lands firstTapMs after the card stood. */
const FIRST_REST = Object.freeze({
  exact: true,
  get wait() { return Math.max(0, Math.round(standAt + LAB_PACE.firstTapMs - LAB_PACE.moveMs - LAB_PACE.pressMs - performance.now())); },
});
const lastShown = (selector) => (stage) => {
  for (const node of stage.querySelectorAll('[data-lnx-last]')) node.removeAttribute('data-lnx-last');
  const shown = [...stage.querySelectorAll(selector)].filter((node) => node.getClientRects().length > 0);
  shown.at(-1)?.setAttribute('data-lnx-last', '');
};
/**
 * Each scene's two taps: the control (a selector inside the stage), where on it, what it reveals (REVEAL_MS), and `before`, a
 * step run just before the tap's move.
 */
export const LAB_TAPS = Object.freeze({
  chapters: Object.freeze([
    { target: '.ml-row:first-child .ml-row__btn', at: [0.3, 0.5], reveal: REVEAL_MS.row },
    { target: '.ml-row[data-open] .ml-chip:nth-child(2)', at: [0.5, 0.55], reveal: REVEAL_MS.line },
  ]),
  time: Object.freeze([
    { target: '.td-long li:first-child .td-long__row', at: [0.62, 0.4], reveal: REVEAL_MS.line },
    { before: lastShown('.td-long__row'), target: '[data-lnx-last]', at: [0.62, 0.45], reveal: REVEAL_MS.line },
  ]),
  changes: Object.freeze([
    { target: '.td-changes li:first-child .td-changes__row', at: [0.55, 0.45], reveal: REVEAL_MS.picks },
    { before: lastShown('.td-changes__row'), target: '[data-lnx-last]', at: [0.55, 0.45], reveal: REVEAL_MS.picks },
  ]),
  repair: Object.freeze([
    { target: '.lnx-mistake', at: [0.55, 0.3], reveal: REVEAL_MS.answers },
    { target: '.mr-start', at: [0.2, 0.45], reveal: REVEAL_MS.repair },
  ]),
  swot: Object.freeze([
    { target: '.sw-q[data-q="weakness"] .lnx-quad', at: [0.45, 0.45], reveal: REVEAL_MS.line },
    { target: '.sw-q[data-q="threat"] .lnx-quad', at: [0.45, 0.45], reveal: REVEAL_MS.line },
  ]),
});
/**
 * A scene's script: the card stands, the cursor shows, rests, then each tap and the rest after its answer (LAB_PACE). A tap's
 * dwell (its answer coming in, then the rest) ends at its planned time after the card stood, never shorter than the answer
 * plus the rest's floor.
 */
function paced(taps) {
  const { firstTapMs, readMs, lastReadMs, minReadMs, minLastReadMs, moveMs, pressMs } = LAB_PACE;
  const steps = [STAND, ARRIVE, { run: arrive }, FIRST_REST];
  let clickAt = firstTapMs;
  taps.forEach((tap, i) => {
    const last = i === taps.length - 1;
    const floor = tap.reveal + (last ? minLastReadMs : minReadMs);
    const end = clickAt + tap.reveal + (last ? lastReadMs : readMs);
    if (tap.before) steps.push({ run: tap.before });
    steps.push({
      target: tap.target, at: tap.at, move: moveMs, click: true, exact: true,
      get dwell() { return Math.max(floor, Math.round(standAt + end - performance.now())); },
    });
    clickAt = end + moveMs + pressMs;
  });
  return Object.freeze(steps);
}
/** The scripted length of a scene, from its step to the next scene's (or, for the last, to the end of its rest). */
export function sceneMs(scene) {
  const { firstTapMs, readMs, lastReadMs, moveMs, pressMs } = LAB_PACE;
  const taps = LAB_TAPS[scene];
  return LNX_IN_MS + firstTapMs + taps.reduce((ms, tap, i) => ms + tap.reveal + (i === taps.length - 1 ? lastReadMs : readMs + moveMs + pressMs), 0);
}
const SCRIPTS = Object.freeze(Object.fromEntries(Object.entries(LAB_TAPS).map(([scene, taps]) => [scene, paced(taps)])));
export const LAB_SCRIPTS = SCRIPTS;

// Memoised: a step change re-renders the Lab's stage, and only the screen that comes on (a new key) needs to draw again.
const SCREENS = { chapters: memo(ChaptersScreen), time: memo(TimeScreen), changes: memo(ChangesScreen), repair: memo(RepairScreen), swot: memo(SwotScreen) };

/**
 * Is scene `index` the story's step? Read from the story root's data-step, which ScrollStory writes the moment a step is
 * decided, not from React's step, which catches up in a transition (600 to 900 ms later on a slow phone, critic round, 21 Nov
 * 2026 evening): so the scene that comes on starts its cursor as its card starts to slide, never after it has landed.
 * Outside a story (no root), `fallback` decides.
 */
function useStoryStep(probe, index, fallback) {
  // null until a story root is found: then `fallback` answers, read live on every render (no state set in the effect).
  const [on, setOn] = useState(null);
  useEffect(() => {
    const root = probe.current?.closest('.ss');
    if (!root || !Number.isInteger(index)) return undefined;
    // React writes the same data-step again when it catches up: only a change of this scene's state counts as its arrival.
    let was = null;
    const read = () => {
      const now = root.dataset.step === String(index);
      if (now && was === false) steppedAt = performance.now();
      was = now;
      setOn(now);
    };
    read();
    const watch = new MutationObserver(read);
    watch.observe(root, { attributes: true, attributeFilter: ['data-step'] });
    return () => watch.disconnect();
  }, [probe, index]);
  return on === null ? fallback : on;
}

/** A screen that has played is drawn afresh this long after its scene leaves (its card has settled under the next one). */
const RESET_MS = 480;
// Never while a finger is on the glass: a touch that began on a card keeps its target, and were that node replaced, the
// browser would send the touch's end to a node no longer in the page, so the story would never hear the finger lift (its
// settle and the autoplay wait on it). A fresh drawing waits for the last finger to leave.
let fingers = 0;
const afterTouch = new Set();
// Counted from the moment this file loads (it loads before any scene plays), so no touch is ever missed.
if (typeof window !== 'undefined') {
  const count = (event) => {
    fingers = event.touches ? event.touches.length : 0;
    if (!fingers) { const waiting = [...afterTouch]; afterTouch.clear(); for (const fn of waiting) fn(); }
  };
  for (const kind of ['touchstart', 'touchend', 'touchcancel']) window.addEventListener(kind, count, { capture: true, passive: true });
}
function whenUntouched(run) {
  if (!fingers) { run(); return () => {}; }
  afterTouch.add(run);
  return () => afterTouch.delete(run);
}

/**
 * One scene's screen in the next look.
 * scene       the scene's key (LAB_SCENES)
 * index       the scene's step in the story (its card's data-ss-step)
 * ready       the story is held and this scene may play (the first scene only once the Lab is half in view)
 * live        the old signal (React's step), used only outside a story
 * still       reduced motion, or a story that is not held: no cursor, the finished state
 * onDone      the cursor's script has ended (the Lab's autoplay moves on from here): called by the script's own last step, the
 *             moment its last dwell is over, so the next scene starts arriving at once (CursorDemo calls it again 260 ms
 *             later, as its cursor has faded; the autoplay ignores a second call)
 * onTakeover  the reader's own tap or key inside the screen took over from the cursor
 * The screen is drawn afresh (a new key) once its scene has left and its card has settled, so it waits in its start state
 * (bars empty, counts at 0: lab-next.css holds a waiting card's reveal) and plays from the top the next time it comes on,
 * with the same nodes that slid in: a card never lands finished and then replays (critic round, 21 Nov 2026 evening). A
 * reader who took over once gets the cursor back next time.
 */
export default function LabNextScreen({ scene, index, ready, live = false, still = false, onDone, onTakeover }) {
  const probe = useRef(null);
  const onStage = useStoryStep(probe, index, live);
  const playing = (ready ?? live) && onStage && !still;
  const [wasPlaying, setWasPlaying] = useState(playing);
  const [mount, setMount] = useState({ key: 0, used: playing });
  if (playing !== wasPlaying) {
    setWasPlaying(playing);
    // A scene back on stage before its fresh drawing (a reader who went back at once): drawn afresh as soon as no finger is
    // down (stale until then: its cursor waits).
    if (playing) setMount((m) => (m.used ? { ...m, stale: true } : { key: m.key, used: true }));
  }
  useEffect(() => {
    if (!mount.stale) return undefined;
    return whenUntouched(() => setMount((m) => (m.stale ? { key: m.key + 1, used: true } : m)));
  }, [mount.stale]);
  useEffect(() => {
    if (playing || !mount.used) return undefined;
    let drop = () => {};
    const fresh = () => startTransition(() => setMount((m) => (m.used && !m.stale ? { key: m.key + 1, used: false } : m)));
    const id = window.setTimeout(() => { drop = whenUntouched(fresh); }, RESET_MS);
    return () => { window.clearTimeout(id); drop(); };
  }, [playing, mount.used]);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);
  const steps = useMemo(() => (SCRIPTS[scene] ? [...SCRIPTS[scene], { run: (stage) => { keepPoint(stage); doneRef.current?.(); } }] : null), [scene]);
  const Screen = SCREENS[scene];
  if (!Screen) return null;
  return (
    <>
      <CursorDemo key={`${mount.key}${still ? '-still' : ''}`} steps={steps} playing={playing && !mount.stale} onDone={onDone} onTakeover={onTakeover} className="lnx-stage">
        <Screen still={still} on={scene === 'changes' ? playing : undefined} />
      </CursorDemo>
      <i ref={probe} hidden />
    </>
  );
}
