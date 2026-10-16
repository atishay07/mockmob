"use client";

// Account > Your sheet: who you are, the exam, your subjects as the app's photo-real objects, and
// your mocks at a glance. Ported from the restructure's You page and given the live page's warmth:
// Mobi greets beside your name (the page passes him in, so there is only ever one on screen), the
// objects are the shared SubjectObject (lamp-lit, settling in once, lifting on hover), and the counts
// roll to their real values. A subject the art does not know keeps its icon. Nothing here invents a
// number: a count that has not loaded shows a quiet bar, and one that failed says so with a retry.
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { useCountUp } from '@/lib/motion';
import { EXAM_LABEL, SUBJECT_LIMIT, SUBJECTS_EDIT_HREF, sheetSubjects, subjectCountLine } from './accountModel.mjs';
import './account.css';

function Roll({ value, suffix = '' }) {
  const shown = useCountUp(value, { from: 0, duration: 800 });
  return <>{shown}{suffix}</>;
}

function SheetSubject({ subject, index }) {
  return (
    <li className="acct-object subj-obj-host" style={{ '--i': index }}>
      <SubjectObject id={subject.id} size={76} lit className="acct-object__art" />
      <span className="acct-object__name">{subject.name}</span>
    </li>
  );
}

function Stat({ label, children }) {
  return (
    <div className="acct-stats__item">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * user: the signed-in user. mobi: the greeting Mobi (or null). mocks: { status: 'loading' | 'ready' | 'error',
 * count, average }. onRetry: reloads the mocks after a failure.
 */
export default function YourSheet({ user, greeting, mobi = null, plan = 'Free', mocks, onRetry }) {
  const subjects = sheetSubjects(user?.subjects);
  const room = subjects.length < SUBJECT_LIMIT;

  return (
    <section className="glass acct-sheet" id="sheet" aria-labelledby="acct-sheet-h">
      <div className="acct-sheet__who">
        {mobi ? <span className="acct-sheet__mobi">{mobi}</span> : null}
        <div className="acct-sheet__id">
          <h2 id="acct-sheet-h">{greeting}</h2>
          {user?.email ? <p className="acct-sheet__mail">Signed in as {user.email}</p> : null}
          <p className="acct-sheet__tags">
            <span>{EXAM_LABEL}</span>
            <span data-tone={plan === 'Pro' ? 'pro' : undefined}>{plan === 'Pro' ? 'Pro plan' : 'Free plan'}</span>
          </p>
        </div>
        {/* The header already shows your initials; with Mobi greeting here, a second avatar would only repeat it. */}
        {mobi ? null : <Avatar name={user?.name || user?.email} size="lg" className="acct-sheet__avatar" />}
      </div>

      <div className="acct-sheet__subjects">
        <div className="acct-sheet__row">
          <h3>Your subjects</h3>
          <p className="acct-sheet__count">{subjectCountLine(subjects.length)}</p>
        </div>
        {subjects.length ? (
          <ul className="acct-objects" aria-label="Your subjects">
            {subjects.map((subject, index) => <SheetSubject key={subject.id} subject={subject} index={index} />)}
            {room ? (
              <li className="acct-object acct-object--add" style={{ '--i': subjects.length }}>
                <Link href={SUBJECTS_EDIT_HREF} className="acct-object__add">
                  <span className="acct-object__stage" aria-hidden="true"><span className="acct-object__plus" /></span>
                  <span className="acct-object__name">Add a subject</span>
                </Link>
              </li>
            ) : null}
          </ul>
        ) : (
          <div className="acct-sheet__none">
            <p>Pick up to {SUBJECT_LIMIT} subjects. Practice and Today use them to choose your questions.</p>
            <Link href={SUBJECTS_EDIT_HREF} className="acct-key acct-key--volt">Pick subjects</Link>
          </div>
        )}
        {subjects.length ? <Link href={SUBJECTS_EDIT_HREF} className="acct-link">Edit subjects</Link> : null}
      </div>

      <dl className="acct-stats" aria-label="Your mocks at a glance" aria-busy={mocks.status === 'loading' || undefined}>
        <Stat label="Mocks taken">
          {mocks.status === 'loading' ? <><span className="acct-sk acct-sk--figure skeleton" aria-hidden="true" /><span className="sr-only">Loading</span></> : mocks.status === 'error' ? <span className="acct-stats__none">Did not load</span> : <Roll value={mocks.count} />}
        </Stat>
        <Stat label="Average score">
          {mocks.status === 'loading' ? <><span className="acct-sk acct-sk--figure skeleton" aria-hidden="true" /><span className="sr-only">Loading</span></>
            : mocks.status === 'error' ? <button type="button" className="acct-link acct-link--inline" onClick={onRetry}>Try again</button>
              : mocks.average === null ? <span className="acct-stats__none">No mocks yet</span> : <Roll value={mocks.average} suffix="%" />}
        </Stat>
        <div className="acct-stats__item acct-stats__next">
          <dt>Next session</dt>
          <dd><Link href="/today" className="acct-link profile-open">Open Today</Link></dd>
        </div>
      </dl>
    </section>
  );
}
