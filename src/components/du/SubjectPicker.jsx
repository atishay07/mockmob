"use client";

import { Check, Search, X } from 'lucide-react';
import { useId, useRef } from 'react';
import { searchSubjects } from '@/lib/du/search';

// Subject chips for CUET List A (languages), List B (domain subjects) and the General
// Aptitude Test, with a finder that maps the names students know ("Informatics Practices",
// "IP", "Biotech", "Book Keeping") to the single subject DU/NTA count them as.
//
// The check indicator is always rendered (outlined when off, filled when on), so toggling a
// chip never changes its width and never reflows the page.
function Chip({ pressed, onClick, title, children }) {
  return (
    <button type="button" className="du-chip" aria-pressed={pressed} onClick={onClick} title={title}>
      <span className="du-chip__tick" aria-hidden="true">
        <Check size={12} strokeWidth={3} />
      </span>
      <span>{children}</span>
    </button>
  );
}

const GAT_WORDS = ['gat', 'general', 'aptitude', 'test'];

export function SubjectPicker({ catalog, selection, onToggle, query, onQuery }) {
  const finderId = useId();
  const finderRef = useRef(null);
  const q = query.trim();
  const found = searchSubjects(q, catalog);
  const searching = q.length >= 2;
  const showGat = !searching || GAT_WORDS.some((w) => w.startsWith(q.toLowerCase()) || q.toLowerCase().startsWith('gen'));
  const languages = searching ? catalog.languages.filter((l) => found.languages.includes(l.id)) : catalog.languages;
  const domains = searching ? catalog.domains.filter((d) => found.domains.includes(d.id)) : catalog.domains;
  const nothing = searching && languages.length === 0 && domains.length === 0 && !showGat;

  // "Informatics Practices" typed -> tell the student it is counted as the official subject.
  const aliasNotes = domains
    .map((d) => ({ d, hit: found.hits[d.id] }))
    .filter(({ d, hit }) => searching && hit && !d.name.toLowerCase().startsWith(hit.toLowerCase()));

  return (
    <div className="du-picker">
      <div className="du-finder">
        <Search size={16} aria-hidden="true" />
        <label htmlFor={finderId} className="du-sr">Find your subject</label>
        <input
          id={finderId}
          ref={finderRef}
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Find your subject, e.g. Informatics Practices"
          autoComplete="off"
        />
        {query ? (
          <button type="button" className="du-finder__clear" onClick={() => { onQuery(''); finderRef.current?.focus(); }} aria-label="Clear search">
            <X size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {aliasNotes.length > 0 ? (
        <ul className="du-alias" aria-live="polite">
          {aliasNotes.map(({ d, hit }) => (
            <li key={d.id}>
              <b>{hit}</b> is counted as <b>{d.name}</b>. NTA and DU treat these papers as one subject.
            </li>
          ))}
        </ul>
      ) : null}

      {nothing ? <p className="du-state">No CUET subject matches “{q}”. Try the name on your Class 12 marksheet.</p> : null}

      {languages.length > 0 ? (
        <fieldset className="du-group">
          <legend>
            Language <small>List A · at least one</small>
          </legend>
          <div className="du-chips">
            {languages.map((l) => (
              <Chip key={l.id} pressed={selection.languages.includes(l.id)} onClick={() => onToggle('language', l.id)}>
                {l.name}
              </Chip>
            ))}
          </div>
        </fieldset>
      ) : null}

      {domains.length > 0 ? (
        <fieldset className="du-group">
          <legend>
            Domain subjects <small>List B</small>
          </legend>
          <div className="du-chips">
            {domains.map((d) => (
              <Chip key={d.id} pressed={selection.domains.includes(d.id)} onClick={() => onToggle('domain', d.id)}>
                {d.name}
              </Chip>
            ))}
          </div>
          {!searching ? (
            <p className="du-hint">Subjects named together count as one. Informatics Practices is the same CUET subject as Computer Science.</p>
          ) : null}
        </fieldset>
      ) : null}

      {showGat ? (
        <fieldset className="du-group">
          <legend>
            General test <small>needed by some programmes</small>
          </legend>
          <div className="du-chips">
            <Chip pressed={selection.gat} onClick={() => onToggle('gat', 'gat')}>
              General Aptitude Test
            </Chip>
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
