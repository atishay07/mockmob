"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SubjectIcon } from '@/components/ui/Glyph';
import { apiPatch } from '@/lib/fetcher';
import { SubjectTiles, StaleSubjects, SubjectTilesSkeleton } from '@/app/onboarding/SubjectPicker';
import {
  MAX_SUBJECTS, chosenCount, formatTime12, isOffline, saveState, staleSubjects, subjectLight, subjectName, toggleSubject,
} from '@/app/onboarding/subjects.mjs';
import { AccountSection, AccountNote } from './AccountSection';

// Account > Subjects (WEB-PARITY F1, edited in place instead of a trip to onboarding). At rest:
// the saved subjects with their art, and any that practice cannot open marked as such. Editing:
// the same tiles as onboarding, five at most, at least one kept. Saved only after the server
// answered and the session refreshed; a failure keeps the choice on screen.

function failure(error) {
  if (isOffline(error)) return 'You are offline. Your subjects were not changed. Try again when you are connected.';
  if (error?.status === 400) return 'That set was not accepted. Choose up to five listed subjects.';
  return 'We could not save your subjects. Nothing was changed. Try again.';
}

export default function SubjectsSetting({ user, refreshSession }) {
  const saved = Array.isArray(user?.subjects) ? user.subjects : [];
  const [catalog, setCatalog] = useState([]);
  const [catalogState, setCatalogState] = useState('loading');
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [capped, setCapped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState({ tone: null, text: '' });
  const editRef = useRef(null);
  const editorRef = useRef(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/subjects', { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data)) throw new Error('catalog_unavailable');
        setCatalog(data);
        setCatalogState('ready');
      })
      .catch((error) => { if (error.name !== 'AbortError') setCatalogState('error'); });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    if (editing) editorRef.current?.focus();
    else if (returnFocus.current) { returnFocus.current = false; editRef.current?.focus(); }
  }, [editing]);

  function open() {
    setDraft(saved);
    setCapped(false);
    setNote({ tone: null, text: '' });
    setEditing(true);
  }

  function close() {
    returnFocus.current = true;
    setEditing(false);
    setCapped(false);
  }

  function toggle(id) {
    if (saving) return;
    const next = toggleSubject(draft, id, { max: MAX_SUBJECTS });
    setCapped(next.capped);
    if (!next.capped) setDraft(next.selected);
  }

  async function save() {
    if (saving || !saveState(draft, saved, { requireOne: true }).canSave) return;
    setSaving(true);
    setNote({ tone: null, text: '' });
    try {
      await apiPatch(`/api/users/${user.id}`, { subjects: draft });
      await refreshSession({ silent: true });
      setNote({ tone: 'ok', text: `Subjects saved at ${formatTime12(new Date())}. Practice and Today now use them.` });
      close();
    } catch (error) {
      setNote({ tone: 'bad', text: failure(error) });
    } finally {
      setSaving(false);
    }
  }

  const check = saveState(draft, saved, { requireOne: true });
  const stale = new Set(catalogState === 'ready' ? staleSubjects(saved, catalog).map((subject) => subject.id) : []);

  return (
    <AccountSection id="subjects" title="Subjects" lead="Practice and Today plan from these. Five at most, like the exam.">
      {editing ? (
        <div className="acct-row acct-subjects-edit" ref={editorRef} tabIndex={-1} aria-label="Edit subjects">
          {catalogState === 'ready' ? (
            <>
              <StaleSubjects catalog={catalog} selected={draft} onRemove={toggle} disabled={saving} />
              <SubjectTiles catalog={catalog} selected={draft} onToggle={toggle} disabled={saving} label="CUET subjects with practice" />
            </>
          ) : <SubjectTilesSkeleton count={6} />}
          <div className="acct-subjects-edit__foot">
            <div className="acct-subjects-edit__status">
              <p className="acct-count" aria-live="polite">{chosenCount(draft.length)}</p>
              <p className="acct-help" role="status">{capped ? 'Five is the most. Remove one to add another.' : check.reason}</p>
            </div>
            <div className="acct-actions">
              <Button variant="primary" loading={saving} disabled={!check.canSave} onClick={save}>{saving ? 'Saving subjects' : 'Save subjects'}</Button>
              <Button variant="quiet" onClick={close} disabled={saving}>Cancel</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="acct-row">
          {saved.length ? (
            <ul className="acct-subjects" aria-label={`Your subjects, ${chosenCount(saved.length)}`}>
              {saved.map((id) => {
                const light = subjectLight(id);
                const row = catalog.find((subject) => subject.id === id);
                return (
                  <li key={id} className="acct-subject" style={{ '--sp-night': light.night, '--sp-day': light.day }}>
                    <span className="acct-subject__art" aria-hidden="true"><SubjectIcon id={row?.internalId || id} size={18} /></span>
                    <span className="acct-subject__text">
                      <b>{subjectName(catalog, id)}</b>
                      {stale.has(id) ? <span>Practice cannot open this subject</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="acct-empty">No subjects yet. Choose the papers you are writing and Practice plans from them.</p>
          )}
          <div className="acct-row__foot">
            <p className="acct-count">{chosenCount(saved.length)}</p>
            {catalogState === 'error' ? (
              <Button variant="secondary" size="sm" onClick={() => { setCatalogState('loading'); setRetry((count) => count + 1); }}>
                Load the subject list
              </Button>
            ) : (
              <Button
                ref={editRef}
                variant="secondary"
                size="sm"
                onClick={open}
                disabled={catalogState !== 'ready'}
              >
                {saved.length ? 'Edit subjects' : 'Choose subjects'}
              </Button>
            )}
          </div>
          {catalogState === 'error' ? (
            <p className="acct-help">The subject list did not load, so editing waits. Your saved subjects are unchanged.</p>
          ) : null}
        </div>
      )}
      <AccountNote tone={note.tone}>{note.text}</AccountNote>
    </AccountSection>
  );
}
