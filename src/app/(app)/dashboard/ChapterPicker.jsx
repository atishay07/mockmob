"use client";

// The chapter picker on Practice (START-1017 D6 and 4.4, owner F8: "Chapters are cluttered, and it's difficult to find
// exactly what we are looking for"). Chapters are grouped by the syllabus's own units with a search that forgives case,
// punctuation and "&". Desktop: the picker opens in place, under the Chapters row, and edits the choice live. Phones: a
// bottom sheet (a native modal <dialog>, so the page behind is inert) with search pinned at the top and "Use N chapters"
// in its foot, the one volt while it is up; closing it without that keeps the previous choice.
// The rules (grouping, search, the 12-chapter limit) are pure, in chapterGroups.mjs, and tested.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { MAX_CHAPTERS, filterUnits, matchRange, toggleChapter, toggleUnit } from './chapterGroups.mjs';

function wideLayout() {
  try { return window.matchMedia('(min-width: 1024px)').matches; } catch { return true; }
}

// The typed text, marked inside the chapter's name, so a match reads at a glance.
function Marked({ text, query }) {
  const range = matchRange(text, query);
  if (!range) return text;
  return <>{text.slice(0, range[0])}<mark className="cp-mark">{text.slice(range[0], range[1])}</mark>{text.slice(range[1])}</>;
}

function ChapterList({ units, flat, chosen, onToggle, onUnit, query, onClearQuery }) {
  const shown = filterUnits(units, query);
  const full = chosen.length >= MAX_CHAPTERS;
  if (!shown.length) {
    return (
      <p className="cp-none" role="status">
        No chapter matches “{query.trim()}”.{' '}
        <button type="button" className="cp-link" onClick={onClearQuery}>Clear search</button>
      </p>
    );
  }
  return (
    <div className="cp-units">
      {shown.map((unit) => {
        const all = units.find((u) => u.id === unit.id) || unit;
        const whole = all.chapters.every((c) => chosen.includes(c.name));
        return (
          <div className="cp-unit" key={unit.id} role="group" aria-label={flat ? 'Chapters' : unit.name}>
            {!flat && unit.name ? (
              <div className="cp-unit__head">
                <b>{unit.name}<small>{all.chapters.length}</small></b>
                {all.chapters.length > 1 ? (
                  <button type="button" className="cp-link" onClick={() => onUnit(all)} aria-label={`${whole ? 'Clear' : 'Choose'} the whole unit ${unit.name}`}>{whole ? 'Clear unit' : 'Whole unit'}</button>
                ) : null}
              </div>
            ) : null}
            <div className="cp-chaps">
              {unit.chapters.map((chapter) => {
                const on = chosen.includes(chapter.name);
                const blocked = !on && full;
                return (
                  <button key={chapter.id || chapter.name} type="button" role="checkbox" aria-checked={on} aria-disabled={blocked || undefined}
                    className="cp-chap" data-on={on || undefined} onClick={() => { if (!blocked) onToggle(chapter.name); }}>
                    <i aria-hidden="true"><Check size={13} strokeWidth={3} /></i>
                    <span><Marked text={chapter.name} query={query} /></span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ChapterPicker({ subjectName = '', data, chosen = [], onChange, onRetry, buttonRef, autoOpen = false }) {
  const { state = 'loading', units = [], count = 0, flat = false } = data || {};
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(chosen);
  const [sheet, setSheet] = useState(false);
  const dialogRef = useRef(null);
  const panelId = useId();
  const searchRef = useRef(null);
  const ownButton = useRef(null);
  const trigger = buttonRef || ownButton;

  // Practice keys the picker by subject, so a new subject starts it closed with an empty search.
  const closeInline = () => { setOpen(false); setQuery(''); requestAnimationFrame(() => trigger.current?.focus?.({ preventScroll: true })); };
  // Closing the phone sheet any way (Escape, the scrim, the close disc) keeps the previous choice and gives focus back.
  const closeSheet = () => { setSheet(false); requestAnimationFrame(() => trigger.current?.focus?.({ preventScroll: true })); };
  const openPicker = () => {
    setQuery('');
    if (wideLayout()) { setSheet(false); setOpen((value) => !value); return; }
    setDraft(chosen);
    setSheet(true);
  };

  // The phone sheet: a modal <dialog>, opened once it is in the page; Escape and a press on the scrim close it.
  useEffect(() => {
    const el = dialogRef.current;
    if (!sheet || !el) return undefined;
    if (!el.open) { try { el.showModal(); } catch { el.setAttribute('open', ''); } }
    const onCancel = (event) => {
      event.preventDefault();
      setSheet(false);
      requestAnimationFrame(() => trigger.current?.focus?.({ preventScroll: true }));
    };
    el.addEventListener('cancel', onCancel);
    return () => { el.removeEventListener('cancel', onCancel); };
  }, [sheet, trigger]);

  useEffect(() => { if (open) searchRef.current?.focus({ preventScroll: true }); }, [open]);

  // ?pick=chapters (the Start sheet's By chapter row): once the chapters are in, the list opens by itself, one time.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!autoOpen || autoOpened.current || state !== 'ready' || !count) return undefined;
    autoOpened.current = true;
    const id = window.setTimeout(() => {
      trigger.current?.scrollIntoView?.({ block: 'center' });
      if (wideLayout()) setOpen(true);
      else { setDraft(chosen); setSheet(true); }
    }, 0);
    return () => window.clearTimeout(id);
  }, [autoOpen, state, count, chosen, trigger]);

  const live = sheet ? draft : chosen;
  // Updates go through a function of the current choice, so quick presses in a row each count.
  const setLive = (update) => (sheet ? setDraft(update) : onChange(update));
  const label = useMemo(() => (chosen.length ? 'Change chapters' : 'Choose chapters'), [chosen.length]);

  if (state === 'loading') {
    return <div className="cp" aria-busy="true"><span className="cp-skel skeleton" /></div>;
  }
  if (state === 'error' || !count) {
    return (
      <div className="cp">
        <p className="cp-sum" role="status">
          Chapters could not load. This set uses all chapters.{' '}
          {onRetry ? <button type="button" className="cp-link" onClick={onRetry}>Try again</button> : null}
        </p>
      </div>
    );
  }

  const list = (
    <ChapterList units={units} flat={flat} chosen={live} query={query} onClearQuery={() => setQuery('')}
      onToggle={(name) => setLive((current) => toggleChapter(current, name))} onUnit={(unit) => setLive((current) => toggleUnit(current, unit))} />
  );
  const search = (
    <label className="cp-search">
      <Search size={17} strokeWidth={1.9} aria-hidden="true" />
      <span className="sr-only">Search chapters</span>
      <input ref={sheet ? undefined : searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${count} chapters`} autoComplete="off" spellCheck={false}
        onKeyDown={(event) => { if (event.key === 'Escape' && !sheet) { event.preventDefault(); closeInline(); } }} />
    </label>
  );
  const limitLine = live.length >= MAX_CHAPTERS ? <span className="cp-limit">{MAX_CHAPTERS} is the most for one set.</span> : null;

  return (
    <div className="cp">
      {chosen.length ? (
        <ul className="cp-chosen" aria-label="Chosen chapters">
          {chosen.map((name) => (
            <li key={name}>
              <span>{name}</span>
              <button type="button" aria-label={`Remove ${name}`} onClick={() => onChange(chosen.filter((entry) => entry !== name))}><X size={14} strokeWidth={2.2} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="cp-sum">
        {chosen.length ? null : <p>Questions from all {count} chapters.</p>}
        <button ref={trigger} type="button" className="cp-open mk-press" aria-expanded={open || sheet} aria-controls={open ? panelId : undefined} onClick={openPicker}>
          <Search size={16} strokeWidth={2} aria-hidden="true" />{open ? 'Close the list' : label}
        </button>
      </div>

      {open ? (
        <div className="cp-panel" id={panelId} role="region" aria-label={`${subjectName} chapters`}
          onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); closeInline(); } }}>
          {search}
          {list}
          <div className="cp-foot">
            <span><b>{chosen.length} of {count}</b> chapters chosen{limitLine ? <>. {limitLine}</> : null}</span>
            <button type="button" className="cp-done mk-press" onClick={closeInline}>Done</button>
          </div>
        </div>
      ) : null}

      {sheet ? (
        <dialog ref={dialogRef} className="cp-sheet" aria-labelledby={`${panelId}-title`}
          onClick={(event) => { if (event.target === dialogRef.current) closeSheet(); }}>
          <div className="cp-sheet__head">
            <span className="cp-sheet__handle" aria-hidden="true" />
            <div className="cp-sheet__title">
              <div>
                <h2 id={`${panelId}-title`}>{subjectName} chapters</h2>
                <p>{flat ? `${count} ${count === 1 ? 'chapter' : 'chapters'}` : `${count} ${count === 1 ? 'chapter' : 'chapters'} in ${units.length} ${units.length === 1 ? 'unit' : 'units'}`}</p>
              </div>
              <button type="button" className="cp-close mk-press" aria-label="Close" onClick={closeSheet}><X size={20} strokeWidth={1.9} aria-hidden="true" /></button>
            </div>
            {search}
          </div>
          <div className="cp-sheet__list">{list}</div>
          <div className="cp-sheet__foot">
            {limitLine ? <p>{limitLine}</p> : null}
            <button type="button" className="cp-clear mk-press" onClick={() => setDraft([])} disabled={!draft.length}>Clear</button>
            <button type="button" className="cp-use mk-press" onClick={() => { onChange(draft); closeSheet(); }}>
              {draft.length ? `Use ${draft.length} ${draft.length === 1 ? 'chapter' : 'chapters'}` : `Use all ${count} chapters`}
            </button>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
