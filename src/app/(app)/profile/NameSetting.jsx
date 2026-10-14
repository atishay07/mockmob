"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Input';
import { apiPatch } from '@/lib/fetcher';
import { formatTime12, isOffline } from '@/app/onboarding/subjects.mjs';
import { AccountNote } from './AccountSection';

// Account > Profile: the display name (WEB-PARITY F2, the app's words). Rest shows the name and
// an Edit key; editing validates on save (not mid-word); "saved" appears only after the server
// answered and the session refreshed. Escape or Cancel puts everything back.

const MAX_NAME = 80;

function validate(name) {
  const clean = name.trim();
  if (!clean) return 'Write a name first.';
  if (clean.length > MAX_NAME) return `Keep it to ${MAX_NAME} characters.`;
  return '';
}

function failure(error) {
  if (isOffline(error)) return 'You are offline. Your name was not changed.';
  if (error?.status === 400) return 'That name was not accepted. Use 1 to 80 characters.';
  return 'We could not save your name. Nothing was changed. Try again.';
}

export default function NameSetting({ user, refreshSession }) {
  const current = user?.name || '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState({ tone: null, text: '' });
  const inputRef = useRef(null);
  const editRef = useRef(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
    else if (returnFocus.current) { returnFocus.current = false; editRef.current?.focus(); }
  }, [editing]);

  function open() {
    setDraft(current);
    setInvalid('');
    setNote({ tone: null, text: '' });
    setEditing(true);
  }

  function close() {
    returnFocus.current = true;
    setEditing(false);
    setInvalid('');
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    const problem = validate(draft);
    if (problem) { setInvalid(problem); inputRef.current?.focus(); return; }
    const clean = draft.trim();
    if (clean === current) { close(); return; }
    setSaving(true);
    setNote({ tone: null, text: '' });
    try {
      await apiPatch(`/api/users/${user.id}`, { name: clean });
      try { await refreshSession({ silent: true }); } catch { /* saved; the session catches up on the next load */ }
      setNote({ tone: 'ok', text: `Name saved at ${formatTime12(new Date())}.` });
      close();
    } catch (error) {
      setNote({ tone: 'bad', text: failure(error) });
    } finally {
      setSaving(false);
    }
  }

  const initial = (current || user?.email || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="acct-row acct-name">
      {editing ? (
        <form className="acct-name__form" onSubmit={save} noValidate onKeyDown={(event) => { if (event.key === 'Escape' && !saving) close(); }}>
          <Field label="Display name" hint="Shown on your account. Up to 80 characters." error={invalid}>
            <TextInput
              ref={inputRef}
              value={draft}
              onChange={(event) => { setDraft(event.target.value); if (invalid) setInvalid(''); }}
              autoComplete="name"
              maxLength={120}
              disabled={saving}
            />
          </Field>
          <div className="acct-actions">
            <Button type="submit" variant="primary" loading={saving}>{saving ? 'Saving name' : 'Save name'}</Button>
            <Button variant="quiet" onClick={close} disabled={saving}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div className="acct-name__view">
          <span className="acct-mark" aria-hidden="true">{initial}</span>
          <div className="acct-name__text">
            <p className="acct-name__value">{current || 'No name yet'}</p>
            <p className="acct-name__sub">{current ? 'Display name' : 'Add the name you want on your account.'}</p>
          </div>
          <Button ref={editRef} variant="secondary" size="sm" onClick={open} aria-label={current ? 'Edit display name' : 'Add display name'}>
            {current ? 'Edit' : 'Add name'}
          </Button>
        </div>
      )}
      <AccountNote tone={note.tone}>{note.text}</AccountNote>
    </div>
  );
}
