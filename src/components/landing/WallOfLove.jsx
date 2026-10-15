"use client";

// Only explicitly consented, attributable student words are publishable. They are set as type, not cards: the
// first quote large, the rest as a two-column list on hairlines, each with the name and the detail the student
// agreed to share. No avatars (an initials circle is a made-up face), no marquee: nothing on this wall moves.
import { useMemo } from 'react';

function Byline({ voice, placeholder }) {
  return (
    <figcaption>
      <b>{voice.name}</b>
      {voice.detail ? <i>{voice.detail}</i> : null}
      {placeholder ? <span className="wl__preview">Preview text</span> : null}
    </figcaption>
  );
}

export default function WallOfLove({ voices = [], placeholder = false, contact = 'support@mockmob.in' }) {
  const shown = useMemo(() => (Array.isArray(voices) ? voices : []).filter((voice) => (
    voice && voice.consent === true && typeof voice.quote === 'string' && voice.quote.trim() &&
    typeof voice.name === 'string' && voice.name.trim()
  )), [voices]);

  if (!shown.length) return null;
  const [lead, ...rest] = shown;

  return (
    <div className="wl" role="region" aria-label="What students say">
      <figure className="wl__lead">
        <blockquote>{lead.quote}</blockquote>
        <Byline voice={lead} placeholder={placeholder} />
      </figure>
      {rest.length ? (
        <ul className="wl__list">
          {rest.map((voice, index) => (
            <li key={`${voice.name}-${index}`}>
              <figure className="wl__item">
                <blockquote>{voice.quote}</blockquote>
                <Byline voice={voice} placeholder={placeholder} />
              </figure>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="wl__share">Used MockMob? <a href={`mailto:${contact}?subject=My%20MockMob%20story`}>Tell us how it went</a>. We only publish words you agree to share.</p>
    </div>
  );
}
