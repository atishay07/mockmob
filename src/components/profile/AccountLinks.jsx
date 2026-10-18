"use client";

// Account > Progress and help: the calm list from the restructure's You page, inside the live navigation. Your standing is the
// same page and the same words as the sidebar's link under Progress, so a phone that never opens the menu still reaches it from
// here. Contribute and My uploads are drawn only while CONTRIBUTE_ENABLED is on (COMMUNITY-1018); the group no longer says community.
// "Replay the guide" opens the live shell's tour: it asks the shell first (GUIDE_EVENT, cancelable),
// then presses the shell's own Guide button, and says where the guide lives if neither answered.
import { useState } from 'react';
import Link from 'next/link';
import { GUIDE_EVENT, HELP_ROWS, standingRows } from './accountModel.mjs';
import { useContributeEnabled } from '@/components/contribute/ContributeFlag';
import './account.css';

function openGuide() {
  if (typeof window === 'undefined') return false;
  const event = new CustomEvent(GUIDE_EVENT, { cancelable: true });
  if (!window.dispatchEvent(event)) return true; // the shell handled it
  const button = document.querySelector('[data-tour="guide-button"]');
  if (!button) return false;
  button.click();
  return true;
}

function Row({ row, onGuideMissing }) {
  const body = (
    <span className="acct-row__text">
      <span className="acct-row__label">{row.label}</span>
      {row.note ? <span className="acct-row__note">{row.note}</span> : null}
    </span>
  );
  if (row.action === 'guide') {
    return <button type="button" className="acct-row" onClick={() => { if (!openGuide()) onGuideMissing(); }}>{body}</button>;
  }
  return <Link className="acct-row" href={row.href}>{body}</Link>;
}

export default function AccountLinks() {
  const [guideNote, setGuideNote] = useState('');
  const contribute = useContributeEnabled();
  const missing = () => setGuideNote('The tour is under Guide, in the menu.');

  return (
    <section className="glass acct-links" aria-label="Progress and help">
      <div className="acct-links__group" id="community">
        <h2 className="acct-h2">Progress</h2>
        <ul className="acct-list">
          {standingRows(contribute).map((row) => <li key={row.id}><Row row={row} onGuideMissing={missing} /></li>)}
        </ul>
      </div>
      <div className="acct-links__group" id="help">
        <h2 className="acct-h2">Help</h2>
        <ul className="acct-list">
          {HELP_ROWS.map((row) => <li key={row.id}><Row row={row} onGuideMissing={missing} /></li>)}
        </ul>
        <p className="acct-note" role="status">{guideNote}</p>
      </div>
    </section>
  );
}
