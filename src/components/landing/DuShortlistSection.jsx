"use client";

import { useCallback, useEffect, useId, useState } from 'react';

// One "Plan your DU shortlist" section with two fully working views: the Compass cutoff ladder and
// the subject-eligibility checker with the Combo Planner. Both panels stay mounted (the inactive one
// is hidden) so nothing is lost when switching. The old anchors #compass and #du-eligibility both
// still land on the right view, including when the page is opened with the hash.
const HASH_TO_TAB = { '#compass': 'compass', '#du-eligibility': 'eligibility' };

export default function DuShortlistSection({ hasCompass = true, compass, eligibility }) {
  const uid = useId();
  const [tab, setTab] = useState(hasCompass ? 'compass' : 'eligibility');
  const tabs = hasCompass ? [['compass', 'Compare cutoffs'], ['eligibility', 'Check subject eligibility']] : [['eligibility', 'Check subject eligibility']];

  const syncHash = useCallback(() => {
    const next = HASH_TO_TAB[window.location.hash];
    if (!next || (next === 'compass' && !hasCompass)) return;
    setTab(next);
    window.requestAnimationFrame(() => document.getElementById(next === 'compass' ? 'compass' : 'du-eligibility')?.scrollIntoView({ block: 'start' }));
  }, [hasCompass]);

  useEffect(() => {
    const first = window.requestAnimationFrame(syncHash);
    window.addEventListener('hashchange', syncHash);
    return () => { window.cancelAnimationFrame(first); window.removeEventListener('hashchange', syncHash); };
  }, [syncHash]);

  const onKeyDown = event => {
    const index = tabs.findIndex(([id]) => id === tab);
    let to = -1;
    if (event.key === 'ArrowRight') to = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') to = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') to = 0;
    else if (event.key === 'End') to = tabs.length - 1;
    if (to < 0) return;
    event.preventDefault();
    setTab(tabs[to][0]);
    document.getElementById(uid + tabs[to][0])?.focus();
  };

  return (
    <div className="dsl">
      {tabs.length > 1 ? (
        <div className="dsl__tabs" role="tablist" aria-label="Plan your DU shortlist" onKeyDown={onKeyDown}>
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" id={uid + id} aria-selected={tab === id} aria-controls={id === 'compass' ? 'compass' : 'du-eligibility'} tabIndex={tab === id ? 0 : -1} className="dsl__tab" onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      ) : null}
      {hasCompass ? <div role="tabpanel" id="compass" aria-labelledby={uid + 'compass'} hidden={tab !== 'compass'} className="dsl__panel">{compass}</div> : null}
      <div role="tabpanel" id="du-eligibility" aria-labelledby={uid + 'eligibility'} hidden={tab !== 'eligibility'} className="dsl__panel">{eligibility}</div>
    </div>
  );
}
