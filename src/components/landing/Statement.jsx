"use client";

// The statement under the hero (LK69, 4 Nov 2026): "Your marks slipped somewhere. MockMob shows you where, ..." with the
// four launch papers standing on a lit shelf.
//
//   <Statement text={STATEMENT} shelf={SHELF} note={`${SUBJECT_CLAIM.long}.`} />
//
// On a phone it is a 4-step held story (ScrollStory): one swipe, one clause. The first clause is lit when the story
// opens, each step lights the next, and on the last the four objects arrive onto their shadows. Step-driven, so a
// stop can never leave a half-lit sentence. On a desktop it stays what it was: the words scrub as the section passes
// (hero-depth.css, completing before the section is mid-window so no resting place shows a half-lit line) and the
// shelf lands with the section's own timeline (home.css). Short phones and reduced motion get the finished scene.
// Nothing is removed: the same words, the same four objects, the same links, in the same reading order.
import Link from 'next/link';
import { useMemo } from 'react';
import ScrollStory from './ScrollStory';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { STATEMENT_HOLD, STATEMENT_STEPS, statementWords } from './statementSteps.mjs';

/** The note with its figures' phrases ("15 subjects", "19 of every 20 CUET papers") marked; any other note stays plain. */
function noteParts(note) {
  return String(note).split(/(\d+ subjects|\d+ of every \d+ CUET papers)/).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
}

function StatementStage({ text, shelf, note }) {
  const words = useMemo(() => statementWords(text), [text]);
  return (
    <div className="mm-wrap lp-statement__grid">
      <p className="lp-statement__text">
        {words.map((word, i) => {
          // An accent word's trailing comma or stop stays ink: the green lands on the word alone (LK86).
          const [, core, mark] = word.accent ? word.text.match(/^(.*?)([.,;:!?]*)$/) : [null, word.text, ''];
          return (
            <span key={i} className="lp-statement__w" data-accent={word.accent || undefined} data-brand={word.brand || undefined} data-ph={word.clause} style={{ '--p': (i / Math.max(1, words.length - 1)).toFixed(3), '--wo': word.offset }}>
              {core}{mark ? <span className="lp-statement__mark">{mark}</span> : null}{i < words.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </p>
      {/* data-ss-step: tabbing into the shelf brings the last step on (the objects arrive), like focus into any step. */}
      <div className="lp-shelf" data-ss-step={STATEMENT_STEPS - 1}>
        <ul className="lp-shelf__row" aria-label="Subjects with full NTA-pattern mocks">
          {shelf.map(({ id, name, href, depth, tilt, base, sizes }, i) => (
            <li key={id} className="lp-shelf__item" style={{ '--k': i, '--depth': depth, '--tilt': `${tilt}deg`, '--base': base }}>
              <Link href={href} className="lp-shelf__link">
                <span className="lp-shelf__float"><SubjectObject id={id} size={184} sizes={sizes} lit={i === 1} className="lp-shelf__obj" style={{ '--obj-size': 'var(--shelf-obj)' }} /></span>
                <span className="lp-shelf__name">{name}</span>
              </Link>
            </li>
          ))}
        </ul>
        {/* Round 10: the claim's two figures ("15 subjects", "19 of every 20 CUET papers", data/subject_claim.js) are set
            in ink, so the proof under the shelf reads at a glance instead of as one grey caption. Same words. */}
        <p className="lp-shelf__note">{noteParts(note)}</p>
      </div>
    </div>
  );
}

export function Statement({ text, shelf, note }) {
  return (
    <section className="lp-statement" aria-label="What MockMob does">
      <ScrollStory
        steps={STATEMENT_STEPS}
        className="lp-statement__story"
        hold={STATEMENT_HOLD}
        holdCalm
        quiet
        Content={StatementStage}
        text={text}
        shelf={shelf}
        note={note}
      />
    </section>
  );
}

export default Statement;
