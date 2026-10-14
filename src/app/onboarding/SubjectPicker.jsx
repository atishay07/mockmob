"use client";

import React from 'react';
import { SubjectIcon } from '@/components/ui/Glyph';
import { MAX_SUBJECTS, pickableSubjects, staleSubjects, subjectLight } from './subjects.mjs';
import './subjects.css';

// The subject grid for onboarding and Account (W2.3). Each tile is one real paper: its glyph in
// the app's subject light field, its name, its CUET code and chapter count. Chosen is the
// answer-sheet bubble (hollow at rest, inked when chosen) plus a raised fill and an ink rim, and
// aria-pressed, so it never rests on colour alone. Saved subjects practice cannot open are listed
// above with Remove; they are never offered as new picks.

function chaptersLine(subject) {
  const parts = [];
  if (subject.officialCode) parts.push(`Code ${subject.officialCode}`);
  if (Array.isArray(subject.chapters) && subject.chapters.length) {
    parts.push(`${subject.chapters.length} ${subject.chapters.length === 1 ? 'chapter' : 'chapters'}`);
  }
  return parts.join(', ');
}

export function SubjectTiles({ catalog, selected, onToggle, disabled = false, label = 'Subjects' }) {
  const pickable = pickableSubjects(catalog);
  if (!pickable.length) {
    return (
      <p className="sp-none" role="status">
        No subject is open for practice right now, so there is nothing to pick. Your saved subjects are unchanged. Try again later.
      </p>
    );
  }
  return (
    <div className="sp-grid" role="group" aria-label={label}>
      {pickable.map((subject) => {
        const chosen = selected.includes(subject.id);
        const light = subjectLight(subject.internalId || subject.id);
        const meta = chaptersLine(subject);
        return (
          <button
            key={subject.id}
            type="button"
            className="sp-tile"
            aria-pressed={chosen}
            disabled={disabled || undefined}
            onClick={() => onToggle(subject.id)}
            style={{ '--sp-night': light.night, '--sp-day': light.day }}
          >
            <span className="sp-tile__top">
              <span className="sp-tile__art" aria-hidden="true">
                <SubjectIcon id={subject.internalId || subject.id} size={22} />
              </span>
              <span className="sp-tile__bubble" aria-hidden="true" />
            </span>
            <span className="sp-tile__name">{subject.name}</span>
            {meta ? <span className="sp-tile__meta">{meta}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function StaleSubjects({ catalog, selected, onRemove, disabled = false }) {
  const stale = staleSubjects(selected, catalog);
  if (!stale.length) return null;
  return (
    <div className="sp-stale" role="group" aria-labelledby="sp-stale-title">
      <p className="sp-stale__title" id="sp-stale-title">On your profile, but practice cannot open these</p>
      <ul className="sp-stale__list">
        {stale.map((subject) => (
          <li key={subject.id} className="sp-stale__row">
            <span className="sp-stale__text">
              <b>{subject.name}</b>
              <span>{subject.reason}</span>
            </span>
            <button
              type="button"
              className="ui-btn ui-btn--quiet ui-btn--sm"
              onClick={() => onRemove(subject.id)}
              disabled={disabled || undefined}
              aria-label={`Remove ${subject.name}`}
            >
              <span className="ui-btn__label">Remove</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tile-shaped placeholders while the subject list loads. */
export function SubjectTilesSkeleton({ count = 6 }) {
  return (
    <div className="sp-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <span key={index} className="sp-tile sp-tile--ghost">
          <span className="ui-skeleton sp-ghost-art" />
          <span className="ui-skeleton sp-ghost-line" />
          <span className="ui-skeleton sp-ghost-line sp-ghost-line--short" />
        </span>
      ))}
    </div>
  );
}

export { MAX_SUBJECTS };
