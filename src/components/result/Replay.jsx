"use client";
// Replay: the paper as a clock you can scrub (spec tmp/mistake-lab-v4/SPEC.md 4.5), the first block of the Mistake
// Lab's Find step. One row per 10 minutes; each visit is a bar from entering to leaving, filled by the question's
// final result; a pick is a dot, a change a ringed dot, a mark for review a small flag, and time away from the paper a
// hatched gap with its label. Each row ends with the server's "By 20:00: 14 of 50 answered. Even pace: 16." line.
// Every sentence, label and number comes finished from the server (lab.replay, data/replay.js; the same words as the
// app); this file only lays them out and moves them.
//
// Play runs the record in replay.playMs (15 s): a clock counts up, the bars after the clock are veiled, the paper's
// mini answer map fills and, at the end, settles into each question's final result. The scrubber is a range input:
// arrow keys step one event, Shift with an arrow one minute, Page keys one row. Reduced motion: Previous and Next
// step one event instead of Play. Tapping a bar opens that question below the grid (its trace from the server's
// Time and decisions read), never over the grid. The ledger's groups are the filter chips; "See it in the replay"
// in a ledger row arrives here with that chip on (`focus`).
import { memo, useCallback, useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';
import { Pause, Play, StepBack, StepForward, X } from 'lucide-react';
import { clockLabel } from '@/../data/paper_trace';
import { TIME_COPY } from '@/../data/time_decisions';
import { withNumbers } from './MarksLedger';
import './replay.css';

// Row geometry, in px: the flag lane, the bar lane, the pick dots on its lower edge, minute ticks under it, and a lane
// for the "Away 1m 10s" labels only in rows that have time away. Bars are taller once a row is 560 px or wider.
function geometry(wide) {
  const barY = 12;
  const barH = wide ? 28 : 22;
  const dotY = barY + barH;
  const tickY = dotY + 7;
  return Object.freeze({ barY, barH, dotY, tickY, rowH: tickY + 7, rowHAway: tickY + 21, font: wide ? 11 : 10 });
}
const LABEL_MIN = 24; // a bar is labelled "Q17" when it is 24 px or wider (4.5)

// ---------- Reduced motion, as one store: the OS setting or the app's own motion preference ----------
function readReduced() {
  try { return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
function subscribeReduced(onChange) {
  let mq = null;
  let mo = null;
  try { mq = window.matchMedia('(prefers-reduced-motion: reduce)'); mq.addEventListener('change', onChange); } catch { /* no matchMedia */ }
  try { mo = new MutationObserver(onChange); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] }); } catch { /* no MutationObserver */ }
  return () => { mq?.removeEventListener('change', onChange); mo?.disconnect(); };
}
const useReducedMotion = () => useSyncExternalStore(subscribeReduced, readReduced, () => false);

// The width of an element, kept current by a ResizeObserver (the grid is drawn in real pixels so dots stay round).
function useWidth() {
  const [el, setEl] = useState(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return undefined;
    if (typeof ResizeObserver === 'undefined') {
      const raf = requestAnimationFrame(() => setWidth(Math.round(el.clientWidth)));
      return () => cancelAnimationFrame(raf);
    }
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width];
}

// data-in once the replay is on screen, so the rows sweep in when the student actually sees them.
function useInView(el) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!el || inView) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      const raf = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [el, inView]);
  return inView;
}

// ---------- The record, prepared once per replay ----------
const PREPARED = new WeakMap();
function prepare(replay) {
  if (PREPARED.has(replay)) return PREPARED.get(replay);
  const rowSec = replay.rowSec || 600;
  const bars = [];
  (replay.rows || []).forEach((row, r) => (row.bars || []).forEach((b, i) => bars.push({ ...b, row: r, i, key: `${r}:${i}` })));
  // Per question: its visits (a visit split at a row edge is joined again), picks, marks and time away.
  const byN = new Map();
  for (const b of bars) {
    if (!Number.isInteger(b.n)) continue;
    let q = byN.get(b.n);
    if (!q) { q = { n: b.n, qid: b.qid, result: b.result, visits: [], picks: [], marks: [], away: [] }; byN.set(b.n, q); }
    const last = q.visits.at(-1);
    if (last && last.to === b.from && b.from % rowSec === 0 && b.row === last.row + 1) { last.to = b.to; last.row = b.row; }
    else q.visits.push({ from: b.from, to: b.to, row: b.row });
    q.picks.push(...(b.picks || []));
    q.marks.push(...(b.marks || []));
    q.away.push(...(b.away || []));
  }
  for (const q of byN.values()) {
    q.picks.sort((a, b) => a.at - b.at);
    q.first = q.visits[0]?.from ?? null;
  }
  // Every moment something happened, for the arrow keys and Previous and Next.
  const rec = replay.recordSec;
  const stops = new Set([0, rec]);
  for (const b of bars) {
    stops.add(b.from);
    for (const p of b.picks || []) stops.add(p.at);
    for (const m of b.marks || []) stops.add(m);
    for (const a of b.away || []) { stops.add(a.from); stops.add(a.to); }
  }
  const times = [...stops].filter((t) => Number.isFinite(t) && t >= 0 && t <= rec).sort((a, b) => a - b);
  // What the legend needs to name: only what this record holds.
  const present = new Set();
  for (const b of bars) {
    present.add(b.result);
    if (b.picks?.length) present.add('pick');
    if (b.picks?.some((p) => p.change)) present.add('change');
    if (b.marks?.length) present.add('mark');
  }
  // When each question first came on screen (replay.opened): a question of a passage set shown but never in focus has
  // no bar and is still opened. Older replays without the list fall back to the first bar.
  const opened = new Map((replay.opened || []).map((o) => [o.n, o]));
  const out = { bars, byN, times, present, opened };
  PREPARED.set(replay, out);
  return out;
}

const nextStop = (times, t) => times.find((x) => x > t + 0.001) ?? times.at(-1) ?? 0;
const prevStop = (times, t) => { for (let i = times.length - 1; i >= 0; i--) if (times[i] < t - 0.001) return times[i]; return 0; };

// The answer map at clock time t: not yet opened, opened, answered then; after the end, each final result.
function mapAt(prep, total, t, settled) {
  const cells = new Array(total);
  for (let k = 0; k < total; k++) {
    const q = prep.byN.get(k + 1);
    const o = prep.opened.get(k + 1);
    if (settled) { cells[k] = q ? q.result : o ? o.result : 'never'; continue; }
    const first = o ? o.at : q?.first ?? null;
    if (first === null || first > t) { cells[k] = 'none'; continue; }
    let answered = false;
    for (const p of q?.picks || []) { if (p.at > t) break; answered = p.option !== null && p.option !== undefined; }
    cells[k] = answered ? 'ans' : 'open';
  }
  return cells;
}

// The widest part of a bar outside its time away, for the "Q17" label.
function labelSlot(x0, x1, gaps) {
  let slots = [[x0, x1]];
  for (const g of gaps) {
    slots = slots.flatMap(([a, b]) => (g.x1 <= a || g.x0 >= b ? [[a, b]] : [[a, Math.max(a, g.x0)], [Math.min(b, g.x1), b]].filter(([p, q]) => q - p > 0)));
  }
  const best = slots.reduce((w, s) => (!w || s[1] - s[0] > w[1] - w[0] ? s : w), null);
  return best && best[1] - best[0] >= LABEL_MIN ? (best[0] + best[1]) / 2 : null;
}

function Patterns({ id }) {
  return (
    <defs>
      <pattern id={`${id}-hatch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" className="rpl-hatch__ground" />
        <line x1="0" y1="0" x2="0" y2="5" className="rpl-hatch__line" />
      </pattern>
      <pattern id={`${id}-dots`} width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" className="rpl-dots__ground" />
        <circle cx="2" cy="2" r="0.9" className="rpl-dots__dot" />
      </pattern>
    </defs>
  );
}

// ---------- One 10-minute row, drawn once per state change (never per animation frame) ----------
const RowGrid = memo(function RowGrid({ row, width, height, rowSec, pid, sel, filterSet, hoverKey, end, geo }) {
  const { barY: BAR_Y, barH: BAR_H, dotY: DOT_Y, tickY: TICK_Y, font } = geo;
  const k = width / rowSec;
  const x = (t) => (t - row.from) * k;
  const ticks = [];
  for (let m = 1; m < rowSec / 60; m++) ticks.push(m);
  const awayLabels = [];
  return (
    <>
      <Patterns id={pid} />
      <rect className="rpl-track" x={0} y={BAR_Y} width={width} height={BAR_H} rx={5} />
      {ticks.map((m) => (
        <line key={m} className="rpl-tick" data-major={m % 5 === 0 || undefined} x1={m * 60 * k} x2={m * 60 * k} y1={TICK_Y} y2={TICK_Y + (m % 5 === 0 ? 5 : 3)} />
      ))}
      {row.bars.map((b, i) => {
        const x0 = x(b.from);
        const x1 = x(b.to);
        const gaps = (b.away || []).map((a) => ({ ...a, x0: x(a.from), x1: x(a.to) }));
        for (const g of gaps) if (g.label) awayLabels.push(g);
        const cx = labelSlot(x0, x1, gaps);
        const bx = x0 + 0.75;
        const bw = Math.max(1.5, x1 - x0 - 1.5);
        const fill = b.result === 'held' ? `url(#${pid}-dots)` : undefined;
        return (
          <g key={`${b.qid}:${b.from}`} className="rpl-bar" data-r={b.result}
            data-dim={filterSet && !filterSet.has(b.n) ? '' : undefined} data-on={filterSet && filterSet.has(b.n) ? '' : undefined}
            data-sel={sel === b.n ? '' : undefined} data-hover={hoverKey === i ? '' : undefined}>
            <rect className="rpl-bar__fill" x={bx} y={BAR_Y} width={bw} height={BAR_H} rx={4} style={fill ? { fill } : undefined} />
            {gaps.map((g) => (
              <rect key={`g${g.from}`} className="rpl-gap" x={g.x0} y={BAR_Y - 1} width={Math.max(1, g.x1 - g.x0)} height={BAR_H + 2} style={{ fill: `url(#${pid}-hatch)` }} />
            ))}
            {cx !== null ? <text className="rpl-bar__q" x={cx} y={BAR_Y + BAR_H / 2 + font * 0.36} textAnchor="middle" style={{ fontSize: font }}>Q{b.n}</text> : null}
            <rect className="rpl-bar__ring" x={bx - 1} y={BAR_Y - 1} width={bw + 2} height={BAR_H + 2} rx={5} />
            {(b.marks || []).map((m) => {
              const mx = x(m);
              return <path key={`m${m}`} className="rpl-flag" d={`M${mx} ${BAR_Y} V2 M${mx} 2 L${mx + 6.5} 4.6 L${mx} 7.2 Z`} />;
            })}
            {(b.picks || []).map((p, j) => {
              const px = x(p.at);
              const cleared = p.option === null || p.option === undefined;
              return (
                <g key={`p${j}`} className="rpl-pick" data-change={p.change || undefined} data-cleared={cleared || undefined}>
                  {p.change ? <circle className="rpl-pick__ring" cx={px} cy={DOT_Y} r={5.6} /> : null}
                  <circle className="rpl-pick__dot" cx={px} cy={DOT_Y} r={3.1} />
                </g>
              );
            })}
          </g>
        );
      })}
      {end && end.at >= row.from && end.at <= row.to ? (
        <g className="rpl-end">
          <line x1={x(end.at)} x2={x(end.at)} y1={4} y2={DOT_Y + 5} />
          <rect x={x(end.at) - 3} y={1} width={6} height={6} rx={1.5} />
        </g>
      ) : null}
      {awayLabels.map((g) => {
        const est = g.label.length * 5.7 + 4;
        const mid = Math.min(Math.max((g.x0 + g.x1) / 2, est / 2), width - est / 2);
        return (
          <g key={`a${g.from}`} className="rpl-away">
            <path d={`M${g.x0} ${TICK_Y + 6} v3 H${Math.max(g.x0 + 1, g.x1)} v-3`} />
            <text x={mid} y={height - 3} textAnchor="middle">{g.label}</text>
          </g>
        );
      })}
    </>
  );
});

// The part of a row that moves with the clock: the veil over what has not happened yet, the playhead and the bar
// on screen at that moment.
function RowLive({ row, width, height, rowSec, t, settled, now, geo }) {
  if (settled || t >= row.to) return null;
  const { barY: BAR_Y, barH: BAR_H, dotY: DOT_Y } = geo;
  const k = width / rowSec;
  const inside = t >= row.from;
  const px = inside ? (t - row.from) * k : 0;
  return (
    <>
      {now ? <rect className="rpl-nowring" x={(now.from - row.from) * k - 0.5} y={BAR_Y - 2} width={Math.max(3, (now.to - now.from) * k + 1)} height={BAR_H + 4} rx={6} /> : null}
      <rect className="rpl-veil" x={px} y={0} width={Math.max(0, width - px)} height={height} />
      {inside ? (
        <g className="rpl-playhead">
          <line x1={px} x2={px} y1={3} y2={DOT_Y + 6} />
          <circle cx={px} cy={4} r={3.6} />
        </g>
      ) : null}
    </>
  );
}

// The legend: colour always travels with a word. Result words are Time and decisions' own.
function Legend({ present, heldLabel }) {
  const items = [
    present.has('right') && ['right', TIME_COPY.verdict.correct],
    present.has('wrong') && ['wrong', TIME_COPY.verdict.wrong],
    present.has('blank') && ['blank', TIME_COPY.verdict.skipped],
    present.has('held') && heldLabel && ['held', heldLabel],
    present.has('pick') && ['pick', 'Picked'],
    present.has('change') && ['change', 'Changed'],
    present.has('mark') && ['mark', 'Marked for review'],
  ].filter(Boolean);
  if (!items.length) return null;
  return (
    <ul className="rpl-legend">
      {items.map(([kind, label]) => (
        <li key={kind}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            {kind === 'pick' ? <g className="rpl-pick"><circle className="rpl-pick__dot" cx="7" cy="7" r="3.1" /></g>
              : kind === 'change' ? <g className="rpl-pick"><circle className="rpl-pick__ring" cx="7" cy="7" r="5.6" /><circle className="rpl-pick__dot" cx="7" cy="7" r="3.1" /></g>
              : kind === 'mark' ? <path className="rpl-flag" d="M4 13 V2 M4 2 L10.5 4.6 L4 7.2 Z" />
              : <rect className="rpl-legend__sw" data-r={kind} x="1" y="2" width="12" height="10" rx="3" />}
          </svg>
          {label}
        </li>
      ))}
    </ul>
  );
}

/**
 * QuestionStrip({ replay, number }): one question across the whole paper, as a thin track: its visits filled by the
 * final result, its picks and changes, marks and time away. Shown in the replay's opened question and in each answer's
 * "Your time and picks". Nothing when the question has no visit in the record.
 */
export function QuestionStrip({ replay, number }) {
  const [ref, width] = useWidth();
  const pid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!replay?.rows?.length) return null;
  const q = prepare(replay).byN.get(number);
  if (!q) return null;
  const span = Math.max(replay.durationSec || 0, replay.recordSec || 0) || 1;
  const k = width / span;
  const end = replay.end;
  return (
    <div className="rpl-strip" aria-hidden="true">
      <div className="rpl-strip__plot" ref={ref}>
        {width > 0 ? (
          <svg width={width} height={26} viewBox={`0 0 ${width} 26`}>
            <Patterns id={pid} />
            <rect className="rpl-track" x={0} y={8} width={width} height={10} rx={5} />
            {end ? <rect className="rpl-strip__after" x={end.at * k} y={8} width={Math.max(0, width - end.at * k)} height={10} rx={5} /> : null}
            {q.visits.map((v) => (
              <rect key={v.from} className="rpl-strip__visit" data-r={q.result} x={v.from * k} y={8} width={Math.max(2.5, (v.to - v.from) * k)} height={10} rx={2.5}
                style={q.result === 'held' ? { fill: `url(#${pid}-dots)` } : undefined} />
            ))}
            {q.away.map((a) => <rect key={`a${a.from}`} className="rpl-gap" x={a.from * k} y={7} width={Math.max(1, (a.to - a.from) * k)} height={12} style={{ fill: `url(#${pid}-hatch)` }} />)}
            {q.marks.map((m) => <path key={`m${m}`} className="rpl-flag" d={`M${m * k} 8 V1 M${m * k} 1 L${m * k + 5} 3 L${m * k} 5 Z`} />)}
            {q.picks.map((p, j) => (
              <g key={`p${j}`} className="rpl-pick" data-change={p.change || undefined} data-cleared={p.option === null || p.option === undefined || undefined}>
                {p.change ? <circle className="rpl-pick__ring" cx={p.at * k} cy={18} r={4.6} /> : null}
                <circle className="rpl-pick__dot" cx={p.at * k} cy={18} r={2.6} />
              </g>
            ))}
            {end ? <line className="rpl-strip__end" x1={end.at * k} x2={end.at * k} y1={5} y2={21} /> : null}
          </svg>
        ) : null}
      </div>
      <div className="rpl-strip__axis"><span>{clockLabel(0)}</span><span>{clockLabel(span)}</span></div>
    </div>
  );
}

/**
 * Replay({ replay, lab, timeRead, onJump, focus }).
 *   replay    lab.replay from the server (null: nothing renders)
 *   lab       the Mistake Lab contract, for the groups behind the chips and each question's group label
 *   timeRead  the Time and decisions read (lab.time from the server), for the opened question's trace lines
 *   onJump    the page's jump to an answer
 *   focus     { chip, n }: a ledger row's "See it in the replay"; each new n turns that chip on and brings the replay in
 */
export default function Replay({ replay, lab = null, timeRead = null, onJump, focus = null }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const reduced = useReducedMotion();
  const [root, setRoot] = useState(null);
  const inView = useInView(root);
  const [gridRef, width] = useWidth();
  const wide = width >= 560;
  const geo = useMemo(() => geometry(wide), [wide]);
  const rec = Math.max(1, replay?.recordSec || 1);
  const [t, setT] = useState(rec);
  const [playing, setPlaying] = useState(false);
  const [start, setStart] = useState(null); // { at, from }: when Play was pressed, and from which clock time
  const [chosen, setChosen] = useState({ id: null, n: 0 }); // the chip picked here, and the last focus it answered
  const [sel, setSel] = useState(null); // the question opened below the grid
  const [hover, setHover] = useState(null); // { row, i }
  const isPlaying = playing && !reduced;

  const prep = useMemo(() => (replay?.rows?.length ? prepare(replay) : null), [replay]);
  const rowSec = replay?.rowSec || 600;
  const total = replay?.total || 0;
  const labels = replay?.labels || {};

  // A ledger row's "See it in the replay" wins until a chip is picked here.
  const filter = focus && focus.n > chosen.n ? focus.chip : chosen.id;
  const groupNumbers = useMemo(() => new Map((lab?.groups || []).map((g) => [g.id, new Set(g.numbers || [])])), [lab]);
  const filterSet = filter && filter !== 'all' ? groupNumbers.get(filter) || new Set() : null;
  const pickChip = (id) => setChosen({ id: id === 'all' ? null : id, n: Math.max(chosen.n, focus?.n || 0) });

  // Play: the clock runs from where it stands (from the start when it stands at the end) to the end in playMs.
  useEffect(() => {
    if (!isPlaying || !start) return undefined;
    const playMs = replay?.playMs || 15000;
    let raf = 0;
    const step = (now) => {
      const next = Math.min(rec, start.from + ((now - start.at) / playMs) * rec);
      setT(next);
      if (next >= rec) { setPlaying(false); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, start, rec, replay?.playMs]);

  const togglePlay = () => {
    if (isPlaying) { setPlaying(false); return; }
    const from = t >= rec ? 0 : t;
    setT(from);
    setStart({ at: performance.now(), from });
    setPlaying(true);
  };
  const seek = useCallback((next) => { setPlaying(false); setT(Math.max(0, Math.min(rec, next))); }, [rec]);
  const onKey = (e) => {
    if (!prep) return;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = e.shiftKey ? Math.floor(t) + 60 : nextStop(prep.times, t);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = e.shiftKey ? Math.ceil(t) - 60 : prevStop(prep.times, t);
    else if (e.key === 'PageUp') next = t + rowSec;
    else if (e.key === 'PageDown') next = t - rowSec;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = rec;
    if (next === null) return;
    e.preventDefault();
    seek(next);
  };

  // "See it in the replay": bring the replay in and put the keyboard on the chip that is now on.
  useEffect(() => {
    if (!focus?.n || !root) return undefined;
    root.scrollIntoView({ behavior: readReduced() ? 'auto' : 'smooth', block: 'start' });
    root.querySelector(`[data-chip="${focus.chip}"]`)?.focus({ preventScroll: true });
    root.setAttribute('data-arrived', '');
    const id = setTimeout(() => root.removeAttribute('data-arrived'), 1400);
    return () => clearTimeout(id);
  }, [focus, root]);

  // A tap anywhere on a row's height picks the bar at that clock time, so the target is the whole row.
  const barAt = (e, r) => {
    const box = e.currentTarget.getBoundingClientRect();
    const row = replay.rows[r];
    const at = row.from + ((e.clientX - box.left) / Math.max(1, box.width)) * rowSec;
    const tol = (4 / Math.max(1, box.width)) * rowSec;
    const i = row.bars.findIndex((b) => at >= b.from - tol && at <= b.to + tol && Number.isInteger(b.n));
    return i < 0 ? null : { i, bar: row.bars[i] };
  };
  const openAt = (e, r) => {
    const hit = barAt(e, r);
    if (!hit) return;
    setSel((s) => (s === hit.bar.n ? null : hit.bar.n));
  };
  const hoverAt = (e, r) => {
    if (e.pointerType !== 'mouse') return;
    const hit = barAt(e, r);
    setHover((h) => {
      if (!hit) return null;
      return h?.row === r && h.i === hit.i ? h : { row: r, i: hit.i };
    });
  };

  // The opened question's panel comes into view below the grid, without moving focus off what was tapped.
  const [panel, setPanel] = useState(null);
  useEffect(() => {
    if (!panel || sel === null) return;
    panel.scrollIntoView({ behavior: readReduced() ? 'auto' : 'smooth', block: 'nearest' });
  }, [panel, sel]);

  if (!replay || !prep || !replay.rows?.length) return null;

  const settled = t >= rec;
  const nowBar = !settled ? prep.bars.find((b) => b.from <= t && t < b.to && Number.isInteger(b.n)) || null : null;
  const cells = mapAt(prep, total, t, settled);
  const lastRow = replay.rows.length - 1;
  const withPace = replay.rows.some((r) => r.evenPaceBy !== null && r.evenPaceBy !== undefined);
  const selQ = sel !== null ? prep.byN.get(sel) : null;
  const selRow = selQ ? (timeRead?.state === 'ready' ? timeRead.rows?.find((r) => r.number === selQ.n) : null) : null;
  const selGroupId = selQ ? lab?.byQuestion?.[selQ.qid]?.group || null : null;
  const selGroup = selGroupId ? (lab?.groups || []).find((g) => g.id === selGroupId) : null;
  const panelId = `${uid}-panel`;
  const verdict = selRow ? TIME_COPY.verdict[selRow.verdict] : selQ ? { right: TIME_COPY.verdict.correct, wrong: TIME_COPY.verdict.wrong, blank: TIME_COPY.verdict.skipped }[selQ.result] : null;

  return (
    <div className="rpl" ref={setRoot} data-in={inView || undefined} data-playing={isPlaying || undefined} data-filter={filter || undefined}>
      <div className="rpl-head">
        <h4 className="td-h">{labels.title}</h4>
        {labels.sub ? <p>{labels.sub}</p> : null}
      </div>

      {replay.chips?.length > 1 ? (
        <div className="rpl-chips" role="group" aria-label={labels.title}>
          {replay.chips.map((c) => {
            const on = (filter || 'all') === c.id;
            return (
              <button key={c.id} type="button" className="rpl-chip" data-chip={c.id} aria-pressed={on} onClick={() => pickChip(c.id)}>
                {c.id !== 'all' ? <span className="rpl-sw" data-g={c.id} aria-hidden="true" /> : null}
                <span>{c.label}</span>
                {Number.isInteger(c.count) ? <b>{c.count}</b> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="rpl-stage">
        <div className="rpl-player">
          {reduced ? (
            <div className="rpl-stepper">
              <button type="button" className="rpl-btn" onClick={() => seek(prevStop(prep.times, t))} disabled={t <= 0}>
                <StepBack size={16} strokeWidth={2.2} aria-hidden="true" /><span>{labels.previous}</span>
              </button>
              <button type="button" className="rpl-btn" onClick={() => seek(nextStop(prep.times, t))} disabled={t >= rec}>
                <StepForward size={16} strokeWidth={2.2} aria-hidden="true" /><span>{labels.next}</span>
              </button>
            </div>
          ) : (
            <button type="button" className="rpl-btn rpl-play" onClick={togglePlay} data-on={isPlaying || undefined}>
              {isPlaying ? <Pause size={16} strokeWidth={2.4} aria-hidden="true" /> : <Play size={16} strokeWidth={2.4} aria-hidden="true" />}
              <span>{isPlaying ? labels.pause : labels.play}</span>
            </button>
          )}
          <div className="rpl-clock">
            <span className="rpl-clock__time">{clockLabel(Math.floor(t))}</span>
            {nowBar ? (
              <button type="button" className="rpl-now" aria-expanded={sel === nowBar.n} aria-controls={panelId} onClick={() => setSel(nowBar.n)}>Q{nowBar.n}</button>
            ) : null}
          </div>
          {replay.end?.label ? <p className="rpl-endline" data-lit={settled || undefined}>{replay.end.label}</p> : null}
        </div>

        <input type="range" className="rpl-scrub" min={0} max={rec} step={1} value={Math.round(t)}
          aria-label={labels.title} aria-valuetext={clockLabel(Math.floor(t))}
          style={{ '--p': `${(t / rec) * 100}%` }}
          onChange={(e) => seek(Number(e.target.value))} onKeyDown={onKey} />

        <div className="rpl-map" aria-hidden="true" data-settled={settled || undefined}>
          <span className="rpl-map__end">Q1</span>
          <div className="rpl-map__cells">
            {cells.map((c, k) => (
              <span key={k} className="rpl-cell" data-s={c} style={{ '--i': k }}
                data-now={nowBar?.n === k + 1 || undefined} data-sel={sel === k + 1 || undefined}
                data-dim={filterSet && !filterSet.has(k + 1) ? '' : undefined} data-on={filterSet && filterSet.has(k + 1) ? '' : undefined} />
            ))}
          </div>
          <span className="rpl-map__end">Q{total}</span>
        </div>

        <div className="rpl-grid" ref={gridRef} onPointerLeave={() => setHover(null)}>
          {replay.rows.map((row, r) => {
            const height = row.bars.some((b) => b.away?.length) ? geo.rowHAway : geo.rowH;
            const litAt = r === lastRow && replay.end ? Math.min(row.to, replay.end.at) : row.to;
            return (
              <div key={row.from} className="rpl-row" style={{ '--r': r }}>
                <div className="rpl-row__plot" style={{ height }}>
                  {width > 0 ? (
                    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true"
                      onClick={(e) => openAt(e, r)} onPointerMove={(e) => hoverAt(e, r)}>
                      <RowGrid row={row} width={width} height={height} rowSec={rowSec} pid={`${uid}r${r}`}
                        sel={sel} filterSet={filterSet} hoverKey={hover?.row === r ? hover.i : null} end={replay.end} geo={geo} />
                      <RowLive row={row} width={width} height={height} rowSec={rowSec} t={t} settled={settled}
                        now={nowBar && nowBar.row === r ? nowBar : null} geo={geo} />
                    </svg>
                  ) : null}
                </div>
                <p className="rpl-row__end" data-lit={settled || t >= litAt || undefined}>{withNumbers(row.label)}</p>
              </div>
            );
          })}
        </div>
        <Legend present={prep.present} heldLabel={(lab?.groups || []).find((g) => g.id === 'held')?.label || null} />
      </div>

      {selQ ? (
        <div className="rpl-panel" id={panelId} ref={setPanel} role="region" aria-label={`Q${selQ.n}`}>
          <div className="rpl-panel__head">
            <div className="rpl-panel__title">
              <span className="rpl-panel__q">Q{selQ.n}</span>
              {verdict ? <span className="rpl-panel__verdict" data-r={selQ.result}>{verdict}</span> : null}
              {selGroup ? <span className="rpl-panel__group"><span className="rpl-sw" data-g={selGroup.id} aria-hidden="true" />{selGroup.label}</span> : null}
            </div>
            <button type="button" className="rpl-panel__close" onClick={() => setSel(null)} aria-label="Close"><X size={16} strokeWidth={2.2} aria-hidden="true" /></button>
          </div>
          <QuestionStrip replay={replay} number={selQ.n} />
          {selRow?.lines?.length ? (
            <ul className="rpl-panel__lines">
              {selRow.lines.map((line, i) => <li key={i}>{withNumbers(line)}</li>)}
            </ul>
          ) : null}
          {onJump ? <button type="button" className="ml-textbtn" onClick={() => onJump(selQ.n)}>Open the answer</button> : null}
        </div>
      ) : null}

      {replay.facts?.length ? (
        <ul className="rpl-facts">
          {replay.facts.map((f) => <li key={f}>{withNumbers(f)}</li>)}
        </ul>
      ) : null}
      <div className="rpl-fines">
        {labels.clockNote ? <p>{labels.clockNote}</p> : null}
        {withPace && labels.evenPaceNote ? <p>{labels.evenPaceNote}</p> : null}
      </div>
    </div>
  );
}
