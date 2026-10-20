"use client";

// How long each day: 10, 20 and 30 minutes as the three quick choices, and "More" for a longer day (D126, owner H1).
// More opens a quiet panel under the choices: 1 hour (time for one full mock a day), 2 hours, or "Your own" in steps of
// 15 minutes. The page never caps a motivated student; the stepper stops only at the longest the account can hold, and
// says so on the key that stopped. A choice in the panel is made with one press (the two ready-made days) or, for the
// stepper, with "Use 1 h 30", so a student can move through the steps without anything saving on the way.
//
// Controlled: `value` (whole minutes or null), `onChange(minutes)`. `busy` holds the choices while a save is on its way
// (aria-disabled, focus kept). `note` is a line from the page under the choices (what was saved, or where it is kept).
// The one line under the track is fixed by the choice (goalMinutes.goalLine); it never claims a habit it has not seen.
//
// Keyboard: the choices are the site's SegmentedControl (arrows, Home, End). More opens with Enter or Space or the
// Right arrow; the stepper's readout is a spinbutton (arrows 15 minutes, Page Up and Page Down an hour, Home and End the
// ends); the keys hold and repeat on a press and hold. Escape closes the panel and returns to the More choice.
//
// MorePanel is exported on its own for Today's "How long do you have?" row, which keeps its own three choices.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/controls/SegmentedControl';
import {
  COPY, MAX_MINUTES, MORE_CHOICES, OWN_MIN, PRESETS, goalLine, isMinutes, isPreset, minutesChip, minutesLong, ownFrom, stepOwn, stepStop,
} from '@/lib/goalMinutes.mjs';
import './daily-minutes.css';

const MORE = 'more';
const HOLD_DELAY = 380;
const HOLD_EVERY = 120;

/**
 * The More panel on its own: 1 hour, 2 hours and "Your own". `open` shows it (it eases open and is inert while closed);
 * `value` is the length the student holds now; `onChoose(minutes)` is called with a ready-made day or with the stepper's
 * length when "Use" is pressed. The stepper keeps its own staged length, so nothing is chosen while the student moves
 * through the steps.
 */
export function MorePanel({ open, value = null, busy = false, onChoose, idPrefix, firstKey = null }) {
  const long = isMinutes(value) && !isPreset(value);
  // The stepper's staged length: where it opens (the kept long day, else an hour and a half) and where it has got to.
  const [own, setOwn] = useState(() => ownFrom(long ? value : null));
  const hold = useRef({ timer: 0, every: 0 });
  const [seen, setSeen] = useState(value);
  // A new kept long day (loaded late, or chosen above) is where "Your own" opens next.
  if (seen !== value) { setSeen(value); if (long) setOwn(ownFrom(value)); }
  useEffect(() => () => { window.clearTimeout(hold.current.timer); window.clearInterval(hold.current.every); }, []);

  const nudge = useCallback((direction) => setOwn((n) => stepOwn(n, direction)), []);
  const stopHold = () => { window.clearTimeout(hold.current.timer); window.clearInterval(hold.current.every); };
  const startHold = (direction) => {
    stopHold();
    nudge(direction);
    hold.current.timer = window.setTimeout(() => { hold.current.every = window.setInterval(() => nudge(direction), HOLD_EVERY); }, HOLD_DELAY);
  };
  const keyStep = (event) => {
    const map = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 };
    if (map[event.key]) { event.preventDefault(); nudge(map[event.key]); return; }
    if (event.key === 'PageUp') { event.preventDefault(); setOwn((n) => Math.min(MAX_MINUTES, ownFrom(n + 60))); return; }
    if (event.key === 'PageDown') { event.preventDefault(); setOwn((n) => Math.max(OWN_MIN, ownFrom(n - 60))); return; }
    if (event.key === 'Home') { event.preventDefault(); setOwn(OWN_MIN); return; }
    if (event.key === 'End') { event.preventDefault(); setOwn(MAX_MINUTES); return; }
    if (event.key === 'Enter') { event.preventDefault(); onChoose?.(own); }
  };
  const lessStop = stepStop(own, -1);
  const moreStop = stepStop(own, 1);
  const id = idPrefix;

  return (
    <div className="gm__panel" id={`${id}-panel`} data-open={open || undefined} role="group" aria-label={COPY.moreSheet} inert={open ? undefined : true}>
      <div className="gm__panel-in">
        <div className="gm__rows">
          {MORE_CHOICES.map((c, i) => (
            <button key={c.minutes} ref={i === 0 ? firstKey : null} type="button" className="gm__row" aria-pressed={value === c.minutes} disabled={busy} onClick={() => onChoose?.(c.minutes)}>
              <span className="gm__row-t">{c.title}</span>
              <span className="gm__row-l">{c.line}</span>
            </button>
          ))}
          <div className="gm__own" data-set={long && value === own ? '' : undefined}>
            <div className="gm__own-text">
              <span className="gm__row-t" id={`${id}-own`}>{COPY.own}</span>
              <span className="gm__row-l">{COPY.ownLine}</span>
            </div>
            <div className="gm__stepper" role="group" aria-labelledby={`${id}-own`}>
              <button
                type="button" className="gm__step" aria-label={lessStop ? `${COPY.minus}. ${lessStop}` : COPY.minus} aria-disabled={lessStop ? 'true' : undefined} disabled={busy}
                onPointerDown={(e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; if (!lessStop) startHold(-1); }}
                onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} onBlur={stopHold}
                onClick={(e) => { if (e.detail === 0 && !lessStop) nudge(-1); }}
              ><Minus size={18} strokeWidth={2.25} aria-hidden="true" /></button>
              <span
                className="gm__read" role="spinbutton" tabIndex={0} aria-label={COPY.own}
                aria-valuemin={OWN_MIN} aria-valuemax={MAX_MINUTES} aria-valuenow={own} aria-valuetext={minutesLong(own)}
                onKeyDown={keyStep}
              >{minutesLong(own)}</span>
              <button
                type="button" className="gm__step" aria-label={moreStop ? `${COPY.plus}. ${moreStop}` : COPY.plus} aria-disabled={moreStop ? 'true' : undefined} disabled={busy}
                onPointerDown={(e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; if (!moreStop) startHold(1); }}
                onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} onBlur={stopHold}
                onClick={(e) => { if (e.detail === 0 && !moreStop) nudge(1); }}
              ><Plus size={18} strokeWidth={2.25} aria-hidden="true" /></button>
            </div>
            <button type="button" className="gm__use" disabled={busy} onClick={() => onChoose?.(own)} aria-label={`${COPY.use} ${minutesLong(own)} a day`}>{COPY.use} {minutesChip(own)}</button>
            <p className="gm__stop" role="status">{lessStop || moreStop}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DailyMinutes({ value = null, onChange, labelledBy, busy = false, note = null, noteTone = null, line = true, idPrefix = null }) {
  const auto = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = idPrefix || `gm${auto}`;
  const long = isMinutes(value) && !isPreset(value);
  const [open, setOpen] = useState(false);
  const firstKey = useRef(null);

  const segValue = open || long ? MORE : isPreset(value) ? value : null;
  const options = useMemo(() => [
    ...PRESETS.map((n) => ({ value: n, label: minutesChip(n) })),
    { value: MORE, label: long ? <span className="gm__more gm__more--set">{minutesChip(value)}</span> : <span className="gm__more">{COPY.more}<Plus size={14} strokeWidth={2.25} aria-hidden="true" /></span> },
  ], [long, value]);

  const onSeg = (next) => {
    if (next === MORE) { setOpen(true); return; }
    setOpen(false);
    onChange?.(next);
  };
  // Tapping More again (it is already the chosen segment, so the control sends no change) opens or closes the panel.
  const onTrackClick = (event) => {
    const radio = event.target.closest?.('[role="radio"]');
    if (!radio || radio.getAttribute('aria-checked') !== 'true') return;
    const radios = [...radio.parentElement.querySelectorAll('[role="radio"]')];
    if (radios.indexOf(radio) !== radios.length - 1) return;
    setOpen((v) => !v);
  };
  const onTrackKey = (event) => {
    if (event.key === 'Escape' && open) { setOpen(false); event.stopPropagation(); }
  };

  // Focus moves into the panel only when the student opened it (not when a long day is simply showing).
  const opened = useRef(false);
  useEffect(() => {
    if (open && opened.current) firstKey.current?.focus({ preventScroll: true });
    opened.current = open;
  }, [open]);

  const choose = (minutes) => { setOpen(false); onChange?.(minutes); };
  const readLine = isMinutes(value) ? goalLine(value) : goalLine(null);

  return (
    <div className="gm" data-open={open || undefined}>
      <div className="gm__track" onClickCapture={onTrackClick} onKeyDownCapture={onTrackKey}>
        <SegmentedControl labelledBy={labelledBy} value={segValue} onChange={onSeg} options={options} busy={busy} className="gm__seg" wrap />
      </div>
      <MorePanel open={open} value={value} busy={busy} onChoose={choose} idPrefix={id} firstKey={firstKey} />
      {line ? <p className="gm__line" aria-live="polite">{readLine}</p> : null}
      {note ? <p className="gm__note" data-tone={noteTone || undefined} role={noteTone === 'err' ? 'alert' : 'status'}>{note}</p> : null}
    </div>
  );
}
