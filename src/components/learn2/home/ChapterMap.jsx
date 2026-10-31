'use client';
// Learn home's chapter map (A3 3.2.6): the book in order, grouped by part and unit. Every row has one anatomy at every width: the
// chapter's name and its card count on the first line, then the state ring and word and one true meta line. From a 960 px container
// the two parts face each other like an open book. The sort menu (Book order, Due first, Needs work first, and Marks open only when
// a chapter has a figure) is the only control in its head: the one search field of the page is above. The part choice (LK2) is drawn
// at the option unit: the tapped side stays chosen at once, only that unit cross-fades inside a height animation, nothing above it
// moves, rows are keyed by chapter, and a failed save slides the indicator back with one line. Rows do not animate in: the panel
// arrives with its own fade.
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { isMotionReduced } from '@/lib/motion';
import { refreshHome, saveOption } from '@/components/keycards/api';
import {
  allNotStarted, cardsText, chapterTotal, displayTitle, effectiveChoice, marksText, metaLine, nothingToPlay, optionChapterCount, rowSpoken,
  shownOptionUnits, sortRows, sortsFor, stateShape, unitHeading, unitsSignature, visibleRefs, plural,
} from './homeModel.mjs';

const OUT_MS = 160;
const IN_MS = 220;
const HEIGHT_MS = 240;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** The ring beside a state word. The word says it first; the shape is the second, non-colour cue. */
export function StateRing({ shape }) {
  const r = 6.25;
  const c = 8;
  const fill = { thin: 0, weak: 0.25, mid: 0.5, strong: 1 }[shape] ?? 0;
  const pie = (f) => {
    if (f >= 1) return <circle cx={c} cy={c} r={r} fill="currentColor" />;
    if (f <= 0) return null;
    const a = f * 2 * Math.PI;
    const x = c + r * Math.sin(a);
    const y = c - r * Math.cos(a);
    return <path d={`M${c} ${c} L${c} ${c - r} A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`} fill="currentColor" />;
  };
  return (
    <svg className="lh-ring" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={shape === 'none' ? '2.2 2.2' : undefined} />
      {pie(fill)}
      {shape === 'unknown' ? <path d={`M${c - 2.6} ${c} H${c + 2.6}`} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /> : null}
    </svg>
  );
}

function Row({ row, href, marks, refLabel, bare }) {
  const shape = stateShape(row.state?.key);
  const empty = nothingToPlay(row);
  const meta = metaLine(row);
  const cards = cardsText(row);
  const m = marks ? marksText(row) : '';
  const detail = [refLabel, meta].filter(Boolean).join(', ');
  const showState = !bare && !empty;
  return (
    <li className="lh-row" data-empty={empty || undefined}>
      <Link className="lh-row__link" href={href} aria-label={rowSpoken(row, { marks })}>
        <b className="lh-row__title">{displayTitle(row.title)}</b>
        <span className="lh-row__count">{m ? <b className="lh-row__marks">{m}</b> : null}{cards ? <span>{cards}</span> : null}</span>
        {showState || detail ? (
          <span className="lh-row__sub">
            {showState ? <span className="lh-row__state" data-state={shape}><StateRing shape={shape} />{row.state?.label || 'Not started'}</span> : null}
            {detail ? <span className="lh-row__meta">{detail}</span> : null}
          </span>
        ) : null}
        <ChevronRight className="lh-row__chev" size={16} strokeWidth={2} aria-hidden="true" />
      </Link>
    </li>
  );
}

function Unit({ unit, links, bare }) {
  const heading = unitHeading(unit);
  const refs = visibleRefs(unit.chapters);
  return (
    <div className="lh-unit">
      {heading ? <h4 className="lh-unit__title">{displayTitle(heading)}</h4> : null}
      <ul className="lh-rows">
        {unit.chapters.map((row, i) => <Row key={row.key} row={row} href={links.chapter(row.key)} refLabel={refs[i]} bare={bare} />)}
      </ul>
    </div>
  );
}

/** The option units of a part, swapped as the part choice changes: the current rows fade out (160 ms), the other part's fade in
 *  (220 ms), and the box animates its height (240 ms). While the save is in flight the old rows stay in place, faded, so nothing below moves. */
function OptionGroup({ units, choice, links, instant, bare }) {
  const target = useMemo(() => shownOptionUnits(units, choice), [units, choice]);
  const sig = unitsSignature(target);
  const [shown, setShown] = useState(target);
  const [stage, setStage] = useState('idle');
  const box = useRef(null);
  const from = useRef(0);
  const outAt = useRef(0);
  const shownSig = unitsSignature(shown);

  useEffect(() => {
    if (sig === shownSig) {
      // Back to what is drawn (a failed save, or a refresh that changed nothing): fade it back in.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a timed cross-fade between two drawn states, not derived state
      if (stage === 'out') setStage('in');
      return undefined;
    }
    if (instant || isMotionReduced()) { setShown(target); setStage('idle'); return undefined; }
    if (stage !== 'out') {
      from.current = box.current?.offsetHeight || 0;
      outAt.current = performance.now();
      setStage('out');
      return undefined;
    }
    if (!target.length) return undefined; // the other part's rows have not arrived yet: hold, faded
    const wait = Math.max(0, OUT_MS - (performance.now() - outAt.current));
    const timer = window.setTimeout(() => { setShown(target); setStage('in'); }, wait);
    return () => window.clearTimeout(timer);
  }, [sig, shownSig, stage, target, instant]);

  useLayoutEffect(() => {
    if (stage !== 'in') return undefined;
    const el = box.current;
    const to = el?.offsetHeight || 0;
    if (el && from.current && Math.abs(to - from.current) > 1 && typeof el.animate === 'function') {
      el.animate([{ height: `${from.current}px`, overflow: 'hidden' }, { height: `${to}px`, overflow: 'hidden' }], { duration: HEIGHT_MS, easing: EASE });
    }
    from.current = 0;
    const timer = window.setTimeout(() => setStage('idle'), IN_MS);
    return () => window.clearTimeout(timer);
  }, [stage, shownSig]);

  return (
    <div className="lh-optgroup" ref={box} data-stage={stage} aria-hidden={stage === 'out' || undefined}>
      {shown.map((unit) => <Unit key={`${unit.optionId}:${unit.title}`} unit={unit} links={links} bare={bare} />)}
    </div>
  );
}

/** "Your part" with its choices: one sliding indicator; each choice says how many chapters it holds; the hint line keeps its height. */
function PartSwitch({ part, choice, status, onChoose }) {
  const { option } = part;
  const choices = option.choices || [];
  const index = choices.findIndex((c) => c.id === choice);
  const labelId = useId();
  const hint = status === 'saving' ? 'Saving your choice' : status === 'failed' ? 'Your choice was not saved. Try again.' : option.hint || (choice ? 'Only your part’s chapters show here and in your practice.' : 'Both parts show until you choose.');
  const key = (event, i) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = (i + (event.key === 'ArrowRight' ? 1 : choices.length - 1)) % choices.length;
    onChoose(choices[next].id);
    event.currentTarget.parentElement.querySelectorAll('[role="radio"]')[next]?.focus();
  };
  return (
    <div className="lh-opt">
      <p className="lh-opt__label" id={labelId}>{option.label || 'Your part'}</p>
      <div className="lh-opt__row" role="radiogroup" aria-labelledby={labelId} style={{ '--n': choices.length, '--i': Math.max(index, 0) }}>
        <span className="lh-opt__thumb" data-on={index >= 0 || undefined} aria-hidden="true" />
        {choices.map((c, i) => {
          const n = optionChapterCount(part.units, c.id);
          return (
            <button key={c.id} type="button" role="radio" aria-checked={choice === c.id} tabIndex={choice === c.id || (index < 0 && i === 0) ? 0 : -1} className="lh-opt__btn" onKeyDown={(e) => key(e, i)} onClick={() => onChoose(c.id)}>
              <span className="lh-opt__name">{c.label}</span>
              {n > 0 ? <span className="lh-opt__count">{plural(n, 'chapter')}</span> : null}
            </button>
          );
        })}
      </div>
      <p className="lh-opt__hint" role={status === 'failed' ? 'alert' : 'status'} data-failed={status === 'failed' || undefined}>{hint}</p>
    </div>
  );
}

function SortMenu({ value, onChange, items }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const current = items.find((i) => i.id === value) || items[0];
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  useEffect(() => { if (open) root.current?.querySelector('[aria-checked="true"]')?.focus(); }, [open]);
  const onKey = (e) => {
    if (e.key === 'Escape') { setOpen(false); root.current?.querySelector('button')?.focus(); }
    if (e.key === 'Tab') setOpen(false);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const list = [...root.current.querySelectorAll('[role="menuitemradio"]')];
      const at = list.indexOf(document.activeElement);
      list[(at + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus();
    }
  };
  return (
    <div className="lh-sort" ref={root} onKeyDown={onKey} onBlur={(e) => { if (open && !root.current?.contains(e.relatedTarget)) setOpen(false); }}>
      <button type="button" className="lh-sort__btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="lh-sort__word">{current.label}</span><ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {open ? (
        <div className="lh-sort__list" role="menu" aria-label="Sort chapters">
          {items.map((item) => (
            <button key={item.id} type="button" role="menuitemradio" aria-checked={value === item.id} className="lh-sort__item" onClick={() => { onChange(item.id); setOpen(false); root.current?.querySelector('button')?.focus(); }}>{item.label}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The map before its data, at its final shape: the head and rows of 64 px (eight; the spread shows them in two columns). */
export function MapSkeleton() {
  return (
    <div className="lh-skelmap" aria-hidden="true">
      <span className="skeleton lh-skelmap__head" />
      <div className="lh-skelmap__rows">
        {Array.from({ length: 8 }).map((_, i) => <span key={i} className="skeleton lh-skelmap__row" />)}
      </div>
    </div>
  );
}

export function MapError({ onRetry, busy }) {
  return (
    <div className="lh-err" role="alert">
      <h3>Learn did not load</h3>
      <p>Check your connection and try again. Your cards and their schedule are safe.</p>
      <button type="button" className="lh-key lh-key--line" onClick={onRetry} disabled={busy}>Try again</button>
    </div>
  );
}

export default function ChapterMap({ parts, subjectId, links, refresh }) {
  const [sort, setSort] = useState('book');
  const [local, setLocal] = useState({});
  const [status, setStatus] = useState({});
  const saving = useRef({});
  const headId = useId();

  const choose = useCallback(async (part, id) => {
    const now = effectiveChoice(part, local);
    if (id === now || saving.current[part.id]) return;
    saving.current[part.id] = true;
    setLocal((l) => ({ ...l, [part.id]: id }));
    setStatus((s) => ({ ...s, [part.id]: 'saving' }));
    let agreed = false;
    try {
      await saveOption({ subject: subjectId, option: id });
      refreshHome();
      const body = await refresh();
      const fresh = body?.parts?.find((p) => p.id === part.id);
      agreed = Boolean(fresh && fresh.option?.chosen === id);
    } catch { agreed = false; }
    saving.current[part.id] = false;
    // Agreed: the held choice is dropped once the body that says so is on screen (the effect below), so nothing flashes back.
    // Not agreed: it is dropped now, the indicator slides back and one line says why.
    if (agreed) { setStatus((st) => ({ ...st, [part.id]: 'idle' })); return; }
    setLocal((l) => { const n = { ...l }; delete n[part.id]; return n; });
    setStatus((st) => ({ ...st, [part.id]: 'failed' }));
  }, [local, subjectId, refresh]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drops a held choice once the server's body agrees with it
    setLocal((l) => {
      const n = { ...l };
      let changed = false;
      for (const part of parts) if (n[part.id] && part.option?.chosen === n[part.id]) { delete n[part.id]; changed = true; }
      return changed ? n : l;
    });
  }, [parts]);

  const items = useMemo(() => sortsFor(parts), [parts]);
  const activeSort = items.some((i) => i.id === sort) ? sort : 'book';
  const flat = useMemo(() => (activeSort === 'book' ? null : sortRows(parts, activeSort)), [activeSort, parts]);
  const fresh = useMemo(() => allNotStarted(parts), [parts]);
  const total = chapterTotal(parts);
  const marks = activeSort === 'marks';

  if (!parts.length) {
    return (
      <section className="lh-map" aria-labelledby={headId}>
        <div className="lh-map__head"><h2 id={headId} className="lh-h2">Chapters</h2></div>
        <div className="lh-none"><p>No chapters here yet.</p></div>
      </section>
    );
  }

  return (
    <section className="lh-map" aria-labelledby={headId} data-flat={flat ? '' : undefined}>
      <div className="lh-map__head">
        <h2 id={headId} className="lh-h2">Chapters</h2>
        {items.length > 1 ? <SortMenu value={activeSort} onChange={setSort} items={items} /> : null}
      </div>
      {fresh ? <p className="lh-map__new">{total === 1 ? 'This chapter is new to you.' : `All ${total} chapters are new to you.`}</p> : null}

      {flat ? (
        <ul className="lh-rows lh-rows--flat">
          {flat.map(({ row }) => <Row key={row.key} row={row} href={links.chapter(row.key)} marks={marks} refLabel={row.ref || ''} bare={fresh} />)}
        </ul>
      ) : (
        <div className="lh-map__parts" data-parts={parts.length}>
          {parts.map((part) => {
            const firstOption = part.units.findIndex((u) => u.optionId);
            const choice = effectiveChoice(part, local);
            const out = [];
            part.units.forEach((unit, i) => {
              if (unit.optionId) {
                if (i !== firstOption) return;
                if (part.option) out.push(<PartSwitch key={`${part.id}-switch`} part={part} choice={choice} status={status[part.id]} onChoose={(id) => choose(part, id)} />);
                const units = part.units.filter((u) => u.optionId);
                out.push(<OptionGroup key={`${part.id}-opts`} units={units} choice={choice} links={links} bare={fresh} />);
                return;
              }
              out.push(<Unit key={`${unit.optionId}:${unit.title}:${i}`} unit={unit} links={links} bare={fresh} />);
            });
            return (
              <section className="lh-part" key={part.id} aria-label={part.title}>
                <h3 className="lh-part__title">{part.title}</h3>
                <div className="lh-part__units">{out}</div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
