"use client";
// A toggle chip for picking several from a set (chapters, filters). The state is in words for screen
// readers (aria-pressed) and in shape for eyes: a ring that fills volt and inks a tick, never colour alone.
// The tick slot is always there, so choosing never shifts the row.
import './controls.css';

export function Chip({ pressed = false, onClick, disabled = false, count, title, children, className = '', ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={Boolean(pressed)}
      disabled={disabled}
      title={title}
      className={`ctl-chip ${className}`.trim()}
      onClick={onClick}
      {...rest}
    >
      <span className="ctl-chip__mark" aria-hidden="true">
        <svg viewBox="0 0 16 16" focusable="false"><path pathLength="1" d="M4 8.4 L6.9 11.2 L12 5.4" /></svg>
      </span>
      <span className="ctl-chip__label">{children}</span>
      {count != null ? <i className="ctl-chip__count">{count}</i> : null}
    </button>
  );
}

export default Chip;
