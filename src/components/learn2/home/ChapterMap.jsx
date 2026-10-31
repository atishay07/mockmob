'use client';
// Learn home's chapter map (B 3.1 and 3.2): the book in order, grouped by part and unit, one row per chapter with its state
// ring and word, its card count and one meta line. The sort menu (Book order, Marks open) and the live chapter filter live in its
// head. The part choice (LK2) is drawn at the option unit: the tapped side stays chosen at once, only that unit cross-fades inside
// a height animation, nothing above it moves, rows are keyed by chapter, and a failed save slides the indicator back with one line.
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { isMotionReduced } from '@/lib/motion';
import { refreshHome, saveOption } from '@/components/keycards/api';
import { cardsText, effectiveChoice, filterParts, marksOrder, marksText, displayTitle, metaLine, rowSpoken, shownOptionUnits, stateShape, unitHeading, unitsSignature } from './homeModel.mjs';

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
    <svg className="lh-ring" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={shape === 'none' ? '2.2 2.2' : undefined} />
      {pie(fill)}
      {shape === 'unknown' ? <path d={`M${c - 2.6} ${c} H${c + 2.6}`} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /> : null}
    </svg>
  );
}

function Row({ row, href, marks, index, enter }) {
  const shape = stateShape(row.state?.key);
  const meta = metaLine(row);
  const cards = cardsText(row);
  const m = marks ? marksText(row) : '';
  return (
    <li className="lh-row" data-enter={enter || undefined} style={{ '--i': Math.min(index, 12) }}>
      <Link className="lh-row__link" href={href} aria-label={rowSpoken(row, { marks })}>
        <span className="lh-row__main">
          <b className="lh-row__title">{displayTitle(row.title)}</b>
          {row.ref || meta ? <span className="lh-row__sub">{row.ref ? <span className="lh-row__ref">{row.ref}</span> : null}{meta ? <span className="lh-row__meta">{meta}</span> : null}</span> : null}
        </span>
        <span className="lh-row__state" data-state={shape}><StateRing shape={shape} />{row.state?.label || 'Not started'}</span>
        <span className="lh-row__count" data-none={!cards && !m ? '' : undefined}>{m ? <b className="lh-row__marks">{m}</b> : null}{cards ? <span>{cards}</span> : null}</span>
        <ChevronRight className="lh-row__chev" size={18} strokeWidth={2} aria-hidden="true" />
      </Link>
    </li>
  );
}

function Unit({ unit, links, enter, offset, marks }) {
  const heading = unitHeading(unit);
  return (
    <div className="lh-unit">
      {heading ? <h4 className="lh-unit__title">{displayTitle(heading)}</h4> : null}
      <ul className="lh-rows">
        {unit.chapters.map((row, i) => <Row key={row.key} row={row} href={links.chapter(row.key)} marks={marks} index={offset + i} enter={enter} />)}
      </ul>
    </div>
  );
}

/** The option units of a part, swapped as the part choice changes: the current rows fade out (160 ms), the other part's fade in
 *  (220 ms), and the box animates its height (240 ms). While the save is in flight the old rows stay in place, faded, so nothing below moves. */
function OptionGroup({ units, choice, links, enter, offset, instant }) {
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

  let at = offset;
  return (
    <div className="lh-optgroup" ref={box} data-stage={stage} aria-hidden={stage === 'out' || undefined}>
      {shown.map((unit) => {
        const el = <Unit key={`${unit.optionId}:${unit.title}`} unit={unit} links={links} enter={enter} offset={at} />;
        at += unit.chapters.length;
        return el;
      })}
    </div>
  );
}

/** "Your part" with its choices: one sliding indicator; the tapped side stays chosen; the hint line keeps its height. */
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
        {choices.map((c, i) => (
          <button key={c.id} type="button" role="radio" aria-checked={choice === c.id} tabIndex={choice === c.id || (index < 0 && i === 0) ? 0 : -1} className="lh-opt__btn" onKeyDown={(e) => key(e, i)} onClick={() => onChoose(c.id)}>{c.label}</button>
        ))}
      </div>
      <p className="lh-opt__hint" role={status === 'failed' ? 'alert' : 'status'} data-failed={status === 'failed' || undefined}>{hint}</p>
    </div>
  );
}

function SortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const items = [{ id: 'book', label: 'Book order' }, { id: 'marks', label: 'Marks open' }];
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
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const list = [...root.current.querySelectorAll('[role="menuitemradio"]')];
      const at = list.indexOf(document.activeElement);
      list[(at + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus();
    }
  };
  return (
    <div className="lh-sort" ref={root} onKeyDown={onKey}>
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

export function MapSkeleton() {
  return (
    <div className="lh-skelmap" aria-hidden="true">
      <span className="skeleton lh-skelmap__head" />
      {Array.from({ length: 8 }).map((_, i) => <span key={i} className="skeleton lh-skelmap__row" />)}
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
  const [query, setQuery] = useState('');
  const [local, setLocal] = useState({});
  const [status, setStatus] = useState({});
  const [enter, setEnter] = useState(true);
  const searchId = useId();
  const saving = useRef({});

  // The map's entrance plays once per visit; a sort, a filter or a part change never replays it.
  useEffect(() => { const t = window.setTimeout(() => setEnter(false), 900); return () => window.clearTimeout(t); }, []);

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
    setLocal((l) => {
      const n = { ...l };
      let changed = false;
      for (const part of parts) if (n[part.id] && part.option?.chosen === n[part.id]) { delete n[part.id]; changed = true; }
      return changed ? n : l;
    });
  }, [parts]);

  const filtering = query.trim().length > 0;
  const shownParts = useMemo(() => filterParts(parts, query), [parts, query]);
  const marks = sort === 'marks';
  const flat = useMemo(() => (marks ? marksOrder(shownParts) : null), [marks, shownParts]);
  const count = shownParts.reduce((n, p) => n + p.units.reduce((m, u) => m + u.chapters.length, 0), 0);

  let at = 0;
  return (
    <section className="lh-map" aria-labelledby={`${searchId}-h`}>
      <div className="lh-map__head">
        <h2 id={`${searchId}-h`} className="lh-h2">Chapters</h2>
        <SortMenu value={sort} onChange={setSort} />
        <div className="lh-search">
          <Search size={16} strokeWidth={2} aria-hidden="true" className="lh-search__icon" />
          <input id={searchId} type="search" className="lh-search__input" placeholder="Search chapters" aria-label="Search chapters" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" enterKeyHint="search" />
          {query ? <button type="button" className="lh-search__clear" aria-label="Clear search" onClick={() => setQuery('')}><X size={16} strokeWidth={2.2} aria-hidden="true" /></button> : null}
        </div>
      </div>
      <p className="sr-only" role="status">{filtering ? `${count} ${count === 1 ? 'chapter matches' : 'chapters match'}` : ''}</p>

      {filtering && !count ? (
        <div className="lh-none"><p>No chapter matches “{query.trim()}”.</p><button type="button" className="lh-key lh-key--line" onClick={() => setQuery('')}>Clear search</button></div>
      ) : marks ? (
        <ul className="lh-rows lh-rows--flat">
          {flat.map(({ row }, i) => <Row key={row.key} row={row} href={links.chapter(row.key)} marks index={i} enter={enter} />)}
        </ul>
      ) : (
        shownParts.map((part) => {
          const firstOption = part.units.findIndex((u) => u.optionId);
          const choice = effectiveChoice(part, local);
          const out = [];
          const start = at;
          part.units.forEach((unit, i) => {
            if (unit.optionId) {
              if (i !== firstOption) return;
              if (!filtering && part.option) out.push(<PartSwitch key={`${part.id}-switch`} part={part} choice={choice} status={status[part.id]} onChoose={(id) => choose(part, id)} />);
              const units = part.units.filter((u) => u.optionId);
              out.push(<OptionGroup key={`${part.id}-opts`} units={units} choice={choice} links={links} enter={enter} offset={at} instant={filtering} />);
              at += units.reduce((n, u) => n + u.chapters.length, 0);
              return;
            }
            out.push(<Unit key={`${unit.optionId}:${unit.title}:${i}`} unit={unit} links={links} enter={enter} offset={at} />);
            at += unit.chapters.length;
          });
          return (
            <section className="lh-part" key={part.id} aria-label={part.title} data-start={start}>
              <h3 className="lh-part__title">{part.title}</h3>
              {out}
            </section>
          );
        })
      )}
    </section>
  );
}
