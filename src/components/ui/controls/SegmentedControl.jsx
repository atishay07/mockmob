"use client";
// One choice from a few: a radio group on a sunken track, with a volt lens that slides to the choice.
// Roving tab stop; arrows, Home and End move and choose (WAI-ARIA radio group). Disabled options are
// skipped. `busy` holds the group (aria-disabled) without dropping keyboard focus, for a choice that
// saves. Before the lens is measured (first paint, no script) the checked option paints its own fill.
// Controlled: `value`, `onChange(nextValue)`, `options` [{ value, label, disabled, hint }].
import { useEffect, useLayoutEffect, useRef } from 'react';
import { normaliseOptions, segmentKeyTarget } from './controlsModel.mjs';
import './controls.css';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// Moves the lens onto the checked option. Offsets come from layout, so wrapping rows work too.
// The first placement (and any `still` one) lands without sliding; later moves slide.
function placeLens(track, lens, checkedIndex, still = false) {
  if (!track || !lens) return;
  const node = checkedIndex >= 0 ? track.querySelectorAll('[role="radio"]')[checkedIndex] : null;
  if (!node) { track.dataset.lens = 'none'; return; }
  const landing = still || track.dataset.lens !== 'on';
  if (landing) lens.dataset.still = 'true';
  lens.style.setProperty('--ctl-x', `${node.offsetLeft}px`);
  lens.style.setProperty('--ctl-y', `${node.offsetTop}px`);
  lens.style.setProperty('--ctl-w', `${node.offsetWidth}px`);
  lens.style.setProperty('--ctl-h', `${node.offsetHeight}px`);
  if (!landing) return;
  void lens.offsetWidth;
  track.dataset.lens = 'on';
  requestAnimationFrame(() => { delete lens.dataset.still; });
}

export function SegmentedControl({
  value,
  onChange,
  options: rawOptions,
  label,
  labelledBy,
  disabledValues = [],
  busy = false,
  size = 'md',
  wrap = false,
  className = '',
  optionClassName = '',
}) {
  const options = normaliseOptions(rawOptions).map((o) => (disabledValues.includes(o.value) ? { ...o, disabled: true } : o));
  const trackRef = useRef(null);
  const lensRef = useRef(null);
  const checkedIndex = options.findIndex((o) => o.value === value);
  const firstEnabled = options.findIndex((o) => !o.disabled);
  const tabStop = checkedIndex >= 0 && !options[checkedIndex].disabled ? checkedIndex : firstEnabled;

  const checkedRef = useRef(checkedIndex);
  useIsoLayoutEffect(() => {
    checkedRef.current = checkedIndex;
    placeLens(trackRef.current, lensRef.current, checkedIndex);
  });

  // A resize (wrap, font load, sidebar) re-measures without a slide.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => placeLens(trackRef.current, lensRef.current, checkedRef.current, true));
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const choose = (index) => {
    const option = options[index];
    if (!option || option.disabled || busy || option.value === value) return;
    onChange?.(option.value);
  };

  const onKeyDown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = segmentKeyTarget(options, checkedIndex >= 0 ? checkedIndex : tabStop, event.key);
    if (target === null) return;
    event.preventDefault();
    if (busy) return;
    trackRef.current?.querySelectorAll('[role="radio"]')[target]?.focus();
    choose(target);
  };

  return (
    <div
      ref={trackRef}
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      data-size={size}
      data-wrap={wrap || undefined}
      data-lens="off"
      className={`ctl-seg ${className}`.trim()}
      onKeyDown={onKeyDown}
    >
      <span ref={lensRef} className="ctl-seg__lens" aria-hidden="true" />
      {options.map((option, index) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={index === checkedIndex}
          tabIndex={index === tabStop ? 0 : -1}
          disabled={option.disabled}
          className={`ctl-seg__opt ${optionClassName}`.trim()}
          onClick={() => choose(index)}
        >
          <span className="ctl-seg__label">{option.label}</span>
          {option.hint ? <small className="ctl-seg__hint">{option.hint}</small> : null}
        </button>
      ))}
    </div>
  );
}

export default SegmentedControl;
