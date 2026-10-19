"use client";

// "Which DU course are you aiming for?" on the subjects step (the app's course step and its "Every DU course" search, flutter_app
// lib/features/onboarding/steps/course_step.dart and widgets/course_list_sheet.dart; owner 19 Oct, G9: the course's subject rule
// is shown up front, not only after a pick). Optional: a student who is not sure just picks subjects. A chosen course shows what
// it asks for in CUET subjects, from the Bulletin's own combinations, and whether the picks fit it as they are made. The colleges
// step opens on the same course. The rules are src/lib/du/courseRule.mjs; the search is the one every DU search uses.
import { useDeferredValue, useMemo, useState } from 'react';
import { Check, Info, Pencil, Search } from 'lucide-react';
import { duSearch } from '@/lib/du/collegeSearch.mjs';
import { courseFit, courseRuleSentence } from '@/lib/du/courseRule.mjs';
import { courseChoices, courseLine } from './courseChoice.mjs';

const HINT = 'Search a course, like bcom or economics';

/** `rules`: public/du/2026/index.json (or null while it loads); `failed`: it did not load. */
export default function CourseFinder({ rules, failed, onRetry, courseId, onCourse, picked, disabled }) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const group = useMemo(() => (courseId ? (rules?.groups || []).find((g) => g.id === courseId) || null : null), [rules, courseId]);
  const found = useMemo(() => courseChoices(rules, deferred, duSearch), [rules, deferred]);
  const rule = group ? courseRuleSentence(group, rules) : null;
  const fit = group ? courseFit(group, picked, rules) : null;

  const choose = (id) => { onCourse(id); setQuery(''); };

  return (
    <section className="ob-course" aria-labelledby="ob-course-h" data-chosen={group ? '' : undefined}>
      <div className="ob-course__head">
        <h2 id="ob-course-h">Which DU course are you aiming for?</h2>
        <span className="ob-course__opt">Optional</span>
      </div>

      {group ? (
        <div className="ob-course__chosen">
          <div className="ob-course__row">
            <p className="ob-course__name"><b>{group.name}</b><span>{courseLine(group)}</span></p>
            <button type="button" className="ob-course__change" onClick={() => choose(null)} disabled={disabled}>
              <Pencil size={14} aria-hidden="true" /><span>Change course</span>
            </button>
          </div>
          <div aria-live="polite" className="ob-course__live">
            {rule ? <p className="ob-course__rule">{rule}</p> : null}
            {fit ? (
              <p className="ob-course__fit" data-fit={fit.fits ? 'yes' : 'no'}>
                {fit.fits ? <Check size={16} aria-hidden="true" /> : <Info size={16} aria-hidden="true" />}
                <span>{fit.line}</span>
              </p>
            ) : <p className="ob-course__fit ob-course__fit--wait">Pick a subject and we check it against this course.</p>}
          </div>
        </div>
      ) : (
        <>
          <p className="ob-course__lead">Search it and we show the CUET subjects it takes. Not sure yet? Skip this and pick your subjects. You can choose a course later in Colleges.</p>
          {failed ? (
            <p className="ob-course__note" role="status">The DU course list did not load. <button type="button" className="ob-course__link" onClick={onRetry}>Try again</button></p>
          ) : (
            <>
              <label className="ob-search">
                <span className="sr-only">Search a DU course</span>
                <Search size={18} aria-hidden="true" />
                <input
                  type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={HINT}
                  autoComplete="off" spellCheck={false} enterKeyHint="search" data-du-search="" disabled={disabled}
                />
              </label>
              {!rules ? (
                <div className="ob-course__list" aria-busy="true">{[0, 1, 2].map((i) => <span key={i} className="ob-course__opt-btn ob-course__opt-btn--wait" />)}</div>
              ) : found.length ? (
                <div className="ob-course__list" role="group" aria-label={query.trim() ? 'Matching courses' : 'Courses students choose most'}>
                  {found.map((g) => (
                    <button key={g.id} type="button" className="ob-course__opt-btn" onClick={() => choose(g.id)} disabled={disabled}>
                      <b>{g.name}</b>
                      <span>{g.colleges} {g.colleges === 1 ? 'college' : 'colleges'}</span>
                    </button>
                  ))}
                </div>
              ) : <p className="ob-course__note" role="status">No DU course matches &ldquo;{query.trim()}&rdquo;. Try bcom, economics or BMS.</p>}
            </>
          )}
        </>
      )}
    </section>
  );
}

