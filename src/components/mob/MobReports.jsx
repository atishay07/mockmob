"use client";
// Moderation's "Mob reports" list (SOCIAL-SPEC section 6): the reason, the name as reported and the date, nothing
// else. Draws nothing while the Mob is off (the route answers 404) or for anyone who is not a moderator.
import { useCallback, useEffect, useState } from 'react';
import { istDateTime } from '@/lib/mob/model.mjs';
import { mobFetch } from './useMob';
import './mob.css';

const REASONS = { name: 'Name', nudge: 'Nudges', safety: 'Safety' };

export function MobReports() {
  const [state, setState] = useState({ status: 'loading', reports: [], error: null });
  const [busy, setBusy] = useState(null);
  const load = useCallback(async () => {
    const r = await mobFetch('/api/mob/reports');
    if (r.ok) setState({ status: 'ready', reports: r.data.reports || [], error: null });
    else setState({ status: r.status === 404 || r.status === 403 ? 'hidden' : 'error', reports: [], error: r.message });
  }, []);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) load(); });
    return () => { cancelled = true; };
  }, [load]);
  const resolve = async (id, remove) => {
    setBusy(id);
    const r = await mobFetch('/api/mob/reports', { method: 'POST', body: { id, remove } });
    setBusy(null);
    if (!r.ok) setState((s) => ({ ...s, error: r.message })); else load();
  };
  if (state.status === 'hidden' || state.status === 'loading') return null;
  return (
    <section className="glass mob-card mb-6" aria-labelledby="mob-reports-h">
      <header className="mob-head">
        <h2 id="mob-reports-h" className="mob-h2">Mob reports</h2>
        <span className="mob-count">{state.reports.length} open</span>
      </header>
      {state.status === 'error' ? <p className="mob-notice" role="alert">{state.error}</p> : null}
      {state.status === 'ready' && !state.reports.length ? <p className="mob-note">No open Mob reports.</p> : null}
      {state.reports.length ? (
        <ul className="mob-members">
          {state.reports.map((r) => (
            <li key={r.id} className="mob-member">
              <span className="mob-member__name"><b>{r.name || 'Name not kept'}</b><span>{REASONS[r.reason] || r.reason}, {istDateTime(r.createdAt)}</span></span>
              <span className="mob-actions mob-actions--row">
                {r.canRemove ? <button type="button" className="mob-key mob-key--bad" disabled={busy === r.id} onClick={() => resolve(r.id, true)}>Remove from Mob</button> : null}
                <button type="button" className="mob-key" disabled={busy === r.id} onClick={() => resolve(r.id, false)}>Close</button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {state.error && state.status === 'ready' ? <p className="mob-notice" role="status">{state.error}</p> : null}
    </section>
  );
}

export default MobReports;
