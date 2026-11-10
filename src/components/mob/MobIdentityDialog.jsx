"use client";

import { useId, useState } from 'react';
import { Check } from 'lucide-react';
import { COLOUR_COUNT, checkName } from '@/lib/mob/model.mjs';
import { MobDialog } from './MobDialog';
import './mob.css';

const COLOUR_NAMES = ['Teal', 'Sky', 'Violet', 'Rose', 'Amber', 'Green', 'Coral', 'Slate'];
export const NAME_RULE = 'Use 2 to 18 letters. Spaces, dots, apostrophes and hyphens are fine.';

export function ColourPicker({ value, onChange, name }) {
  return (
    <fieldset className="mob-colours">
      <legend className="mob-label">Colour</legend>
      <div className="mob-colours__row">
        {Array.from({ length: COLOUR_COUNT }, (_, i) => (
          <label key={i} className="mob-colour" title={COLOUR_NAMES[i]}>
            <input type="radio" name={name} value={i} checked={value === i} onChange={() => onChange(i)} />
            <span className="mob-disc mob-disc--pick" data-colour={i} aria-hidden="true">{value === i ? <Check size={16} strokeWidth={2.5} /> : null}</span>
            <span className="sr-only">{COLOUR_NAMES[i]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function NameField({ value, onChange, error, id }) {
  return (
    <div className="mob-field">
      <label className="mob-label" htmlFor={id}>Your name in the Mob</label>
      <input id={id} className="mob-input" value={value} maxLength={18} autoComplete="given-name" onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined} aria-describedby={`${id}-hint`} />
      <p id={`${id}-hint`} className={error ? 'mob-hint mob-hint--bad' : 'mob-hint'}>{error || 'Only your Mob sees it. 2 to 18 letters.'}</p>
    </div>
  );
}

export default function RenameDialog({ open, onClose, you, run, busy }) {
  const [name, setName] = useState(you.name);
  const [colour, setColour] = useState(you.colour);
  const [error, setError] = useState(null);
  const id = useId();
  const save = async (event) => {
    const dialog = event.currentTarget.closest('dialog');
    const checked = checkName(name);
    if (!checked.ok) { setError(NAME_RULE); return; }
    const r = await run('/api/mob/me', { name: checked.name, colour }, { method: 'PATCH', name: 'rename' });
    if (!r.ok) setError(r.message); else dialog.close();
  };
  return (
    <MobDialog open={open} onClose={onClose} title="Change name or colour" labelId={`${id}-heading`}>
      <div className="mob-form mob-form--plain">
        <NameField id={id} value={name} onChange={(value) => { setName(value); setError(null); }} error={error} />
        <ColourPicker value={colour} onChange={setColour} name={`${id}-colour`} />
        <button type="button" className="btn-volt md" onClick={save} disabled={busy === 'rename'}>{busy === 'rename' ? 'Saving' : 'Save'}</button>
      </div>
    </MobDialog>
  );
}
