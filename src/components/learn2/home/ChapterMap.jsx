'use client';
// Learn home's "Your roadmap" (R2 ruling 2, LK10, LK24; it was the chapter ledger, A3 3.2.6): the book in order, grouped by part and
// unit. Every row has one anatomy at every width: the chapter's name, one coverage line ("31 of 46 cards seen · 4 of 10 questions
// tried") and a 3 px bar of the cards seen. The only verdict word is "Needs work"; the chapter the student is in carries "Start here"
// (a first-timer) or "Up next". No %, never "mastered", never a zero. A chapter with nothing to play yet is muted, "Coming soon".
// From a 960 px container the two parts face each other like an open book. The sort menu (Book order, Needs work first) is the only
// control in its head. The part choice (LK2) is one line under the part's heading ("Your school teaches" and two chips): the tapped
// side stays chosen at once, only the option units cross-fade inside a height animation, rows are keyed by chapter, and a failed save
// slides back with one line. Rows do not animate in: the panel arrives with its own fade; the bars fill once.
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { isMotionReduced } from '@/lib/motion';
import { refreshHome, saveOption } from '@/components/keycards/api';
import {
  displayTitle, effectiveChoice, flatRows, metaLine, nothingToPlay, optionChapterCount, plural, roadmapRow, shownOptionUnits, sortRows, sortsFor,
  unitHeading, unitsSignature,
} from './homeModel.mjs';

const OUT_MS = 160;
const IN_MS = 220;
const HEIGHT_MS = 240;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** The ring beside a state word (the chapter page still draws it). The word says it first; the shape is the second, non-colour cue. */
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

function Row({ row, href, isPro, here }) {
  const empty = nothingToPlay(row);
  const road = roadmapRow(row, { isPro });
  if (empty) road.verdict = null; // a chapter with nothing to play yet carries no verdict, only "Coming soon"
  const line = empty ? 'Coming soon' : road.line || metaLine(row);
  const spoken = [displayTitle(row.title), here, road.verdict, line].filter(Boolean).join('. ');
  const inner = (
    <>
      <span className="lh-row__head">
        <b className="lh-row__title">{displayTitle(row.title)}</b>
        {here ? <span className="lh-row__here">{here}</span> : road.verdict ? <span className="lh-row__verdict">{road.verdict}</span> : null}
      </span>
      {line ? <span className="lh-row__meta">{line}</span> : null}
      {road.seen > 0 ? <span className="lh-row__bar" aria-hidden="true"><span style={{ '--p': road.share }} /></span> : null}
      {empty ? null : <ChevronRight className="lh-row__chev" size={16} strokeWidth={2} aria-hidden="true" />}
    </>
  );
  return (
    <li className="lh-row" data-empty={empty || undefined} data-here={here ? '' : undefined} data-chapter={row.key}>
      {empty ? <div className="lh-row__link" role="group" aria-label={spoken}>{inner}</div> : <Link className="lh-row__link" href={href} aria-label={spoken}>{inner}</Link>}
    </li>
  );
}

function Unit({ unit, links, isPro, here }) {
  const heading = unitHeading(unit);
  return (
    <div className="lh-unit">
      {heading ? <h4 className="lh-unit__title">{displayTitle(heading)}</h4> : null}
      <ul className="lh-rows">
        {unit.chapters.map((row) => <Row key={row.key} row={row} href={links.chapter(row.key)} isPro={isPro} here={here?.key === row.key ? here.label : null} />)}
      </ul>
    </div>
  );
}

/** The option units of a part, swapped as the part choice changes: the current rows fade out (160 ms), the other part's fade in
 *  (220 ms), and the box animates its height (240 ms). While the save is in flight the old rows stay in place, faded, so nothing below moves. */
function OptionGroup({ units, choice, links, instant, isPro, here }) {
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
      {shown.map((unit) => <Unit key={`${unit.optionId}:${unit.title}`} unit={unit} links={links} isPro={isPro} here={here} />)}
    </div>
  );
}

/**
 * "Your part" as one line under the part's heading (phone-clarity.md item 9): "Your school teaches" and the choices as chips. Until
 * one is chosen both show (that needs no sentence); a save in flight, or a failed one, says so in one short line.
 */
function PartSwitch({ part, choice, status, onChoose }) {
  const choices = part.option.choices || [];
  const labelId = useId();
  const index = choices.findIndex((c) => c.id === choice);
  const key = (event, i) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = (i + (event.key === 'ArrowRight' ? 1 : choices.length - 1)) % choices.length;
    onChoose(choices[next].id);
    event.currentTarget.parentElement.querySelectorAll('[role="radio"]')[next]?.focus();
  };
  return (
    <div className="lh-opt">
      <span className="lh-opt__label" id={labelId}>Your school teaches</span>
      <div className="lh-opt__row" role="radiogroup" aria-labelledby={labelId}>
        {choices.map((c, i) => {
          const n = optionChapterCount(part.units, c.id);
          return (
            <button key={c.id} type="button" role="radio" aria-checked={choice === c.id} tabIndex={choice === c.id || (index < 0 && i === 0) ? 0 : -1} className="lh-opt__btn"
              aria-label={n > 0 ? `${c.label}, ${plural(n, 'chapter')}` : c.label} onKeyDown={(e) => key(e, i)} onClick={() => onChoose(c.id)}>
              {c.label}
            </button>
          );
        })}
      </div>
      {status === 'saving' || status === 'failed'
        ? <p className="lh-opt__hint" role={status === 'failed' ? 'alert' : 'status'} data-failed={status === 'failed' || undefined}>{status === 'failed' ? 'Your choice was not saved. Try again.' : 'Saving your choice'}</p>
        : null}
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

export default function ChapterMap({ parts, subjectId, links, refresh, isPro = true, position = null, isNew = false, id }) {
  const [sort, setSort] = useState('book');
  const [local, setLocal] = useState({});
  const [status, setStatus] = useState({});
  const saving = useRef({});
  const headId = useId();

  const choose = useCallback(async (part, choiceId) => {
    const now = effectiveChoice(part, local);
    if (choiceId === now || saving.current[part.id]) return;
    saving.current[part.id] = true;
    setLocal((l) => ({ ...l, [part.id]: choiceId }));
    setStatus((s) => ({ ...s, [part.id]: 'saving' }));
    let agreed = false;
    try {
      await saveOption({ subject: subjectId, option: choiceId });
      refreshHome();
      const body = await refresh();
      const fresh = body?.parts?.find((p) => p.id === part.id);
      agreed = Boolean(fresh && fresh.option?.chosen === choiceId);
    } catch { agreed = false; }
    saving.current[part.id] = false;
    // Agreed: the held choice is dropped once the body that says so is on screen (the effect below), so nothing flashes back.
    // Not agreed: it is dropped now, the chip slides back and one line says why.
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

  // Book order and Needs work first: the rows carry no due counts or marks, so a sort by them would order by something unseen.
  const items = useMemo(() => sortsFor(parts).filter((s) => s.id === 'book' || s.id === 'needs'), [parts]);
  const activeSort = items.some((i) => i.id === sort) ? sort : 'book';
  const flat = useMemo(() => (activeSort === 'book' ? null : sortRows(parts, activeSort)), [activeSort, parts]);
  const playable = flatRows(parts).map(({ row }) => row).filter((row) => !nothingToPlay(row));
  const started = playable.filter((row) => (Number(row.progress?.seen) || 0) > 0 || (Number(row.progress?.tried) || 0) > 0).length;
  const here = position ? { key: position, label: isNew ? 'Start here' : 'Up next' } : null;

  if (!parts.length) {
    return (
      <section className="lh-map" id={id} aria-labelledby={headId}>
        <div className="lh-map__head"><h2 id={headId} className="lh-h2">Your roadmap</h2></div>
        <div className="lh-none"><p>No chapters here yet.</p></div>
      </section>
    );
  }

  return (
    <section className="lh-map" id={id} aria-labelledby={headId} data-flat={flat ? '' : undefined} tabIndex={-1}>
      <div className="lh-map__head">
        <h2 id={headId} className="lh-h2">Your roadmap</h2>
        {items.length > 1 ? <SortMenu value={activeSort} onChange={setSort} items={items} /> : null}
      </div>
      <p className="lh-map__new">{started > 0 ? `${started} of ${plural(playable.length, 'chapter')} started` : `${plural(playable.length, 'chapter')}, in book order`}</p>

      {flat ? (
        <ul className="lh-rows lh-rows--flat">
          {flat.map(({ row }) => <Row key={row.key} row={row} href={links.chapter(row.key)} isPro={isPro} here={here?.key === row.key ? here.label : null} />)}
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
                const units = part.units.filter((u) => u.optionId);
                out.push(<OptionGroup key={`${part.id}-opts`} units={units} choice={choice} links={links} isPro={isPro} here={here} />);
                return;
              }
              out.push(<Unit key={`${unit.optionId}:${unit.title}:${i}`} unit={unit} links={links} isPro={isPro} here={here} />);
            });
            return (
              <section className="lh-part" key={part.id} aria-label={part.title}>
                <h3 className="lh-part__title">{part.title}</h3>
                {part.option ? <PartSwitch part={part} choice={choice} status={status[part.id]} onChoose={(cid) => choose(part, cid)} /> : null}
                <div className="lh-part__units">{out}</div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
