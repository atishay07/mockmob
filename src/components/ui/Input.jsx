"use client";

import React, { useId } from 'react';

// Fields with every state: empty, filled, focus, invalid (aria-invalid plus a written error,
// never colour alone), valid (only when the check matters), disabled and read-only. Text is
// 16px so phones do not zoom on focus. Validate when the user can act on it, not mid-word.

function ErrorMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="8" cy="8" r="6.5" /><path d="M8 4.8v3.6M8 11h.01" />
    </svg>
  );
}

function OkMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

/**
 * A labelled field. Pass the control as the child, or use Input / Select / Textarea, which
 * wire the ids for you. `error` wins over `ok`; `hint` stays visible under both.
 */
export function Field({ label, hint, error, ok, optional = false, id, className = '', children }) {
  const auto = useId();
  const controlId = id || `f${auto}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const msgId = error || ok ? `${controlId}-msg` : undefined;
  const describedBy = [hintId, msgId].filter(Boolean).join(' ') || undefined;
  const child = React.Children.only(children);
  const control = React.cloneElement(child, {
    id: child.props.id || controlId,
    'aria-describedby': [child.props['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
    'aria-invalid': error ? true : child.props['aria-invalid'],
    'data-valid': !error && ok ? 'true' : undefined,
  });
  return (
    <div className={`ui-field ${className}`.trim()}>
      {label ? (
        <label className="ui-field__label" htmlFor={child.props.id || controlId}>
          {label}{optional ? <span className="ui-field__optional"> (optional)</span> : null}
        </label>
      ) : null}
      {control}
      {hint ? <p className="ui-field__hint" id={hintId}>{hint}</p> : null}
      {error ? <p className="ui-field__error" id={msgId} role="alert"><ErrorMark />{error}</p>
        : ok ? <p className="ui-field__ok" id={msgId}><OkMark />{ok}</p> : null}
    </div>
  );
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function TextInput({ type = 'text', className = '', ...props }) {
  return <input type={type} className={`ui-input ${className}`.trim()} {...props} />;
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`ui-textarea ${className}`.trim()} {...props} />;
}

/** options: strings, or { value, label, disabled }. */
export function Select({ options = [], placeholder, className = '', children, ...props }) {
  return (
    <span className="ui-select-wrap">
      <select className={`ui-select ${className}`.trim()} {...props}>
        {placeholder ? <option value="" disabled>{placeholder}</option> : null}
        {options.map((opt) => {
          const value = typeof opt === 'object' ? opt.value : opt;
          const label = typeof opt === 'object' ? opt.label ?? opt.value : opt;
          return <option key={String(value)} value={value} disabled={typeof opt === 'object' ? opt.disabled : undefined}>{label}</option>;
        })}
        {children}
      </select>
      <ChevronDown />
    </span>
  );
}

/**
 * Old single-component API, kept for compatibility: <Input />, <Input isTextarea />,
 * <Input isSelect options={[...]} />. New code uses Field with TextInput, Textarea or Select.
 */
export function Input({ isTextarea = false, isSelect = false, options = [], ...props }) {
  if (isTextarea) return <Textarea {...props} />;
  if (isSelect) return <Select options={options} {...props} />;
  return <TextInput {...props} />;
}
