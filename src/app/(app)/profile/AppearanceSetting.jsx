"use client";

import React, { useState, useSyncExternalStore } from 'react';
import { AccountSection, AccountNote } from './AccountSection';
import { GLASS_OPTIONS, THEME_OPTIONS, appearanceNote, writeAppearance } from './appearance.mjs';

// Account > Appearance (W2.3; owner D5 and D6). Theme: Night or Daylight. Glass on the header,
// dock and sheets: Full (live blur), Lite (dense tint, no blur) or Off (solid). Both are kept on
// this device under the keys the boot script reads, so the next page paints the choice first.
// The page shows what <html> is using now, whatever set it (a saved choice or the route rule).

const subscribeRoot = (notify) => {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-glass'] });
  return () => observer.disconnect();
};
const themeNow = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
const glassNow = () => {
  const value = document.documentElement.dataset.glass;
  return value === 'lite' || value === 'off' ? value : 'full';
};
const serverNull = () => null;

const SOLID_QUERY = '(prefers-reduced-transparency: reduce), (prefers-contrast: more)';
const subscribeSolid = (notify) => {
  let query = null;
  try { query = window.matchMedia(SOLID_QUERY); } catch { return () => {}; }
  query.addEventListener?.('change', notify);
  return () => query.removeEventListener?.('change', notify);
};
const solidNow = () => {
  try { return window.matchMedia(SOLID_QUERY).matches; } catch { return false; }
};
const serverFalse = () => false;

function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
}

function apply(kind, value) {
  const root = document.documentElement;
  const set = () => {
    root.dataset[kind] = value;
    // ThemeToggle and anything else following the theme listen for this.
    if (kind === 'theme') window.dispatchEvent(new Event('mm-theme'));
  };
  // A theme change cross-fades (the browser's own snapshot fade); glass changes in place.
  if (kind === 'theme' && !reducedMotion() && typeof document.startViewTransition === 'function') {
    try { document.startViewTransition(set); return; } catch { /* fall through */ }
  }
  set();
}

function ThemeSwatch({ theme }) {
  return (
    <span className={`acct-swatch ${theme === 'dark' ? 'mm-night' : 'mm-day'}`} aria-hidden="true">
      <span className="acct-swatch__bar" />
      <span className="acct-swatch__line" />
      <span className="acct-swatch__key" />
    </span>
  );
}

function Choice({ name, legend, options, value, onChoose, swatch = false }) {
  return (
    <fieldset className="acct-choice">
      <legend className="acct-choice__legend">{legend}</legend>
      <div className={`acct-choice__opts ${swatch ? 'acct-choice__opts--wide' : ''}`.trim()}>
        {options.map((option) => (
          <label key={option.id} className="acct-opt">
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={value === option.id}
              onChange={() => onChoose(option.id)}
            />
            {swatch ? <ThemeSwatch theme={option.id} /> : null}
            <span className="acct-opt__bubble" aria-hidden="true" />
            <span className="acct-opt__text">
              <b>{option.label}</b>
              <span>{option.note}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function AppearanceSetting() {
  const theme = useSyncExternalStore(subscribeRoot, themeNow, serverNull);
  const glass = useSyncExternalStore(subscribeRoot, glassNow, serverNull);
  const solid = useSyncExternalStore(subscribeSolid, solidNow, serverFalse);
  const [note, setNote] = useState({ tone: null, text: '' });

  function choose(kind, value) {
    let storage = null;
    try { storage = window.localStorage; } catch { /* blocked: applies for this visit only */ }
    const kept = writeAppearance(storage, kind, value);
    apply(kind, value);
    setNote({ tone: kept ? 'ok' : null, text: appearanceNote(kind, value, kept) });
  }

  return (
    <AccountSection id="appearance" title="Appearance" lead="How MockMob looks on this device. Each browser keeps its own choice.">
      <div className="acct-row">
        <Choice name="mm-theme" legend="Theme" options={THEME_OPTIONS} value={theme} onChoose={(value) => choose('theme', value)} swatch />
      </div>
      <div className="acct-row">
        <Choice name="mm-glass" legend="Glass" options={GLASS_OPTIONS} value={glass} onChoose={(value) => choose('glass', value)} />
        <p className="acct-help">
          {solid
            ? 'Your device asks for less transparency, so bars and sheets stay solid whatever you pick here.'
            : 'Glass is only on the header, the bottom bar and sheets. Lite and Off are easier on older phones.'}
        </p>
      </div>
      <AccountNote tone={note.tone}>{note.text}</AccountNote>
    </AccountSection>
  );
}
