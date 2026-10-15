"use client";
// A labelled switch row: the whole row is the target (the label clicks the switch), the switch is the
// site's spring switch from ui/Switch. Use it where a bare checkbox stood for an on/off filter.
import { useId } from 'react';
import { Switch } from '@/components/ui/Switch';
import './controls.css';

export function ToggleRow({ checked, onChange, label, hint, disabled = false, className = '' }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <label className={`ctl-toggle ${className}`.trim()} data-on={Boolean(checked)} data-disabled={disabled || undefined}>
      <span className="ctl-toggle__text">
        <span id={`ctl-t-${id}`} className="ctl-toggle__label">{label}</span>
        {hint ? <small id={`ctl-th-${id}`}>{hint}</small> : null}
      </span>
      <Switch checked={checked} onChange={onChange} disabled={disabled} aria-labelledby={`ctl-t-${id}`} aria-describedby={hint ? `ctl-th-${id}` : undefined} />
    </label>
  );
}

export default ToggleRow;
