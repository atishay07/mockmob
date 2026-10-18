"use client";
// The replay, pass 1018 (docs/design-decisions/pass-1018/REVIEW-RESULT-1018.md section 6, packet P-RR3; owner D17: "if
// there are just 10 questions, then show it according to 10 questions only ... only just gray boxes going and going").
//
// One slot per question of this paper, in paper order, sized to the width (slotLayout: 10 questions at 358 px are one row
// of wide slots; 50 are two rows of 25). Colour is the result; height is the time on the question over the paper's even
// pace (capped at 3x), against a dashed even-pace line; a ring marks a changed answer. Selecting a slot gives one detail
// line. Play walks the real events (a pick, a change, a cleared answer, a return visit, the submit) in about 12 seconds
// with one caption; Previous and Next step one event. Questions not yet reached are dimmed. Collapse folds it to one line
// of ticks (remembered on this device). A paper with nothing to replay (under 2 minutes, fewer than 3 answer events, or
// no usable record) draws no replay and says so in one sentence. Motion is transform and opacity only, 180-200 ms; under
// reduced motion Play steps one event a press. Words: data/mistake_lab.copy.json replay.slots, shared with the app.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import COPY from '@/../data/mistake_lab.copy.json';
import { SLOT_RULES, cutIndexLine, cutSentence, eventCaption, replayView, slotLayout, spokenTime } from '@/../data/replay';
import { fill, spentLabel, clockLabel } from '@/../data/paper_trace';
import './replay-slots.css';

const S = COPY.replay.slots;
const PLAY_MS = 12000;
const STORE = 'mm:replay:collapsed:v1';
const H_PHONE = 76;
const H_WIDE = 96;

const readReduced = () => { try { return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } };
const readCollapsed = () => { try { return window.localStorage.getItem(STORE) === '1'; } catch { return false; } };
const writeCollapsed = (v) => { try { window.localStorage.setItem(STORE, v ? '1' : '0'); } catch { /* per-device convenience only */ } };

function useWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** "the even pace" in words: "1m 12s". */
const paceWords = (sec) => spentLabel(sec);

function Cut({ view, cutLink, known }) {
  return (
    <div className="rs-cut" role="note">
      <b>{S.cutTitle}</b>
      <p>{cutSentence(view, { known })}</p>
      {cutLink ? <Link className="rs-link" href={cutLink.href}>{cutLink.label}</Link> : null}
    </div>
  );
}

/** The index line for Time and changes when nothing is drawn: "58 seconds. Nothing to replay." `known` is the paper's own total time and changed answers (knownRecord). */
export function replayCutLine(replay, total, known = null) {
  return cutIndexLine(replayView(replay, { total }), { known });
}

export default function ReplaySlots({ replay, rows = [], paceSec = null, onJump, cutLink = null, known = null }) {
  const total = rows.length || replay?.total || 0;
  const view = useMemo(() => replayView(replay, { total }), [replay, total]);
  const byN = useMemo(() => new Map(rows.map((r) => [r.number, r])), [rows]);
  const keyOf = useCallback((n) => byN.get(n)?.q?.correctIndex ?? null, [byN]);
  const pace = paceSec || (replay?.durationSec && total ? replay.durationSec / total : null) || (view.recordSec && total ? view.recordSec / total : 60);
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  // The result renders on the client after its read, so the device's choice is read at once (default: expanded).
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [sel, setSel] = useState(null);
  // Play: t is the paper clock; null is at rest (the whole paper, settled).
  const [t, setT] = useState(null);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  const events = view.events;
  const stopAt = useCallback(() => { cancelAnimationFrame(raf.current); setPlaying(false); }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const play = useCallback(() => {
    if (!events.length) return;
    if (readReduced()) { // one event a press, nothing slides
      const from = t ?? -1;
      const next = events.find((e) => e.at > from + 0.001);
      setT(next ? next.at : null);
      return;
    }
    const start = t === null || t >= view.recordSec ? 0 : t;
    const began = performance.now() - (start / Math.max(1, view.recordSec)) * PLAY_MS;
    setPlaying(true);
    const tick = (now) => {
      const p = Math.min(1, (now - began) / PLAY_MS);
      const at = p * view.recordSec;
      setT(at);
      if (p < 1) raf.current = requestAnimationFrame(tick); else { setPlaying(false); setT(null); }
    };
    raf.current = requestAnimationFrame(tick);
  }, [events, t, view.recordSec]);
  const step = (dir) => {
    stopAt();
    const now = t ?? (dir > 0 ? -1 : view.recordSec + 1);
    const e = dir > 0 ? events.find((x) => x.at > now + 0.001) : [...events].reverse().find((x) => x.at < now - 0.001);
    if (e) { setT(e.at); if (e.n) setSel(e.n); } else if (dir > 0) setT(null);
  };

  if (view.cut) return <Cut view={view} cutLink={cutLink} known={known} />;

  const settled = t === null;
  const current = settled ? null : [...events].reverse().find((e) => e.at <= t + 0.001) || null;
  const caption = current ? eventCaption(current, { key: keyOf(current.n) }) : null;
  // Seconds on each question up to the clock (at rest: the whole paper).
  const spentAt = (q) => {
    if (settled) return q.sec;
    const f = view.firstAt.get(q.n);
    if (f === null || f === undefined || f > t) return 0;
    return Math.min(q.sec, Math.max(0, t - f));
  };
  const changedBy = (n) => events.some((e) => e.n === n && e.kind === 'change' && (settled || e.at <= t));
  const reached = (n) => settled || (view.firstAt.get(n) ?? Infinity) <= t;

  const minSlot = width && width < 768 ? SLOT_RULES.minSlotPhone : SLOT_RULES.minSlotWide;
  const { perRow } = slotLayout(total, width || 358, minSlot);
  const H = width && width < 560 ? H_PHONE : H_WIDE;
  const lines = [];
  for (let i = 0; i < view.perQuestion.length; i += perRow) lines.push(view.perQuestion.slice(i, i + perRow));
  const labelled = (n) => perRow <= SLOT_RULES.labelsAllUpTo || n === 1 || n % 5 === 0 || n === total;
  const selected = sel ? view.perQuestion.find((q) => q.n === sel) : null;
  const detail = selected ? (() => {
    const row = byN.get(selected.n);
    const D = S.detail;
    const letter = (i) => (Number.isInteger(i) ? 'ABCDEFGH'[i] || String(i + 1) : '');
    const changes = events.filter((e) => e.n === selected.n && (e.kind === 'pick' || e.kind === 'change'));
    const picks = changes.map((e, i) => fill(i === 0 ? D.first : D.later, { to: letter(e.to), at: clockLabel(e.at) })).join(', ');
    const res = D[selected.result === 'right' ? 'right' : selected.result === 'wrong' ? 'wrong' : selected.result === 'held' ? 'held' : 'blank'];
    return [`Q${selected.n}`, row?.chapter, fill(D.pace, { time: spentLabel(selected.sec), pace: paceWords(pace) }), picks || D.none, res].filter(Boolean).join(' · ');
  })() : null;
  const away = view.awayCount ? (view.awayCount === 1 ? fill(S.awayOne, { time: spentLabel(view.awaySec) }) : fill(S.awayMany, { k: view.awayCount, time: spentLabel(view.awaySec) })) : '';
  const facts = (replay.facts || []).slice(1).join(' ');
  const rest = [fill(S.rest, { a: view.answered, total, time: spentLabel(view.recordSec) }), facts, away].filter(Boolean).join(' ');

  return (
    <div className="rs" ref={wrapRef} data-playing={playing || undefined}>
      <div className="rs-head">
        <p className="rs-clock"><b>{clockLabel(Math.round(settled ? view.recordSec : t))}</b><span>{fill(S.of, { time: clockLabel(view.recordSec) })}</span></p>
        <div className="rs-ctl">
          <button type="button" className="rs-btn mk-press" onClick={() => step(-1)} aria-label="Previous event"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button>
          <button type="button" className="rs-btn rs-play mk-press" onClick={playing ? stopAt : play} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zM13 5h3v14h-3z" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>}
            <span>{playing ? 'Pause' : 'Play'}</span>
          </button>
          <button type="button" className="rs-btn mk-press" onClick={() => step(1)} aria-label="Next event"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></button>
        </div>
      </div>
      <p className="rs-cap" aria-live="polite">{caption ? <><b>{caption.at}</b>{caption.text}</> : rest}</p>
      {collapsed ? (
        <div className="rs-line" role="img" aria-label={`${total} questions: ${view.perQuestion.filter((q) => q.result === 'right').length} right, ${view.perQuestion.filter((q) => q.result === 'wrong').length} wrong, ${view.perQuestion.filter((q) => q.result === 'blank').length} blank`}>
          <div className="rs-line__ticks" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
            {view.perQuestion.map((q) => <i key={q.n} data-v={q.result} data-dim={!reached(q.n) || undefined} />)}
          </div>
          <div className="rs-line__lab"><span>Q1</span><span>Q{total}</span></div>
        </div>
      ) : (
        <div className="rs-grid" style={{ '--h': `${H}px` }}>
          {lines.map((line, li) => (
            <div key={li} className="rs-row" style={{ gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))` }}>
              <span className="rs-pace" aria-hidden="true" />
              {line.map((q) => {
                const f = Math.min(SLOT_RULES.cap, spentAt(q) / pace) / SLOT_RULES.cap;
                const isNow = current?.n === q.n;
                return (
                  <button key={q.n} type="button" className="rs-q" data-v={q.result} data-sel={sel === q.n || undefined} data-now={isNow || undefined}
                    data-dim={!reached(q.n) || undefined} data-changed={changedBy(q.n) || undefined}
                    style={{ '--f': Math.max(0.02, f) }}
                    aria-pressed={sel === q.n} aria-label={`Question ${q.n}: ${q.result}, ${spentLabel(q.sec)}${q.changed ? ', answer changed' : ''}`}
                    onClick={() => setSel(sel === q.n ? null : q.n)}>
                    <span className="rs-col"><i style={{ transform: `scaleY(${Math.max(0.02, f)})` }} /></span>
                    <em>{labelled(q.n) ? q.n : ''}</em>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <p className="rs-detail" aria-live="polite">
        {detail ? <>{detail}{onJump ? <> <button type="button" className="rs-inline" onClick={() => onJump(selected.n)}>{fill(S.detail.open, { n: selected.n })}</button></> : null}</> : S.detail.select}
      </p>
      <div className="rs-foot">
        <p className="rs-key">
          <span><i data-k="right" />{S.key.right}</span><span><i data-k="wrong" />{S.key.wrong}</span><span><i data-k="blank" />{S.key.blank}</span>
          <span><i data-k="changed" />{S.key.changed}</span><span><i data-k="pace" />{S.key.pace} {paceWords(pace)}</span>
        </p>
        <button type="button" className="rs-toggle" aria-expanded={!collapsed} onClick={() => { const v = !collapsed; setCollapsed(v); writeCollapsed(v); }}>
          {collapsed ? fill(S.expand, { total }) : S.collapse}
        </button>
      </div>
    </div>
  );
}

// One read of the replay per paper, shared by every opened answer's strip.
const VIEWS = new WeakMap();
function viewOf(replay) {
  if (!replay || typeof replay !== 'object') return null;
  if (!VIEWS.has(replay)) VIEWS.set(replay, replayView(replay));
  return VIEWS.get(replay);
}

/**
 * QuestionStrip({ replay, number, paceSec }): the replay in miniature inside an opened answer's "Your time and picks" (P-RR3):
 * the paper's own slots, one a question, with this question's slot lit and the rest quiet, so its time reads against the paper
 * and the even pace. Nothing when there is no replay to draw (a cut paper, or a question with no time).
 */
export function QuestionStrip({ replay, number, paceSec = null }) {
  const view = viewOf(replay);
  if (!view || view.cut || !view.perQuestion.length) return null;
  const total = view.perQuestion.length;
  const own = view.perQuestion[number - 1];
  if (!own) return null;
  const pace = paceSec || (replay.durationSec && total ? replay.durationSec / total : null) || (view.recordSec / total) || 60;
  return (
    <div className="rs-mini" aria-hidden="true">
      <div className="rs-mini__cols" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        <span className="rs-mini__pace" />
        {view.perQuestion.map((q) => (
          <i key={q.n} data-v={q.result} data-own={q.n === number || undefined} style={{ '--f': Math.max(0.04, Math.min(SLOT_RULES.cap, q.sec / pace) / SLOT_RULES.cap) }} />
        ))}
      </div>
      <div className="rs-mini__lab"><span>Q1</span><span>{fill(S.mini, { n: number, time: spentLabel(own.sec), pace: paceWords(pace) })}</span><span>Q{total}</span></div>
    </div>
  );
}
