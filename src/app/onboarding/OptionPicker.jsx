'use client';
// One subject's section or part, asked with two clear choices (LK94). A real radio group (native keys, one tab stop), each choice a
// card with its name and a one-line explanation; the one shown is the default until the student taps the other.
import React, { useId } from 'react';
import { optionAsk } from './optionChoices.mjs';

export default function OptionPicker({ subjectId, value, onChange, disabled }) {
  const ask = optionAsk(subjectId);
  const name = useId();
  if (!ask) return null;
  return (
    <div className="ob-opt" role="radiogroup" aria-labelledby={`${name}-h`} aria-disabled={disabled || undefined}>
      <p className="ob-opt__legend" id={`${name}-h`}>Your {ask.name} {ask.label.toLowerCase()}</p>
      <p className="ob-opt__ask">Pick the one your school teaches.</p>
      <div className="ob-opt__choices">
        {ask.choices.map((c) => (
          <label key={c.id} className="ob-opt__choice mk-press" data-on={value === c.id || undefined}>
            <input type="radio" disabled={disabled} name={name} value={c.id} checked={value === c.id} onChange={() => onChange(subjectId, c.id)} />
            <span className="ob-opt__dot" aria-hidden="true" />
            <span className="ob-opt__text">
              <span className="ob-opt__name">{c.label}</span>
              <span className="ob-opt__line">{c.line}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
