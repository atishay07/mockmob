"use client";

import React from 'react';

// A chip in the answer-sheet selection language (app: MmChip): a hollow bubble and a hairline at
// rest; chosen, a raised fill, an ink rim and an inked bubble. 40px to see, 48px to hit.
// For small fixed sets only (10, 20, 30 minutes; a subject). Selection is never colour alone:
// the bubble fills and the state is exposed to assistive tech.
//
//   <Chip selected={x} onClick={...}>20 minutes</Chip>            a toggle (aria-pressed)
//   <ChipGroup label="Time" single> <Chip ...> </ChipGroup>          one choice (role radio)

const GroupContext = React.createContext({ single: false });

export function ChipGroup({ label, single = false, className = '', children }) {
  return (
    <GroupContext.Provider value={{ single }}>
      <div className={`ui-chips ${className}`.trim()} role={single ? 'radiogroup' : 'group'} aria-label={label}>
        {children}
      </div>
    </GroupContext.Provider>
  );
}

export function Chip({ selected = false, disabled = false, icon = null, className = '', children, ...props }) {
  const { single } = React.useContext(GroupContext);
  const state = single ? { role: 'radio', 'aria-checked': selected } : { 'aria-pressed': selected };
  return (
    <button type="button" className={`ui-chip ${className}`.trim()} disabled={disabled || undefined} {...state} {...props}>
      <span className="ui-chip__bubble" aria-hidden="true" />
      {icon}
      <span className="ui-chip__label">{children}</span>
    </button>
  );
}
