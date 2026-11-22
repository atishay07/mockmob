'use client';

// The Mistake Lab's five screens in the "next" look (owner, 20 Nov 2026 night: "the mistake lab approach was better ...
// You just had to redo the screens", and LK363: "they have a cursor which is updating the screen live ... using actual
// screens and actual UI, because we are showing people how to use it"). LabCinema renders these only for look="next".
// LK368 (22 Nov 2026 night: "incorporate the old and new into making better cards"): each screen is a card in the result
// page's own roles, type and sentences, fed with labStory.mjs's one sample Accountancy mock (never a typed figure). It leads
// with ONE finding (its figure bold, one pen mark, the result page's own idiom), then ONE picture from the earlier screens
// rebuilt at phone size, then the slot a tap fills. A cursor (CursorDemo) works it, two taps a scene:
//   Chapters  "Partnership cost 18 of the 28 marks you missed.", the chapters worst first with "Fix first" and the marks lost,
//             each bar cut into its lost questions; the cursor taps a wrong one, then a blank; the record before this mock.
//   Time      "All 3 wrong answers ran over the 1:12 pace.", the slowest questions against a dashed pace line, the overrun
//             hatched (coral wrong, amber right); the cursor taps the slowest, then the slowest that was still right.
//   Changes   the net, large, counting up; the totals; each change as two picks and an arrow; the cursor taps the change that
//             threw a right answer away, then the one that found the key (TIME_COPY's sentences in the slot).
//   Repair    the question, the pick struck through and the key ticked; the cursor taps the pick (the record line), then
//             "Repair Q4" and the finished repair rises over the card as a sheet.
//   SWOT      "Do these next" with the plan's first set and its Set up key, the four groups as filled tiles; the cursor taps
//             "Costing you", then "Watch".
// A tap writes its scene's beat (data-beat) so the line above the device says what it showed (LabBeats.mjs). What a tap shows
// holds its room from the first frame (Slot), so a tap moves nothing (no layout shift); a card's picture plays in once the
// card stands (lnx-in). Reduced motion, or a story that is not held: no cursor, the finished state, the controls still work
// by hand. No layout read here but CursorDemo's, once a step.
import { memo, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { Check, KeyRound, Wrench, X } from 'lucide-react';
import CursorDemo from './demo/CursorDemo';
import Doodle from '@/components/doodle/Doodle';
import { SWOT_UI_COPY } from '@/components/result/SwotPanel';
import { TIME_COPY, signedMarks } from '@/../data/time_decisions';
import { REPAIR_COPY, checkChip } from '@/../data/repair_presentation.mjs';
import { FIX_COPY } from '@/components/recovery/fixForGood.mjs';
import { labStory, longestQuestions, REPAIR, repairRecordLine } from './labStory.mjs';
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

// ---------- The cards (LK368, 22 Nov 2026 night: "incorporate the old and new into making better cards") ----------
// Each card is the result page's own card (its roles, its type, its sentences) and keeps ONE idea: a finding first, in the
// display face with its figure in bold and one pen mark on it (the result page's own idiom: it underlines the costliest
// chapter in red), then ONE picture borrowed from the earlier screens (the chapter bars cut into their lost questions, the
// pace line with the overrun hatched, each change as two picks and an arrow, the two options that matter, the plan with its
// Set up key), then the slot where a tap's answer shows. Every element that plays as the card comes on carries `lnx-in`
// (lab-next.css holds it in its start state until the card stands). The beat line above the device follows the taps
// (LabBeats.mjs; a control's tap writes data-beat on its scene, no render).
const PEN_DELAY = 900;
const withFigures = (text) => String(text).split(/(\d+)/).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
/** The scene's beat line (LabCinema draws the lines; lab-next.css shows the one data-beat names). */
const beat = (node, k) => { const scene = node?.closest?.('.lc-scene'); if (scene) scene.dataset.beat = String(k); };
const delay = (ms) => ({ '--d': `${ms}ms` });

// ---------- 0. Chapters: where the marks went, chapter by chapter ----------
// The result page's finding ("Partnership cost 18 of the 28 marks you missed.", data/result_next_move.mjs costliestLine) with
// the chapter underlined in pen, then the chapters worst first as the earlier screens drew them: the name, right of its
// questions, "Fix first" on the costliest, the marks lost in the display face, and a bar as long as the chapter's share of
// every lost mark, cut into its lost questions (a wrong answer's 6, a blank's 5, dashed). Each piece is a control: tapped,
// the slot says what that question was (labStory's rows and changes). The foot is the record before this mock ("Across your
// mocks", AcrossMocks.jsx's folded head) with its three columns.
const LOST_CHAPTERS = S.chapters.filter((c) => c.lost > 0);
const TOP = LOST_CHAPTERS[0];
const MISSED = LOST_CHAPTERS.flatMap((c) => c.misses.map((m) => m.n));
function missLine(n) {
  const row = S.rows.find((r) => r.n === n);
  const change = S.changes.find((c) => c.n === n);
  if (row.band === 'blank') return `Q${n}: left blank after ${row.time}.`;
  return `Q${n}: wrong after ${row.time}.${change ? ` You changed ${change.from} to ${change.to}.` : ''}`;
}
const chapterWords = (c, i) => `${c.chapter}: ${c.right} of ${c.of} right, ${c.lost ? `${c.lost} marks lost` : 'no marks lost'}${i === 0 && c.lost ? ', fix this first' : ''}.`;
const HISTORY = S.earlierLine ? S.swot.partnershipLost : [];
const HISTORY_MAX = Math.max(1, ...HISTORY);
/** The two questions the cursor opens: the costliest chapter's second lost question, then the first blank. */
export const CHAPTER_TAPS = Object.freeze([TOP.misses[Math.min(1, TOP.misses.length - 1)].n, (S.chapters.flatMap((c) => c.misses).find((m) => m.verdict === 'blank') ?? TOP.misses[0]).n]);
function ChaptersScreen({ still, on }) {
  const [q, setQ] = useState(still ? CHAPTER_TAPS[0] : null);
  const pick = (event, m) => { setQ(m.n); beat(event.currentTarget, m.verdict === 'blank' ? 2 : 1); };
  return (
    <div className="lnx lnx--chapters">
      <p className="lnx-find">
        <Doodle mark="underline" tone="pen" when={on || still} delay={PEN_DELAY}>{TOP.chapter}</Doodle>
        {` cost `}<b>{TOP.lost}</b>{` of the `}<b>{S.lostMarks}</b>{` marks you missed.`}
      </p>
      <ol className="lnx-chs">
        {S.chapters.map((c, i) => (
          <li key={c.chapter} className="lnx-ch" data-worst={i === 0 && c.lost ? '' : undefined} data-clear={c.lost ? undefined : ''}>
            <span className="lnx-ch__head">
              <b className="lnx-ch__name">{c.chapter}</b>
              <small className="lnx-ch__right">{c.right} of {c.of} right</small>
              {i === 0 && c.lost ? <em className="lnx-ch__flag lnx-in" style={delay(520)}>Fix first</em> : null}
              <b className="lnx-ch__lost">{c.lost ? signedMarks(-c.lost) : '0'}</b>
            </span>
            {c.lost ? (
              <span className="lnx-ch__bar" style={{ '--share': c.share }}>
                {c.misses.map((m, k) => (
                  <button key={m.n} type="button" className="lnx-ch__q" data-n={m.n} data-verdict={m.verdict} aria-pressed={q === m.n} style={{ flexGrow: m.marks }} onClick={(event) => pick(event, m)}>
                    <i className="lnx-ch__fill lnx-in" style={delay(i * 160 + k * 70)} />
                    <span className="lnx-ch__qn lnx-in" style={delay(i * 160 + k * 70 + 220)}>Q{m.n}</span>
                    <span className="sr-only">{missLine(m.n)}</span>
                  </button>
                ))}
              </span>
            ) : null}
            <span className="sr-only">{chapterWords(c, i)}</span>
          </li>
        ))}
      </ol>
      <Slot className="lnx-slot--line" chosen={q} options={MISSED.map((n) => ({ id: n, node: <p className="lnx-detail">{missLine(n)}</p> }))} />
      {S.earlierLine ? (
        <div className="lnx-across">
          <div className="lnx-across__text">
            <p className="lnx-across__title">Across your mocks</p>
            <p className="lnx-across__line">{withFigures(S.earlierLine)}</p>
          </div>
          <ol className="lnx-across__cols" aria-hidden="true">
            {HISTORY.map((lost, j) => (
              <li key={j} data-now={j === HISTORY.length - 1 ? '' : undefined}>
                <span className="lnx-across__col"><i className="lnx-in" style={{ ...delay(700 + j * 110), '--v': lost / HISTORY_MAX }} /></span>
                <b>{lost}</b>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

// ---------- 1. Time: the slowest questions against the paper's pace ----------
// "Where your time went" (TimeDecisions): the finding first ("All 3 wrong answers ran over the 1:12 pace.", from labStory's
// own count), then the slowest answered questions, slowest first, as the earlier screens drew time: a verdict mark, the bar
// up to the pace in grey (or whole, in its verdict's colour, inside it), the time past the pace hatched (coral when it ended
// wrong, amber when it was still right), the pace as a dashed volt line through every row, the time and how far over. A
// tapped row shows what the result page prints for it: the verdict and how many times the paper's pace it took.
const SLOWEST = longestQuestions(undefined, 8).map((l) => ({ ...l, row: S.rows.find((r) => r.n === l.n) }));
/** The two rows the cursor taps: the slowest, then the slowest that was still right. */
export const TIME_TAPS = Object.freeze([SLOWEST[0].n, (SLOWEST.find((l, i) => i > 0 && l.verdict === 'right') ?? SLOWEST[1]).n]);
const timeWords = (l) => `Question ${l.n}: ${l.time}, ${l.row.band === 'over' ? `${l.row.delta} over the pace` : `${l.row.delta} under the pace`}, ${l.verdict === 'right' ? 'right' : 'wrong'}.`;
function TimeScreen({ still, on }) {
  const [open, setOpen] = useState(still ? TIME_TAPS[0] : null);
  const t = S.time;
  return (
    <div className="lnx lnx--time" style={{ '--pace': S.paceShare }}>
      <p className="lnx-find">
        {t.wrongAllOver
          ? <>All <Doodle mark="underline" tone="pen" when={on || still} delay={PEN_DELAY + 300}>{S.facts.wrong} wrong answers</Doodle> ran over the {S.pace} pace.</>
          : <><b>{t.overCount}</b> questions ran over the {S.pace} pace.</>}
      </p>
      <div className="lnx-t">
        <p className="lnx-t__pace" aria-hidden="true"><span><b className="lnx-in" style={delay(0)}>Pace {S.pace}</b></span></p>
        <ol className="lnx-t__rows">
          {SLOWEST.map((l, i) => {
            const r = l.row;
            const verdict = TIME_VERDICT[l.verdict];
            return (
              <li key={l.n}>
                <button type="button" className="lnx-t__row" data-n={l.n} data-band={r.band} data-verdict={l.verdict} aria-pressed={open === l.n}
                  onClick={(event) => { setOpen(l.n); beat(event.currentTarget, l.verdict === 'right' ? 2 : 1); }}>
                  <span className="lnx-t__q">Q{l.n}</span>
                  <span className="lnx-t__mark" data-verdict={verdict} aria-hidden="true">{l.verdict === 'right' ? <Check size={12} strokeWidth={3.4} /> : <X size={12} strokeWidth={3.4} />}</span>
                  <span className="lnx-t__track" aria-hidden="true">
                    <i className="lnx-t__base lnx-in" style={{ ...delay(120 + i * 60), '--w': r.base }} />
                    {r.band === 'over' ? <i className="lnx-t__over lnx-in" style={{ ...delay(420 + i * 60), '--a': r.base, '--w': r.over }} /> : null}
                    <i className="lnx-t__line" />
                  </span>
                  <span className="lnx-t__time" aria-hidden="true">{l.time}</span>
                  <span className="lnx-t__delta lnx-in" aria-hidden="true" style={delay(560 + i * 60)}>{r.band === 'over' ? `+${r.delta}` : ''}</span>
                  <span className="sr-only">{timeWords(l)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <Slot className="lnx-slot--line" chosen={open} options={SLOWEST.map((l) => {
        const verdict = TIME_VERDICT[l.verdict];
        return { id: l.n, node: <p className="lnx-detail"><b>Q{l.n}</b> <span data-verdict={verdict}>{TIME_COPY.verdict[verdict]}</span>, {l.time}: {TIME_COPY.longestRatio(l.pace)}.</p> };
      })} />
      <p className="lnx-key" aria-hidden="true"><span><i data-k="over-wrong" />Over pace, wrong</span><span><i data-k="over-right" />Over pace, right</span><span><i data-k="under" />Under pace</span></p>
    </div>
  );
}

// ---------- 2. Changes: every answer changed, as two picks and an arrow ----------
// The finding is the net, large, counting up once as the card stands ("Net effect on your marks", TimeDecisions' own words),
// then the result page's two totals (TIME_COPY.changesGained / changesCost). Each change is drawn as the earlier screens drew
// it: the first pick with its verdict and clock time, the arrow (coral and crossed when it threw a right answer away), the
// final pick, the marks. A tapped change says it in TIME_COPY's own sentences.
const FIRST_SCORES = `First picks: ${S.firstAnswers} of ${S.facts.outOf}. Final answers: ${S.facts.marks} of ${S.facts.outOf}.`;
/** The two changes the cursor taps: the first that threw a right answer away, then the one that gained. */
export const CHANGE_TAPS = Object.freeze([(S.changes.find((c) => c.net < 0) ?? S.changes[0]).n, (S.changes.find((c) => c.net > 0) ?? S.changes.at(-1)).n]);
function Chip({ letter, verdict, at }) {
  return (
    <span className="lnx-chip" data-verdict={verdict}>
      <i>{letter}<b aria-hidden="true">{verdict === 'right' ? <Check size={11} strokeWidth={3.4} /> : <X size={11} strokeWidth={3.4} />}</b></i>
      <small>{at}</small>
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
  const [open, setOpen] = useState(still ? CHANGE_TAPS[0] : null);
  const sumRef = useRef(null);
  useCountUp(sumRef, still, on);
  return (
    <div className="lnx lnx--changes" ref={sumRef}>
      <div className="lnx-net" data-tone={S.net < 0 ? 'bad' : 'good'}>
        <b data-count={S.net} data-prefix="= ">= {signedMarks(S.net)}</b>
        <span><span className="lnx-net__label">Net effect on your marks</span><span className="lnx-net__from">{plural(S.changes.length, 'answer')} changed</span></span>
      </div>
      <p className="lnx-tot">
        <span data-tone="good"><b data-count={S.gainedMarks}>{signedMarks(S.gainedMarks)}</b> {TIME_COPY.changesGained(S.gainedCount, S.gainedMarks)}</span>
        <span data-tone="bad"><b data-count={S.lostToChanges}>{signedMarks(S.lostToChanges)}</b> {TIME_COPY.changesCost(S.lostQuestions.length, -S.lostToChanges)}</span>
      </p>
      <ol className="lnx-chgs">
        {S.changes.map((c, i) => (
          <li key={c.n} className="lnx-in" style={delay(140 + i * 180)}>
            <button type="button" className="lnx-chg" data-n={c.n} data-tone={c.net < 0 ? 'bad' : 'good'} aria-pressed={open === c.n}
              onClick={(event) => { setOpen(c.n); beat(event.currentTarget, c.net > 0 ? 2 : 1); }}>
              <span className="lnx-chg__q">Q{c.n}</span>
              <Chip letter={c.from} verdict={c.fromVerdict} at={c.at} />
              <span className="lnx-chg__arrow" aria-hidden="true">
                <i className="lnx-chg__line lnx-in" style={delay(340 + i * 180)} />
                <i className="lnx-chg__head" />
                {c.net < 0 ? <i className="lnx-chg__cross lnx-in" style={delay(520 + i * 180)}><X size={10} strokeWidth={3.4} /></i> : null}
              </span>
              <span className="lnx-chg__to lnx-in" style={delay(480 + i * 180)}><Chip letter={c.to} verdict={c.toVerdict} at={c.toAt} /></span>
              <b className="lnx-chg__net">{signedMarks(c.net)}</b>
              <span className="sr-only">{`Question ${c.n}. ${TIME_COPY.first(c.from, c.at)} ${TIME_COPY.changed(c.to, c.toAt, c.gap)} ${TIME_COPY.effectOne(c.net)}`}</span>
            </button>
          </li>
        ))}
      </ol>
      <Slot className="lnx-slot--line" chosen={open} options={S.changes.map((c) => ({ id: c.n, node: (
        <p className="lnx-detail"><b>Q{c.n}</b> {TIME_COPY.changed(c.to, c.toAt, c.gap)} <span data-tone={c.net < 0 ? 'bad' : 'good'}>{TIME_COPY.effectOne(c.net)}</span></p>
      ) }))} />
      {/* Wide device only (lab-next.css): the ledger's re-mark line, in its own words (data/mistake_lab.copy.json remark.scores). */}
      <p className="lnx-first">{withFigures(FIRST_SCORES)}</p>
    </div>
  );
}

// ---------- 3. Repair: the question, the two options that matter, then the repair ----------
// The question as the student met it, then the two options that matter as the earlier screens showed them: the pick
// (struck through in pen) and the key (ticked), in the result row's words ("Your answer", "Correct answer"). Tapped, the
// pick says what the record shows ("From your record": you first chose the key here). Under them MistakeRepair's own start
// ("Repair Q4", FIX_COPY's line and price); tapped, the finished repair (Repair v3's layout in REPAIR_COPY's words) rises
// over the card like a sheet, in the room the card already holds, so nothing moves.
const REPAIR_BLOCK = Object.fromEntries(REPAIR.blocks.map((b) => [b.kind, b]));
const OPTION_TEXT = Object.fromEntries(REPAIR.options);
const RECORD = repairRecordLine();
function RepairScreen({ still, on }) {
  const [told, setTold] = useState(still);
  const [done, setDone] = useState(still);
  return (
    <div className="lnx lnx--repair">
      <p className="lnx-rq"><b>Q{REPAIR.n}</b> {REPAIR.stem}</p>
      <div className="lnx-opts">
        <button type="button" className="lnx-opt" data-kind="mine" aria-pressed={told} onClick={(event) => { setTold(true); beat(event.currentTarget, 1); }}>
          <i className="lnx-opt__l">{REPAIR.picked}<b aria-hidden="true"><X size={11} strokeWidth={3.4} /></b></i>
          <span><small>Your answer</small><Doodle mark="strike" tone="pen" when={on || still} delay={PEN_DELAY}>{OPTION_TEXT[REPAIR.picked]}</Doodle></span>
        </button>
        <p className="lnx-opt" data-kind="key">
          <i className="lnx-opt__l">{REPAIR.key}<b aria-hidden="true"><Check size={11} strokeWidth={3.4} /></b></i>
          <span><small>Correct answer</small>{OPTION_TEXT[REPAIR.key]}</span>
        </p>
      </div>
      {RECORD ? <Slot className="lnx-slot--line" chosen={told ? 'record' : null} options={[{ id: 'record', node: <p className="lnx-detail"><b>From your record</b> {RECORD}</p> }]} /> : null}
      <button type="button" className="mr-start" onClick={(event) => { setDone(true); beat(event.currentTarget, 2); }}>
        <span className="mr-start__icon" aria-hidden="true"><Wrench size={18} strokeWidth={2.4} /></span>
        <span className="mr-start__text"><b>{FIX_COPY.startTitle(REPAIR.n)}</b><small>{FIX_COPY.startLine(REPAIR.picked)}</small></span>
        <span className="mr-start__cost">{FIX_COPY.price}</span>
      </button>
      {done ? (
        <section className="mr mr--panel mr--done lnx-sheet" data-fresh={still ? undefined : ''} aria-label="Mistake Repair">
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
      ) : null}
    </div>
  );
}

// ---------- 4. SWOT: "After this mock" ----------
// SwotPanel's words: "Do these next" with the plan's first set large, underlined in volt, its reason and the Set up key the
// result page puts beside it, then the four groups two by two under the plain headings the result page uses (SwotPanel PLAIN,
// in its order), each a filled tile with its colour. A tapped group shows its line in the slot.
const PLAIN = { weakness: 'Costing you', strength: 'Working', opportunity: 'Room to grow', threat: 'Watch' };
const PLAIN_ORDER = ['weakness', 'strength', 'opportunity', 'threat'];
const QUADS = [...S.swot.quadrants].sort((a, b) => PLAIN_ORDER.indexOf(a.id) - PLAIN_ORDER.indexOf(b.id));
const FIRST = S.swot.plan[0];
function SwotScreen({ still, on }) {
  const [open, setOpen] = useState(still ? 'threat' : null);
  return (
    <div className="lnx lnx--swot">
      <p className="lnx-h">{SWOT_UI_COPY.next}</p>
      <div className="lnx-plan lnx-in" style={delay(0)}>
        <span className="lnx-plan__n" aria-hidden="true">1</span>
        <span className="lnx-plan__text">
          <span className="lnx-plan__label"><Doodle mark="underline" tone="volt" when={on || still} delay={PEN_DELAY}>{FIRST.label}</Doodle></span>
          <span className="lnx-plan__why">{FIRST.reason}</span>
        </span>
        <span className="lnx-plan__go" aria-hidden="true">{SWOT_UI_COPY.setUp}</span>
      </div>
      <p className="lnx-h">{SWOT_UI_COPY.swot}</p>
      <div className="lnx-quads">
        {QUADS.map((q, i) => (
          <button key={q.id} type="button" className="lnx-quad lnx-in" data-q={q.id} aria-pressed={open === q.id} style={delay(220 + i * 90)}
            onClick={(event) => { setOpen(q.id); beat(event.currentTarget, q.id === 'threat' ? 2 : 1); }}>
            <span className="lnx-quad__h"><i aria-hidden="true" />{PLAIN[q.id]}</span>
            <span className="lnx-quad__title">{q.title}</span>
          </button>
        ))}
      </div>
      <Slot className="lnx-slot--line" chosen={open} options={QUADS.map((q) => ({ id: q.id, node: <p className="lnx-detail" data-q={q.id}><b>{PLAIN[q.id]}</b> {q.detail}</p> }))} />
    </div>
  );
}

// ---------- The cursor's scripts (CursorDemo steps: each clicks the screen's real control) ----------
// Two taps a scene, every scene. A selector that finds nothing is skipped, so a screen that changes never strands the cursor.
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
 *   line     a slot's answer rises (lnx-rise, 260 ms): every first tap, and the second tap of four scenes;
 *   repair   the repair sheet rises and its blocks follow 50 ms apart, the rule last (mistake-repair.css mr-rule-in, 520 ms
 *            from 150 ms).
 */
export const REVEAL_MS = Object.freeze({ line: 260, repair: 670 });
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
/**
 * Each scene's two taps: the control (a selector inside the stage), where on it, what it reveals (REVEAL_MS), and `before`, a
 * step run just before the tap's move.
 */
export const LAB_TAPS = Object.freeze({
  chapters: Object.freeze([
    { target: `.lnx-ch__q[data-n="${CHAPTER_TAPS[0]}"]`, at: [0.5, 0.5], reveal: REVEAL_MS.line },
    { target: `.lnx-ch__q[data-n="${CHAPTER_TAPS[1]}"]`, at: [0.5, 0.5], reveal: REVEAL_MS.line },
  ]),
  time: Object.freeze([
    { target: `.lnx-t__row[data-n="${TIME_TAPS[0]}"]`, at: [0.55, 0.5], reveal: REVEAL_MS.line },
    { target: `.lnx-t__row[data-n="${TIME_TAPS[1]}"]`, at: [0.55, 0.5], reveal: REVEAL_MS.line },
  ]),
  changes: Object.freeze([
    { target: `.lnx-chg[data-n="${CHANGE_TAPS[0]}"]`, at: [0.5, 0.45], reveal: REVEAL_MS.line },
    { target: `.lnx-chg[data-n="${CHANGE_TAPS[1]}"]`, at: [0.5, 0.45], reveal: REVEAL_MS.line },
  ]),
  repair: Object.freeze([
    { target: '.lnx-opt[data-kind="mine"]', at: [0.6, 0.5], reveal: REVEAL_MS.line },
    { target: '.mr-start', at: [0.2, 0.45], reveal: REVEAL_MS.repair },
  ]),
  swot: Object.freeze([
    { target: '.lnx-quad[data-q="weakness"]', at: [0.45, 0.45], reveal: REVEAL_MS.line },
    { target: '.lnx-quad[data-q="threat"]', at: [0.45, 0.45], reveal: REVEAL_MS.line },
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
  // A fresh drawing starts on the scene's first beat line (LabBeats.mjs; the taps write the later ones).
  useEffect(() => { probe.current?.closest('.lc-scene')?.removeAttribute('data-beat'); }, [mount.key]);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);
  const steps = useMemo(() => (SCRIPTS[scene] ? [...SCRIPTS[scene], { run: (stage) => { keepPoint(stage); doneRef.current?.(); } }] : null), [scene]);
  const Screen = SCREENS[scene];
  if (!Screen) return null;
  return (
    <>
      <CursorDemo key={`${mount.key}${still ? '-still' : ''}`} steps={steps} playing={playing && !mount.stale} onDone={onDone} onTakeover={onTakeover} className="lnx-stage">
        <Screen still={still} on={playing} />
      </CursorDemo>
      <i ref={probe} hidden />
    </>
  );
}
