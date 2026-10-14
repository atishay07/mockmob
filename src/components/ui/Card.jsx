import React from 'react';

// Surfaces with a real hierarchy (see ui.css):
//   plain   grouped by spacing alone, the default for most content
//   raised  a solid card, for one object you act on
//   sunken  a well inside a card or page
//   focal   the one lit object on a screen (thin volt top edge); use once per screen
// Never nest cards: a raised surface inside another renders as a sunken well.
// Pass `href` with `as={Link}` or `onClick` to make the whole surface pressable.

const LEVELS = new Set(['plain', 'raised', 'sunken', 'focal']);

export function Surface({ level = 'raised', as: Tag, onClick, href, selected, className = '', children, type = 'button', ...props }) {
  const lvl = LEVELS.has(level) ? level : 'raised';
  const interactive = Boolean(onClick || href);
  const classes = ['ui-surface', `ui-surface--${lvl}`, interactive ? 'ui-surface--interactive' : '', className].filter(Boolean).join(' ');
  if (href) {
    const Link = Tag || 'a';
    return <Link href={href} className={classes} aria-current={selected ? 'true' : undefined} {...props}>{children}</Link>;
  }
  if (onClick) {
    return <button type={type} className={classes} onClick={onClick} aria-pressed={selected ?? undefined} {...props}>{children}</button>;
  }
  const Box = Tag || 'div';
  return <Box className={classes} {...props}>{children}</Box>;
}

// Old API, kept for compatibility. variant: 'default' (raised), 'hover', 'active', 'volt-soft'.
// It renders the legacy .glass class, which is now a solid raised surface (no blur on content).
export function Card({ children, variant = 'default', className = '', onClick, type = 'button', ...props }) {
  const variantClass = variant !== 'default' ? variant : '';
  const classNames = `glass ${variantClass} ${onClick ? 'card-action' : ''} ${className}`;
  if (onClick) {
    return <button type={type} className={classNames} onClick={onClick} {...props}>{children}</button>;
  }
  return <div className={classNames} {...props}>{children}</div>;
}
