"use client";
// Repairs and Ask Mobi on Practice (owner D5, 18 Oct dawn: "no one will be able to see it ever; the placement is really
// bad"). One ruled line under the subject shelf, about the subject the shelf has chosen, so it changes with the shelf:
//   - the questions from that subject's sessions still waiting for a repair, with the way into Review where they are
//     repaired (the count is Review's own: missed or blank, minus the ones that already hold a saved repair, F17);
//   - the repairs already saved, with the way back to the newest one (a saved repair reopens free on its result);
//   - Ask Mobi, the page's one entry to it (ASK-MOBI-1018, D5): "Ask Mobi what to practise" opens the panel already about
//     Practice, with the record's weakest chapter, and the line under it says what the record shows there.
// Counts come from the attempts the page already holds and GET /api/me/repair-record; until that answers, the line says
// it is checking (never a number that then changes), and a failed read says so instead of claiming nothing is saved.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, Wrench } from 'lucide-react';
import { apiGet } from '@/lib/fetcher';
import AskMobiLink from '@/components/ai/AskMobiLink';
import { ENTRY_LABELS, practiceContext, practicePreview } from '@/components/ai/askContexts.mjs';
import { useInsights } from '@/components/ai/useInsights';
import { plural, repairsFor, sessionsWord } from './repairsLine.mjs';

export default function PracticeRepairs({ userId, attempts, subjectId, subjectName }) {
  const [record, setRecord] = useState({ state: 'loading', rows: null });
  const [nonce, setNonce] = useState(0);
  const { insights } = useInsights(userId || null);

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    apiGet('/api/me/repair-record?limit=100')
      .then((body) => { if (alive) setRecord({ state: 'ready', rows: Array.isArray(body?.repairs) ? body.repairs : [] }); })
      .catch(() => { if (alive) setRecord({ state: 'error', rows: null }); });
    return () => { alive = false; };
  }, [userId, nonce]);

  const facts = useMemo(() => repairsFor({ attempts, repairs: record.rows, subjectId }), [attempts, record.rows, subjectId]);
  if (!subjectId) return null;
  const name = subjectName || 'this subject';
  // What the record says about the weakest chapter, with its denominator; left out when the record has none.
  const preview = practicePreview(insights);
  const askLine = preview ? `${preview}.` : `About ${name} or how to practise it.`;

  let title; let detail; let primary = null;
  if (record.state === 'loading') {
    title = `Checking your ${name} mistakes`;
    detail = 'Repairs you saved are being read.';
  } else if (!facts.sessions) {
    title = `No ${name} sessions yet`;
    detail = 'After a session, every question you miss waits here to be repaired.';
  } else if (record.state === 'error') {
    title = `${plural(facts.open, 'question')} missed in ${name}`;
    detail = 'Your saved repairs did not load, so some of these may already be repaired.';
    primary = { href: '/review', label: 'Review and repair' };
  } else if (facts.open) {
    title = `${plural(facts.open, 'question')} to repair in ${name}`;
    detail = `From ${sessionsWord(facts.sessions)}${facts.openElsewhere ? `, and ${facts.openElsewhere} more in other subjects` : ''}.`;
    primary = { href: '/review', label: 'Review and repair' };
  } else {
    title = facts.saved ? `Every ${name} miss is repaired` : `Nothing to repair in ${name}`;
    detail = facts.saved ? 'Each one holds a saved repair you can reopen for free.' : `Every answer in ${sessionsWord(facts.sessions)} was right.`;
    if (facts.openElsewhere) {
      detail += ` ${plural(facts.openElsewhere, 'question')} still ${facts.openElsewhere === 1 ? 'waits' : 'wait'} in other subjects.`;
      primary = { href: '/review', label: 'Review and repair' };
    }
  }

  return (
    <div className="pr-fix" role="group" aria-label={`Repairs and Ask Mobi for ${name}`} data-state={record.state}>
      <div className="pr-fix__text" key={`${subjectId}-${record.state}`} aria-live="polite">
        <p className="pr-fix__title"><Wrench size={16} strokeWidth={2.2} aria-hidden="true" /><span>{title}</span></p>
        <p className="pr-fix__detail">
          {detail}
          {record.state === 'ready' && facts.saved > 0 && facts.revisit ? (
            <> <Link className="pr-fix__revisit" href={`/result/${encodeURIComponent(facts.revisit.attemptId)}`}>{plural(facts.saved, 'saved repair')} to revisit</Link></>
          ) : null}
          {record.state === 'error' ? <> <button type="button" className="pr-fix__retry" onClick={() => { setRecord({ state: 'loading', rows: null }); setNonce((n) => n + 1); }}>Check again</button></> : null}
        </p>
      </div>
      <div className="pr-fix__acts">
        {primary ? <Link className="pr-fix__go" href={primary.href}>{primary.label}</Link> : null}
        <AskMobiLink context={practiceContext(insights)} variant="plain" className="pr-fix__ask" aria-describedby="pr-fix-ask-line">
          <MessageCircle size={16} strokeWidth={2.2} aria-hidden="true" />{ENTRY_LABELS.practice}
        </AskMobiLink>
      </div>
      <p className="pr-fix__fine" id="pr-fix-ask-line">{askLine} Opening Mobi is free; a written reply costs 1 AI credit.</p>
    </div>
  );
}
