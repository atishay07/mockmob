'use client';

import { useState } from 'react';
import MobiReact, { MOBI_ACTS, MOBI_MOODS } from '@/components/brand/MobiReact';
import { SPEC } from '@/components/brand/mobiActs';
import { ThemeToggle } from '@/components/ThemeToggle';
import './mobi-preview.css';

const SIZES = [32, 48, 72, 120];
const THEMES = ['night', 'day'];
const ACTS = ['idle', ...MOBI_ACTS];

const kindOf = (act) => {
  const spec = SPEC[act];
  if (spec.held) return spec.ms ? 'held, plays first' : 'held';
  return `once, ${(spec.ms / 1000).toFixed(2)} s`;
};

export default function MobiPreview() {
  const [plays, setPlays] = useState({});
  const [hold, setHold] = useState(false);
  const replay = (key) => setPlays((p) => ({ ...p, [key]: (p[key] || 0) + 1 }));

  return (
    <main className="mp">
      <header className="mp-head">
        <div>
          <p className="mp-eyebrow">Development inspection</p>
          <h1 className="mp-title">Mobi, one rig.</h1>
          <p className="mp-lead">
            The website plays the same Mobi as the app, from the same table: proportions, shading, idle life, emotions and acts.
            Each tile shows Night and Day. Press Play to run an act again.
          </p>
        </div>
        <div className="mp-tools">
          <ThemeToggle />
          <button type="button" className="mp-btn" aria-pressed={hold} onClick={() => setHold((v) => !v)}>
            {hold ? 'Hold still: on' : 'Hold still: off'}
          </button>
        </div>
      </header>

      <section aria-labelledby="mp-try">
        <h2 id="mp-try" className="mp-h2">Try him</h2>
        <p className="mp-note">Tap him for the tap cycle. Move the pointer and his eyes follow.</p>
        <div className="mp-pair">
          {THEMES.map((theme) => (
            <div key={theme} className={`mp-cell mp-cell--${theme} mp-cell--big`}>
              <MobiReact act="idle" size={180} theme={theme} interactive follow still={hold} label={`Mobi, ${theme}. Tap him.`} />
              <span className="mp-tag">{theme}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="mp-moods">
        <h2 id="mp-moods" className="mp-h2">Emotions</h2>
        <p className="mp-note">A mood is a face under every act. It blends over 0.3 s.</p>
        <ul className="mp-grid">
          {MOBI_MOODS.map((mood) => (
            <li key={mood} className="mp-tile">
              <div className="mp-pair">
                {THEMES.map((theme) => (
                  <div key={theme} className={`mp-cell mp-cell--${theme}`}>
                    <MobiReact act="idle" mood={mood} size={128} theme={theme} still={hold} label={`Mobi, ${mood}, ${theme}`} />
                  </div>
                ))}
              </div>
              <div className="mp-meta"><span><b>{mood}</b></span></div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="mp-acts">
        <h2 id="mp-acts" className="mp-h2">Acts</h2>
        <p className="mp-note">{ACTS.length} acts, in the app&apos;s order. Held acts keep their stance; once acts settle back to standing.</p>
        <ul className="mp-grid">
          {ACTS.map((act) => (
            <li key={act} className="mp-tile">
              <div className="mp-pair">
                {THEMES.map((theme) => (
                  <div key={theme} className={`mp-cell mp-cell--${theme}`}>
                    <MobiReact key={`${act}-${plays[act] || 0}`} act={act} size={128} theme={theme} still={hold} label={`Mobi, ${act}, ${theme}`} />
                  </div>
                ))}
              </div>
              <div className="mp-meta">
                <span><b>{act}</b><small>{kindOf(act)}</small></span>
                <button type="button" className="mp-btn mp-btn--small" onClick={() => replay(act)} aria-label={`Play ${act} again`}>Play</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="mp-sizes">
        <h2 id="mp-sizes" className="mp-h2">Sizes</h2>
        <p className="mp-note">Below about 56 px he draws lighter, and below 0.42 px per design unit his face grows so every expression still reads.</p>
        <div className="mp-pair">
          {THEMES.map((theme) => (
            <div key={theme} className={`mp-cell mp-cell--${theme} mp-cell--sizes`}>
              {SIZES.map((size) => (
                <figure key={size} className="mp-size">
                  <MobiReact act="hello" mood="happy" size={size} theme={theme} still label={`Mobi at ${size} px, ${theme}`} />
                  <figcaption>{size} px</figcaption>
                </figure>
              ))}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
