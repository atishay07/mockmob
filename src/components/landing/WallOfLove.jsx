"use client";

// Only explicitly consented, attributable student words are publishable. With fewer than four
// entries the cards stay still; larger sets use two lanes that visitors can pause themselves.
import { useEffect, useMemo, useState } from 'react';
import { Pause, Play } from 'lucide-react';

const LANE_MIN = 4;

function initial(name) {
  const words = String(name || '').trim().split(/\s+/u).filter(Boolean);
  const firstGrapheme = (word) => {
    if (typeof Intl.Segmenter === 'function') return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word)][0]?.segment || '';
    return Array.from(word)[0] || '';
  };
  return (words.length > 1 ? firstGrapheme(words[0]) + firstGrapheme(words.at(-1)) : firstGrapheme(words[0] || '?')).toLocaleUpperCase();
}

function Card({ voice, placeholder, duplicate = false }) {
  return (
    <figure className="wl__card" aria-hidden={duplicate || undefined} inert={duplicate || undefined}>
      <blockquote>{voice.quote}</blockquote>
      <figcaption>
        <span className="wl__avatar" aria-hidden="true">{initial(voice.name)}</span>
        <span className="wl__byline"><b>{voice.name}</b>{voice.detail ? <i>{voice.detail}</i> : null}</span>
        {placeholder ? <em>Preview text</em> : null}
      </figcaption>
    </figure>
  );
}

export default function WallOfLove({ voices = [], placeholder = false, contact = 'support@mockmob.in' }) {
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const shown = useMemo(() => (Array.isArray(voices) ? voices : []).filter((voice) => (
    voice && voice.consent === true && typeof voice.quote === 'string' && voice.quote.trim() &&
    typeof voice.name === 'string' && voice.name.trim()
  )), [voices]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener?.('change', sync);
    return () => query.removeEventListener?.('change', sync);
  }, []);

  if (!shown.length) return null;
  const moving = shown.length >= 4 && !reducedMotion;
  const rowA = shown.filter((_, index) => index % 2 === 0);
  const rowB = shown.filter((_, index) => index % 2 === 1);
  // A lane loops seamlessly only when one set is wider than the lane, so short lanes repeat
  // their cards (as hidden visual copies) up to LANE_MIN. Duration scales with the set so
  // every lane drifts at the same reading speed.
  const row = (list, reverse) => {
    const fillers = Array.from({ length: Math.ceil(LANE_MIN / list.length) - 1 }, () => list).flat();
    const set = [...list, ...fillers];
    return (
      <div className="wl__row" data-reverse={reverse} data-drift="true" data-paused={paused} style={{ '--wl-cards': set.length }}>
        <div className="wl__strip">
          {list.map((voice, index) => <Card key={`${voice.name}-${index}`} voice={voice} placeholder={placeholder} />)}
          {fillers.map((voice, index) => <Card key={`fill-${voice.name}-${index}`} voice={voice} placeholder={placeholder} duplicate />)}
          <div className="wl__duplicates" aria-hidden="true" inert>
            {set.map((voice, index) => <Card key={`copy-${voice.name}-${index}`} voice={voice} placeholder={placeholder} duplicate />)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="wl" role="region" aria-label="What students say">
      {moving ? (
        <>
          <div className="wl__controls">
            <p>Cards move slowly. Pause them whenever you like.</p>
            <button type="button" className="wl__pause" onClick={() => setPaused((value) => !value)}>
              {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
              {paused ? 'Resume movement' : 'Pause movement'}
            </button>
          </div>
          {row(rowA, false)}{row(rowB.length ? rowB : rowA, true)}
        </>
      ) : (
        <div className="wl__grid">
          {shown.map((voice, index) => <Card key={`${voice.name}-${index}`} voice={voice} placeholder={placeholder} />)}
        </div>
      )}
      <p className="wl__share">Used MockMob? <a href={`mailto:${contact}?subject=My%20MockMob%20story`}>Tell us how it went</a>. We only publish words you agree to share.</p>
    </div>
  );
}
