"use client";
// Weak chapters on Today (TODAY-1018 section 3 row 5 and 6.5; owner D18: the weak chapters are the useful part). The top
// three chapters by marks open (PrepOS insights, the student's own server-scored papers), each with Practise. A row opens
// in place to its own mistakes: the stems load on the first open (GET /api/attempts/{id}, at most 2 papers, cached for
// the visit) into two lines of reserved height. Each mistake shows its paper and time and the whole question (never cut
// short), and one action in the words every screen uses (release 7, owner D15; data/repair_presentation.mjs actionLabel):
// Repair while it is open, Check it held once it is repaired and the check on a new question is not taken, See repair once it
// is checked, Try it again for a blank (F17: a repaired mistake is never sold again). "All {n} in Review" opens Review on the
// chapter.
import { useState } from 'react';
import Link from 'next/link';
import { Plus, Play } from 'lucide-react';
import { TEST_MODES } from '@/../data/test_modes';
import { mistakeAction } from '@/lib/today/mistakeAction.mjs';
import { clockIn } from '@/lib/today/week.mjs';
import { paperDay } from '@/lib/today/move.mjs';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const when = (at) => {
  const t = Number(at);
  if (!Number.isFinite(t)) return '';
  return `${WEEKDAYS[new Date(t + 19800000).getUTCDay()]} ${paperDay(t)}, ${clockIn(t)}`;
};
const practiseHref = (c) => `/dashboard?${new URLSearchParams({ subject: c.subject, chapter: c.chapter, mode: 'quick' })}`;

function paperTitle(attempt, subjectName) {
  const mode = TEST_MODES[attempt?.mode]?.label || 'Practice';
  const kind = mode === 'NTA mode' ? 'NTA mock' : mode;
  return `${attempt?.subject ? `${subjectName(attempt.subject)} ` : ''}${kind.charAt(0).toLowerCase()}${kind.slice(1)}`;
}

function Mistakes({ chapter, state, repairRows, subjectName }) {
  if (state?.status !== 'ready') {
    if (state?.status === 'error') return <p className="twk__note">These questions did not load. Review still has them.</p>;
    return <div className="twk__wait" aria-hidden="true"><span /><span /></div>;
  }
  const rowOf = (m) => (repairRows || []).find((r) => r?.attemptId === m.attemptId && r?.questionId === m.qid) || null;
  const items = chapter.recent.map((m) => {
    const attempt = state.attempts[m.attemptId];
    if (!attempt) return null;
    const q = (attempt.questionsSnapshot || []).find((x) => x.id === m.qid);
    const stem = String(q?.question ?? q?.body ?? '').trim();
    return { ...m, stem, paper: paperTitle(attempt, subjectName), act: mistakeAction(m, attempt, rowOf(m)) };
  }).filter(Boolean);
  if (!items.length) return <p className="twk__note">These questions are in Review.</p>;
  return (
    <ul className="twk__list">
      {items.map((k) => (
        <li key={`${k.attemptId}-${k.qid}`} className="twk__mk">
          <div>
            <span className="twk__meta">Q{k.position}, {k.paper}, {when(k.completedAt)}</span>
            {k.stem ? <p className="twk__stem">{k.stem}</p> : null}
          </div>
          <Link className="twk__act" href={`/result/${encodeURIComponent(k.attemptId)}?q=${k.position}`} aria-label={`${k.act.label} Q${k.position}, ${k.paper}${k.act.state ? `. ${k.act.state}.` : ''}`}>
            {k.act.label}{k.act.state ? <span className="twk__state" data-state={k.act.state.toLowerCase()}>{k.act.state}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** `insights`: the page's useInsights state. `loadAttempt(id)`: the cached paper read. `repairRows`: repair-record rows. */
export default function TodayWeak({ insights, loadAttempt, repairRows = null, subjectName = (id) => id, hold = false }) {
  const [open, setOpen] = useState({});
  const [stems, setStems] = useState({});
  const [retry, setRetry] = useState(null); // a second read after the first failed: { status, insights }

  const view = retry?.status === 'ready' || retry?.status === 'empty' ? retry : insights;
  const ranked = view.status === 'ready' ? (view.insights?.chapters?.ranked || []).slice(0, 3) : [];

  const toggle = (c) => {
    const next = !open[c.key];
    setOpen((o) => ({ ...o, [c.key]: next }));
    if (!next || stems[c.key]) return;
    const ids = [...new Set((c.recent || []).map((m) => m.attemptId))].slice(0, 2);
    if (!ids.length) { setStems((s) => ({ ...s, [c.key]: { status: 'ready', attempts: {} } })); return; }
    setStems((s) => ({ ...s, [c.key]: { status: 'loading' } }));
    Promise.all(ids.map((id) => loadAttempt(id).then((a) => [id, a])))
      .then((pairs) => setStems((s) => ({ ...s, [c.key]: { status: 'ready', attempts: Object.fromEntries(pairs) } })))
      .catch(() => setStems((s) => ({ ...s, [c.key]: { status: 'error' } })));
  };
  const again = () => {
    setRetry({ status: 'loading' });
    fetch('/api/prepos/insights', { cache: 'no-store' })
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!ok || !b?.insights) throw new Error('unavailable');
        setRetry({ status: b.insights.state === 'ready' ? 'ready' : 'empty', insights: b.insights });
      })
      .catch(() => setRetry({ status: 'unavailable' }));
  };

  const head = <header className="tg__row"><h2 id="twk-h" className="tg__h">Weak chapters</h2></header>;
  if (hold || view.status === 'loading') {
    return (
      <section className="twk twk--wait" aria-labelledby="twk-h" aria-busy="true">
        {head}
        <p className="twk__sub"><span className="twk__skl" /></p>
        <ul className="twk__rows" aria-hidden="true">{[0, 1, 2].map((i) => <li key={i}><span className="twk__row"><span className="twk__skl" /><span className="twk__skf" /></span></li>)}</ul>
      </section>
    );
  }
  if (view.status === 'unavailable') {
    return (
      <section className="twk" aria-labelledby="twk-h">
        {head}
        <p className="twk__empty" role="status">Your weak chapters did not load. <button type="button" className="tm__inline" onClick={again}>Try again</button></p>
      </section>
    );
  }
  if (!ranked.length) {
    return (
      <section className="twk" aria-labelledby="twk-h">
        {head}
        <p className="twk__empty">{view.status === 'empty' ? 'After your first paper, the three chapters costing you the most marks show here, each with Practise and its mistakes.' : 'No chapter has enough answers to rank yet. After a few more questions in a chapter, it shows here with its mistakes.'}</p>
      </section>
    );
  }
  const n = view.insights.sessions;
  return (
    <section className="twk" aria-labelledby="twk-h">
      {head}
      <p className="twk__sub">Where your marks go, from your last {n} {n === 1 ? 'paper' : 'papers'}</p>
      <ul className="twk__rows">
        {ranked.map((c) => {
          const missed = c.wrong + c.skip;
          const isOpen = Boolean(open[c.key]);
          const id = `twk-${c.key.replace(/[^a-zA-Z0-9]/g, '-')}`;
          return (
            <li key={c.key} data-open={isOpen || undefined}>
              <div className="twk__row">
                <button type="button" className="twk__open" aria-expanded={isOpen} aria-controls={id} onClick={() => toggle(c)}>
                  <Plus className="twk__plus" size={18} strokeWidth={1.75} aria-hidden="true" />
                  <span className="twk__t"><b>{c.chapter}</b><span>{c.subjectName || subjectName(c.subject)}, {missed} of {c.n} missed</span></span>
                  <span className="twk__fig"><b>{c.open}</b><span>marks</span></span>
                </button>
                <Link className="tm__pill twk__practise" href={practiseHref(c)} aria-label={`Practise ${c.chapter}`}><Play size={15} strokeWidth={1.75} aria-hidden="true" />Practise</Link>
              </div>
              <div className="twk__more" id={id} data-open={isOpen || undefined}>
                <div>
                  {isOpen || stems[c.key] ? <Mistakes chapter={c} state={stems[c.key]} repairRows={repairRows} subjectName={subjectName} /> : null}
                  <p className="twk__all"><Link className="tm__inline" href={`/review?${new URLSearchParams({ chapter: c.chapter, subject: c.subject })}`}>All {missed} in Review</Link></p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
