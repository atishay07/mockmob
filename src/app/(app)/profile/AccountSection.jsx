import React from 'react';

// One group of Account settings (W2.3): its heading and one line on the left, its controls on a
// single raised surface on the right (stacked on phones). Rows inside are divided by hairlines,
// never by cards inside the card.
export function AccountSection({ id, title, lead, tone, children, ref, tabIndex, className = '' }) {
  return (
    <section
      id={id}
      ref={ref}
      tabIndex={tabIndex}
      className={`acct-sec ${tone === 'danger' ? 'acct-sec--danger' : ''} ${className}`.trim()}
      aria-labelledby={`${id}-title`}
    >
      <header className="acct-sec__head">
        <h2 className="acct-sec__title" id={`${id}-title`}>{title}</h2>
        {lead ? <p className="acct-sec__lead">{lead}</p> : null}
      </header>
      <div className="acct-sec__body">{children}</div>
    </section>
  );
}

/**
 * A status line under a control: saved (only after the server or browser accepted it), or what
 * went wrong and what to do. The live region is always present so a change is announced.
 */
export function AccountNote({ tone, children }) {
  return (
    <p
      className={`acct-note ${tone === 'ok' ? 'acct-note--ok' : tone === 'bad' ? 'acct-note--bad' : ''}`.trim()}
      role="status"
      aria-live="polite"
    >
      {children}
    </p>
  );
}
