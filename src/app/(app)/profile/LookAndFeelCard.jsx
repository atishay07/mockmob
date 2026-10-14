"use client";

// Profile > Appearance and feel. The same choices, in the same words, as the app: Theme (Night,
// Daylight, Match device), Feel (Reduce motion) and Celebrations (Full, Quiet, Off). Each choice
// takes effect straight away and is remembered on this device. Mobi previews a change once, and
// only when the student made it: opening the page plays nothing.
import { useRef, useState } from 'react';
import MobiReact from '@/components/brand/MobiReact';
import { Switch } from '@/components/ui/Switch';
import { setThemeMode, useDeviceThemeSync, useThemeMode } from '@/components/ThemeToggle';
import { setCelebrations, setReduceMotion, useMobiPrefs } from '@/lib/mobiPrefs';
import './look-and-feel.css';

const THEMES = [
  { id: 'dark', name: 'Night', note: 'Warm charcoal' },
  { id: 'light', name: 'Daylight', note: 'Warm paper' },
  { id: 'system', name: 'Match device', note: 'Follows your device' },
];
const LEVELS = [
  { id: 'full', name: 'Full', hint: 'A short moment when a repair or a week is finished.' },
  { id: 'quiet', name: 'Quiet', hint: 'Plain text only, with no movement.' },
  { id: 'off', name: 'Off', hint: 'Nothing is shown.' },
];

// A small picture of each theme: the screen, a card on it, a volt mark. Match device is both,
// split on a diagonal.
const NIGHT = { bg: '#0b100e', card: '#18211b', line: '#384736', edge: 'none' };
const DAY = { bg: '#f4f5f0', card: '#ffffff', line: '#c9d0bd', edge: '#6f8700' };
function Screen({ c }) {
  return (
    <g>
      <rect width="96" height="56" fill={c.bg} />
      <rect x="8" y="12" width="60" height="8" rx="4" fill={c.line} />
      <rect x="8" y="26" width="80" height="22" rx="6" fill={c.card} stroke={c.line} strokeWidth="1" />
      <circle cx="82" cy="37" r="4.2" fill="#d2f000" stroke={c.edge} strokeWidth="1" />
    </g>
  );
}
function ThemePicture({ id }) {
  return (
    <svg viewBox="0 0 96 56" className="lf-theme__art" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="lf-round"><rect width="96" height="56" rx="8" /></clipPath>
        <clipPath id="lf-diagonal"><path d="M96 0 V56 H34 Z" /></clipPath>
      </defs>
      <g clipPath="url(#lf-round)">
        <Screen c={id === 'light' ? DAY : NIGHT} />
        {id === 'system' ? <g clipPath="url(#lf-diagonal)"><Screen c={DAY} /></g> : null}
      </g>
    </svg>
  );
}

export default function LookAndFeelCard() {
  const mode = useThemeMode();
  const prefs = useMobiPrefs();
  useDeviceThemeSync();
  const [preview, setPreview] = useState({ act: 'idle', n: 0 });
  const [said, setSaid] = useState('');
  const themeRefs = useRef([]);
  const levelRefs = useRef([]);

  const react = (act, message) => { setPreview((p) => ({ act, n: p.n + 1 })); setSaid(message); };
  const pickTheme = (id, element) => {
    if (id === mode) return;
    setThemeMode(id, element);
    const name = THEMES.find((t) => t.id === id)?.name;
    react('nod', id === 'system' ? 'Theme follows your device.' : `${name} is on.`);
  };
  const toggleMotion = (next) => {
    setReduceMotion(next);
    react(next ? 'rest' : 'wave', next ? 'Reduce motion is on. Screens stay still.' : 'Reduce motion is off.');
  };
  const pickLevel = (id) => {
    if (id === prefs.celebrations) return;
    setCelebrations(id);
    react(id === 'off' ? 'idle' : 'cheer', `Celebrations: ${LEVELS.find((l) => l.id === id)?.name}.`);
  };
  const arrow = (event, items, current, refs, pick) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (current + step + items.length) % items.length;
    refs.current[next]?.focus();
    pick(items[next].id, refs.current[next]);
  };

  const themeIndex = Math.max(0, THEMES.findIndex((t) => t.id === mode));
  const levelIndex = Math.max(0, LEVELS.findIndex((l) => l.id === prefs.celebrations));
  const fromDevice = prefs.deviceReduced && !prefs.overridden;
  const motionOn = prefs.reduced;

  return (
    <section className="glass p-6 lf" aria-labelledby="lf-title">
      <header className="lf__head">
        <div>
          <div className="mono-label mb-2">Look and feel</div>
          <h2 id="lf-title">Appearance and feel</h2>
        </div>
        <MobiReact key={preview.n} act={preview.act} size={72} onDone={() => setPreview((p) => (p.act === 'idle' ? p : { act: 'idle', n: p.n }))} />
      </header>

      <div className="lf__group">
        <h3 id="lf-theme">Theme</h3>
        <div role="radiogroup" aria-labelledby="lf-theme" className="lf__tiles">
          {THEMES.map((theme, i) => (
            <button
              key={theme.id}
              ref={(node) => { themeRefs.current[i] = node; }}
              type="button" role="radio" aria-checked={mode === theme.id}
              tabIndex={i === themeIndex ? 0 : -1}
              className="lf-theme mk-rim mk-press"
              onClick={(event) => pickTheme(theme.id, event.currentTarget)}
              onKeyDown={(event) => arrow(event, THEMES, i, themeRefs, (id, el) => pickTheme(id, el))}
            >
              <ThemePicture id={theme.id} />
              <span className="lf-theme__name">{theme.name}</span>
              <span className="lf-theme__note">{theme.note}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="lf__group">
        <h3 id="lf-feel">Feel</h3>
        <div className="lf__row">
          <div>
            <b id="lf-motion">Reduce motion</b>
            <p id="lf-motion-note">{fromDevice ? 'On, from your device. Change it in your device settings, under accessibility.' : 'Keeps screens still. It follows your device unless you turn it on here.'}</p>
          </div>
          <Switch checked={motionOn} disabled={fromDevice} onChange={toggleMotion} aria-labelledby="lf-motion" aria-describedby="lf-motion-note" />
        </div>
      </div>

      <div className="lf__group">
        <h3 id="lf-cel">Celebrations</h3>
        <div role="radiogroup" aria-labelledby="lf-cel" className="lf__seg" style={{ '--lf-i': levelIndex }}>
          <span className="lf__seg-thumb" aria-hidden="true" />
          {LEVELS.map((level, i) => (
            <button
              key={level.id}
              ref={(node) => { levelRefs.current[i] = node; }}
              type="button" role="radio" aria-checked={prefs.celebrations === level.id}
              tabIndex={i === levelIndex ? 0 : -1}
              onClick={() => pickLevel(level.id)}
              onKeyDown={(event) => arrow(event, LEVELS, i, levelRefs, (id) => pickLevel(id))}
            >{level.name}</button>
          ))}
        </div>
        <p className="lf__hint">{LEVELS[levelIndex].hint}</p>
      </div>

      <p className="lf__said" role="status" aria-live="polite">{said}</p>
    </section>
  );
}
