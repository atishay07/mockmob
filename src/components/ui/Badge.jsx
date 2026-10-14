import React from 'react';

// A quiet status word in sentence case ("Pro", "Held for checks", "Wrong in 2"). Never an
// eyebrow above a heading: `isEyebrow` (old API) now renders the same plain tag, and the
// dot it used to draw is gone. State is carried by the word, not by the colour.
//   variant: 'subtle' | 'volt' (accent) | 'red' (needs action)
const TONES = { subtle: '', volt: 'ui-tag--accent', red: 'ui-tag--bad' };

export function Badge({ children, variant = 'subtle', className = '', isEyebrow = false, noDot = false }) {
  const tone = TONES[variant] ?? '';
  return <span className={`ui-tag ${tone} ${className}`.trim()}>{children}</span>;
}
