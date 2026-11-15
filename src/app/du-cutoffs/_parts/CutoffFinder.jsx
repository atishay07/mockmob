'use client';
// The DU cutoffs index: every course (by stream) and every college, findable from one field on a phone. The full
// lists are in the static HTML; typing narrows both with the site's one DU matcher (collegeSearch.mjs), so "bcom hons",
// "srcc", "lsr" and "hansrj" all find what they mean.
import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { duSearch } from '@/lib/du/collegeSearch.mjs';
import { useAboveKeyboard } from '@/lib/du/useAboveKeyboard';

function CourseRow({ course }) {
  return (
    <li>
      <Link href={course.href} className="dc-list__link">
        <span className="dc-list__name">{course.name}</span>
        <span className="dc-list__meta">{course.meta}</span>
      </Link>
    </li>
  );
}

/**
 * streams: [{ stream, courses: [{ id, name, href, meta }] }]; colleges: [{ slug, name, href, meta }].
 */
export function CutoffFinder({ streams, colleges }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [query, setQuery] = useState('');
  // On a phone the keyboard covers the lower half: keep the field near the top so its results show under it.
  useAboveKeyboard();
  const courses = useMemo(() => streams.flatMap((s) => s.courses), [streams]);
  const typed = query.trim().length > 0;
  const foundCourses = useMemo(() => (typed ? duSearch(query, courses, (c) => c.name) : []), [typed, query, courses]);
  const foundColleges = useMemo(() => (typed ? duSearch(query, colleges, (c) => c.name) : colleges), [typed, query, colleges]);

  return (
    <div className="dc-finder">
      <div className="dc-search">
        <label htmlFor={`${id}-q`} className="dc-label">Find a course or college</label>
        <div className="dc-search__box">
          <Search size={18} aria-hidden="true" />
          <input
            data-du-search
            id={`${id}-q`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="B.Com (Hons), Hindu, SRCC"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            aria-describedby={`${id}-count`}
          />
          {typed ? (
            <button type="button" className="dc-search__clear" onClick={() => setQuery('')} aria-label="Clear the search">
              <X size={18} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <p className="dc-search__count" id={`${id}-count`} aria-live="polite">
          {typed
            ? foundCourses.length + foundColleges.length === 0
              ? `Nothing matches “${query.trim()}”. Try a shorter name, like Hindu or B.Com.`
              : `${foundCourses.length} ${foundCourses.length === 1 ? 'course' : 'courses'} and ${foundColleges.length} ${foundColleges.length === 1 ? 'college' : 'colleges'} match.`
            : <>{courses.length} courses and <a href="#colleges" className="dc-jump">{colleges.length} colleges</a>.</>}
        </p>
      </div>

      {/* While searching, a list with no match is left out: the line under the field already says so. */}
      {typed && !foundCourses.length ? null : (
      <section className="mm-article__section dc-index" id="courses" aria-labelledby="dc-courses-title">
        <h2 className="mm-h2" id="dc-courses-title">Courses</h2>
        {typed ? (
          <ul className="dc-list">{foundCourses.map((c) => <CourseRow key={c.id} course={c} />)}</ul>
        ) : (
          streams.map((s) => (
            <div key={s.stream} className="dc-stream">
              <h3 className="dc-stream__name">{s.stream}</h3>
              <ul className="dc-list">{s.courses.map((c) => <CourseRow key={c.id} course={c} />)}</ul>
            </div>
          ))
        )}
      </section>
      )}

      {typed && !foundColleges.length ? null : (
      <section className="mm-article__section dc-index" id="colleges" aria-labelledby="dc-colleges-title">
        <h2 className="mm-h2" id="dc-colleges-title">Colleges</h2>
        <ul className="dc-list">
            {foundColleges.map((c) => (
              <li key={c.slug}>
                <Link href={c.href} className="dc-list__link">
                  <span className="dc-list__name">{c.name}</span>
                  <span className="dc-list__meta">{c.meta}</span>
                </Link>
              </li>
            ))}
        </ul>
      </section>
      )}
    </div>
  );
}
