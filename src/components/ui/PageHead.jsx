import React from 'react';

// The one page head for the site and the product: a title, one line of lead, the actions.
// No eyebrow, kicker or numbered badge (copy rules). A branded name gets its plain descriptor
// in the title or the lead the first time it appears ("Weak chapters (Radar)").
//   tone: 'screen' (a tab root or page) | 'moment' (a welcome, a result, a first run)
export function PageHead({ title, lead, actions, tone = 'screen', as: Heading = 'h1', id, className = '' }) {
  const classes = ['ui-pagehead', tone === 'moment' ? 'ui-pagehead--moment' : '', actions ? 'ui-pagehead--with-actions' : '', className]
    .filter(Boolean).join(' ');
  return (
    <header className={classes}>
      <Heading className="ui-pagehead__title" id={id}>{title}</Heading>
      {lead ? <p className="ui-pagehead__lead">{lead}</p> : null}
      {actions ? <div className="ui-pagehead__actions">{actions}</div> : null}
    </header>
  );
}
