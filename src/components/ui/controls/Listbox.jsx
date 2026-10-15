"use client";
// The site's select. A button that opens a designed list (WAI-ARIA select-only combobox): focus stays on
// the trigger, the list follows with aria-activedescendant. Arrows, Home, End, Page keys, Enter, Space,
// Escape, Tab and typeahead work as a native select does. Groups replace optgroup. On a phone the list
// rises as a bottom sheet; elsewhere it floats under (or over) the trigger, outside any clipping card.
// Controlled: pass `value` and `onChange(nextValue)`. Name it with `labelledBy` or `aria-label`.
// `aria-invalid` marks it for a form's error focus; `name` adds a hidden input for form posts.
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { edgeEnabled, groupOptions, indexOfValue, listboxKeyAction, normaliseOptions, pageEnabled, placePopover, stepEnabled, typeaheadMatch } from './controlsModel.mjs';
import './controls.css';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const SHEET_QUERY = '(max-width: 600px) and (pointer: coarse)';

export function Listbox({
  value,
  onChange,
  options: rawOptions,
  placeholder = 'Choose',
  disabled = false,
  labelledBy,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  sheetTitle,
  className = '',
  size = 'md',
  active = false,
  id: idProp,
  name,
}) {
  const autoId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = idProp || `ctl-lb-${autoId}`;
  const listId = `${id}-list`;
  const options = useMemo(() => normaliseOptions(rawOptions), [rawOptions]);
  const sections = useMemo(() => groupOptions(options), [options]);
  const selectedIndex = indexOfValue(options, value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [place, setPlace] = useState(null);
  const [sheet, setSheet] = useState(false);
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const listRef = useRef(null);
  const typed = useRef({ text: '', timer: 0 });
  const closeTimer = useRef(0);

  const optionId = (index) => `${id}-opt-${index}`;

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setClosing(true);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setClosing(false), 160);
    if (refocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const commit = useCallback((index) => {
    const option = options[index];
    if (!option || option.disabled) return;
    if (!(Object.is(option.value, value) || option.value === value)) onChange?.(option.value);
  }, [options, value, onChange]);

  const openAt = useCallback((focus) => {
    if (disabled || !options.length) return;
    const first = edgeEnabled(options), last = edgeEnabled(options, true);
    let start = selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : -1;
    if (focus === 'first') start = first;
    else if (focus === 'last') start = last;
    else if (start < 0) start = focus === 'current-or-last' ? last : first;
    setActiveIndex(start);
    window.clearTimeout(closeTimer.current);
    setClosing(false);
    setOpen(true);
  }, [disabled, options, selectedIndex]);

  // Position: measured from the trigger every frame something could move it (scroll, resize).
  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const isSheet = typeof window.matchMedia === 'function' && window.matchMedia(SHEET_QUERY).matches;
    setSheet(isSheet);
    const rect = trigger.getBoundingClientRect();
    if (!isSheet && (rect.bottom < 0 || rect.top > window.innerHeight)) { close(false); return; }
    setPlace(placePopover(rect, { width: window.innerWidth, height: window.innerHeight }));
  }, [close]);

  useIsoLayoutEffect(() => { if (open) measure(); }, [open, measure]);

  useEffect(() => {
    if (!open) return undefined;
    let frame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const outside = (event) => {
      if (triggerRef.current?.contains(event.target) || popRef.current?.contains(event.target)) return;
      close(false);
    };
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    document.addEventListener('pointerdown', outside, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('pointerdown', outside, true);
    };
  }, [open, measure, close]);

  // Keep the active option in view, and the lens on it.
  useIsoLayoutEffect(() => {
    if (!open || activeIndex < 0) return;
    const list = listRef.current;
    const node = document.getElementById(optionId(activeIndex));
    if (!list || !node || !list.contains(node)) return;
    const top = node.offsetTop, bottom = top + node.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top - 4;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + 4;
    list.style.setProperty('--ctl-lens-y', `${top}px`);
    list.style.setProperty('--ctl-lens-h', `${node.offsetHeight}px`);
    // The first placement lands without a slide: commit the position, then let the lens move.
    if (list.dataset.lens !== 'on') { void list.offsetHeight; list.dataset.lens = 'on'; }
  }, [open, activeIndex, place]);

  useEffect(() => () => { window.clearTimeout(closeTimer.current); window.clearTimeout(typed.current.timer); }, []);

  const onKeyDown = (event) => {
    if (disabled) return;
    // A space in the middle of typeahead ("business s…") is part of the search, not a choice.
    const action = event.key === ' ' && typed.current.text ? null : listboxKeyAction(event.key, { open, altKey: event.altKey });
    if (action) {
      if (!action.keepDefault) event.preventDefault();
      if (action.type === 'open') openAt(action.focus);
      else if (action.type === 'move') setActiveIndex((i) => (i < 0 ? edgeEnabled(options, action.step < 0) : stepEnabled(options, i, action.step)));
      else if (action.type === 'edge') setActiveIndex(edgeEnabled(options, action.last));
      else if (action.type === 'page') setActiveIndex((i) => pageEnabled(options, Math.max(0, i), action.step));
      else if (action.type === 'select-close') { commit(activeIndex); close(!action.keepDefault); }
      else if (action.type === 'close') close();
      return;
    }
    // Typeahead: printable characters, typed within half a second, search from the active option.
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const state = typed.current;
      state.text += event.key;
      window.clearTimeout(state.timer);
      state.timer = window.setTimeout(() => { state.text = ''; }, 500);
      const from = open ? activeIndex : selectedIndex;
      const match = typeaheadMatch(options, state.text, from);
      if (match < 0) return;
      if (open) setActiveIndex(match);
      else commit(match);
    }
  };

  const triggerLabel = selected ? selected.label : placeholder;
  const showPop = (open || closing) && place;
  const popover = showPop ? (
    <>
      {sheet ? <div className="ctl-scrim" data-state={open ? 'open' : 'closing'} aria-hidden="true" /> : null}
      <div
        ref={popRef}
        className="ctl-pop"
        data-state={open ? 'open' : 'closing'}
        data-placement={sheet ? 'sheet' : place.placement}
        style={sheet ? undefined : { top: place.top, bottom: place.bottom, left: place.left, width: place.width, '--ctl-pop-max': `${place.maxHeight}px` }}
      >
        {sheet ? <div className="ctl-pop__sheet-head" aria-hidden="true"><i className="ctl-pop__grip" /><b>{sheetTitle || ariaLabel || placeholder}</b></div> : null}
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          className="ctl-pop__list"
          aria-labelledby={labelledBy}
          aria-label={labelledBy ? undefined : ariaLabel}
          onMouseDown={(event) => event.preventDefault()}
        >
          <span className="ctl-pop__lens" aria-hidden="true" />
          {sections.map((section) => {
            const groupLabelId = section.name ? `${id}-g-${section.items[0].index}` : undefined;
            const rows = section.items.map(({ option, index }) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={`${String(option.value)}-${index}`}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  data-active={index === activeIndex || undefined}
                  className="ctl-pop__option"
                  onPointerMove={() => { if (!option.disabled && index !== activeIndex) setActiveIndex(index); }}
                  onClick={() => { if (option.disabled) return; commit(index); close(); }}
                >
                  <span className="ctl-pop__text">{option.label}{option.hint ? <small>{option.hint}</small> : null}</span>
                  <span className="ctl-pop__check" aria-hidden="true">{isSelected ? <Check size={16} strokeWidth={2.6} /> : null}</span>
                </div>
              );
            });
            return section.name ? (
              <div key={groupLabelId} role="group" aria-labelledby={groupLabelId} className="ctl-pop__group">
                <div id={groupLabelId} role="presentation" className="ctl-pop__group-label">{section.name}</div>
                {rows}
              </div>
            ) : <div key="ungrouped" role="presentation">{rows}</div>;
          })}
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-labelledby={labelledBy ? `${labelledBy} ${id}-value` : undefined}
        aria-label={labelledBy ? undefined : ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        data-size={size}
        data-placeholder={selected ? undefined : 'true'}
        data-active={active || undefined}
        className={`ctl-select ${className}`.trim()}
        onClick={() => (open ? close() : openAt('current-or-first'))}
        onKeyDown={onKeyDown}
        onBlur={(event) => { if (open && !popRef.current?.contains(event.relatedTarget)) close(false); }}
      >
        <span id={`${id}-value`} className="ctl-select__value">{triggerLabel}</span>
        <ChevronDown size={18} aria-hidden="true" className="ctl-select__chev" />
      </button>
      {name ? <input type="hidden" name={name} value={value ?? ''} /> : null}
      {typeof document !== 'undefined' && popover ? createPortal(popover, document.body) : null}
    </>
  );
}

export default Listbox;
