"use client";

// The one-time "What should Mobi call you?" row under Today's greeting (the app's TodayNameAsk, I11, 20 Oct). A student who signed
// up by email code has no name they gave, so Today greets without one and the email's own prefix is never shown. This asks once.
// It sits on the ground like the rest of Today (one volt per screen is the lead key, so Save is an outline key). A saved name or
// "Not now" puts it away on this browser; the name stays one tap away in Account. The rules are src/lib/nameAsk.mjs.
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/Button';
import { NAME_ASK, NAME_ASK_KEY, NAME_MAX, checkName, shouldAskName } from '@/lib/nameAsk.mjs';
import './nameAsk.css';

function readDone() {
  try { return window.localStorage.getItem(NAME_ASK_KEY) === '1'; } catch { return false; }
}
function writeDone() {
  try { window.localStorage.setItem(NAME_ASK_KEY, '1'); } catch { /* private window: it asks again next visit at worst */ }
}

export default function NameAsk() {
  const { user, status, refreshSession } = useAuth();
  // null until this browser's mark is read, so the row never flashes in for a student who already put it away.
  const [done, setDone] = useState(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [thanks, setThanks] = useState(false);
  const input = useRef(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDone(readDone()), 0);
    return () => window.clearTimeout(id);
  }, []);

  const show = done === false && shouldAskName({ user, status, done: false });
  if (!show && !thanks) return null;

  const putAway = () => { writeDone(); setDone(true); };

  async function save(event) {
    event?.preventDefault();
    if (saving) return;
    const check = checkName(value);
    if (!check.ok) { setError(check.error); input.current?.focus(); return; }
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: check.name }) });
      if (!response.ok) throw new Error('save_failed');
      await refreshSession({ silent: true });
      writeDone();
      setThanks(true);
      setDone(true);
      window.setTimeout(() => setThanks(false), 1800);
    } catch {
      setError(NAME_ASK.failed);
    } finally {
      setSaving(false);
    }
  }

  if (thanks) return <p className="name-ask name-ask--thanks" role="status">{NAME_ASK.saved}</p>;

  return (
    <form className="name-ask" onSubmit={save} aria-labelledby="name-ask-title" noValidate>
      <h2 id="name-ask-title" className="name-ask__title">{NAME_ASK.title}</h2>
      <p className="name-ask__note">{NAME_ASK.note}</p>
      <div className="name-ask__row">
        <label className="name-ask__field">
          <span className="sr-only">{NAME_ASK.label}</span>
          <input
            ref={input} className="input" type="text" value={value} maxLength={NAME_MAX} disabled={saving}
            onChange={(event) => { setValue(event.target.value); if (error) setError(''); }}
            placeholder={NAME_ASK.label} autoComplete="given-name" autoCapitalize="words" enterKeyHint="done" spellCheck={false}
            aria-invalid={error ? 'true' : undefined} aria-describedby={error ? 'name-ask-error' : undefined}
          />
        </label>
        <div className="name-ask__keys">
          <Button type="submit" variant="outline" size="md" disabled={saving}>{saving ? NAME_ASK.saving : NAME_ASK.save}</Button>
          <button type="button" className="name-ask__quiet" onClick={putAway} disabled={saving}>{NAME_ASK.notNow}</button>
        </div>
      </div>
      <p id="name-ask-error" className="name-ask__error" role="alert">{error}</p>
    </form>
  );
}
