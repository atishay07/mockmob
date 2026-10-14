import React from 'react';
import { Icon } from './Icons';

// The Night Sheet button (app: KeyButton). One primary per screen.
//   variant   'primary' (the volt pill) | 'secondary' (smoked pill) | 'quiet' (text button)
//             Old names still work: 'volt' = primary, 'outline' = secondary, 'ghost' = quiet.
//   size      'sm' | 'md' | 'lg';  block: full width
//   icon      a leading icon name from ./Icons. Icons sit before the label, never after it.
//   loading   keeps the label and the width, shows a spinner, ignores presses (aria-busy)
//   disabledReason  shown under a disabled button when the reason matters
// Arrows and chevrons placed after the label are dropped here (copy rule: no trailing arrows).

const VARIANTS = { primary: 'primary', secondary: 'secondary', quiet: 'quiet', volt: 'primary', outline: 'secondary', ghost: 'quiet' };
const SIZES = { sm: 'sm', md: 'md', lg: 'lg' };
const LEGACY = { primary: 'btn-volt', secondary: 'btn-outline', quiet: 'btn-ghost' };
const TRAILING = new Set(['arrow', 'arrow-right', 'arrowRight', 'chevR', 'chevron', 'chevron-right', 'chevronRight', 'next', 'external']);
const ARROW_TEXT = /\s*(?:→|➜|›|»|->)\s*$/;

function isTrailingArrow(node) {
  if (typeof node === 'string') return ARROW_TEXT.test(node) && node.replace(ARROW_TEXT, '') === '';
  if (!React.isValidElement(node)) return false;
  const name = node.props?.name;
  if (typeof name === 'string' && TRAILING.has(name)) return true;
  const label = node.props?.['data-icon'];
  return typeof label === 'string' && TRAILING.has(label);
}

/** Drops a trailing arrow icon or a trailing arrow glyph from button content. */
export function withoutTrailingArrow(children) {
  const parts = React.Children.toArray(children);
  while (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (typeof last === 'string' && !last.trim()) { parts.pop(); continue; }
    if (isTrailingArrow(last)) { parts.pop(); continue; }
    break;
  }
  if (parts.length && typeof parts[parts.length - 1] === 'string') {
    parts[parts.length - 1] = parts[parts.length - 1].replace(ARROW_TEXT, '');
  }
  return parts;
}

export function buttonClass({ variant = 'primary', size = 'md', block = false, className = '' } = {}) {
  const v = VARIANTS[variant] || 'primary';
  const s = SIZES[size] || 'md';
  // The legacy alias stays on the element so page-level layout rules (`.x .btn-volt { width }`) still apply.
  return ['ui-btn', `ui-btn--${v}`, LEGACY[v], s !== 'md' ? `ui-btn--${s}` : '', block ? 'ui-btn--block' : '', className].filter(Boolean).join(' ');
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  block = false,
  loading = false,
  disabled = false,
  disabledReason,
  asChild = false,
  className = '',
  type = 'button',
  ...props
}) {
  const classes = buttonClass({ variant, size, block, className });
  const lead = loading
    ? <span className="ui-spinner" aria-hidden="true" />
    : icon && !TRAILING.has(icon) ? <Icon name={icon} /> : null;
  const state = {
    'data-loading': loading ? 'true' : undefined,
    'aria-busy': loading ? true : undefined,
  };

  let control;
  if (asChild) {
    const child = React.Children.toArray(children).find(React.isValidElement);
    if (!child) return null;
    // A link cannot be disabled; it is marked and its press is ignored instead.
    const inert = disabled || loading;
    control = React.cloneElement(child, {
      ...props,
      ...state,
      'aria-disabled': inert ? true : child.props['aria-disabled'],
      tabIndex: disabled ? -1 : child.props.tabIndex,
      onClick: inert ? (event) => event.preventDefault() : child.props.onClick ?? props.onClick,
      className: `${classes} ${child.props.className || ''}`.trim(),
      children: (
        <>
          {lead}
          <span className="ui-btn__label">{withoutTrailingArrow(child.props.children)}</span>
        </>
      ),
    });
  } else {
    const { onClick, ...rest } = props;
    control = (
      <button
        {...rest}
        type={type}
        className={classes}
        disabled={disabled || undefined}
        {...state}
        aria-disabled={loading ? true : rest['aria-disabled']}
        onClick={loading ? undefined : onClick}
      >
        {lead}
        <span className="ui-btn__label">{withoutTrailingArrow(children)}</span>
      </button>
    );
  }

  if (!(disabled && disabledReason)) return control;
  return (
    <span className={`ui-btn-wrap ${block ? 'ui-btn-wrap--block' : ''}`}>
      {control}
      <span className="ui-btn-reason">{disabledReason}</span>
    </span>
  );
}
