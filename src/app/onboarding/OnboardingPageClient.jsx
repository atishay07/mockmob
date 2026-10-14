"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/Button';
import { PageHead } from '@/components/ui/PageHead';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { ErrorState, OfflineState } from '@/components/ui/Skeleton';
import { useAuth } from '@/components/AuthProvider';
import { Mascot } from '@/components/brand/Mascot';
import { SubjectTiles, StaleSubjects, SubjectTilesSkeleton } from './SubjectPicker';
import {
  MAX_SUBJECTS, chosenCount, firstCheckHref, formatTime12, isOffline, pickableSubjects, saveState, subjectName, toggleSubject,
} from './subjects.mjs';
import './onboarding.css';

// First run: choose up to five subjects, save, then the first check (10 questions in one of
// them, opened in Practice with the setup prefilled; the cost is shown there on the confirm
// line). ?edit=true: the same choice for an existing account, back to Practice after saving.
// "Saved" is shown only after the server answered and the session refreshed.

const noSubscribe = () => () => {};
const readEdit = () => new URLSearchParams(window.location.search).get('edit') === 'true';
const serverEdit = () => false;

function firstName(name) {
  const first = String(name || '').trim().split(/\s+/)[0];
  return first && first.length <= 24 ? first : '';
}

function saveFailure(response, failure) {
  if (response && response.status === 400) return 'That set was not accepted. Choose up to five listed subjects.';
  if (!response && isOffline(failure)) return 'You are offline. Your subjects were not changed. Try again when you are connected.';
  return 'We could not save your subjects. Your choices are still here. Try again.';
}

export default function OnboardingPageClient({ preview = false }) {
  const router = useRouter();
  const { user, status, refreshSession } = useAuth();
  const isEdit = useSyncExternalStore(noSubscribe, readEdit, serverEdit);
  const [catalog, setCatalog] = useState([]);
  const [catalogState, setCatalogState] = useState('loading');
  const [retry, setRetry] = useState(0);
  const [draft, setDraft] = useState(null);
  const [capped, setCapped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // { at, subjects } once the server acknowledged
  const [checkSubject, setCheckSubject] = useState(null);
  const saveLock = useRef(false);
  const finishing = useRef(false);
  const doneHeading = useRef(null);

  const saved = Array.isArray(user?.subjects) ? user.subjects : [];
  const selected = draft ?? saved;

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/subjects', { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data)) throw new Error('catalog_unavailable');
        setCatalog(data);
        setCatalogState('ready');
      })
      .catch((failure) => { if (failure.name !== 'AbortError') setCatalogState('error'); });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    if (preview || finishing.current) return;
    if (status === 'unauthenticated') {
      router.push('/signup');
    } else if (status === 'authenticated' && saved.length > 0 && !isEdit) {
      // Subjects are already chosen: this is not a first run.
      router.push('/dashboard');
    }
  }, [status, saved.length, isEdit, router, preview]);

  useEffect(() => {
    if (done) doneHeading.current?.focus();
  }, [done]);

  function toggle(id) {
    if (saveLock.current) return;
    const next = toggleSubject(selected, id, { max: MAX_SUBJECTS });
    setCapped(next.capped);
    setError('');
    if (!next.capped) setDraft(next.selected);
  }

  async function save() {
    if (saveLock.current || !user?.id) return;
    const check = saveState(selected, isEdit ? saved : null, { requireOne: isEdit });
    if (!check.canSave) return;
    saveLock.current = true;
    setSaving(true);
    setError('');
    let response = null;
    try {
      response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: selected }),
      });
      if (!response.ok) throw new Error('save_failed');
      finishing.current = true;
      try { await refreshSession(); } catch { /* the save is committed; the next page load re-reads the session */ }
      const chosen = [...selected];
      if (isEdit && !preview) {
        router.push('/dashboard');
        return;
      }
      setDone({ at: new Date(), subjects: chosen });
      setCheckSubject(pickableSubjects(catalog).find((subject) => chosen.includes(subject.id))?.id || null);
    } catch (failure) {
      finishing.current = false;
      setError(saveFailure(response && !response.ok ? response : null, failure));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  const name = firstName(user?.name);

  return (
    <div className="ob">
      <header className="ob-top ui-chrome">
        <div className="ob-top__inner">
          <Logo />
          <div className="ob-top__end">
            {isEdit ? <Link href="/dashboard" className="ob-top__link">Back to Practice</Link> : null}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main-content" className="ob-main">
        {done ? (
          <FirstCheck
            headingRef={doneHeading}
            done={done}
            catalog={catalog}
            checkSubject={checkSubject}
            onPick={setCheckSubject}
            preview={preview}
          />
        ) : status === 'unavailable' && !user ? (
          <div className="ob-state">
            <OfflineState
              title="We could not reach MockMob"
              message="Nothing is lost. Check your connection, then try again to choose your subjects."
              onRetry={() => refreshSession({ silent: false })}
            />
          </div>
        ) : catalogState === 'error' ? (
          <div className="ob-state">
            <ErrorState
              title="Subjects did not load"
              message="Check your connection and try again. Nothing was changed."
              onRetry={() => { setCatalogState('loading'); setRetry((count) => count + 1); }}
            />
          </div>
        ) : (
          <>
            <div className="ob-intro">
              {!isEdit ? (
                <div className="ob-mobi" aria-hidden="true"><Mascot pose="greeting" eager /></div>
              ) : null}
              <PageHead
                tone={isEdit ? 'screen' : 'moment'}
                title={isEdit ? 'Your subjects' : name ? `${name}, which subjects are you writing?` : 'Which subjects are you writing?'}
                lead={isEdit
                  ? 'Five at most, like the exam. Practice and Today follow these once saved.'
                  : 'Pick up to five, like the exam. Practice and Today plan from these, and you can change them later in Account.'}
              />
            </div>

            {catalogState === 'loading' || status === 'loading' ? (
              <div role="status" aria-live="polite">
                <span className="sr-only">Loading the subject list</span>
                <SubjectTilesSkeleton count={9} />
              </div>
            ) : (
              <div className="ob-pick">
                <StaleSubjects catalog={catalog} selected={selected} onRemove={toggle} disabled={saving} />
                <SubjectTiles catalog={catalog} selected={selected} onToggle={toggle} disabled={saving} label="CUET subjects with practice" />
              </div>
            )}
          </>
        )}
      </main>

      {!done && catalogState !== 'error' && !(status === 'unavailable' && !user) ? (
        <SaveBar
          selected={selected}
          saved={isEdit ? saved : null}
          requireOne={isEdit}
          capped={capped}
          error={error}
          saving={saving}
          ready={catalogState === 'ready' && Boolean(user?.id)}
          onSave={save}
          label={isEdit ? 'Save subjects' : 'Save and continue'}
        />
      ) : null}
    </div>
  );
}

function SaveBar({ selected, saved, requireOne, capped, error, saving, ready, onSave, label }) {
  const check = saveState(selected, saved, { requireOne });
  const note = error || (capped ? 'Five is the most. Remove one to add another.' : '');
  return (
    <div className="ob-bar">
      <div className="ob-bar__inner">
        <div className="ob-bar__status">
          <p className="ob-bar__count" aria-live="polite">{chosenCount(selected.length)}</p>
          <p className={`ob-bar__note ${error ? 'ob-bar__note--bad' : ''}`} role={error ? 'alert' : 'status'}>
            {note || (ready && !check.canSave ? check.reason : '')}
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          loading={saving}
          disabled={!ready || !check.canSave}
          onClick={onSave}
          className="ob-bar__save"
        >
          {saving ? 'Saving subjects' : label}
        </Button>
      </div>
    </div>
  );
}

function FirstCheck({ headingRef, done, catalog, checkSubject, onPick, preview }) {
  const subjects = pickableSubjects(catalog).filter((subject) => done.subjects.includes(subject.id));
  const current = checkSubject || subjects[0]?.id || null;
  const currentName = current ? subjectName(catalog, current) : '';
  return (
    <section className="ob-done" aria-labelledby="ob-done-title">
      <div className="ob-mobi ob-mobi--done" aria-hidden="true"><Mascot pose="pointing" eager /></div>
      <header className="ui-pagehead ui-pagehead--moment">
        <h1 className="ui-pagehead__title" id="ob-done-title" ref={headingRef} tabIndex={-1}>Start your first check</h1>
        <p className="ui-pagehead__lead">Ten questions in one subject. The result shows where your marks went.</p>
      </header>

      <p className="ob-done__saved" role="status">
        {preview
          ? 'Preview only: nothing was saved to an account.'
          : `Subjects saved at ${formatTime12(done.at)}. Practice and Today use them now.`}
      </p>

      {subjects.length > 1 ? (
        <div className="ob-done__pick">
          <p className="ob-done__label" aria-hidden="true">Subject for the first check</p>
          <ChipGroup label="Subject for the first check" single>
            {subjects.map((subject) => (
              <Chip key={subject.id} selected={subject.id === current} onClick={() => onPick(subject.id)}>
                {subject.name}
              </Chip>
            ))}
          </ChipGroup>
        </div>
      ) : null}

      <div className="ob-done__actions">
        {current ? (
          <Button asChild variant="primary" size="lg">
            <Link href={firstCheckHref(current)}>{`Start with 10 questions in ${currentName}`}</Link>
          </Button>
        ) : null}
        <Button asChild variant="quiet">
          <Link href="/dashboard">Go to Practice</Link>
        </Button>
      </div>
    </section>
  );
}
